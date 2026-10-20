import { scopeCustomCodeCss, validatePagePlan, type AiPlan } from '@craftkit/builder';
import { completeReadyScene, pagePlanCss } from '@craftkit/builder/testing';

import type { KitUnderTest } from './kit-section';

export interface InitializedSceneFixture {
  readonly kit: KitUnderTest;
  readonly css: string;
  readonly title: string;
  readonly action: string;
  readonly href: string;
  readonly copy: readonly string[];
  readonly surface: string;
}

/** One marker answer, validated plan, and real locally completed tree/CSS/code/settings. */
export function initializedScene(
  dir: 'ltr' | 'rtl',
  preset: 'aurora-curtains' | 'arcade' | 'picture-book' = 'aurora-curtains',
): InitializedSceneFixture {
  const rtl = dir === 'rtl';
  const title = rtl ? 'أضواء في السماء' : 'Lights across the sky';
  const action = rtl ? 'شاهد التفاصيل' : 'View details';
  const copy = rtl
    ? ['مشهد يتغير بهدوء', 'الضوء فوق التلال']
    : ['A gently changing scene', 'Light above the hills'];
  const result = validatePagePlan({
    intent: 'replace',
    locale: { lang: rtl ? 'ar' : 'en', dir },
    title,
    description: rtl ? 'جدارية الشفق مع شرح واضح.' : 'An aurora mural with readable copy.',
    tokens: {
      bg: '#ffffff',
      surface: '#f5f5f5',
      ink: '#171717',
      muted: '#525252',
      accent: '#065f46',
      onAccent: '#ffffff',
      accentInk: '#065f46',
      border: '#d4d4d4',
      fontDisplay: { family: rtl ? 'Tajawal' : 'Figtree', weights: [400, 700] },
      fontBody: { family: rtl ? 'Tajawal' : 'Figtree', weights: [400, 700] },
      radius: 'md',
      signature: 'Aurora behind a readable surface',
    },
    primaryCta: { label: action, href: '#details' },
    nav: [],
    sections: [
      {
        key: 'mural',
        role: 'hero',
        anchorId: 'mural',
        title,
        purpose: 'A calm aurora mural and a clear action.',
        mustSay: copy,
        mustNotRepeat: [],
      },
      {
        key: 'details',
        role: 'band',
        anchorId: 'details',
        title: rtl ? 'تفاصيل' : 'Details',
        purpose: 'The anchor destination.',
        mustSay: [],
        mustNotRepeat: [],
      },
    ],
    facts: [],
  });
  if (!result.ok) {
    throw new Error(result.issues.map(({ path, message }) => `${path}: ${message}`).join('\n'));
  }
  const section = result.plan.sections[0];
  if (section === undefined) throw new Error('Validated fixture has no hero.');
  const markerAnswer: AiPlan = {
    rationale: 'Ready scene initialization',
    commands:
      preset === 'aurora-curtains'
        ? [{ command: 'setProp', args: { id: 'kit', key: 'js', value: `@preset:${preset}` } }]
        : [{ command: 'tool', args: { name: 'scene.preset', input: { preset } } }],
  };
  const answer = completeReadyScene(
    result.plan,
    section,
    'kit',
    markerAnswer,
    ['tree', 'css', 'js', 'jsMeta', 'jsParams'],
    '',
    preset !== 'aurora-curtains',
  );
  const values = Object.fromEntries(
    answer.commands.map(({ args }) => {
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new Error('Ready initialization command args are invalid.');
      }
      const prop = args as Record<string, unknown>;
      return [String(prop['key']), prop['value']];
    }),
  );
  const tree = values['tree'] as NonNullable<KitUnderTest['region']>['tree']['en'];
  if (
    typeof values['css'] !== 'string' ||
    typeof values['js'] !== 'string' ||
    !Array.isArray(tree.children)
  ) {
    throw new Error('Ready scene did not complete its tree, CSS and code.');
  }
  // Use the real page token rules and host scoping; only remote font imports are omitted offline.
  const pageCss = scopeCustomCodeCss(
    pagePlanCss(result.plan).replace(/@import[^;]+;/gu, ''),
    'scene-page',
  );
  const regionCss = scopeCustomCodeCss(values['css'], 'kit');
  if (pageCss === undefined || regionCss === undefined) throw new Error('Fixture CSS was refused.');
  const params = values['jsParams'] as Record<string, unknown>;
  return {
    kit: {
      id: preset,
      category: preset === 'aurora-curtains' ? 'mural' : preset === 'arcade' ? 'game' : 'story',
      code: values['js'],
      params: [],
      region: { tree: { en: tree, ar: tree }, css: regionCss, params: { en: params, ar: params } },
    },
    css: `${pageCss}\n${regionCss}`,
    title: section.title,
    action: result.plan.primaryCta.label,
    href: result.plan.primaryCta.href,
    copy: section.mustSay,
    surface: result.plan.tokens.surface,
  };
}
