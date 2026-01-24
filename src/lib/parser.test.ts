import { describe, it, expect } from 'vitest';
import { parseHtml } from './parser';

// We will use local HTML string to avoid network dependency
const sampleHtml = `<!doctype html><html><head><title>Test Site</title><meta name="description" content="A test site"></head><body><nav><a href="/home">Home</a><a href="/about">About</a></nav><form action="/search"><input name="q" type="search" /></form></body></html>`;

describe('parser.parseHtml', () => {
  it('parses basic fields from html string', () => {
    const info = parseHtml(sampleHtml, 'https://example.com');
    expect(info.title).toBe('Test Site');
    expect(info.description).toBe('A test site');
    expect(info.links.length).toBe(2);
    expect(info.links[0]).toMatch(/^https?:\/\/example.com/);
    expect(info.forms.length).toBe(1);
    expect(typeof info.isDynamic).toBe('boolean');
  });

  it('detects dynamic pages heuristically', () => {
    const dynamicHtml = `<!doctype html><html><head><title></title></head><body><script src="/app.js"></script><script>window.__NEXT_DATA__ = {}</script></body></html>`;
    const info = parseHtml(dynamicHtml, 'https://example.com');
    expect(info.isDynamic).toBe(true);
  });
});