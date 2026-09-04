import { describe, it, expect } from 'vitest';
import { extractFilesFromMarkdown, parseAgentResponse } from './mdParser';

const md = '# Report\n\n**File: tests/sample.spec.ts**\n```typescript\nexport const x = 1;\n```\n\n**File: pages/Home.page.ts**\n```typescript\nexport class HomePage {}\n```\n';

describe('mdParser', () => {
  it('extracts files', () => {
    const files = extractFilesFromMarkdown(md);
    expect(files.length).toBe(2);
    expect(files[0].filename).toBe('tests/sample.spec.ts');
  });

  it('accepts a ### heading only when it looks like a file path', () => {
    const headingFile = '### pages/login.page.ts\n```typescript\nexport class LoginPage {}\n```';
    expect(extractFilesFromMarkdown(headingFile).map(f => f.filename)).toEqual(['pages/login.page.ts']);
  });

  it('does not treat prose headings followed by code as files', () => {
    const prose = '## Strategy\n\n### Test Strategy\n```typescript\nconst example = 1;\n```';
    expect(extractFilesFromMarkdown(prose)).toEqual([]);
  });

  it('detects javascript and json languages by extension', () => {
    const mixed = '**File: run.js**\n```javascript\nconsole.log(1);\n```\n\n**File: data.json**\n```json\n{"a":1}\n```';
    const files = extractFilesFromMarkdown(mixed);
    expect(files.map(f => f.language)).toEqual(['javascript', 'json']);
  });
});

describe('parseAgentResponse', () => {
  it('returns progress lines, files and a summary without them', () => {
    const input = '```PROGRESS\nStep 1: Crawling...\nStep 2: Analyzing...\n```\n\n# Analysis\n\nShort analysis text.\n\n**File: tests/home.spec.ts**\n```typescript\nexport const t = 1;\n```\n';
    const result = parseAgentResponse(input);

    expect(result.progress).toEqual(['Step 1: Crawling...', 'Step 2: Analyzing...']);
    expect(result.files).toEqual([
      { filename: 'tests/home.spec.ts', language: 'typescript', content: 'export const t = 1;' },
    ]);
    expect(result.summary).toContain('Short analysis text.');
    expect(result.summary).not.toContain('export const t = 1;');
    expect(result.summary).not.toContain('PROGRESS');
  });

  it('falls back to the first generic code block when no file markers exist', () => {
    const input = '# Strategy\n\n```typescript\nimport test from \'@playwright/test\';\n```\n';
    const result = parseAgentResponse(input);
    expect(result.files.length).toBe(1);
    expect(result.files[0].filename).toBe('generated.spec.ts');
    expect(result.summary).not.toContain('@playwright/test');
  });

  it('keeps prose code examples in the summary when real files exist', () => {
    const input = '# Strategy\n\n**File: tests/home.spec.ts**\n```typescript\nexport const t = 1;\n```\n\n### Smoke scenarios\n```typescript\nconst example = 1;\n```\n';
    const result = parseAgentResponse(input);
    expect(result.files.map(f => f.filename)).toEqual(['tests/home.spec.ts']);
    expect(result.summary).toContain('const example = 1;');
  });

  it('handles an empty response', () => {
    const result = parseAgentResponse('');
    expect(result).toEqual({ summary: '', files: [], progress: [] });
  });
});
