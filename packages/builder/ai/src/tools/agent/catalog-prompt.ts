import { CUSTOM_CODE_SCENES, CUSTOM_CODE_TIMELINE_RECIPES, GALLERY_LAYOUTS } from '@craftkit/builder-schema';

import { agentToolsForLane } from './registry';
import { AGENT_TOOL_COMMAND, type AgentTool, type AgentToolLane } from './types';

/**
 * The tools a lane may name, as the prompt lists them: one compact line each
 * (`<name> <signature> — <summary>`) and one example step. At most 900
 * characters per lane — a section writer sees ~3 tools, an edit ~10. When
 * the lines would not fit, summaries go first, then signatures, so every
 * tool stays nameable.
 */

export const AGENT_TOOL_PROMPT_MAX_CHARS = 900;

// media-motion (2026-10-06): per-lane caps. The edit lane lists ~30 tools (style tools, media.add,
// motion.add); at 900 characters every one degrades to a bare name and media.add loses its kinds.
export const AGENT_TOOL_PROMPT_LANE_MAX_CHARS: Readonly<Record<AgentToolLane, number>> = {
  build: AGENT_TOOL_PROMPT_MAX_CHARS,
  section: AGENT_TOOL_PROMPT_MAX_CHARS,
  edit: 1_400,
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
};

// media-motion (2026-10-06): one line of fields per tool whose signature cannot hold them (DESIGN §F.1).
const DETAILS: Readonly<Record<string, string>> = {
  'media.add': `media.add kinds: gallery{layout?:${GALLERY_LAYOUTS.join('|')},images?:'catalog:<topic>'|[{src,alt}],count?} video{url,mode?:background} scene{scene:${CUSTOM_CODE_SCENES.join('|')},behind?:hero id} compare{images?} pricing{plans:[{name,a,b}]} map{address} lottie{src}`,
  'motion.add': `motion.add recipe: ${CUSTOM_CODE_TIMELINE_RECIPES.join('|')}`,
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
  while (text().length > max) {
    let longest = -1;
    let width = -1;
    for (const [index, tool] of tools.entries()) {
      const at = level[index] ?? 0;
      if (at >= shapes.length - 1) continue;
      const length = lineAt(tool, at).length;
      if (length > width) {
        width = length;
        longest = index;
      }
    }
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
