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
 * Cache of TypeScript lib SourceFiles (everything not in the virtual map).
 * They are identical for the process lifetime, and re-parsing the whole
 * lib.es*.d.ts chain on every request was the dominant cost.
 */
const libSourceCache = new Map<string, ts.SourceFile>();

/**
 * Validate a set of code files using the TypeScript Compiler API.
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

  const compilerOptions: ts.CompilerOptions = {
    strict: true,
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

  const rootNames = Array.from(fileMap.keys());
  const program = ts.createProgram(rootNames, compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

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
