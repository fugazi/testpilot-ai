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
 * Validate a set of code files using the TypeScript Compiler API.
 *
 * This performs both syntax and type checking and returns diagnostics grouped by file.
 * @param files - Array of code files to validate
 * @returns Array of ValidationResult containing errors per file
 */
export function validateTypeScriptFiles(files: CodeFile[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const tsFiles = files.filter(f => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx'));
  if (tsFiles.length === 0) return results;

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
    return originalGetSourceFile.call(host, fileName, languageVersion, onError);
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

  // If there are global diagnostics (no file), attach them to the first file as a fallback
  const global = byFile.get('__global') || [];
  if (global.length && results.length) {
    results[0].errors = results[0].errors.concat(global);
  }

  return results;
}
