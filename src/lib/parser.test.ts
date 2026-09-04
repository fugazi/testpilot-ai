import { describe, it, expect } from 'vitest';
import { parseHtml, isPrivateIp, assertPublicHttpUrl } from './parser';

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

  it('caps the number of links at maxLinks', () => {
    const manyLinks = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');
    const info = parseHtml(`<html><body>${manyLinks}</body></html>`, 'https://example.com', 10);
    expect(info.links.length).toBe(10);
  });

  it('extracts form inputs with name and type', () => {
    const info = parseHtml(sampleHtml, 'https://example.com');
    expect(info.forms[0].inputs).toEqual([{ tag: 'input', name: 'q', type: 'search' }]);
  });
});

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '172.31.255.255',
    '169.254.169.254', '0.0.0.0', '100.64.0.1',
  ])('blocks private IPv4 %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34'])('allows public IPv4 %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });

  it.each(['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1', '[::ffff:127.0.0.1]'])('blocks private IPv6 %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it('allows public IPv6', () => {
    expect(isPrivateIp('2606:4700::1111')).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  it.each([
    'http://127.0.0.1:3000',
    'http://10.0.0.5/admin',
    'http://192.168.0.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://[::ffff:10.0.0.1]/',
  ])('rejects private target %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(/private|Invalid/);
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)'])('rejects protocol %s', async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow();
  });

  it('rejects malformed URLs', async () => {
    await expect(assertPublicHttpUrl('not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('accepts public http/https URLs with IP literals (no DNS)', async () => {
    await expect(assertPublicHttpUrl('https://8.8.8.8/')).resolves.toBeInstanceOf(URL);
  });
});