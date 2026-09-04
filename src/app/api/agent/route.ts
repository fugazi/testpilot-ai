import { NextRequest, NextResponse } from 'next/server';
import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fetchAndParse, assertPublicHttpUrl } from '@/lib/parser';
import { incrementMetric, getMetrics } from '@/lib/metrics';
import { parseAgentResponse } from '@/lib/mdParser';
import { validateTypeScriptFiles } from '@/lib/validator';
import { checkRateLimit } from '@/lib/rateLimit';

// 1. CONFIGURACIÓN DEL AGENTE
// Los modelos de reasoning (p.ej. Nemotron en NVIDIA NIM) pueden tardar
// varios minutos; 300s es el techo de la plataforma y el timeout del
// agente se deja 30s por debajo para dar margen a la limpieza.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DEFAULT_AGENT_TIMEOUT_MS = 270_000;

/** Timeout del agente, acotado a maxDuration - 30s para poder limpiar. */
function resolveAgentTimeoutMs(): number {
  const raw = Number(process.env.AGENT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_AGENT_TIMEOUT_MS;
  return Math.min(raw, (maxDuration - 30) * 1000);
}

// 2. CARGA DEL PROMPT (archivo Markdown cacheado por promesa)
let promptPromise: Promise<string> | null = null;

function loadPrompt(): Promise<string> {
  promptPromise ??= readFile(
    path.join(process.cwd(), 'src', 'app', 'api', 'agent', 'prompts', 'qa-system-prompt.md'),
    'utf8',
  );
  return promptPromise;
}

/**
 * Resuelve la ruta del runtime de Copilot (binario de la plataforma).
 * El SDK hace require.resolve del paquete de plataforma, pero con pnpm
 * (node_modules aislado) no lo encuentra. Respetamos COPILOT_CLI_PATH y
 * luego intentamos layouts npm/yarn y pnpm.
 */
async function resolveCopilotCliPath(): Promise<string | undefined> {
  if (process.env.COPILOT_CLI_PATH) return process.env.COPILOT_CLI_PATH;

  const platformPkg = `@github/copilot-${process.platform}-${process.arch}`;
  const binaryName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';

  // Layout npm: el paquete de plataforma queda hoisteado en node_modules raíz
  const npmPath = path.join(process.cwd(), 'node_modules', platformPkg, binaryName);
  if (existsSync(npmPath)) return npmPath;

  // Layout pnpm: node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>/<binario>
  try {
    const copilotPkgPath = path.join(process.cwd(), 'node_modules', '@github', 'copilot', 'package.json');
    const version = (JSON.parse(await readFile(copilotPkgPath, 'utf8')) as { version: string }).version;
    const pnpmPath = path.join(
      process.cwd(), 'node_modules', '.pnpm',
      `${platformPkg.replace('/', '+')}@${version}`,
      'node_modules', platformPkg, binaryName,
    );
    if (existsSync(pnpmPath)) return pnpmPath;
  } catch { /* no instalado localmente */ }

  return undefined;
}

/** Resuelve y fija COPILOT_CLI_PATH una sola vez por proceso. */
let copilotCliResolved = false;
async function ensureCopilotCliPath(): Promise<void> {
  if (copilotCliResolved) return;
  copilotCliResolved = true;
  const cliPath = await resolveCopilotCliPath();
  if (cliPath && !process.env.COPILOT_CLI_PATH) {
    process.env.COPILOT_CLI_PATH = cliPath;
    console.log(`🔧 Runtime de Copilot: ${cliPath}`);
  }
}

export async function POST(req: NextRequest) {
  // Rate limit por IP antes de gastar una sesión de LLM
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rate = checkRateLimit(`agent:${clientIp}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please retry later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  let client: CopilotClient | null = null;
  let sessionId: string | undefined;

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validación de URL (formato + objetivo público) antes de tocar la red
    // o iniciar una sesión de LLM. Rechaza SSRF contra redes internas.
    try {
      await assertPublicHttpUrl(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    console.log(`🤖 Iniciando agente para: ${url}`);

    await ensureCopilotCliPath();
    client = new CopilotClient();

    // Fetch a sample page to provide context
    let pageInfo;
    try {
      pageInfo = await fetchAndParse(url);
    } catch (e) {
      pageInfo = { status: 0, html: '', title: undefined, description: undefined, links: [], forms: [], isDynamic: false };
      console.warn('⚠️ Could not fetch page for context:', e);
    }

    const links = pageInfo.html ? pageInfo.links : [];
    const forms = pageInfo.html ? pageInfo.forms : [];

    // Metrics: increment isDynamic scan counter so we can decide later whether to enable MCP
    if (pageInfo.isDynamic) {
      try {
        incrementMetric('isDynamicScans');
        const metrics = getMetrics();
        console.log(`📊 metrics.isDynamicScans = ${metrics.isDynamicScans || 0}`);
      } catch (e) {
        console.warn('⚠️ Could not update metrics:', e);
      }
    }

    // 3. INICIAR EL CLIENTE
    await client.start();
    console.log('✅ Cliente Copilot iniciado');

    // Build a small context summary to include in the prompt
    const contextSummary = `
URL: ${url}
Status: ${pageInfo.status}${pageInfo.isDynamic ? ' (dynamic detected)' : ''}
Title: ${pageInfo.title || 'N/A'}
Description: ${pageInfo.description || 'N/A'}
Internal links (first ${Math.min(links.length, 10)}):\n${links.slice(0, 10).map(l => `- ${l}`).join('\n') || '- none'}
Forms found: ${forms.length}
${forms.slice(0,5).map((f, i) => `Form ${i+1}: inputs=${JSON.stringify(f.inputs.map((it)=>({name:it.name,type:it.type})))}`).join('\n')}
`;

    // 4. CREAR SESIÓN CON SYSTEM MESSAGE
    // Modelo GPT-4.1 por defecto. Si existe NVIDIA_API_KEY, se usa BYOK
    // (Bring Your Own Key) contra NVIDIA NIM, una API compatible con OpenAI.
    const prompt = await loadPrompt();

    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    const nvidiaModel = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';

    // El runtime de Copilot envía parámetros propietarios (p.ej. "snippy") que
    // NVIDIA rechaza con 400; enrutamos el proveedor por nuestro proxy
    // limpiador (/api/provider-proxy), que reenvía a NVIDIA_BASE_URL.
    const providerBaseUrl = new URL('/api/provider-proxy', process.env.APP_ORIGIN || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : req.nextUrl.origin)).toString();

    const session = await client.createSession({
      model: nvidiaApiKey ? nvidiaModel : 'gpt-4.1',
      streaming: false,
      onPermissionRequest: approveAll,
      systemMessage: {
        mode: 'replace',
        content: prompt,
      },
      ...(nvidiaApiKey
        ? {
            provider: {
              type: 'openai' as const,
              baseUrl: providerBaseUrl,
              apiKey: nvidiaApiKey,
              modelId: nvidiaModel,
            },
          }
        : {}),
    });
    sessionId = session.sessionId;
    console.log(`✅ Sesión creada: ${sessionId} (modelo: ${nvidiaApiKey ? nvidiaModel : 'gpt-4.1'})`);

    // 5. ENVIAR MENSAJE Y ESPERAR RESPUESTA
    const userPrompt = `Analyze this URL and generate the test suite. Use the CONTEXT below and produce: a short analysis, a TEST STRATEGY in markdown, 3 SMOKE TEST scenarios, and generate Page Object Model files and Playwright specs in code blocks using the exact output format defined above.\n\nCONTEXT:\n${contextSummary}\n\nPlease emit PROGRESS lines and **File:** blocks as specified in the OUTPUT FORMAT.`;

    const response = await session.sendAndWait({ prompt: userPrompt }, resolveAgentTimeoutMs());

    console.log('✅ Análisis completado.');

    const markdown = response?.data?.content || '';
    if (!markdown.trim()) {
      return NextResponse.json(
        { error: 'The agent returned no content. Try again or use a different URL.' },
        { status: 502 },
      );
    }

    console.log('📝 Mensaje generado por Copilot.');

    // Parse generated files (single parser shared with the client) and validate
    const parsed = parseAgentResponse(markdown);
    const validation = validateTypeScriptFiles(parsed.files);

    // 7. RESPUESTA
    return NextResponse.json({
      success: true,
      data: markdown,
      summary: parsed.summary,
      files: parsed.files,
      progress: parsed.progress,
      validation,
      context: { title: pageInfo.title, description: pageInfo.description, linksCount: links.length, formsCount: forms.length, isDynamic: pageInfo.isDynamic },
      stats: {
        generatedFilesCount: parsed.files.length,
      }
    });

  } catch (error: unknown) {
    console.error('❌ Error ejecutando el agente Copilot:', error);

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || 'Error interno del agente' },
      { status: 500 }
    );
  } finally {
    // 6. LIMPIAR RECURSOS (happy path y error): sesión primero, luego cliente
    if (client) {
      try {
        if (sessionId) await client.deleteSession(sessionId);
      } catch { /* la sesión puede ya no existir */ }
      try {
        await client.stop();
      } catch { /* Ignorar errores al detener */ }
    }
  }
}
