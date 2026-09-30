import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_TAGS,
  customCodeTreeSchema,
  findCssRejection,
} from '@craftkit/builder-schema';

import { normalizeAiPlanTrees } from '../plan/normalize-plan';
import { parseTreeMarkup } from '../plan/tree-markup';
import { CRAFTKIT_AI_SKILL_DEFINITIONS, createCraftkitAiSkillRegistry } from './builtins';
import { DESIGN_CODE_SKILL } from './design-code';

/*
  craftkit.design-code (2026-09-28) teaches the markup and CSS the door
  admits since the same day. An example the door refuses costs the section a
  repair round (25-40 s, measured 2026-09-27), so every pattern it teaches is
  held here to the door, the normalizer and the CSS refusal list.
*/

const SINGLE_SKILL_TOKEN_CEILING = 2_800;
const text = DESIGN_CODE_SKILL.instructions;

/** A pattern written as a writer writes it, landed the way run-build lands it. */
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

describe('craftkit.design-code', () => {
  it('is explicit-only, depends on nothing, and fits under the single-skill ceiling', () => {
    expect(DESIGN_CODE_SKILL.activation).toEqual({ mode: 'explicit' });
    expect(DESIGN_CODE_SKILL.dependencies ?? []).toEqual([]);
    const registry = createCraftkitAiSkillRegistry();
    const prepared = registry.prepare({
      request: '',
      selectedSkillIds: ['craftkit.design-code'],
      auto: false,
    });
    expect(prepared.active.map(({ id }) => id)).toContain('craftkit.design-code');
    expect(prepared.totalTokens).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
    // Never on by itself: an edit or a question does not carry it.
    expect(
      registry.prepare({ request: 'make the hero title bigger' }).active.map(({ id }) => id),
    ).not.toContain('craftkit.design-code');
    expect(CRAFTKIT_AI_SKILL_DEFINITIONS).toContain(
      CRAFTKIT_AI_SKILL_DEFINITIONS.find(({ id }) => id === 'craftkit.design-code'),
    );
  });

  it('writes only attributes and tags the vocabulary has', () => {
    const attributes = new Set<string>(CUSTOM_CODE_ATTRIBUTES);
    // `class` is the markup spelling of className; a ck-component takes type and props.
    for (const extra of ['class', 'props']) attributes.add(extra);
    const written = [...text.matchAll(/([A-Za-z][\w-]*)='/gu)].map((match) => match[1] ?? '');
    expect(written.length).toBeGreaterThan(10);
    expect(written.filter((name) => !attributes.has(name))).toEqual([]);

    const tags = new Set<string>(CUSTOM_CODE_TAGS);
    for (const tag of ['details', 'summary', 'table', 'caption', 'thead', 'tbody', 'th', 'td']) {
      expect(tags.has(tag), tag).toBe(true);
      expect(text).toContain(tag);
    }
    for (const tag of ['svg', 'path', 'linearGradient', 'video', 'source', 'picture']) {
      expect(tags.has(tag), tag).toBe(true);
      expect(text).toContain(tag);
    }
  });

  it.each([
    [
      'faq',
      "<div class='ck-faq-list divide-y divide-black/10'><details class='ck-faq py-5' name='faq' open=''><summary class='flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold'>Do you deliver?<icon name='plus' size='20' class='ck-faq-icon'/></summary><p class='mt-3'>Every morning inside Amman.</p></details><details class='ck-faq py-5' name='faq'><summary class='cursor-pointer list-none font-semibold'>Parking?</summary><p>Behind the shop.</p></details></div>",
    ],
    [
      'phone menu',
      "<button aria-label='Menu' class='lg:hidden' popovertarget='ck-nav'><icon name='menu'/></button><nav aria-label='Sections' class='ck-sheet me-0 ms-auto h-full w-80 p-6' id='ck-nav' popover=''><div class='flex flex-col'><button aria-label='Close' popovertarget='ck-nav' popovertargetaction='hide'><icon name='x'/></button><a href='#menu'>Menu</a><a href='#order'>Order</a></div></nav>",
    ],
    [
      'comparison table',
      "<div class='overflow-x-auto'><table class='w-full text-sm'><caption class='sr-only'>Plans</caption><thead><tr><th scope='col'>Feature</th><th scope='col'>Basic</th><th scope='col'>Pro</th></tr></thead><tbody><tr><th scope='row'>Seats</th><td>1</td><td>5</td></tr><tr><th scope='row'>Support</th><td colspan='2'>Email, both plans</td></tr></tbody></table></div>",
    ],
    [
      'svg divider with a gradient',
      "<svg aria-hidden='true' class='block h-12 w-full' preserveAspectRatio='none' viewBox='0 0 1440 80'><defs><linearGradient id='ck-fade' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='currentColor' stop-opacity='0.3'/><stop offset='1' stop-color='currentColor'/></linearGradient></defs><path d='M0 40C360 80 1080 0 1440 40V80H0Z' fill='url(#ck-fade)'/></svg>",
    ],
    [
      'video hero',
      "<section class='relative isolate min-h-dvh overflow-hidden'><video autoplay muted loop playsinline class='absolute inset-0 -z-10 h-full w-full object-cover' poster='https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1600' preload='metadata'><source src='https://cdn.example.com/roastery.mp4' type='video/mp4'/></video><h1>Roasted this morning</h1></section>",
    ],
    [
      'responsive image',
      "<picture><source media='(min-width:768px)' srcset='https://images.unsplash.com/a?w=1600 1600w'/><img alt='A cup' decoding='async' height='600' loading='lazy' sizes='(min-width:768px) 50vw, 100vw' src='https://images.unsplash.com/a?w=800' srcset='https://images.unsplash.com/a?w=800 800w, https://images.unsplash.com/a?w=1600 1600w' width='800'/></picture>",
    ],
    ['mixed language', "<p lang='ar'>محمصة <span dir='ltr' lang='en'>Hail Roastery</span> في عمّان</p>"],
  ])('teaches a %s the door takes as written', (_name, markup) => {
    const { changes, door } = landed(markup);
    expect(door.success, door.success ? '' : door.error.issues[0]?.message).toBe(true);
    expect(changes).toEqual([]);
  });

  it('teaches CSS the refusal list takes, grain from a data: svg included', () => {
    const sheet = [
      '.ck-hero-mesh{background:radial-gradient(60% 50% at 80% 10%,var(--ck-accent),transparent),linear-gradient(180deg,var(--ck-surface),var(--ck-bg))}',
      ".ck-grain{position:relative}.ck-grain::before{content:'';position:absolute;inset:0;opacity:0.06;pointer-events:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")}",
      '.ck-glass{background:color-mix(in srgb,var(--ck-surface) 72%,transparent);backdrop-filter:blur(14px)}',
      '.ck-fade{mask-image:linear-gradient(#000 70%,transparent)}',
      '.ck-edge{clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}',
      '@keyframes ck-marquee{to{transform:translateX(-50%)}}',
      '.ck-marquee{display:flex;width:max-content;animation:ck-marquee 30s linear infinite}',
      '.ck-card:hover,.ck-card:focus-visible{transform:translateY(-2px);transition:transform 200ms}',
      '.ck-cards{container-type:inline-size}@container (min-width:40rem){.ck-card{display:grid}}',
      'summary::-webkit-details-marker{display:none}.ck-faq[open] .ck-faq-icon{rotate:45deg}',
      '.ck-sheet::backdrop{background:rgb(0 0 0 / 0.4)}',
      "@import url('https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&display=swap');",
      '@media (prefers-reduced-motion:reduce){.ck-marquee,.ck-card{animation:none;transition:none}}',
    ].join('\n');
    expect(findCssRejection(sheet)).toBeUndefined();
    // What the skill says the door will not take, it will not take.
    expect(findCssRejection('.ck-x{background:url(http://x.test/a.jpg)}')).toBeDefined();
    expect(findCssRejection("@import url('https://cdn.example.com/kit.css');")).toBeDefined();
  });

  it('puts a reduced-motion guard beside every motion it teaches', () => {
    expect(text).toContain('@keyframes');
    expect(text).toMatch(/every animation and transition ships with @media \(prefers-reduced-motion:reduce\)/u);
  });

  it('keeps a popover closed until asked, and opens it from a button only', () => {
    expect(text).toMatch(/popover itself takes no display class/u);
    expect(text).toContain("popovertargetaction='hide'");
    expect(text).toMatch(/Only a button opens a popover/u);
  });

  it('teaches online booking as a real form with service, date and time — not steps and links', () => {
    // Final test 2026-09-30: "online booking" landed as a 3-step explainer and anchors.
    const markup = /<ck-component type='formSection'[^>]*\/>/u.exec(text)?.[0] ?? '';
    expect(markup).not.toBe('');
    const tree = parseTreeMarkup(markup);
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    const component = (tree as { children: { kind?: string; props?: Record<string, unknown> }[] })
      .children[0];
    expect(component?.kind).toBe('component');
    const fields = (component?.props?.['fields'] ?? []) as readonly {
      name: string;
      type: string;
      options?: unknown[];
    }[];
    expect(fields.map(({ name, type }) => `${name}:${type}`)).toEqual([
      'service:select',
      'date:date',
      'time:select',
      'phone:tel',
    ]);
    for (const field of fields.filter(({ type }) => type === 'select')) {
      expect(field.options?.length ?? 0).toBeGreaterThan(0);
    }
    expect(text).toMatch(/WhatsApp stays beside it/u);
  });

  it('names a video only when the request gives one, and plays it muted', () => {
    expect(text).toMatch(/only with a video address the request gives/u);
    expect(text).toMatch(/video autoplay muted loop playsinline/u);
  });
});
