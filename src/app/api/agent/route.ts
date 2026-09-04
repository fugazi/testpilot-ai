import { NextRequest, NextResponse } from 'next/server';
import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 1. CONFIGURACIÓN DEL AGENTE
// Importante: Aumentamos el tiempo máximo de ejecución a 60 segundos
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 2. CARGA DEL PROMPT (archivo Markdown cacheado)
let QA_SYSTEM_PROMPT_CACHE: string | null = null;

async function loadPrompt(): Promise<string> {
  if (QA_SYSTEM_PROMPT_CACHE) return QA_SYSTEM_PROMPT_CACHE;
  const p = path.join(process.cwd(), 'src', 'app', 'api', 'agent', 'prompts', 'qa-system-prompt.md');
  QA_SYSTEM_PROMPT_CACHE = await readFile(p, 'utf8');
  return QA_SYSTEM_PROMPT_CACHE;
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

export async function POST(req: NextRequest) {
  // Crear cliente para poder limpiarlo en caso de error
  // Para desarrollo local, esto funciona directamente si tienes el CLI de Copilot instalado
  // Con pnpm el SDK no encuentra el paquete de plataforma; le pasamos la ruta resuelta.
  const cliPath = await resolveCopilotCliPath();
  if (cliPath && !process.env.COPILOT_CLI_PATH) {
    process.env.COPILOT_CLI_PATH = cliPath;
    console.log(`🔧 Runtime de Copilot: ${cliPath}`);
  }
  const client = new CopilotClient();

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only http/https URLs are allowed');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    console.log(`🤖 Iniciando agente para: ${url}`);

    // Use the parser module to fetch and extract page info
    // This moves complex parsing out of this file and avoids mixing API logic with extraction logic.
    const { fetchAndParse } = await import('@/lib/parser');

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

    // Include dynamic detection in context summary
    // Metrics: increment isDynamic scan counter so we can decide later whether to enable MCP
    if (pageInfo.isDynamic) {
      try {
        const { incrementMetric, getMetrics } = await import('@/lib/metrics');
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
    const nvidiaBaseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
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
    console.log(`✅ Sesión creada: ${session.sessionId} (modelo: ${nvidiaApiKey ? nvidiaModel : 'gpt-4.1'})`);

    // 5. ENVIAR MENSAJE Y ESPERAR RESPUESTA
    const userPrompt = `Analyze this URL and generate the test suite. Use the CONTEXT below and produce: a short analysis, a TEST STRATEGY in markdown, 3 SMOKE TEST scenarios, and generate Page Object Model files and Playwright specs in code blocks using the exact output format defined above.\n\nCONTEXT:\n${contextSummary}\n\nPlease emit PROGRESS lines and **File:** blocks as specified in the OUTPUT FORMAT.`;

    // Los modelos de reasoning (p.ej. Nemotron en NVIDIA NIM) pueden tardar
    // varios minutos en generar la suite completa; el default del SDK es 60s.
    const agentTimeoutMs = Number(process.env.AGENT_TIMEOUT_MS) || 480000;
    const response = await session.sendAndWait({ prompt: userPrompt }, agentTimeoutMs);

    console.log('✅ Análisis completado.');

    const markdown = response?.data.content || 'No response received';

    console.log('📝 Mensaje generado por Copilot.');

    // Extract PROGRESS block if present
    const progressMatch = markdown.match(/```PROGRESS\n([\s\S]*?)```/i);
    const progressLines = progressMatch ? progressMatch[1].split('\n').map(l=>l.trim()).filter(Boolean) : [];

    // Parse generated files and validate TypeScript (basic syntax check)
    const { extractFilesFromMarkdown } = await import('@/lib/mdParser');
    const { validateTypeScriptFiles } = await import('@/lib/validator');

    const generatedFiles = extractFilesFromMarkdown(markdown);
    const validation = validateTypeScriptFiles(generatedFiles);

    // 6. LIMPIAR RECURSOS
    // En SDK >= 1.0.11 la sesión se destruye vía el cliente (deleteSession)
    await client.deleteSession(session.sessionId);
    await client.stop();

    // 7. RESPUESTA
    return NextResponse.json({ 
      success: true, 
      data: markdown,
      progress: progressLines,
      validation,
      context: { title: pageInfo.title, description: pageInfo.description, linksCount: links.length, formsCount: forms.length, isDynamic: pageInfo.isDynamic },
      stats: {
        generatedFilesCount: generatedFiles.length,
      }
    });

  } catch (error: unknown) {
    console.error('❌ Error ejecutando el agente Copilot:', error);

    // Intentar limpiar el cliente en caso de error
    try {
      await client.stop();
    } catch {
      // Ignorar errores al detener
    }

    // Manejo especial de errores
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || 'Error interno del agente' },
      { status: 500 }
    );
  }
}