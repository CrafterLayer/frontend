import { describe, expect, it } from 'vitest';

import type { JsonValue } from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../../plan/tree-markup';
import { checkScene } from './check-scene';
import { checkSection } from './check-section';
import {
  BUILDER_PLAN,
  CAFE_PLAN,
  builderBand,
  builderHero,
  contractOf,
  h,
  tree,
  writerSteps,
  written,
  type FixtureNode,
} from './tidy.fixtures';
import { tidySection } from './tidy-section';
import type { LandedSection, PagePlan } from './types';

/*
  The slip catalogue (2026-10-13): one row per way a writer's section fails
  the check, taken from the checker's own test suites (each row there was a
  live verifier finding, dated in check-section.ts and check-scene.ts). The
  last column says whether code repairs it exactly. This file pins both
  halves: every "code" row reaches the check clean after tidy — that slip no
  longer costs a repair round — and every "writer" row still reaches it with
  its finding, because tidy never guesses a word, a photo or a place.

  Measured over this catalogue: 20 of 33 section slips and 10 of 29 scene
  slips are code's (62 rows, 30 repaired in code; the palette-class tidy of
  2026-10-05 covered 2 of them before today).
*/

type Row = readonly [
  name: string,
  plan: PagePlan,
  key: string,
  section: LandedSection,
  code: boolean,
];

const SCENE_TREE = parseTreeMarkup(
  "<section id='projects' class='ck-scene'><h2>Projects</h2><p>120 homes delivered</p><p data-anim-status role='status'></p><button type='button' data-fx-burst>Go</button></section>",
) as unknown as JsonValue;
const SCENE_CSS = '.ck-scene{position:relative;min-height:420px}';
const PIXI = ['pixi', 'js'].join('.');
const CLEAN =
  "const s=await ck.scene({libs:['fx']});\nconst fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nconst go=ck.root.querySelector('[data-fx-burst]');\nconst burst=()=>{if(!s.editor)fx.emit('magic',s.width/2,s.height/2)};\nif(go){go.addEventListener('click',burst);s.dispose(()=>go.removeEventListener('click',burst))}\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());";

function band(
  inner: FixtureNode[] = [],
  attributes: Record<string, string> = { id: 'projects' },
): LandedSection {
  return { tree: builderBand(inner, attributes) };
}

function hero(inner: FixtureNode[] = [], extra: Partial<LandedSection> = {}): LandedSection {
  return { tree: builderHero(inner), ...extra };
}

function heading(value: JsonValue, from: string, to: string): JsonValue {
  return JSON.parse(JSON.stringify(value).replace(`"${from}"`, `"${to}"`)) as JsonValue;
}

function scene(js: string, extra: Partial<LandedSection> = {}): LandedSection {
  return { tree: SCENE_TREE, css: SCENE_CSS, js, ...extra };
}

const SECTION_ROWS: readonly Row[] = [
  [
    'a band heads with h1 (EN)',
    BUILDER_PLAN,
    'projects',
    { tree: heading(builderBand(), 'h2', 'h1') },
    true,
  ],
  [
    'a band heads with h1 (AR)',
    CAFE_PLAN,
    'menu',
    {
      tree: tree(
        h('section', 'ck-ground', [h('h1', '', 'القائمة'), h('p', '', 'إسبريسو')], { id: 'menu' }),
      ),
    },
    true,
  ],
  [
    'a hero heads with h2',
    BUILDER_PLAN,
    'hero',
    { tree: heading(builderHero(), 'h1', 'h2') },
    true,
  ],
  ['a hero has two h1', BUILDER_PLAN, 'hero', hero([h('h1', '', 'Again')]), true],
  ['the outer element has no anchor', BUILDER_PLAN, 'projects', band([], {}), true],
  [
    'the anchor is on an inner wrapper',
    BUILDER_PLAN,
    'projects',
    {
      tree: tree(
        h('section', 'py-24', [
          h('div', '', [h('h2', '', 'Projects'), h('p', '', '120 homes delivered')], {
            id: 'projects',
          }),
        ]),
      ),
    },
    true,
  ],
  [
    'another section’s anchor inside',
    BUILDER_PLAN,
    'projects',
    band([h('div', '', 'x', { id: 'quote' })]),
    true,
  ],
  [
    'the outer element has another section’s anchor',
    BUILDER_PLAN,
    'projects',
    band([], { id: 'quote' }),
    true,
  ],
  [
    'a link spelled in another case',
    BUILDER_PLAN,
    'projects',
    band([h('a', 'ck-link', 'Ask', { href: '#Quote' })]),
    true,
  ],
  [
    'a link to no section',
    BUILDER_PLAN,
    'projects',
    band([h('a', 'ck-link', 'Team', { href: '#team' })]),
    false,
  ],
  [
    'an action button with other words',
    BUILDER_PLAN,
    'hero',
    hero([h('a', 'ck-btn', 'Get started', { href: '#quote' })]),
    false,
  ],
  [
    'a closing section with no action',
    BUILDER_PLAN,
    'quote',
    {
      tree: tree(
        h(
          'section',
          'ck-accent-fill',
          [h('h2', '', 'Quote'), h('p', '', 'Tell us about the plot.')],
          { id: 'quote' },
        ),
      ),
    },
    false,
  ],
  [
    'the action as a button',
    BUILDER_PLAN,
    'quote',
    {
      tree: tree(
        h(
          'section',
          'ck-accent-fill',
          [h('h2', '', 'Quote'), h('button', 'ck-btn', 'Get a quote', { type: 'button' })],
          { id: 'quote' },
        ),
      ),
    },
    true,
  ],
  [
    'the action’s words lead elsewhere',
    BUILDER_PLAN,
    'hero',
    hero([h('a', 'ck-btn ck-btn--ghost', 'Get a quote', { href: '#projects' })]),
    true,
  ],
  [
    'the action’s words lead elsewhere (AR)',
    CAFE_PLAN,
    'order',
    {
      tree: tree(
        h(
          'section',
          'ck-accent-fill',
          [h('h2', '', 'اطلب'), h('a', 'ck-btn', 'اطلب الآن', { href: '#menu' })],
          { id: 'order' },
        ),
      ),
    },
    true,
  ],
  [
    'a bracketed placeholder',
    BUILDER_PLAN,
    'hero',
    hero([h('p', '', 'From [price] a month')]),
    false,
  ],
  ['lorem ipsum', BUILDER_PLAN, 'hero', hero([h('p', '', 'Lorem ipsum dolor sit amet')]), false],
  ['a masked phone', BUILDER_PLAN, 'hero', hero([h('p', '', 'Call +962 7 XXX XXXX')]), false],
  [
    'a photo from memory',
    BUILDER_PLAN,
    'hero',
    hero([h('img', '', [], { src: 'https://example.com/a.jpg', alt: 'site' })]),
    false,
  ],
  ['a palette ground class', BUILDER_PLAN, 'hero', hero([h('div', 'bg-amber-50 p-6', 'x')]), true],
  [
    'a palette class behind a variant',
    BUILDER_PLAN,
    'hero',
    hero([h('p', 'md:hover:text-sky-700', 'x')]),
    true,
  ],
  [
    'a raw shadow, hairline and ink in the css',
    BUILDER_PLAN,
    'hero',
    hero([], {
      css: '.ck-card{box-shadow:0 4px 12px rgba(15,23,42,.08);border:1px solid #e4e4e7;color:rgb(24,24,27)}',
    }),
    true,
  ],
  [
    'a mid-tone hue in the css',
    BUILDER_PLAN,
    'hero',
    hero([], { css: '.ck-glow{background:hsl(280 80% 60%)}' }),
    false,
  ],
  [
    'a named colour in the css',
    BUILDER_PLAN,
    'hero',
    hero([], { css: '.ck-x{color:crimson}' }),
    false,
  ],
  [
    'accent text that does not read',
    BUILDER_PLAN,
    'hero',
    hero([h('p', 'text-yellow-400 text-4xl', '120')]),
    true,
  ],
  [
    'accent text in the css',
    BUILDER_PLAN,
    'hero',
    hero([], { css: '.ck-stat{color:var(--ck-accent)}' }),
    true,
  ],
  [
    'white text on the accent fill',
    BUILDER_PLAN,
    'hero',
    hero([h('div', 'bg-yellow-400 p-6', [h('p', 'text-white', 'Free site visit')])]),
    true,
  ],
  [
    'white text on the page ground (AR)',
    CAFE_PLAN,
    'menu',
    {
      tree: tree(
        h('section', 'ck-ground', [h('h2', '', 'القائمة'), h('p', 'text-white', 'إسبريسو')], {
          id: 'menu',
        }),
      ),
    },
    true,
  ],
  [
    'a claim left out',
    BUILDER_PLAN,
    'projects',
    { tree: tree(h('section', 'ck-surface', [h('h2', '', 'Projects')], { id: 'projects' })) },
    false,
  ],
  [
    'a foreign face in the css',
    BUILDER_PLAN,
    'hero',
    hero([], { css: '.ck-x{font-family:Inter,sans-serif}' }),
    false,
  ],
  ['a site-face class', BUILDER_PLAN, 'hero', hero([h('p', 'font-serif', 'Since 2004')]), true],
  [
    'a web font imported',
    BUILDER_PLAN,
    'hero',
    hero([], { css: "@import url('https://fonts.googleapis.com/css2?family=Inter');" }),
    false,
  ],
  ['an arbitrary face class', BUILDER_PLAN, 'hero', hero([h('p', "font-['Cairo']", 'x')]), false],
];

const SCENE_ROWS: readonly Row[] = (
  [
    ['a syntax error', scene('const s=await ck.scene({});\nconst x = ;'), false],
    ['an unknown library', scene("const s=await ck.scene({libs:['three']});"), false],
    ['a computed library key', scene("const k='fx';const s=await ck.scene({libs:[k]});"), false],
    ['s.lib.X not listed in libs', scene(CLEAN.replace("libs:['fx']", "libs:['anim']")), true],
    ['s.lib of no library', scene(`${CLEAN}\ns.lib.particles.go();`), false],
    [
      'a [data-…] lookup the tree lacks',
      scene(CLEAN.replace('[data-fx-burst]', '[data-chase-start]')),
      false,
    ],
    ['an id lookup the tree lacks', scene(`${CLEAN}\ndocument.getElementById('score');`), false],
    ['its own Pixi application', scene('const app=new PIXI.Application();'), false],
    ['a dynamic import', scene(`const P=await import('${PIXI}');`), false],
    ['a require', scene(`const P=require('${PIXI}');`), false],
    [
      'a CDN address',
      scene("const u='https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js';"),
      false,
    ],
    ['a script element', scene("const t=document.createElement('script');"), false],
    ['eval', scene("eval('1+1');"), false],
    ['localStorage', scene("localStorage.setItem('a','1');"), false],
    ['Arabic split into letters', scene("const t='مرحبا';const letters=t.split('');"), false],
    [
      'a listener with no removal',
      scene("const fit=()=>{};addEventListener('resize',fit);ck.onDispose(()=>{});"),
      true,
    ],
    [
      'listeners and no dispose at all',
      scene("const move=()=>{};ck.root.addEventListener('pointermove',move);"),
      true,
    ],
    [
      'a listener removed for another event',
      scene(
        "const f=()=>{};ck.root.addEventListener('pointermove',f);ck.onDispose(()=>ck.root.removeEventListener('click',f));",
      ),
      true,
    ],
    ['an inline listener', scene("ck.root.addEventListener('click',()=>{});"), false],
    [
      'an interval never cleared',
      scene('if(!ck.reducedMotion){const id=setInterval(()=>{},100)}ck.onDispose(()=>{});'),
      true,
    ],
    [
      'a frame loop never cancelled',
      scene(
        'let id=0;const f=()=>{id=requestAnimationFrame(f)};if(!ck.reducedMotion)f();ck.onDispose(()=>{});',
      ),
      true,
    ],
    [
      'an observer never disconnected',
      scene('const io=new IntersectionObserver(()=>{});io.observe(ck.root);ck.onDispose(()=>{});'),
      true,
    ],
    [
      'a shared ticker',
      scene('const P=await ck.pixi();P.Ticker.shared.add(()=>{});ck.onDispose(()=>{});'),
      false,
    ],
    [
      'a ticker with no reduced-motion guard',
      scene('const {app}=await ck.stage();app.ticker.add(t=>{});'),
      true,
    ],
    [
      'keys taken on the window',
      scene(
        "const k=()=>{};window.addEventListener('keydown',k);ck.onDispose(()=>window.removeEventListener('keydown',k));",
      ),
      false,
    ],
    ['a region with no height', scene(CLEAN, { css: '.ck-scene{position:relative}' }), true],
    [
      'a setting with no default',
      scene(`const p=ck.params({tint:'#fff'});\n${CLEAN}`, { jsParams: { speed: 2 } }),
      true,
    ],
    ['settings never read', scene(CLEAN, { jsParams: { speed: 2 } }), false],
    [
      'a level whose exit is walled in',
      scene(
        "const T=s.lib.tiles;T.world(s,{rows:['#######','#p...##','#####e#','#######'],legend:{'#':{solid:true},p:{kind:'player'},e:{kind:'exit'}}});",
      ),
      false,
    ],
  ] as const
).map(([name, section, code]) => [name, BUILDER_PLAN, 'projects', section, code] as const);

function issuesOf(plan: PagePlan, key: string, section: LandedSection) {
  const pageIds = plan.sections.map(({ anchorId }) => anchorId);
  return [
    ...checkSection(plan, contractOf(plan, key), section),
    ...checkScene(section, { pageIds }),
  ];
}

function tidied(plan: PagePlan, key: string, section: LandedSection): LandedSection {
  const commands = writerSteps(section.tree, {
    ...(section.css === undefined ? {} : { css: section.css }),
    ...(section.js === undefined ? {} : { js: section.js }),
    ...(section.jsParams === undefined ? {} : { jsParams: section.jsParams }),
  });
  const { commands: after } = tidySection(commands, { plan, contract: contractOf(plan, key) });
  const value = (name: string) => written(after, name);
  return {
    tree: value('tree') as JsonValue,
    ...(typeof value('css') === 'string' ? { css: value('css') as string } : {}),
    ...(typeof value('js') === 'string' ? { js: value('js') as string } : {}),
    ...(section.jsParams === undefined ? {} : { jsParams: section.jsParams }),
  };
}

describe('the slip catalogue: what code repairs before the check, and what it leaves', () => {
  it.each([...SECTION_ROWS, ...SCENE_ROWS])('%s', (_name, plan, key, section, code) => {
    expect(issuesOf(plan, key, section)).not.toEqual([]);
    const after = issuesOf(plan, key, tidied(plan, key, section));
    if (code) expect(after).toEqual([]);
    else expect(after).not.toEqual([]);
  });

  it('counts the catalogue as its header says', () => {
    const count = (rows: readonly Row[]) => rows.filter(([, , , , code]) => code).length;
    expect([count(SECTION_ROWS), SECTION_ROWS.length]).toEqual([20, 33]);
    expect([count(SCENE_ROWS), SCENE_ROWS.length]).toEqual([10, 29]);
  });
});
