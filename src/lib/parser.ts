// Using native fetch (Node.js 18+) to avoid url.parse() deprecation warning from node-fetch v2
import * as cheerio from 'cheerio';

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
  const anchors = new Set<string>();
  $('a[href]').each((i, el) => {
    try {
      const href = $(el).attr('href')?.trim();
      if (!href) return;
      const resolved = new URL(href, baseUrl).toString();
      if (new URL(resolved).origin === new URL(baseUrl).origin) {
        if (anchors.size < maxLinks) anchors.add(resolved);
      }
    } catch {
      // ignore
    }
  });

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
 * @param url - URL to fetch
 * @param maxLinks - Maximum number of links to collect
 * @returns Parsed PageInfo
 */
export async function fetchAndParse(url: string, maxLinks = 30): Promise<PageInfo> {
  const res = await fetch(url, { 
    headers: { 'User-Agent': 'TestPilotAI/1.0 (+https://github.com)' }
  });
  const status = res.status;
  const html = await res.text();

  const parsed = parseHtml(html, url, maxLinks);
  parsed.status = status;
  return parsed;
}
