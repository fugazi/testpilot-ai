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
});