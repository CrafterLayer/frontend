import { describe, expect, it } from 'vitest';

import { CUSTOM_CODE_SVG_TAGS, customCodeTreeSchema } from '@craftkit/builder-schema';

import { normalizeAiPlanTrees } from '../plan/normalize-plan';
import { parseTreeMarkup } from '../plan/tree-markup';
import { ART_NAMES_SKILL } from './art-names';
import { createCraftkitAiSkillRegistry } from './builtins';
import { LOGO_DESIGN_SKILL } from './logo-design';
import { PHOTO_DIRECTION_SKILL } from './photo-direction';

/*
  The art skills (2026-10-14): craftkit.art-names — verified logos, characters and illustrations
  by name, split out of the explicit-only photo-direction so an edit can reach it — and
  craftkit.logo-design, the person's own original logo in inline svg. Held to the same per-row
  ceilings as builtins.test.ts (whose file is at its size baseline).
*/

const ALWAYS = 'craftkit.craft-manual';
const SINGLE_SKILL_TOKEN_CEILING = 2_800;
const MAX_AUTO_SKILLS_PER_REQUEST = 4;
const ROW_TOKEN_CEILING = 3_400;

const registry = createCraftkitAiSkillRegistry();

function autoIds(request: string): readonly string[] {
  return registry
    .prepare({ request, auto: true })
    .active.filter(({ id }) => id !== ALWAYS)
    .map(({ id }) => id);
}

function closureTokens(id: string): number {
  const floor = registry.prepare({ request: '', auto: false }).totalTokens;
  return registry.prepare({ request: '', selectedSkillIds: [id], auto: false }).totalTokens - floor;
}

/** A tree written as a writer writes it, landed the way run-build lands it. */
function landed(markup: string) {
  const tree = parseTreeMarkup(markup);
  const normalized = normalizeAiPlanTrees({
    rationale: 'r',
    commands: [{ command: 'setProp', args: { id: 'a', key: 'tree', value: tree } }],
  });
  return {
    changes: [...normalized.adjustments, ...normalized.removedClasses, ...normalized.removedIcons],
    door: customCodeTreeSchema.safeParse(tree),
  };
}

describe('craftkit.art-names', () => {
  it('is auto for every intent that writes, and small', () => {
    expect(ART_NAMES_SKILL.activation).toMatchObject({
      mode: 'auto',
      intents: ['edit', 'add-section', 'build-page', 'build-site'],
    });
    // Measured 338 tokens with its envelope (2026-10-14).
    expect(closureTokens('craftkit.art-names')).toBeLessThanOrEqual(350);
  });

  it('carries the ART lines photo-direction no longer does, and photo-direction depends on it', () => {
    for (const spec of ["'logo:<brand>'", "'character:<style>:<seed>'", "'illustration:<words>'"]) {
      expect(ART_NAMES_SKILL.instructions).toContain(spec);
      expect(PHOTO_DIRECTION_SKILL.instructions).not.toContain(spec);
    }
    expect(PHOTO_DIRECTION_SKILL.dependencies).toEqual(['craftkit.art-names']);
    const writer = registry.prepare({
      request: '',
      selectedSkillIds: ['craftkit.photo-direction'],
      auto: false,
    });
    expect(writer.active.map(({ id, reason }) => `${id}:${reason}`)).toContain(
      'craftkit.art-names:dependency',
    );
    // Was 926 with the ART lines inside (2026-10-13); the split costs one skill envelope.
    expect(closureTokens('craftkit.photo-direction')).toBeLessThanOrEqual(990);
  });

  it.each([
    'Add our client logos: Visa, Stripe',
    'Add a logo strip of our payment partners',
    'Add avatars to the testimonials',
    'Add illustrations to the how it works steps',
    'Add a team section with cartoon characters',
    'ضيف شعارات العملاء',
    'حط لوجوهات الشركاء',
    'ضيف قسم للفريق بشخصيات كرتونية',
    'ضيف رسومات توضيحية للخطوات',
  ])('reaches an edit or a section: %s', (request) => {
    for (const intent of ['edit', 'add-section'] as const) {
      const ids = registry.prepare({ request, intent }).active.map(({ id }) => id);
      expect(ids).toContain('craftkit.art-names');
      expect(ids).not.toContain('craftkit.pixi-animation');
    }
  });

  it.each(['اكتب شعار للحملة', 'Change the hero title', 'غير شعار الصفحة إلى «قهوتك أولاً»'])(
    'stays out of slogans and plain edits: %s',
    (request) => {
      expect(autoIds(request)).not.toContain('craftkit.art-names');
    },
  );

  it('stays out of a question', () => {
    const ids = registry
      .prepare({ request: 'how do client logos work?', intent: 'question' })
      .active.map(({ id }) => id);
    expect(ids).not.toContain('craftkit.art-names');
  });
});

describe('craftkit.logo-design', () => {
  it('is auto for every intent that writes, and within its target', () => {
    expect(LOGO_DESIGN_SKILL.activation).toMatchObject({
      mode: 'auto',
      intents: ['edit', 'add-section', 'build-page', 'build-site'],
    });
    expect(closureTokens('craftkit.logo-design')).toBeLessThanOrEqual(700);
    expect(
      registry.prepare({ request: '', selectedSkillIds: ['craftkit.logo-design'], auto: false })
        .totalTokens,
    ).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
  });

  it.each([
    'Design a logo for my coffee brand',
    'Make me a logo for our bakery',
    'Create a logo and a brand mark',
    'صمم لي شعار لمقهى',
    'صمملي شعار',
    'سويلي لوجو لشركتي',
    'بدي لوجو لمحلي',
    'تصميم شعار لمشروعي',
  ])('activates on an ask to make one: %s', (request) => {
    expect(autoIds(request)).toContain('craftkit.logo-design');
  });

  it.each([
    'شعار',
    'اكتب شعار للحملة',
    'Add our client logos: Visa, Stripe',
    'ضيف شعارات العملاء',
    'Put the Visa logo in the footer',
    'Change the hero title',
  ])('stays out of slogans and logo strips: %s', (request) => {
    expect(autoIds(request)).not.toContain('craftkit.logo-design');
  });

  it.each([
    ['Design a logo for my coffee brand', ['craftkit.logo-design']],
    ['سويلي لوجو لشركتي', ['craftkit.arabic-rtl', 'craftkit.art-names', 'craftkit.logo-design']],
    ['صمملي شعار', ['craftkit.arabic-rtl', 'craftkit.logo-design', 'craftkit.copywriting']],
  ] as const)('keeps a logo row within the per-row ceilings: %s', (request, expected) => {
    const prepared = registry.prepare({ request, auto: true });
    const ids = autoIds(request);
    expect(ids).toEqual(expected);
    expect(ids.length).toBeLessThanOrEqual(MAX_AUTO_SKILLS_PER_REQUEST);
    expect(prepared.totalTokens).toBeLessThanOrEqual(ROW_TOKEN_CEILING);
  });

  it('names only svg shapes the custom-code tree admits', () => {
    const svgTags: ReadonlySet<string> = new Set(CUSTOM_CODE_SVG_TAGS);
    for (const tag of ['svg', 'path', 'circle', 'rect', 'ellipse', 'polygon', 'line', 'g']) {
      expect(svgTags.has(tag), tag).toBe(true);
      expect(LOGO_DESIGN_SKILL.instructions).toContain(tag);
    }
    for (const refused of ['use', 'image', 'foreignObject'])
      expect(svgTags.has(refused)).toBe(false);
  });

  it.each([
    [
      'header lockup',
      "<a aria-label='Hail Roastery' class='inline-flex min-h-11 items-center gap-3' href='/'><svg aria-hidden='true' class='size-10 shrink-0 text-amber-700' viewBox='0 0 48 48'><circle cx='24' cy='28' fill='currentColor' r='14'/><path d='M18 6C14 10 22 12 18 16M26 6C22 10 30 12 26 16' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='3'/></svg><span class='ck-display text-xl font-bold'>Hail Roastery</span></a>",
    ],
    [
      'logo board',
      "<div class='grid gap-6 md:grid-cols-3'><div class='rounded-3xl bg-surface p-8 ring-1 ring-black/5'><div class='inline-flex items-center gap-3'><svg aria-hidden='true' class='size-24 text-teal-700' viewBox='0 0 48 48'><defs><linearGradient id='ck-logo-fade' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='currentColor'/><stop offset='1' stop-color='currentColor' stop-opacity='0.6'/></linearGradient></defs><rect fill='url(#ck-logo-fade)' height='32' rx='8' width='32' x='8' y='8'/><polygon fill='#ffffff' points='24,14 32,32 16,32'/></svg><span class='ck-display text-4xl font-bold'>عيادة النور</span></div></div><div class='rounded-3xl bg-teal-700 p-8 text-white ring-1 ring-black/5'><svg aria-hidden='true' class='size-24' viewBox='0 0 48 48'><g fill='currentColor'><rect height='32' rx='8' width='32' x='8' y='8'/></g></svg></div><div class='rounded-3xl p-8 ring-1 ring-black/5'><svg aria-hidden='true' class='size-8 text-teal-700' viewBox='0 0 48 48'><ellipse cx='24' cy='24' fill='currentColor' rx='16' ry='12'/><line stroke='#ffffff' stroke-width='3' x1='12' x2='36' y1='24' y2='24'/></svg></div></div>",
    ],
  ])('teaches a %s the door takes as written', (_name, markup) => {
    const { changes, door } = landed(markup);
    expect(door.success, door.success ? '' : door.error.issues[0]?.message).toBe(true);
    expect(changes).toEqual([]);
  });
});
