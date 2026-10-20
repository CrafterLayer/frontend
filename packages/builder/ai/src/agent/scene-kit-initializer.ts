import type { CustomCodeElement, CustomCodeNode, CustomCodeRoot } from '@craftkit/builder-schema';

import { scenePresetTool } from '../tools/agent/builtin/scene-preset';
import { metaOf, storedParams } from '../tools/agent/builtin/scene-preset-region';
import { isRecord } from '../tools/agent/shared';
import type { AiPlan, AiPlanStep } from '../types';
import type { PagePlan, SectionContract } from './page-plan/types';

const TITLE_CSS =
  '.ck-kit .ck-kit-build-title{margin:0;font-size:clamp(1.25rem,3vw,2rem);line-height:1.2}';

function propKey(step: AiPlanStep, id: string): unknown {
  return step.command === 'setProp' && isRecord(step.args) && step.args['id'] === id
    ? step.args['key']
    : undefined;
}

/** Keep all kit hooks and controls; only its section heading and required page copy change. */
function contractTree(
  tree: CustomCodeRoot,
  plan: PagePlan,
  contract: SectionContract,
): CustomCodeRoot {
  const required = [
    ...new Set([
      ...contract.mustSay,
      ...plan.facts.filter(({ section }) => section === contract.key).map(({ sample }) => sample),
    ]),
  ].filter((text) => text.trim() !== '' && text !== contract.title);
  const copy: CustomCodeElement[] = required.map((text) => ({
    kind: 'element',
    tag: 'p',
    text,
  }));
  if (contract.role === 'hero' || contract.role === 'cta') {
    copy.push({
      kind: 'element',
      tag: 'a',
      className: 'ck-btn',
      attributes: { href: plan.primaryCta.href },
      text: plan.primaryCta.label,
    });
  }
  let titled = false;
  const visit = (node: CustomCodeNode): CustomCodeNode[] => {
    if (node.kind !== 'element') return [node];
    const title =
      !titled &&
      (node.attributes?.['data-scene-part'] === 'title' ||
        node.className?.split(/\s+/u).includes('ck-kit-eyebrow') === true ||
        node.tag === 'h1' ||
        node.tag === 'h2');
    if (title) {
      titled = true;
      return [
        {
          ...node,
          tag: contract.role === 'hero' ? 'h1' : 'h2',
          className: `${node.className ?? ''} ck-kit-build-title`.trim(),
          text: contract.title,
        },
        ...copy,
      ];
    }
    return [
      {
        ...node,
        ...(node.children === undefined ? {} : { children: node.children.flatMap(visit) }),
      },
    ];
  };
  const children = tree.children.flatMap(visit);
  const outer = children[0];
  if (outer?.kind !== 'element') {
    throw new Error('Scene kit initialization needs its outer section.');
  }
  return {
    ...tree,
    children: [
      { ...outer, attributes: { ...outer.attributes, id: contract.anchorId } },
      ...children.slice(1),
    ],
  };
}

/**
 * Only the build coordinator calls this for its own newly scaffolded region. General edits keep
 * scene.preset's authored-content protection. Invalid calls stay intact for ordinary tool/door
 * validation, including unsupported placements and ids outside this writer's target.
 */
export function completeSceneKitSteps(
  plan: PagePlan,
  contract: SectionContract,
  regionId: string,
  answer: AiPlan,
  declaredProps: readonly string[],
): AiPlan {
  const raw: unknown = answer.commands;
  if (!Array.isArray(raw)) return answer;
  const steps = raw as readonly AiPlanStep[];
  const written = new Set(steps.map((step) => propKey(step, regionId)));
  const commands = steps.flatMap((step): AiPlanStep[] => {
    if (step.command !== 'tool' || !isRecord(step.args) || step.args['name'] !== 'scene.preset')
      return [step];
    const parsed = scenePresetTool.parse(step.args['input']);
    if (!parsed.ok) return [step];
    const { preset, place, values } = parsed.value;
    const region = preset.region;
    if (
      region === undefined ||
      (place !== undefined && (place.key !== 'id' || place.id !== regionId)) ||
      !['tree', 'css', 'js'].every((key) => declaredProps.includes(key))
    )
      return [step];
    const lang = plan.locale.lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
    // Use the tool's own param validation, including its bounded adjustments, for localized words.
    const localized = scenePresetTool.parse({
      preset: preset.id,
      params: { ...region.params?.[lang], ...values },
    });
    if (!localized.ok) return [step];
    const params = storedParams(preset, localized.value.values);
    if (Object.keys(params).length > 0 && !declaredProps.includes('jsParams')) return [step];
    const props: Record<string, unknown> = {
      js: preset.code,
      ...(!written.has('tree')
        ? { tree: contractTree(structuredClone(region.tree[lang]), plan, contract) }
        : {}),
      ...(!written.has('css') ? { css: `${region.css}\n${TITLE_CSS}` } : {}),
      ...(declaredProps.includes('jsMeta') ? { jsMeta: metaOf(preset) } : {}),
      ...(declaredProps.includes('jsParams') ? { jsParams: params } : {}),
    };
    return Object.entries(props).map(([key, value], index) => ({
      command: 'setProp',
      args: { id: regionId, key, value },
      ...(index === 0 && step.title !== undefined ? { title: step.title } : {}),
    }));
  });
  return commands.length === steps.length && commands.every((step, index) => step === steps[index])
    ? answer
    : { ...answer, commands };
}
