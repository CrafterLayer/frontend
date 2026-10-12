import { describe, expect, it } from 'vitest';

import type { JsonValue } from '@craftkit/builder-schema';

import { freeCodeCardExamples } from '../free-code-card';
import { parseTreeMarkup } from '../../plan/tree-markup';
import * as creativeEngines from '../../skills/creative/creative-engines';
import * as gameEngines from '../../skills/creative/game-engines';
import * as pixiCreative from '../../skills/creative/pixi-creative';
import { CRAFTKIT_AI_SKILL_DEFINITIONS } from '../../skills/builtins';
import { pixiSkillExamples } from '../../skills/creative/pixi-v8';
import { checkScene } from './check-scene';
import { readSceneSource } from './scene-source';
import type { LandedSection, SectionCheckCode } from './types';

/*
  The scene check (creative-power Phase 1 B, 2026-10-12). Two promises, both
  pinned here: it is SILENT on every scene the agent is taught — the creative
  skills' worked examples and the free-code card's, in a tree that has the
  controls each example's "Example tree" names — and every rule FIRES on a
  scene broken the way that rule describes.
*/

/** What the region's css is taught to say (the free-code card's LAYOUT line). */
const TAUGHT_CSS = '.ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px}';

/** The free-code card's DOM example names its own tree: `<b data-count="250"> in the tree`. */
const CARD_TREE = "<b data-count='250'>0</b>";

/** Every creative and Pixi skill the registry holds — a skill added later is checked too. */
const SCENE_SKILLS = CRAFTKIT_AI_SKILL_DEFINITIONS.filter(({ id }) =>
  id.startsWith('craftkit.pixi-'),
);

/** The attributes a skill's "Example tree:" line names (`button[data-fx-burst]`, `data-game-key=…`). */
const EXAMPLE_TREE_MARKUP = SCENE_SKILLS.flatMap(({ instructions }) =>
  instructions
    .split('\n')
    .filter((line) => line.startsWith('Example tree:'))
    .flatMap((line) => [...line.matchAll(/data-[\w-]+/gu)].map(([name]) => `<i ${name}></i>`)),
).join('');

const MODULES: readonly Readonly<Record<string, unknown>>[] = [
  pixiCreative,
  creativeEngines,
  gameEngines,
];

/** Every exported `…_CONTROLS` markup and `…_EXAMPLE` scene of the creative skill modules. */
function exported(suffix: string): readonly [string, string][] {
  return MODULES.flatMap((module) =>
    Object.entries(module).flatMap(([name, value]): [string, string][] =>
      name.endsWith(suffix) && typeof value === 'string' ? [[name, value]] : [],
    ),
  );
}

const TAUGHT_TREE = parseTreeMarkup(
  `<section class='ck-scene'>${[...exported('_CONTROLS').map(([, markup]) => markup), EXAMPLE_TREE_MARKUP, CARD_TREE].join('\n')}</section>`,
) as unknown as JsonValue;

/** Every worked example the agent reads: each skill's `e.g.` lines and the exported scenes. */
function taughtExamples(): readonly [string, string][] {
  return [
    ...exported('_EXAMPLE'),
    ...SCENE_SKILLS.flatMap((skill) =>
      pixiSkillExamples(skill).map((code, index): [string, string] => [
        `${skill.id} e.g. ${String(index + 1)}`,
        code,
      ]),
    ),
    ...freeCodeCardExamples().map((code, index): [string, string] => [
      `free-code card e.g. ${String(index + 1)}`,
      code,
    ]),
  ];
}

describe('checkScene on the scenes the agent is taught', () => {
  const examples = taughtExamples();

  it('reads every taught example (the creative skills and the free-code card)', () => {
    // Pixi v8 (8), the game/story/mural playbooks (3+3 exported), the engines and the card.
    expect(examples.length).toBeGreaterThanOrEqual(30);
  });

  it.each(examples)('finds nothing in %s', (_name, js) => {
    expect(checkScene({ tree: TAUGHT_TREE, css: TAUGHT_CSS, js })).toEqual([]);
  });

  it('checks nothing in a section without code', () => {
    for (const js of [undefined, '', '  \n']) {
      expect(checkScene({ tree: null, ...(js === undefined ? {} : { js }) })).toEqual([]);
    }
  });
});

const TREE = parseTreeMarkup(
  "<section class='ck-scene'><p data-status role='status'></p><button type='button' data-go>Go</button></section>",
) as unknown as JsonValue;
const CSS = '.ck-scene{position:relative;min-height:420px}';
/** A scene that passes every rule; each broken case changes one thing. */
const CLEAN =
  "const s=await ck.scene({libs:['fx']});\nconst fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nconst go=ck.root.querySelector('[data-go]');\nconst burst=()=>{if(!s.editor)fx.emit('magic',s.width/2,s.height/2)};\nif(go){go.addEventListener('click',burst);s.dispose(()=>go.removeEventListener('click',burst))}\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());";

function codes(section: Partial<LandedSection> & { readonly js: string }): SectionCheckCode[] {
  return checkScene({ tree: TREE, css: CSS, ...section }).map(({ code }) => code);
}

describe('checkScene on broken scenes: every rule fires', () => {
  it('passes the clean scene the cases start from', () => {
    expect(checkScene({ tree: TREE, css: CSS, js: CLEAN })).toEqual([]);
  });

  it.each<[string, string, SectionCheckCode]>([
    ['a syntax error', 'const s=await ck.scene({});\nconst x = ;', 'scene-syntax'],
    ['an unknown library', "const s=await ck.scene({libs:['three']});", 'scene-lib'],
    ['a computed library key', "const k='fx';const s=await ck.scene({libs:[k]});", 'scene-lib'],
    ['s.lib.X not listed in libs', CLEAN.replace("libs:['fx']", "libs:['anim']"), 'scene-lib'],
    ['s.lib of no library', `${CLEAN}\ns.lib.particles.go();`, 'scene-lib'],
    ['a [data-…] lookup the tree lacks', CLEAN.replace('[data-go]', '[data-start]'), 'scene-dom'],
    ['an id lookup the tree lacks', `${CLEAN}\ndocument.getElementById('score');`, 'scene-dom'],
    ['its own Pixi application', 'const app=new PIXI.Application();', 'scene-forbidden'],
    ['a dynamic import', "const P=await import('pixi.js');", 'scene-forbidden'],
    ['a static import', "import * as PIXI from 'pixi.js';", 'scene-forbidden'],
    ['a require', "const P=require('pixi.js');", 'scene-forbidden'],
    [
      'a CDN address',
      "const u='https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js';",
      'scene-forbidden',
    ],
    ['a script element', "const t=document.createElement('script');", 'scene-forbidden'],
    ['eval', "eval('1+1');", 'scene-forbidden'],
    ['localStorage', "localStorage.setItem('a','1');", 'scene-forbidden'],
    ['Arabic split into letters', "const t='مرحبا';const letters=t.split('');", 'scene-text'],
    [
      'a listener with no removal',
      "const fit=()=>{};addEventListener('resize',fit);ck.onDispose(()=>{});",
      'scene-cleanup',
    ],
    [
      'listeners and no dispose at all',
      "const move=()=>{};ck.root.addEventListener('pointermove',move);",
      'scene-cleanup',
    ],
    [
      'a listener removed for another event',
      "const f=()=>{};ck.root.addEventListener('pointermove',f);ck.onDispose(()=>ck.root.removeEventListener('click',f));",
      'scene-cleanup',
    ],
    [
      'an interval never cleared',
      'if(!ck.reducedMotion){const id=setInterval(()=>{},100)}ck.onDispose(()=>{});',
      'scene-cleanup',
    ],
    [
      'a requestAnimationFrame loop never cancelled',
      'let id=0;const f=()=>{id=requestAnimationFrame(f)};if(!ck.reducedMotion)f();ck.onDispose(()=>{});',
      'scene-cleanup',
    ],
    [
      'an observer never disconnected',
      'const io=new IntersectionObserver(()=>{});io.observe(ck.root);ck.onDispose(()=>{});',
      'scene-cleanup',
    ],
    [
      'a shared ticker',
      'const P=await ck.pixi();P.Ticker.shared.add(()=>{});ck.onDispose(()=>{});',
      'scene-cleanup',
    ],
    [
      'a ticker with no reduced-motion guard',
      'const {app}=await ck.stage();app.ticker.add(t=>{});',
      'scene-guard',
    ],
    [
      'keys taken on the document after a condition',
      "const k=()=>{};if(ck.root) document.addEventListener('keyup',k);ck.onDispose(()=>document.removeEventListener('keyup',k));",
      'scene-guard',
    ],
    [
      'keys taken on the window with no editor guard',
      "const k=()=>{};window.addEventListener('keydown',k);ck.onDispose(()=>window.removeEventListener('keydown',k));",
      'scene-guard',
    ],
  ])('%s', (_name, js, code) => {
    expect(codes({ js })).toContain(code);
  });

  it('asks for a region height when the scene fills a region that has none', () => {
    expect(codes({ js: CLEAN, css: '.ck-scene{position:relative}' })).toEqual(['scene-height']);
    expect(
      codes({ js: CLEAN, css: '.ck-scene{line-height:2;max-height:90vh;height:auto}' }),
    ).toEqual(['scene-height']);
    // A height in the tree, or any of the css forms, is a height.
    const sized = parseTreeMarkup(
      "<section class='md:min-h-[420px]'><button data-go>Go</button></section>",
    );
    expect(codes({ js: CLEAN, css: '', tree: sized as unknown as JsonValue })).toEqual([]);
    for (const css of ['.a{aspect-ratio:4/3}', '.a{height:60vh}', '.a{min-block-size:20rem}']) {
      expect(codes({ js: CLEAN, css })).toEqual([]);
    }
    // DOM-only code fills nothing.
    expect(codes({ js: "ck.root.querySelector('[data-go]');", css: '' })).toEqual([]);
  });

  it('asks for ck.params when the region carries settings the code never reads', () => {
    expect(codes({ js: CLEAN, jsParams: { speed: 2 } })).toEqual(['scene-params']);
    const read = `const p=ck.params({tint:'#fff'});\n${CLEAN}`;
    const issues = checkScene({
      tree: TREE,
      css: CSS,
      js: read,
      jsParams: { speed: 2, tint: '#000' },
    });
    expect(issues.map(({ code }) => code)).toEqual(['scene-params']);
    expect(issues[0]?.message).toContain("'speed'");
    expect(codes({ js: read, jsParams: { tint: '#000' } })).toEqual([]);
  });

  it('says where, as the instruction that fixes it', () => {
    const [syntax] = checkScene({
      tree: TREE,
      css: CSS,
      js: 'const s=await ck.scene({});\nconst x = ;',
    });
    expect(syntax).toMatchObject({ code: 'scene-syntax', path: 'js line 2' });
    expect(syntax?.message).toMatch(/^Fix the syntax error at line 2/u);
    const [lib] = checkScene({
      tree: TREE,
      css: CSS,
      js: CLEAN.replace("libs:['fx']", "libs:['anim']"),
    });
    expect(lib).toMatchObject({ code: 'scene-lib', path: 'js line 2' });
    expect(lib?.message).toContain("ck.scene({libs:['fx', …]})");
    const [dom] = checkScene({
      tree: TREE,
      css: CSS,
      js: CLEAN.replace('[data-go]', '[data-start]'),
    });
    expect(dom).toMatchObject({ code: 'scene-dom', path: 'js line 3' });
    expect(dom?.message).toContain('[data-start]');
  });
});

describe('checkScene stays silent where it cannot be sure', () => {
  it('never reads strings, comments or regexes as code', () => {
    const js = `// new PIXI.Application() and import('x') were the old way
/* window.addEventListener('keydown', k) */
const note='app.ticker.add(f) addEventListener( setInterval( s.lib.three';
const pattern=/['"]\\/import\\(/g;
const tpl=\`\${note} new Application(\${pattern.source})\`;
${CLEAN}`;
    expect(checkScene({ tree: TREE, css: CSS, js })).toEqual([]);
  });

  it('takes an anchor of another section from a page-level lookup', () => {
    const js = `${CLEAN}\ndocument.getElementById('menu');document.querySelector('#order');`;
    expect(codes({ js })).toEqual(['scene-dom', 'scene-dom']);
    expect(checkScene({ tree: TREE, css: CSS, js }, { pageIds: ['menu', 'order'] })).toEqual([]);
  });

  it('takes an attribute the code writes itself, and a tree whose components it cannot see', () => {
    const made = `${CLEAN}\nck.root.insertAdjacentHTML('beforeend','<b data-score></b>');ck.root.querySelector('[data-score]');`;
    expect(codes({ js: made })).toEqual([]);
    const viaDataset = `${CLEAN}\nconst b=document.createElement('b');b.dataset.hiScore='1';ck.root.querySelector('[data-hi-score]');`;
    expect(codes({ js: viaDataset })).toEqual([]);
    const component = parseTreeMarkup(
      "<section class='ck-scene'><ck-component type='kit' props='{}'></ck-component></section>",
    ) as unknown as JsonValue;
    expect(codes({ js: CLEAN.replace('[data-go]', '[data-start]'), tree: component })).toEqual([]);
  });

  it("reads a page-level attribute as the page's, and an interval as a clock, not motion", () => {
    const theme = `${CLEAN}\nconst dark=document.documentElement.matches('[data-theme=dark]');`;
    expect(codes({ js: theme })).toEqual([]);
    const clock = `${CLEAN}\nconst id=setInterval(()=>{},1000);ck.onDispose(()=>clearInterval(id));`;
    expect(codes({ js: clock })).toEqual([]);
  });

  it('leaves what the runtime ends alone: app.ticker, app.renderer, s.tick, s.fixedTick', () => {
    const js = `const {app}=await ck.stage();const lay=()=>{};app.renderer.on('resize',lay);if(!ck.reducedMotion)app.ticker.add(t=>lay());`;
    expect(codes({ js })).toEqual([]);
  });
});

describe('readSceneSource', () => {
  it('blanks strings, templates, comments and regexes without moving a character', () => {
    const code = "const a='x(y)';// c\nconst r=/[)]/g;const t=`a${b('(')}c`;";
    const { bare, literals } = readSceneSource(code);
    expect(bare).toHaveLength(code.length);
    expect(bare.split('\n')).toHaveLength(2);
    expect(bare).not.toMatch(/x\(y\)|\/\/ c|\[\)\]/u);
    // A template's expression stays code; its text and the string inside it are literals.
    expect(bare).toContain('${b(');
    expect(literals.map(({ text }) => text)).toEqual(['x(y)', 'a', '(', 'c']);
  });

  it('tells a division from a regex', () => {
    const { bare } = readSceneSource('const w=a/2/b;const r=x.split(/\'/);return /"/.test(q);');
    expect(bare).toContain('a/2/b');
    expect(bare).not.toContain("'/");
  });
});
