import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from './route';

const makeCtx = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) });

function makeRequest(path: string, init?: RequestInit) {
  return new NextRequest(`http://localhost/api/provider-proxy/${path}`, init as ConstructorParameters<typeof NextRequest>[1]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NVIDIA_API_KEY;
  vi.restoreAllMocks();
});

describe('provider-proxy', () => {
  it('forwards allowed paths and strips non-standard params', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (_target: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const req = makeRequest('chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [], temperature: 0.5, snippy: true }),
    });

    const res = await POST(req, makeCtx(['chat', 'completions']) as never);

    expect(res.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    const forwarded = JSON.parse(String(init?.body));
    expect(forwarded.model).toBe('m');
    expect(forwarded.temperature).toBe(0.5);
    expect('snippy' in forwarded).toBe(false);
  });

  it('rejects calls without the exact expected bearer token', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = makeRequest('chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer someone-elses-key' },
      body: '{}',
    });

    const res = await POST(req, makeCtx(['chat', 'completions']) as never);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = makeRequest('chat/completions', { method: 'POST', body: '{}' });
    const res = await POST(req, makeCtx(['chat', 'completions']) as never);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for endpoints outside the allowlist', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = makeRequest('anything/else', {
      method: 'POST',
      headers: { authorization: 'Bearer test-key' },
      body: '{}',
    });

    const res = await POST(req, makeCtx(['anything', 'else']) as never);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards GET /models without a body', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (_target: RequestInfo | URL, _init?: RequestInit) =>
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const req = makeRequest('models', {
      method: 'GET',
      headers: { authorization: 'Bearer test-key' },
    });

    const res = await GET(req, makeCtx(['models']) as never);
    expect(res.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe('https://integrate.api.nvidia.com/v1/models');
    expect(init?.body).toBeUndefined();
  });
});
