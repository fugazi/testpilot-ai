import { describe, it, expect } from 'vitest';
import { extractFilesFromMarkdown } from './mdParser';

const md = '# Report\n\n**File: tests/sample.spec.ts**\n```typescript\nexport const x = 1;\n```\n\n**File: pages/Home.page.ts**\n```typescript\nexport class HomePage {}\n```\n';

describe('mdParser', () => {
  it('extracts files', () => {
    const files = extractFilesFromMarkdown(md);
    expect(files.length).toBe(2);
    expect(files[0].filename).toBe('tests/sample.spec.ts');
  });
});