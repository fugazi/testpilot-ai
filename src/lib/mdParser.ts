/**
 * Represents a code file extracted from markdown code blocks.
 * @property filename - Path or name of the file
 * @property language - Language hint (typescript, javascript, json)
 * @property content - File contents
 */
export interface CodeFile { filename: string; language: string; content: string }

/**
 * Extract file blocks from a Markdown string. Supports common code fences and file markers.
 * @param markdown - Markdown content to parse
 * @returns Array of CodeFile objects
 */
export function extractFilesFromMarkdown(markdown: string): CodeFile[] {
  const files: CodeFile[] = [];

  const fileRegex = /(?:\*\*File:\s*|File:\s*|###\s*)([\w./-]+)(?:\*\*|\n)\s*```(?:typescript|javascript|json|ts)?\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(markdown)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    let language = 'typescript';
    if (filename.endsWith('.json')) language = 'json';
    if (filename.endsWith('.js')) language = 'javascript';
    files.push({ filename, language, content });
  }

  return files;
}
