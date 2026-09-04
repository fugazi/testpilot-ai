import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy "limpiador" para BYOK (Bring Your Own Key).
 *
 * El runtime de Copilot envía parámetros propietarios (p.ej. `snippy`) en el
 * body de /chat/completions. Las APIs OpenAI-compatibles estrictas como
 * NVIDIA NIM los rechazan con 400. Esta ruta elimina esos parámetros y
 * reenvía la petición al proveedor real (NVIDIA_BASE_URL).
 */

// Parámetros propietarios del runtime de Copilot no presentes en la spec
// de OpenAI Chat Completions.
const NON_STANDARD_PARAMS = ['snippy'];

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  try {
    const { path: segments } = await ctx.params;
    const upstreamBase = (
      process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
    ).replace(/\/$/, '');
    const target = `${upstreamBase}/${segments.join('/')}`;

    let body: unknown;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json();
      } catch {
        body = undefined;
      }
    }
    if (body && typeof body === 'object') {
      for (const key of NON_STANDARD_PARAMS) {
        delete (body as Record<string, unknown>)[key];
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
