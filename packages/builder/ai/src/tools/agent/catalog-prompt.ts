import { CUSTOM_CODE_SCENES, CUSTOM_CODE_TIMELINE_RECIPES, ELEMENT_RECIPE_IDS, GALLERY_LAYOUTS } from '@craftkit/builder-schema';

import { DATA_SHOW_AS } from '../../data-tools/data-show';
import { scenePresetMenu } from './builtin/scene-preset';
import { agentToolsForLane } from './registry';
import { AGENT_TOOL_COMMAND, type AgentTool, type AgentToolLane } from './types';

/**
 * The tools a lane may name, as the prompt lists them: one compact line each
 * (`<name> <signature> — <summary>`) and one example step. Each lane has a
 * bounded character cap below. When
 * the lines would not fit, summaries go first, then signatures, so every
 * tool stays nameable.
 */

export const AGENT_TOOL_PROMPT_MAX_CHARS = 900;

// media-motion (2026-10-06): per-lane caps. The edit lane lists ~30 tools (style tools, media.add,
// motion.add); at 900 characters every one degrades to a bare name and media.add loses its kinds.
// red-tests (2026-10-06): edit 1400 → 1600, measured. The five part.* lines take 182 characters at
// their signatures; under 1400 they pushed fonts.set, image.set, kit.section and palette.set down to
// bare names (all four had signatures before), and those are inputs a model cannot guess (`subject`,
// `heading?:'h1'|'h2'`, a verified family), so a bare name costs a refusal and a repair round. The
// lane is part of the frozen, cached system[0]: +200 characters is ~50 cached tokens per edit.
// data (2026-10-12): +150 in build and edit, measured: data.show keeps its signature and data line.
// data (2026-10-12, charts and reports): build 1050 → 1270, edit 2050 → 2290, measured (1,269 and
// 2,286): report.build's signature and data line (~185 characters) and seven more chart types in
// data.show's `as` (+49), with every other tool keeping the shape it had (edit also absorbs the
// `data-table` preset, +11). Below these, report.build drops out of the build lane entirely and
// kit.section, fonts.set and image.set lose their signatures in edit.
// i18n (2026-10-12): edit 2290 → 2460, measured (2,458): page.translate's signature and its texts
// line (+171); below this palette.set or page.translate falls back to a bare name.
// creative-power F (2026-10-12): edit 2460 → 3250 and section 1200 → 1976, measured (3,247 and
// 1,973): scene.preset's signature and its preset line (the 30 ids by category, +789); every other
// tool keeps the shape it had. Not in build: +789 does not fit its 1,270 (a 62% rise for one tool).
// T230b (2026-10-12): edit 3250 → 3294, measured: nav.pages at its signature (+47). At 3,250 it
// pushed kit.section and image.set down to bare names; every other tool keeps the shape it had.
export const AGENT_TOOL_PROMPT_LANE_MAX_CHARS: Readonly<Record<AgentToolLane, number>> = {
  build: 1_270,
  // Eight shared presets add a bounded capability line; retain usable tool signatures.
  section: 1_976,
  edit: 3_294,
  seo: AGENT_TOOL_PROMPT_MAX_CHARS,
};

/** The most characters a lane's tool prompt may take. */
export function agentToolPromptMaxChars(lane: AgentToolLane): number {
  return AGENT_TOOL_PROMPT_LANE_MAX_CHARS[lane];
}

const HEADER = `TOOLS — a step {"command":"${AGENT_TOOL_COMMAND}","args":{"name","input"}} is expanded to kernel steps for you; prefer it to rewriting markup:`;

const EXAMPLES: Readonly<Record<string, unknown>> = {
  'kit.section': { id: 'r-hero', kit: 'hero-split-media', slots: { title: '…' } },
  'copy.set': { edits: [{ find: 'Old words', text: 'New words' }] },
  'theme.apply': { accent: 'emerald-700' },
  'seo.fix': {},
  'nav.sync': {},
  // media-motion (2026-10-06)
  'media.add': { kind: 'gallery', layout: 'masonry', images: 'catalog:restaurant' },
  'motion.add': { id: 'r-hero', find: 'Heading text', recipe: 'split-reveal' },
  // ── block-parts (2026-10-06): the parts of registered blocks (DESIGN §2.12) ──
  'part.text': { id: 'hero-1', part: 'heading', text: 'New words' },
  'part.style': { id: 'hero-1', part: 'heading', style: { textColor: 'accent', fontSize: '5xl' } },
  'part.link': { id: 'cta-1', part: 'button', text: 'Book now', href: '/contact' },
  'part.image': { id: 'content-1', part: 'image', src: 'https://…', alt: 'What it shows' },
  'part.list': { id: 'features-1', part: 'item', op: 'add', index: 3 },
  // ── /block-parts ──
};

// media-motion (2026-10-06): one line of fields per tool whose signature cannot hold them (DESIGN §F.1).
const DETAILS: Readonly<Record<string, string>> = {
  'element.insert': `element.insert preset:${ELEMENT_RECIPE_IDS.join('|')} content:{title?,text?,value?,label?,href?,items?:[{title,text?}]}; markup OR preset`,
  'media.add': `media.add kinds: gallery{layout?:${GALLERY_LAYOUTS.join('|')},images?:'catalog:<topic>'|[{src,alt}],count?} video{url,mode?:background} scene{scene:${CUSTOM_CODE_SCENES.join('|')},behind?:hero id} compare{images?} pricing{plans:[{name,a,b}]} map{address} lottie{src}`,
  'motion.add': `motion.add recipe: ${CUSTOM_CODE_TIMELINE_RECIPES.join('|')}`,
  // data (2026-10-12)
  'data.show': `data.show data:'Month,Sales\\nJan,120' (CSV/TSV/markdown, row 1 = headings) as?:${DATA_SHOW_AS.join('|')}; id refills a chart/table`,
  // data (2026-10-12): the report's KPI cards come from the numeric columns unless named.
  'report.build': `report.build data like data.show → title, KPI cards (last value + change vs previous row; kpis?:['Revenue']), chart, table`,
  // i18n (2026-10-12): the texts are the page's own words, all of them, or the tool refuses.
  'page.translate': 'page.translate texts: every text on the page as shown → its translation (names map to themselves); sets dir too',
  // creative-power F (2026-10-12): the catalogue's ids by category; the shared params, then each preset's own.
  'scene.preset': `scene.preset ${scenePresetMenu()}; params: palette,seed,speed,density + its own; behind:id fills that region under its content, id swaps its scene`,
};

function details(tools: readonly AgentTool[]): readonly string[] {
  return tools.flatMap(({ name }) => {
    const line = DETAILS[name];
    return line === undefined ? [] : [line];
  });
}

function example(tools: readonly AgentTool[]): string {
  const tool = tools.find(({ name }) => EXAMPLES[name] !== undefined) ?? tools[0];
  if (tool === undefined) return '';
  const input = EXAMPLES[tool.name] ?? {};
  return `e.g. ${JSON.stringify({ command: AGENT_TOOL_COMMAND, args: { name: tool.name, input } })}`;
}

function render(tools: readonly AgentTool[], line: (tool: AgentTool) => string): string {
  return [HEADER, ...tools.map(line), ...details(tools), example(tools)].join('\n');
}

export function agentToolPrompt(lane: AgentToolLane): string {
  const tools = agentToolsForLane(lane);
  if (tools.length === 0) return '';
  const max = agentToolPromptMaxChars(lane);
  const shapes: readonly ((tool: AgentTool) => string)[] = [
    (tool) => `${tool.name} ${tool.signature} — ${tool.summary}`,
    (tool) => `${tool.name} ${tool.signature}`,
    (tool) => tool.name,
  ];
  // Each tool starts with its full line; the longest lines shorten first until the lane fits.
  const lineAt = (tool: AgentTool, at: number): string => {
    const shape = shapes[at];
    return shape === undefined ? tool.name : shape(tool);
  };
  const level = tools.map(() => 0);
  const text = () => render(tools, (tool) => lineAt(tool, level[tools.indexOf(tool)] ?? 0));
  /*
    block-parts (2026-10-06): a tool with a DETAILS line (media.add, motion.add)
    keeps its signature while any other line can still shorten — the part.*
    signatures pushed media.add down to a bare name, and its kinds line then
    described fields the model could not see. Only when nothing else is left
    does it shorten too.
  */
  // ── block-parts (2026-10-06) ──
  let guarded = true;
  // ── /block-parts ──
  while (text().length > max) {
    let longest = -1;
    let width = -1;
    for (const [index, tool] of tools.entries()) {
      const at = level[index] ?? 0;
      if (at >= shapes.length - 1) continue;
      // ── block-parts (2026-10-06) ──
      if (guarded && at >= 1 && DETAILS[tool.name] !== undefined) continue;
      // ── /block-parts ──
      const length = lineAt(tool, at).length;
      if (length > width) {
        width = length;
        longest = index;
      }
    }
    // ── block-parts (2026-10-06) ──
    if (longest < 0 && guarded) {
      guarded = false;
      continue;
    }
    // ── /block-parts ──
    if (longest < 0) break;
    level[longest] = (level[longest] ?? 0) + 1;
  }
  if (text().length <= max) return text();
  // Names only still too long: the lane lists too many tools; keep as many as fit.
  const kept: AgentTool[] = [];
  for (const tool of tools) {
    if (render([...kept, tool], (entry) => entry.name).length > max) break;
    kept.push(tool);
  }
  return render(kept, (entry) => entry.name);
}
