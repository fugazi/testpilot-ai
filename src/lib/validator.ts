import ts from 'typescript';
import type { CodeFile } from './mdParser';
import path from 'path';

/**
 * Validation result for a single file produced by the TypeScript checker.
 * @property filename - Original filename
 * @property errors - Diagnostic messages for the file
 */
export interface ValidationResult { filename: string; errors: string[] }

/**
 * Cap on validated files per call: tsc runs inline in the request, so a
 * runaway generation cannot pin the event loop for too long.
 */
const MAX_FILES_PER_CALL = 20;

/**
 * Bare specifier: a package import, as opposed to a relative (`./x`) or
 * absolute (`/x`) one. This is the distinction that separates a dependency we
 * cannot load from a file the agent was supposed to generate.
 */
const BARE_SPECIFIER = /^[^./]/;

/** "Cannot find module 'X' or its corresponding type declarations." */
const CANNOT_FIND_MODULE = 2307;

/**
 * Compiler hint emitted when a Node global is used but `@types/node` is not
 * installed. The generated artifacts run in Node under Playwright, so seeing
 * it always means the sandbox lacks the types, never that the code is wrong.
 */
const MISSING_NODE_TYPES_HINT = 'Do you need to install type definitions for node?';

/**
 * Does this diagnostic describe the sandbox rather than the generated code?
 *
 * The validator compiles against an in-memory filesystem with no
 * `node_modules` and no `@types/node`. Generated Playwright suites legitimately
 * import packages that only exist in the target project and touch Node globals,
 * so without this filter every valid file is flagged and the reported
 * validation rate collapses to 0%.
 *
 * Only the two environment gaps are dropped. Relative imports are deliberately
 * kept: they point at files the agent was asked to generate, so a dangling one
 * is a genuine finding.
 */
function isEnvironmentNoise(diagnostic: ts.Diagnostic): boolean {
  if (
    diagnostic.code === CANNOT_FIND_MODULE
    && diagnostic.file
    && diagnostic.start !== undefined
    && diagnostic.length !== undefined
  ) {
    // The span of a "cannot find module" diagnostic covers the specifier,
    // quotes included.
    const specifier = diagnostic.file.text
      .slice(diagnostic.start, diagnostic.start + diagnostic.length)
      .replace(/^['"]|['"]$/g, '');
    return BARE_SPECIFIER.test(specifier);
  }

  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  return message.includes(MISSING_NODE_TYPES_HINT);
}

/**
 * Directories that exist in the virtual filesystem.
 *
 * The module resolver checks `directoryExists` before it probes any file, and
 * `createCompilerHost` answers that from the real disk — where `/virtual` does
 * not exist. Without this override the resolver bailed out immediately and
 * every relative import between generated files was reported as missing, even
 * when the imported file was right there in the map.
 */
function buildVirtualDirectories(fileMap: Map<string, string>): Set<string> {
  const directories = new Set<string>();
  for (const fileName of fileMap.keys()) {
    let dir = path.posix.dirname(fileName);
    while (dir !== '/' && dir !== '.' && !directories.has(dir)) {
      directories.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  return directories;
}

/**
 * Cache of TypeScript lib SourceFiles (everything not in the virtual map).
 * They are identical for the process lifetime, and re-parsing the whole
 * lib.es*.d.ts chain on every request was the dominant cost.
 */
const libSourceCache = new Map<string, ts.SourceFile>();

/**
 * Validate a set of code files using the TypeScript Compiler API.
 *
 * Diagnostics that only describe the sandbox (unresolved package imports,
 * Node globals without `@types/node`) are dropped; see
 * {@link isEnvironmentNoise}.
 *
 * This performs both syntax and type checking and returns diagnostics grouped by file.
 * @param files - Array of code files to validate
 * @returns Array of ValidationResult containing errors per file
 */
export function validateTypeScriptFiles(files: CodeFile[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const allTsFiles = files.filter(f => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx'));
  if (allTsFiles.length === 0) return results;

  const tsFiles = allTsFiles.slice(0, MAX_FILES_PER_CALL);

  // Create a virtual file map with stable absolute-like paths
  const fileMap = new Map<string, string>();
  tsFiles.forEach(f => {
    const name = path.posix.join('/virtual', f.filename.replace(/\\\\/g, '/'));
    fileMap.set(name, f.content);
  });

  const virtualDirectories = buildVirtualDirectories(fileMap);

  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    // Packages we cannot resolve are typed `any`, so callbacks they receive
    // have no contextual type either (Playwright's `async ({ page }) => ...`
    // is the usual case). Implicit-`any` would then flag every fixture in
    // every generated spec — a false positive we cannot avoid without the real
    // types — so it is the one strictness rule we drop.
    noImplicitAny: false,
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    esModuleInterop: true,
    skipLibCheck: true,
    allowJs: false,
  };

  const host = ts.createCompilerHost(compilerOptions);

  // Override file accessors to read from our virtual map
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, languageVersion, onError) => {
    if (fileMap.has(fileName)) {
      return ts.createSourceFile(fileName, fileMap.get(fileName)!, languageVersion, true);
    }
    const cached = libSourceCache.get(fileName);
    if (cached) return cached;
    const source = originalGetSourceFile.call(host, fileName, languageVersion, onError);
    if (source) libSourceCache.set(fileName, source);
    return source;
  };

  const originalFileExists = host.fileExists;
  host.fileExists = (fileName) => {
    if (fileMap.has(fileName)) return true;
    return typeof originalFileExists === 'function' ? originalFileExists.call(host, fileName) : false;
  };

  const originalReadFile = host.readFile;
  host.readFile = (fileName) => {
    if (fileMap.has(fileName)) return fileMap.get(fileName);
    return typeof originalReadFile === 'function' ? originalReadFile.call(host, fileName) : undefined;
  };

  // Module resolution consults the directory layout before probing for files,
  // so the virtual tree has to answer these three too.
  const originalDirectoryExists = host.directoryExists;
  host.directoryExists = (dirName) => {
    if (virtualDirectories.has(dirName)) return true;
    return typeof originalDirectoryExists === 'function'
      ? originalDirectoryExists.call(host, dirName)
      : false;
  };

  const originalGetDirectories = host.getDirectories;
  host.getDirectories = (dirName) => {
    if (virtualDirectories.has(dirName)) {
      return [...virtualDirectories]
        .filter(dir => path.posix.dirname(dir) === dirName)
        .map(dir => path.posix.basename(dir));
    }
    return typeof originalGetDirectories === 'function'
      ? originalGetDirectories.call(host, dirName)
      : [];
  };

  // Keep virtual paths verbatim: canonicalizing them against the real disk
  // would break the identity between a generated file and its import.
  const originalRealpath = host.realpath;
  host.realpath = (fileName) => {
    if (fileMap.has(fileName) || virtualDirectories.has(fileName)) return fileName;
    return typeof originalRealpath === 'function' ? originalRealpath.call(host, fileName) : fileName;
  };

  const rootNames = Array.from(fileMap.keys());
  const program = ts.createProgram(rootNames, compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !isEnvironmentNoise(d));

  // Group messages per file where possible
  const byFile = new Map<string, string[]>();
  diagnostics.forEach(d => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (d.file) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start || 0);
      const fileName = d.file.fileName;
      const text = `${path.basename(fileName)} (${line+1},${character+1}): ${message}`;
      byFile.set(fileName, (byFile.get(fileName) || []).concat(text));
    } else {
      byFile.set('__global', (byFile.get('__global') || []).concat(message));
    }
  });

  // Map results back to requested filenames
  tsFiles.forEach(f => {
    const virtualName = path.posix.join('/virtual', f.filename.replace(/\\\\/g, '/'));
    const errors = byFile.get(virtualName) || [];
    results.push({ filename: f.filename, errors });
  });

  // Files beyond the per-call cap are reported as skipped, not silently ignored
  allTsFiles.slice(MAX_FILES_PER_CALL).forEach(f => {
    results.push({ filename: f.filename, errors: ['Validation skipped: too many files in one generation (limit 20)'] });
  });

  // If there are global diagnostics (no file), attach them to the first file as a fallback
  const global = byFile.get('__global') || [];
  if (global.length && results.length) {
    results[0].errors = results[0].errors.concat(global);
  }

  return results;
}
