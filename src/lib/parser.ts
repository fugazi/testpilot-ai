// Using native fetch (Node.js 18+) to avoid url.parse() deprecation warning from node-fetch v2
import * as cheerio from 'cheerio';
import { lookup } from 'dns/promises';

/** Represents a single form control in a parsed form */
export interface FormInput { tag: string; name?: string; type?: string }

/** Represents a parsed form with its inputs and raw HTML (truncated) */
export interface Form { inputs: FormInput[]; raw: string }

/**
 * Parsed page information extracted from HTML.
 * @property status - HTTP response status
 * @property html - Raw HTML content
 * @property title - Document title (if any)
 * @property description - Meta description (if any)
 * @property links - Same-origin links found on the page
 * @property forms - Parsed forms
 * @property isDynamic - Heuristic flag for dynamic/SPAs
 */
export interface PageInfo {
  status: number;
  html: string;
  title?: string;
  description?: string;
  links: string[];
  forms: Form[];
  isDynamic: boolean; // heuristics
} 

// --- SSRF protection -------------------------------------------------------
// Limits applied when fetching user-supplied URLs.
const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 5;

/**
 * Returns true when the IP belongs to a non-public range
 * (loopback, private networks, link-local, CGNAT).
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes('.') && !ip.includes(':')) {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some(o => Number.isNaN(o))) return true;
    const [a, b] = octets;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
      (a === 169 && b === 254) ||           // link-local (cloud metadata)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  // IPv6 (including IPv4-mapped, which URL normalizes to hex: ::ffff:a00:1)
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isPrivateIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return (
    normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') || // ULA fc00::/7
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb')   // link-local fe80::/10
  );
}

/**
 * Validate that a URL is a public http(s) endpoint safe to fetch server-side.
 * Blocks loopback/private/link-local targets (SSRF) before any request is made.
 * Note: DNS-rebinding (public name repointed after resolution) is out of scope.
 * @throws Error when the URL is invalid or points to a non-public host
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  // IP literals are checked directly; hostnames are resolved and all
  // resulting addresses must be public.
  if (hostname.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('URL points to a private address');
    return parsed;
  }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some(r => isPrivateIp(r.address))) {
      throw new Error('URL resolves to a private address');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('private')) throw e;
    throw new Error('Could not resolve host');
  }
  return parsed;
}

/**
 * Read a response body as text, stopping at `maxBytes` (truncates, never throws).
 */
async function readBodyWithLimit(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/**
 * Fetch following redirects manually so every hop is validated against
 * private addresses (a public URL redirecting to an internal host is SSRF).
 */
async function fetchWithSsrfGuard(url: URL): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      headers: { 'User-Agent': 'TestPilotAI/1.0 (+https://github.com)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) {
        throw new Error(`Too many redirects or missing location (status ${res.status})`);
      }
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

/**
 * Parse HTML and extract page metadata, links and forms.
 * @param html - Raw HTML of the page
 * @param baseUrl - Base URL used to resolve relative links
 * @param maxLinks - Maximum number of links to return
 * @returns PageInfo with parsed data
 */
export function parseHtml(html: string, baseUrl: string, maxLinks = 30): PageInfo {
  // Load with cheerio for powerful selectors
  const $ = cheerio.load(html);

  const title = ($('title').text() || undefined)?.trim();

  // meta description (look for name=description or property=og:description)
  const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || undefined;
  const description = metaDesc ? metaDesc.trim() : undefined;

  // Links (only same origin)
  let baseOrigin: string | null = null;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    baseOrigin = null;
  }
  const anchors = new Set<string>();
  if (baseOrigin) {
    $('a[href]').each((i, el) => {
      try {
        const href = $(el).attr('href')?.trim();
        if (!href) return;
        const resolved = new URL(href, baseUrl).toString();
        if (new URL(resolved).origin === baseOrigin) {
          if (anchors.size < maxLinks) anchors.add(resolved);
        }
      } catch {
        // ignore
      }
    });
  }

  // Forms
  const forms: Form[] = [];
  $('form').each((i, f) => {
    const formHtml = $(f).html() || '';
    const inputs: FormInput[] = [];
    $(f).find('input, select, textarea, button').each((j, inp) => {
      const tag = inp.tagName.toLowerCase();
      const name = $(inp).attr('name') || undefined;
      const type = $(inp).attr('type') || (tag === 'button' ? 'button' : undefined);
      inputs.push({ tag, name, type });
    });
    forms.push({ inputs, raw: formHtml.slice(0, 500) });
  });

  // Heuristics to detect dynamic/SPAs (simple and fast)
  const scriptsCount = $('script').length;
  const hasNextData = !!html.match(/__NEXT_DATA__|next-data|"@next\//i);
  const minimalContent = !title && $('body').text().trim().length < 50;
  const isDynamic = hasNextData || scriptsCount > 6 || minimalContent;

  return {
    status: 200,
    html,
    title,
    description,
    links: Array.from(anchors),
    forms,
    isDynamic,
  };
}

/**
 * Fetch a URL and return parsed page information.
 * The URL is validated against SSRF (private/loopback targets) and the
 * response is bounded by a timeout and a max body size.
 * @param url - URL to fetch (must be a public http/https endpoint)
 * @param maxLinks - Maximum number of links to collect
 * @returns Parsed PageInfo
 * @throws Error for private targets, HTTP >= 400, timeouts or fetch failures
 */
export async function fetchAndParse(url: string, maxLinks = 30): Promise<PageInfo> {
  const target = await assertPublicHttpUrl(url);
  const res = await fetchWithSsrfGuard(target);
  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}`);
  }
  const status = res.status;
  const html = await readBodyWithLimit(res, MAX_HTML_BYTES);

  const parsed = parseHtml(html, target.toString(), maxLinks);
  parsed.status = status;
  return parsed;
}
