import {
  paramsDiffFromDefaults,
  validateParamValues,
  type CustomCodeElement,
  type CustomCodeNode,
  type CustomCodeRoot,
  type CustomCodeJsParams,
} from '@craftkit/builder-schema';

import type { ScenePreset } from '../scene-presets/catalog';
import type { AiPlan, AiPlanStep } from '../types';
import { sceneInitializationIds } from '../provider/scene-init-wire';
import { instantiatePlanKit, planKit } from './page-plan/kits';
import type { PagePlan, SectionContract } from './page-plan/types';
import { readyScenes } from './scene-ready';

/** The copy has an opaque theme surface; a busy picture cannot reduce its contrast. */
export const READY_SCENE_INIT_CSS =
  '.ck-scene-init{position:relative;width:100%;box-sizing:border-box;aspect-ratio:16/9;min-height:320px;display:flex;align-items:center;padding:clamp(1rem,4vw,3rem);background:transparent}' +
  '.ck-scene-copy{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:32rem;margin:0;padding:clamp(1rem,3vw,2rem);background:var(--ck-surface);color:var(--ck-ink);overflow-wrap:anywhere}' +
  '.ck-scene-copy h1,.ck-scene-copy h2{margin-top:0;font-size:clamp(1.75rem,4vw,3rem)}' +
  '@media(max-width:40rem){.ck-scene-init{aspect-ratio:3/4;align-items:flex-end}}';

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function propOf(step: AiPlanStep, regionId: string): string | undefined {
  return step.command === 'setProp' && record(step.args) && step.args['id'] === regionId
    ? typeof step.args['key'] === 'string'
      ? step.args['key']
      : undefined
    : undefined;
}

function presetOf(step: AiPlanStep, regionId: string): ScenePreset | undefined {
  if (propOf(step, regionId) !== 'js' || !record(step.args)) return;
  const value = step.args['value'];
  if (typeof value !== 'string') return;
  const id = /^\s*@preset:\s*([a-z0-9-]+)\s*$/u.exec(value)?.[1];
  return id === undefined ? undefined : readyScenes().find((preset) => preset.id === id);
}

function setProp(regionId: string, key: string, value: unknown): AiPlanStep {
  return { command: 'setProp', args: { id: regionId, key, value } };
}

function hasAction(node: CustomCodeNode): boolean {
  return (
    node.kind === 'element' &&
    (node.className?.split(/\s+/u).includes('ck-btn') === true ||
      node.children?.some(hasAction) === true)
  );
}

function initTree(plan: PagePlan, contract: SectionContract): CustomCodeRoot {
  const kit = planKit('hero-centered');
  if (kit === undefined) throw new Error('Ready scene initialization needs the hero-centered kit.');
  const filled = instantiatePlanKit(
    kit,
    { title: contract.title, cta: plan.primaryCta },
    contract,
    plan.locale,
  );
  if (!filled.ok) throw new Error(`Ready scene initialization: ${filled.error}`);
  const tree = filled.region.tree as CustomCodeRoot;
  const outer = tree.children[0];
  const copy = outer?.kind === 'element' ? outer.children?.[0] : undefined;
  if (outer?.kind !== 'element' || copy?.kind !== 'element') {
    throw new Error('Ready scene initialization needs the kit section and its copy container.');
  }
  const action = contract.role === 'hero' || contract.role === 'cta';
  // Never turn a purpose into invented copy or truncate required claims into a kit's lead slot.
  const required = [
    ...new Set([
      ...contract.mustSay,
      ...plan.facts.filter(({ section }) => section === contract.key).map(({ sample }) => sample),
    ]),
  ].filter((text) => text.trim() !== '' && text !== contract.title);
  const paragraphs: CustomCodeElement[] = required.map((text) => ({
    kind: 'element',
    tag: 'p',
    className: 'ck-muted mt-4 leading-relaxed',
    text,
  }));
  const children = (copy.children ?? []).filter((child) => action || !hasAction(child));
  const heading = children.findIndex(
    (child) => child.kind === 'element' && (child.tag === 'h1' || child.tag === 'h2'),
  );
  return {
    kind: 'root',
    children: [
      {
        ...outer,
        className: 'ck-scene-init ck-kit-hero-centered',
        children: [
          {
            ...copy,
            className: 'ck-card ck-scene-copy',
            children: [
              ...children.slice(0, heading + 1),
              ...paragraphs,
              ...children.slice(heading + 1),
            ],
          },
        ],
      },
    ],
  };
}

function paramsOf(preset: ScenePreset, raw: unknown): CustomCodeJsParams {
  if (!record(raw)) throw new Error(`Ready scene ${preset.id}: jsParams must be an object.`);
  const checked = validateParamValues(preset.params, raw);
  if (checked.issues.length > 0) {
    throw new Error(
      `Ready scene ${preset.id}: ${checked.issues.map(({ message }) => message.en).join(' ')}`,
    );
  }
  return paramsDiffFromDefaults(preset.params, checked.values);
}

/**
 * Complete a compact marker answer locally, before the ordinary command door sees it. Only the
 * captured region's last JS write selects a preset; custom JS and unknown markers remain intact.
 * A supplied tree/CSS stays authored. Every generated setting must be declared by the block.
 */
export function completeReadyScene(
  plan: PagePlan,
  contract: SectionContract,
  regionId: string,
  answer: AiPlan,
  declaredProps: readonly string[],
  initializationRequest = '',
): AiPlan {
  const written: unknown = (answer as { readonly commands?: unknown }).commands;
  const allowed = sceneInitializationIds(initializationRequest);
  if (!Array.isArray(written)) {
    if (allowed !== undefined) throw new Error('Scene initialization requires preset commands.');
    return answer;
  }
  const steps = written as readonly AiPlanStep[];
  const writes = steps.filter((step) => propOf(step, regionId) === 'js');
  const last = writes.at(-1);
  const preset = last === undefined ? undefined : presetOf(last, regionId);
  if (
    allowed !== undefined &&
    (writes.length === 0 ||
      writes.some((step) => {
        const chosen = presetOf(step, regionId);
        return chosen === undefined || !allowed.includes(chosen.id);
      }))
  )
    throw new Error(
      'Scene initialization must name one of the offered ready presets; custom or missing JS is refused.',
    );
  if (preset === undefined) return answer;
  const keys = new Set(steps.map((step) => propOf(step, regionId)));
  const metadata = declaredProps.includes('jsMeta');
  const settings = declaredProps.includes('jsParams');
  const meta = {
    ref: { tier: 'builtin', id: preset.id, version: preset.entry.version },
    name: { ...preset.title },
    tags: [...preset.tags],
    params: structuredClone(preset.params),
    libs: [...preset.libs],
  };
  const commands = steps.map((step): AiPlanStep => {
    const key = propOf(step, regionId);
    const named = key === 'js' ? presetOf(step, regionId) : undefined;
    if (named !== undefined) return setProp(regionId, 'js', named.code);
    // Validate even undeclared authored params: dropping them would hide a bad answer.
    if (key === 'jsParams' && record(step.args)) {
      return setProp(regionId, 'jsParams', paramsOf(preset, step.args['value']));
    }
    if (key === 'jsMeta' && metadata) return setProp(regionId, 'jsMeta', meta);
    return step;
  });
  if (!keys.has('tree')) commands.push(setProp(regionId, 'tree', initTree(plan, contract)));
  if (!keys.has('css')) commands.push(setProp(regionId, 'css', READY_SCENE_INIT_CSS));
  if (metadata && !keys.has('jsMeta')) commands.push(setProp(regionId, 'jsMeta', meta));
  if (settings && !keys.has('jsParams')) commands.push(setProp(regionId, 'jsParams', {}));
  return { ...answer, commands };
}
