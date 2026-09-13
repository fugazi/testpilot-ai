import { describe, it, expect } from 'vitest';
import { validateTypeScriptFiles } from './validator';

import type { CodeFile } from './mdParser';

const good: CodeFile[] = [{ filename: 'good.ts', language: 'typescript', content: 'export const x: number = 1;' }];
const badSyntax: CodeFile[] = [{ filename: 'bad.ts', language: 'typescript', content: 'export const x: number = ;' }];
const badType: CodeFile[] = [{ filename: 'badtype.ts', language: 'typescript', content: 'export const y: string = 1;' }];

describe('validator', () => {
  it('validates good files', () => {
    const r = validateTypeScriptFiles(good);
    expect(r.length).toBe(1);
    expect(r[0].errors.length).toBe(0);
  });

  it('detects syntax errors in bad files', () => {
    const r = validateTypeScriptFiles(badSyntax);
    expect(r.length).toBe(1);
    expect(r[0].errors.length).toBeGreaterThan(0);
  });

  it('detects type errors in badType files', () => {
    const r = validateTypeScriptFiles(badType);
    expect(r.length).toBe(1);
    expect(r[0].errors.length).toBeGreaterThan(0);
    // The message should reference 'Type' or 'Type' mismatch
    expect(r[0].errors.join('\n')).toMatch(/Type 'number'|Type '1'|Type 'string'|is not assignable/);
  });

  it('skips validation with a note beyond the per-call file cap', () => {
    const many: CodeFile[] = Array.from({ length: 25 }, (_, i) => ({
      filename: `f${i}.ts`,
      language: 'typescript',
      content: 'export const a = 1;',
    }));
    const r = validateTypeScriptFiles(many);
    expect(r.length).toBe(25);
    expect(r[19].errors.length).toBe(0);
    expect(r[20].errors.join('\n')).toMatch(/skipped/);
  });

  it('is safe to call repeatedly (cached libs)', () => {
    const first = validateTypeScriptFiles(good);
    const second = validateTypeScriptFiles(good);
    expect(second).toEqual(first);
  });
});

describe('validator external imports', () => {
  const playwrightConfig: CodeFile[] = [{
    filename: 'playwright.config.ts',
    language: 'typescript',
    content: `import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

export default defineConfig({
  testDir: './tests',
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: process.env.BASE_URL ?? 'https://example.com' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
`,
  }];

  const playwrightSpec: CodeFile[] = [{
    filename: 'tests/example.spec.ts',
    language: 'typescript',
    content: `import { test, expect } from '@playwright/test';

test('works', async ({ page }) => {
  await page.goto('https://example.com');
  expect(1).toBe(1);
});
`,
  }];

  it('does not report packages that only exist in the target project', () => {
    const r = validateTypeScriptFiles(playwrightConfig);
    expect(r[0].errors).toEqual([]);
  });

  it('does not report Node globals or fixture callbacks of a package', () => {
    const r = validateTypeScriptFiles(playwrightSpec);
    expect(r[0].errors).toEqual([]);
  });

  it('accepts an external import used in type position', () => {
    const page: CodeFile[] = [{
      filename: 'pages/home.page.ts',
      language: 'typescript',
      content: `import type { Page, Locator } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  get heading(): Locator {
    return this.page.locator('h1');
  }
}
`,
    }];
    const r = validateTypeScriptFiles(page);
    expect(r[0].errors).toEqual([]);
  });

  it('still reports a relative import the agent did not generate', () => {
    const dangling: CodeFile[] = [{
      filename: 'tests/dangling.spec.ts',
      language: 'typescript',
      content: `import { helper } from '../pages/forgotten.page';

export const value = helper;
`,
    }];
    const r = validateTypeScriptFiles(dangling);
    expect(r[0].errors.join('\n')).toMatch(/forgotten\.page/);
  });

  it('resolves a relative import between generated files', () => {
    const suite: CodeFile[] = [
      {
        filename: 'pages/login.page.ts',
        language: 'typescript',
        content: `export class LoginPage {
  constructor(private readonly id: string) {}

  async goto(): Promise<void> {
    await Promise.resolve(this.id);
  }
}
`,
      },
      {
        filename: 'tests/login.spec.ts',
        language: 'typescript',
        content: `import { LoginPage } from '../pages/login.page';

export const loginPage = new LoginPage('form');
`,
      },
    ];
    const r = validateTypeScriptFiles(suite);
    expect(r[0].errors).toEqual([]);
    expect(r[1].errors).toEqual([]);
  });

  it('still reports a type error in a file that imports a package', () => {
    const mismatch: CodeFile[] = [{
      filename: 'tests/mismatch.spec.ts',
      language: 'typescript',
      content: `import { test } from '@playwright/test';

const count: number = 'not a number';

test('x', async () => count);
`,
    }];
    const r = validateTypeScriptFiles(mismatch);
    expect(r[0].errors.join('\n')).toMatch(/not assignable/);
  });

  it('reports a file with no external imports unchanged', () => {
    const plain: CodeFile[] = [{
      filename: 'pages/plain.page.ts',
      language: 'typescript',
      content: 'export class PlainPage { constructor(private readonly name: string) {} }',
    }];
    const r = validateTypeScriptFiles(plain);
    expect(r[0].errors).toEqual([]);
  });
});