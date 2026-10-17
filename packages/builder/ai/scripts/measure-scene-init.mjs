import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Offline CPU/payload measurement. Middleware mode binds no listener and calls no provider.
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  logLevel: 'error',
});

try {
  const { completeReadyScene } = await server.ssrLoadModule('/src/agent/scene-initializer.ts');
  const { readyScenes } = await server.ssrLoadModule('/src/agent/scene-ready.ts');
  const { validatePagePlan } = await server.ssrLoadModule(
    '/src/agent/page-plan/validate-page-plan.ts',
  );
  const checked = validatePagePlan({
    intent: 'replace',
    locale: { lang: 'en' },
    title: 'Studio',
    description: 'Independent studio',
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'emerald-800',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Archivo Black' },
      fontBody: { family: 'Archivo' },
      radius: 'md',
      signature: 'Generative art with a readable copy panel',
    },
    primaryCta: { label: 'Start a project', href: '#contact' },
    sections: [
      {
        key: 'hero',
        role: 'hero',
        title: 'Made for your next idea',
        anchorId: 'hero',
        purpose: 'A ready mural behind the studio name.',
        mustSay: ['Independent design studio'],
      },
      {
        key: 'contact',
        role: 'cta',
        title: 'Say hello',
        anchorId: 'contact',
        purpose: 'Contact the studio.',
      },
    ],
  });
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  const page = checked.plan;
  const section = page.sections[0];
  const declared = ['tree', 'css', 'js', 'jsMeta', 'jsParams'];
  const samples = [];
  const payloads = [];
  let compactChars = 0;
  let expandedChars = 0;
  for (const preset of readyScenes()) {
    const compact = {
      rationale: 'Ready mural',
      commands: [
        {
          command: 'setProp',
          args: { id: 'hero-region', key: 'js', value: `@preset:${preset.id}` },
        },
      ],
    };
    const initialize = () => completeReadyScene(page, section, 'hero-region', compact, declared);
    for (let warmup = 0; warmup < 5; warmup += 1) initialize();
    for (let run = 0; run < 50; run += 1) {
      const start = performance.now();
      initialize();
      samples.push(performance.now() - start);
    }
    const small = JSON.stringify(compact).length;
    const full = JSON.stringify(initialize()).length;
    compactChars += small;
    expandedChars += full;
    payloads.push({ preset: preset.id, compactChars: small, expandedChars: full });
  }
  samples.sort((a, b) => a - b);
  const percentile = (value) =>
    Number(samples[Math.min(samples.length - 1, Math.floor(samples.length * value))].toFixed(3));
  process.stdout.write(
    JSON.stringify(
      {
        measurement: 'offline scene initialization; no model or network calls',
        node: process.version,
        presets: payloads.length,
        initializationRuns: samples.length,
        initializationMs: { p50: percentile(0.5), p95: percentile(0.95) },
        outputChars: {
          compact: compactChars,
          expanded: expandedChars,
          reductionPercent: Number((100 * (1 - compactChars / expandedChars)).toFixed(2)),
        },
        payloads,
        limitations:
          'Measures local initialization CPU and exact JSON characters. Provider tokens, latency, bills and visual quality are not measured.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await server.close();
}
