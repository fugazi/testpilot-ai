/**
 * Represents a code file extracted from markdown code blocks.
 * @property filename - Path or name of the file
 * @property language - Language hint (typescript, javascript, json)
 * @property content - File contents
 */
export interface CodeFile { filename: string; language: string; content: string }

/** Structured result of parsing a full agent response. */
export interface ParsedAgentResponse {
  /** Markdown minus PROGRESS blocks and extracted file blocks */
  summary: string;
  files: CodeFile[];
  /** Lines inside ```PROGRESS blocks, if any */
  progress: string[];
}

/**
 * Code fence preceded by a file marker. Markers: `**File: name**`,
 * `File: name` or a `### heading`. Headings are only treated as files
 * when they look like a path (have an extension), so prose headings
 * followed by example code are not mistaken for generated files.
 */
const FILE_BLOCK_REGEX = /(?:\*\*File:\s*|File:\s*|###\s)([\w./-]+)\s*(?:\*\*)?\s*\n+```(?:typescript|ts|tsx|javascript|js|json)?\s*\n([\s\S]*?)```/gi;

const PROGRESS_BLOCK_REGEX = /```PROGRESS\n([\s\S]*?)```/gi;

const LOOKS_LIKE_FILE = /\.[A-Za-z0-9]{1,5}$/;

interface FileBlockMatch {
  filename: string;
  language: string;
  content: string;
  /** Position of the whole match in the source markdown */
  start: number;
  end: number;
}

function inferLanguage(filename: string): string {
  if (filename.endsWith('.json')) return 'json';
  if (/\.(js|mjs|cjs)$/.test(filename)) return 'javascript';
  return 'typescript';
}

/**
 * Find all file blocks in markdown, skipping `### heading` markers that
 * do not look like file paths.
 */
function matchFileBlocks(markdown: string): FileBlockMatch[] {
  const blocks: FileBlockMatch[] = [];
  FILE_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_BLOCK_REGEX.exec(markdown)) !== null) {
    const filename = match[1].trim();
    const isHeadingMarker = match[0].startsWith('###');
    if (isHeadingMarker && !LOOKS_LIKE_FILE.test(filename)) continue;
    blocks.push({
      filename,
      language: inferLanguage(filename),
      content: match[2].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return blocks;
}

/**
 * Extract file blocks from a Markdown string. Supports common code fences and file markers.
 * @param markdown - Markdown content to parse
 * @returns Array of CodeFile objects
 */
export function extractFilesFromMarkdown(markdown: string): CodeFile[] {
  return matchFileBlocks(markdown).map(({ filename, language, content }) => ({
    filename,
    language,
    content,
  }));
}

/**
 * Parse a full agent response into summary, files and progress lines.
 * This is the single parser used by both the API route and the client,
 * so the extraction rules cannot drift between backend and frontend.
 * @param markdown - Raw agent output
 */
export function parseAgentResponse(markdown: string): ParsedAgentResponse {
  // Progress lines
  const progress: string[] = [];
  PROGRESS_BLOCK_REGEX.lastIndex = 0;
  let progressMatch: RegExpExecArray | null;
  while ((progressMatch = PROGRESS_BLOCK_REGEX.exec(markdown)) !== null) {
    progress.push(...progressMatch[1].split('\n').map(l => l.trim()).filter(Boolean));
  }

  const withoutProgress = markdown.replace(PROGRESS_BLOCK_REGEX, '').trim();

  const blocks = matchFileBlocks(withoutProgress);
  const files: CodeFile[] = blocks.map(({ filename, language, content }) => ({
    filename,
    language,
    content,
  }));

  // Strip extracted blocks (back to front keeps offsets valid)
  let summary = withoutProgress;
  for (let i = blocks.length - 1; i >= 0; i--) {
    summary = summary.slice(0, blocks[i].start) + summary.slice(blocks[i].end);
  }

  // Fallback: no file markers, take the first generic TS block as a spec
  if (files.length === 0) {
    const genericCode = withoutProgress.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
    if (genericCode && genericCode[1].trim()) {
      files.push({
        filename: 'generated.spec.ts',
        language: 'typescript',
        content: genericCode[1].trim(),
      });
      summary = summary.replace(genericCode[0], '');
    }
  }

  return { summary: summary.trim(), files, progress };
}
