import { chromium, type Browser, type Route } from 'playwright';

import type { CompiledPageArtifact, ExportPage } from '@craftkit/builder/code-runtime';
import { buildManagedCatalog, compileProject } from '@craftkit/builder/code-runtime/compiler';

import type { RuntimeWorkerPayload, RuntimeWorkerResult } from './runtime-workers';

interface RunMessage {
  readonly type: 'run';
  readonly taskId: string;
  readonly payload: RuntimeWorkerPayload;
}

interface CancelMessage {
  readonly type: 'cancel';
  readonly taskId: string;
}

const controllers = new Map<string, AbortController>();
let browser: Browser | undefined;

function send(message: unknown): void {
  process.send?.(message);
}

function isRunMessage(message: unknown): message is RunMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>)['type'] === 'run' &&
    typeof (message as Record<string, unknown>)['taskId'] === 'string'
  );
}

function isCancelMessage(message: unknown): message is CancelMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>)['type'] === 'cancel' &&
    typeof (message as Record<string, unknown>)['taskId'] === 'string'
  );
}

async function prerender(
  pageInput: ExportPage,
  artifact: CompiledPageArtifact,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    javaScriptEnabled: true,
    serviceWorkers: 'block',
  });
  try {
    await context.route('**/*', (route: Route) => route.abort('blockedbyclient'));
    const page = await context.newPage();
    const failures: string[] = [];
    page.on('pageerror', (error: Error) => failures.push(error.message));
    await page.setContent(
      '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    );
    for (const style of artifact.css) await page.addStyleTag({ content: style.content });
    for (const script of artifact.js) {
      signal.throwIfAborted();
      await page.addScriptTag({ content: script.content, type: 'module' });
    }
    await page.waitForFunction(
      "document.getElementById('root') && (document.getElementById('root').childElementCount > 0 || document.getElementById('root').textContent.trim() !== '')",
      undefined,
      { timeout: 3_000 },
    );
    signal.throwIfAborted();
    if (failures.length > 0) {
      throw new Error(`Authored page failed in browser: ${failures[0] ?? 'unknown error'}`);
    }
    const root = page.locator('#root');
    const html = await root.innerHTML();
    const text = await root.textContent();
    const semanticElements = await root.locator('main,article,section,img,svg').count();
    const rendered = {
      html,
      hasPrimaryContent: text?.trim() !== '' || semanticElements > 0,
      renderMode: 'client' as const,
    };
    if (!pageInput.noIndex && !rendered.hasPrimaryContent) {
      throw new Error(`Page ${pageInput.pageId} rendered no primary content.`);
    }
    return rendered;
  } finally {
    await context.close();
    await browser.close();
    browser = undefined;
  }
}

async function execute(
  payload: RuntimeWorkerPayload,
  signal: AbortSignal,
): Promise<RuntimeWorkerResult> {
  if (payload.kind === 'compile') {
    const catalog = await buildManagedCatalog();
    const result = await compileProject(payload.snapshot, { catalog, signal });
    signal.throwIfAborted();
    if (!result.ok) throw new Error(result.diagnostics[0]?.message ?? 'Compilation failed.');
    return {
      kind: 'compile',
      artifact: result.artifact,
      sourceElements: result.artifact.sourceElements,
      cacheHit: result.cacheHit,
    };
  }
  return {
    kind: 'prerender',
    result: await prerender(payload.page, payload.artifact, signal),
  };
}

process.on('message', (message: unknown) => {
  if (isCancelMessage(message)) {
    controllers.get(message.taskId)?.abort(new Error('Runtime task cancelled.'));
    void browser?.close();
    return;
  }
  if (!isRunMessage(message)) return;
  const controller = new AbortController();
  controllers.set(message.taskId, controller);
  void execute(message.payload, controller.signal)
    .then((result) => {
      if (!controller.signal.aborted) {
        send({ type: 'result', taskId: message.taskId, result });
      }
    })
    .catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        send({
          type: 'error',
          taskId: message.taskId,
          message:
            cause instanceof Error ? cause.message.slice(0, 4_000) : 'Runtime worker failed.',
        });
      }
    })
    .finally(() => {
      controllers.delete(message.taskId);
    });
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    for (const controller of controllers.values()) controller.abort();
    void browser?.close().finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 500).unref();
  });
}
