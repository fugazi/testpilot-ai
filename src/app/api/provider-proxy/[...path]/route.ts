import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// The proxy holds a streaming LLM connection for as long as the agent runs,
// so it needs the same headroom as /api/agent.
export const maxDuration = 300;

/**
 * Proxy "limpiador" para BYOK (Bring Your Own Key).
 *
 * El runtime de Copilot envía parámetros propietarios (p.ej. `snippy`) en el
 * body de /chat/completions. Las APIs OpenAI-compatibles estrictas como
 * NVIDIA NIM los rechazan con 400. Esta ruta elimina esos parámetros y
 * reenvía la petición al proveedor real (NVIDIA_BASE_URL).
 *
 * Hardening: solo acepta los endpoints que usa el runtime y solo acepta
 * llamadas autenticadas con la propia NVIDIA_API_KEY del servidor (el token
 * que el route handler pasa a la sesión de Copilot). Sin esa coincidencia
 * el proxy no puede usarse como relay abierto hacia el proveedor.
 */

// Endpoints del runtime de Copilot que necesitan pasar por el proxy.
const ALLOWED_PATHS: Array<string[]> = [
  ['chat', 'completions'],
  ['models'],
];

// Allowlist de parámetros de la spec de OpenAI Chat Completions.
// Cualquier parámetro propietario futuro del runtime se descarta aquí,
// en lugar de perseguirlos uno a uno con una denylist.
const ALLOWED_BODY_PARAMS = new Set([
  'model', 'messages', 'input',
  'temperature', 'top_p', 'n', 'stream', 'stream_options',
  'stop', 'max_tokens', 'max_completion_tokens',
  'presence_penalty', 'frequency_penalty', 'logit_bias',
  'logprobs', 'top_logprobs', 'seed',
  'response_format', 'tools', 'tool_choice', 'parallel_tool_calls',
  'user', 'functions', 'function_call', 'metadata',
]);

function isAllowedPath(segments: string[]): boolean {
  return ALLOWED_PATHS.some(allowed =>
    allowed.every((seg, i) => segments[i] === seg),
  );
}

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  try {
    const { path: segments } = await ctx.params;

    if (!isAllowedPath(segments)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // El único llamador legítimo es nuestro propio runtime de Copilot, que
    // envía el Bearer token que /api/agent le pasó (la NVIDIA_API_KEY real).
    const expectedToken = process.env.NVIDIA_API_KEY;
    const auth = req.headers.get('authorization') || '';
    if (!expectedToken || auth !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upstreamBase = (
      process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
    ).replace(/\/$/, '');
    const target = `${upstreamBase}/${segments.join('/')}${req.nextUrl.search}`;

    let body: Record<string, unknown> | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const parsed: unknown = await req.json();
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Conservar solo parámetros estándar
          body = {};
          for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (ALLOWED_BODY_PARAMS.has(key)) body[key] = value;
          }
        }
      } catch {
        body = undefined;
      }
    }

    const headers = new Headers();
    for (const header of ['authorization', 'content-type', 'accept']) {
      const value = req.headers.get(header);
      if (value) headers.set(header, value);
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error: unknown) {
    console.error('Error en provider-proxy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 },
    );
  }
}

export const POST = handler;
export const GET = handler;
