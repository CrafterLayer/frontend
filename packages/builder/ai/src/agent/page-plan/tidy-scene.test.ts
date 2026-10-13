import { describe, expect, it } from 'vitest';

import { scriptCodeIssues, type JsonValue } from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../../plan/tree-markup';
import { checkScene } from './check-scene';
import { BUILDER_PLAN, contractOf, writerSteps, written } from './tidy.fixtures';
import { tidySection } from './tidy-section';
import type { SectionCheckCode } from './types';

/*
  The scene repairs (2026-10-13): each row is one of check-scene.test.ts's
  broken scenes, written the way a writer slips. Tidy's code must still
  parse, and the scene check must find nothing in it — the slip never reaches
  the repair round. The rows that need a reading of what the scene is for
  (an unknown library, an inline handler, a frame loop with no kept id) are
  left exactly as written.
*/

const TREE = parseTreeMarkup(
  "<section id='projects' class='ck-scene'><h2>Projects</h2><p>120 homes delivered</p><p data-anim-status role='status'></p><button type='button' data-fx-burst>Go</button></section>",
) as unknown as JsonValue;
const CSS = '.ck-scene{position:relative;min-height:420px}';

function sceneCodes(
  js: string,
  extra: { css?: string; tree?: JsonValue; jsParams?: JsonValue } = {},
): SectionCheckCode[] {
  return checkScene({
    tree: extra.tree ?? TREE,
    css: extra.css ?? CSS,
    js,
    ...(extra.jsParams === undefined ? {} : { jsParams: extra.jsParams }),
  }).map(({ code }) => code);
}

function tidied(js: string, extra: { css?: string; tree?: JsonValue; jsParams?: JsonValue } = {}) {
  const commands = writerSteps(extra.tree ?? TREE, {
    css: extra.css ?? CSS,
    js,
    ...(extra.jsParams === undefined ? {} : { jsParams: extra.jsParams }),
  });
  const report = tidySection(commands, {
    plan: BUILDER_PLAN,
    contract: contractOf(BUILDER_PLAN, 'projects'),
  });
  return {
    report,
    unchanged: report.commands === commands,
    js: written(report.commands, 'js') as string,
    css: written(report.commands, 'css') as string,
    tree: JSON.stringify(written(report.commands, 'tree')),
  };
}

/** Tidies a broken scene and asserts: the check found `code`, the tidied code parses, the check finds nothing. */
function repaired(
  js: string,
  code: SectionCheckCode,
  extra: { css?: string; tree?: JsonValue; jsParams?: JsonValue } = {},
) {
  expect(sceneCodes(js, extra)).toContain(code);
  const result = tidied(js, extra);
  expect(
    scriptCodeIssues(result.js, { switchOn: true }).filter(({ code: issue }) => issue === 'syntax'),
  ).toEqual([]);
  expect(
    sceneCodes(result.js, {
      ...extra,
      css: result.css,
      tree: JSON.parse(result.tree) as JsonValue,
    }),
  ).toEqual([]);
  return result;
}

const FX =
  'const fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());';

describe('tidySection — scene-lib: what s.lib uses is listed', () => {
  it.each([
    [
      'added to the literal list',
      "const s=await ck.scene({libs:['anim']});\n",
      "ck.scene({libs:['fx','anim']})",
    ],
    ['added to an empty list', 'const s=await ck.scene({libs:[ ]});\n', "ck.scene({libs:['fx' ]})"],
    [
      'a list made in the options',
      'const s=await ck.scene({seed:7});\n',
      "ck.scene({libs:['fx'],seed:7})",
    ],
    ['options made for a bare call', 'const s=await ck.scene();\n', "ck.scene({libs:['fx']})"],
  ])('%s', (_name, head, expected) => {
    const { js, report } = repaired(`${head}${FX}`, 'scene-lib');
    expect(js).toContain(expected);
    expect(report.fixed).toEqual(['scene-libs']);
  });

  it('leaves a key that is not a library, and two lists, to the writer', () => {
    expect(
      tidied(`const s=await ck.scene({libs:['fx']});\n${FX}\ns.lib.particles.go();`).unchanged,
    ).toBe(true);
    const two = `const s=await ck.scene({libs:['anim']});const t=await ck.scene({libs:[]});\n${FX}`;
    expect(tidied(two).unchanged).toBe(true);
  });
});

describe('tidySection — scene-params: every setting has a default', () => {
  it("defaults a region setting with the region's own value", () => {
    const js = `const p=ck.params({tint:'#fff'});\nconst s=await ck.scene({libs:['fx']});\n${FX}`;
    const { js: after } = repaired(js, 'scene-params', {
      jsParams: { speed: 2, 'trail-length': 'long' },
    });
    expect(after).toContain(`ck.params({speed:2,"trail-length":"long",tint:'#fff'})`);
  });

  it('leaves code that never calls ck.params to the writer', () => {
    const js = `const s=await ck.scene({libs:['fx']});\n${FX}`;
    expect(tidied(js, { jsParams: { speed: 2 } }).unchanged).toBe(true);
  });
});

describe('tidySection — scene-guard: a ticker loop calms under reduced motion', () => {
  it('guards every ticker loop that starts a statement', () => {
    const js =
      'const {app}=await ck.stage();\napp.ticker.add(t=>{});\nif(app)app.ticker.add(t=>{})';
    const { js: after } = repaired(js, 'scene-guard');
    expect(after).toBe(
      'const {app}=await ck.stage();\nif(!ck.reducedMotion)app.ticker.add(t=>{});\nif(app)if(!ck.reducedMotion)app.ticker.add(t=>{})',
    );
  });

  it('leaves a loop inside an expression, or a frame loop beside it, to the writer', () => {
    expect(
      tidied('const {app}=await ck.stage();const go=()=>app.ticker.add(t=>{});go();').unchanged,
    ).toBe(true);
    const frames =
      'const {app}=await ck.stage();app.ticker.add(t=>{});let id=0;const f=()=>{id=requestAnimationFrame(f)};f();ck.onDispose(()=>cancelAnimationFrame(id));';
    expect(tidied(frames).unchanged).toBe(true);
  });

  it('never reads a ticker in a comment or a string as code', () => {
    const js =
      "const {app}=await ck.stage();\n// app.ticker.add(f) is how\nconst note='app.ticker.add(';\napp.ticker.add(t=>{});";
    const { js: after } = repaired(js, 'scene-guard');
    expect(after.match(/reducedMotion/gu)).toHaveLength(1);
    expect(after).toContain(
      "// app.ticker.add(f) is how\nconst note='app.ticker.add(';\nif(!ck.reducedMotion)app.ticker.add",
    );
  });
});

describe('tidySection — scene-cleanup: what outlives the stage is released', () => {
  it.each([
    [
      'a listener with no removal',
      "const fit=()=>{};addEventListener('resize',fit);ck.onDispose(()=>{});",
      "addEventListener('resize',fit);ck.onDispose(()=>removeEventListener('resize',fit));",
    ],
    [
      'listeners and no dispose at all',
      "const move=()=>{};ck.root.addEventListener('pointermove',move,{passive:true});",
      "ck.root.addEventListener('pointermove',move,{passive:true});ck.onDispose(()=>ck.root.removeEventListener('pointermove',move))",
    ],
    [
      'a listener removed for another event',
      "const f=()=>{};ck.root.addEventListener('pointermove',f);ck.onDispose(()=>ck.root.removeEventListener('click',f));",
      "ck.root.addEventListener('pointermove',f);ck.onDispose(()=>ck.root.removeEventListener('pointermove',f));",
    ],
    [
      'a capturing listener',
      "const f=()=>{};window.addEventListener('scroll',f,true);",
      "window.addEventListener('scroll',f,true);ck.onDispose(()=>window.removeEventListener('scroll',f,true))",
    ],
    [
      'an interval never cleared, inside a block',
      'if(!ck.reducedMotion){const id=setInterval(()=>{},100)}ck.onDispose(()=>{});',
      '{const id=setInterval(()=>{},100);ck.onDispose(()=>clearInterval(id))}',
    ],
    [
      'an observer never disconnected',
      'const io=new IntersectionObserver(()=>{});io.observe(ck.root);ck.onDispose(()=>{});',
      'const io=new IntersectionObserver(()=>{});ck.onDispose(()=>io.disconnect());io.observe(ck.root);',
    ],
    [
      'a frame loop kept in a top-level id',
      'let id=0;const f=()=>{id=requestAnimationFrame(f)};if(!ck.reducedMotion)f();ck.onDispose(()=>{});',
      'if(!ck.reducedMotion)f();ck.onDispose(()=>{});\nck.onDispose(()=>cancelAnimationFrame(id));',
    ],
  ])('%s', (_name, js, expected) => {
    const { js: after, report } = repaired(js, 'scene-cleanup');
    expect(after).toContain(expected);
    expect(report.fixed).toEqual(['scene-cleanup']);
  });

  it.each([
    ['an inline handler', "ck.root.addEventListener('click',()=>{});"],
    [
      'a listener on an expression',
      "ck.root.querySelector('b').addEventListener('click',go);function go(){}",
    ],
    [
      'a shared ticker',
      'const P=await ck.pixi();P.Ticker.shared.add(()=>{});ck.onDispose(()=>{});',
    ],
    ['an interval never kept', 'setInterval(()=>{},100);ck.onDispose(()=>{});'],
  ])('leaves %s to the writer', (_name, js) => {
    expect(sceneCodes(js)).toContain('scene-cleanup');
    expect(tidied(js).unchanged).toBe(true);
  });
});

describe('tidySection — scene-height: a scene region gets the taught height', () => {
  const js = `const s=await ck.scene({libs:['fx']});\n${FX}`;

  it('sizes an empty stage by its width, as the free-code card teaches', () => {
    const stage = parseTreeMarkup(
      "<section id='projects'><button type='button' data-fx-burst></button></section>",
    ) as unknown as JsonValue;
    const { css, tree } = repaired(js, 'scene-height', { css: '', tree: stage });
    expect(css).toBe('.ck-scene{width:100%;aspect-ratio:16/9;min-height:320px}');
    expect(tree).toContain('"className":"ck-scene"');
  });

  it('gives a region with content only a floor, so nothing it shows overflows', () => {
    const filled = parseTreeMarkup(
      "<section id='projects' class='py-16'><h2>Projects</h2><p>120 homes delivered</p><button type='button' data-fx-burst>Go</button></section>",
    ) as unknown as JsonValue;
    const { css, tree } = repaired(js, 'scene-height', {
      css: '.ck-x{position:relative}',
      tree: filled,
    });
    expect(css).toBe('.ck-x{position:relative}\n.ck-scene{min-height:320px}');
    expect(tree).toContain('"className":"py-16 ck-scene"');
  });

  it('writes the css as a step of its own when the writer wrote none', () => {
    const stage = parseTreeMarkup(
      "<section id='projects'><button type='button' data-fx-burst></button></section>",
    ) as unknown as JsonValue;
    const commands = [
      { command: 'setProp', args: { id: 'r-1', key: 'tree', value: stage } },
      { command: 'setProp', args: { id: 'r-1', key: 'js', value: js } },
    ];
    const report = tidySection(commands, {
      plan: BUILDER_PLAN,
      contract: contractOf(BUILDER_PLAN, 'projects'),
    });
    expect(report.commands.map(({ args }) => (args as { key: string }).key)).toEqual([
      'tree',
      'css',
      'js',
    ]);
  });
});
