import { afterAll, describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';

import { applyAiPlan } from '../plan/apply-plan';
import { validateAiPlan } from '../plan/validate-plan';
import { sectionKit } from '../section-kit/kit-index';
import { kitSamples } from '../section-kit/kit-testing';
import { styleKernel } from '../style-tools/style-tools.fixtures';
import { asTreeRoot } from '../style-tools/tree-steps';
import { expandAgentTools } from '../tools/agent/expand';
import type { AgentToolStep } from '../tools/agent/types';
import type { AiPlan } from '../types';
import { expandScriptSteps, type ScriptExpansion, type ScriptExpansionOptions } from './expand-scripts';
import { createInlineScriptRunner } from './runner-inline';
import {
  arabicKernel,
  buttonsKernel,
  menuKernel,
  policyOf,
  scriptPlan,
  scriptPorts,
  twoPageSite,
} from './script.fixtures';
import type { ScriptRunner } from './types';

const runner = createInlineScriptRunner();
afterAll(() => {
  runner.dispose();
});

function expand(plan: unknown, kernel: BuilderKernel, options: ScriptExpansionOptions = {}): Promise<ScriptExpansion> {
  return expandScriptSteps(plan, kernel, { runner, policy: policyOf(kernel), ...options });
}

function commandsOf(expansion: ScriptExpansion): readonly AgentToolStep[] {
  expect(expansion.issues.map(({ message }) => message)).toEqual([]);
  return (expansion.plan as { commands: AgentToolStep[] }).commands;
}

function issueOf(expansion: ScriptExpansion): string {
  expect(expansion.issues).toHaveLength(1);
  expect(expansion.issues[0]).toMatchObject({ code: 'invalid-args', step: 0 });
  return expansion.issues[0]?.message ?? '';
}

function door(plan: unknown, kernel: BuilderKernel) {
  const judged = validateAiPlan(plan, kernel, scriptPorts(), policyOf(kernel));
  if (!judged.ok) throw new Error(judged.issues.map(({ message }) => message).join('\n'));
  return judged.plan;
}

const ROUND = "ck.style(ck.find({kind:'button'}),{borderRadius:'full'})";

describe('expandScriptSteps — end to end on a real kernel', () => {
  it('rounds every button: 3 setProps, door-valid, ONE transaction, and Undo restores the page', async () => {
    const kernel = buttonsKernel();
    const before = structuredClone(kernel.getDocument());
    const expansion = await expand(scriptPlan(ROUND), kernel);
    const commands = commandsOf(expansion);
    expect(commands.map(({ command, args }) => [command, args['id'], args['key']])).toEqual([
      ['setProp', 'r-a', 'tree'],
      ['setProp', 'r-b', 'tree'],
      ['setProp', 'r-c', 'tree'],
    ]);
    expect(commands[0]?.title).toBe('Script: 14 edits');
    expect(expansion.runs).toEqual([expect.objectContaining({ step: 0, steps: 3, notes: [] })]);
    expect(expansion.crossPage).toEqual([]);
    const plan = door(expansion.plan, kernel);
    const transactionsBefore = kernel.transactions().length;
    const applied = applyAiPlan({ kernel, plan, policy: policyOf(kernel), validationPorts: scriptPorts(), label: 'Round every button' });
    expect(applied.transactions).toHaveLength(1);
    expect(kernel.transactions().length).toBe(transactionsBefore + 1);
    expect(JSON.stringify(kernel.getDocument()).match(/rounded-full/gu)).toHaveLength(14);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
  });

  it('translates headings from a map, titled by the script step', async () => {
    const kernel = styleKernel();
    const code =
      "const t={'Fresh coffee daily':'قهوة طازجة كل يوم','Our menu':'قائمتنا','Our story':'قصتنا'};ck.find({kind:'heading'}).forEach(h=>{if(t[h.text])ck.set(h,{text:t[h.text]})})";
    const expansion = await expand(scriptPlan(code, 'Translate headings'), kernel);
    const commands = commandsOf(expansion);
    expect(commands.map(({ args }) => args['id'])).toEqual(['r-hero', 'r-menu', 'r-story']);
    expect(commands[0]?.title).toBe('Translate headings');
    const text = JSON.stringify(commands);
    for (const word of ['قهوة طازجة كل يوم', 'قائمتنا', 'قصتنا']) expect(text).toContain(word);
    door(expansion.plan, kernel);
  });

  it('adds 8 menu items through ck.tool(part.list) as ONE setProp', async () => {
    const kernel = menuKernel();
    const code =
      "const d=['حمص','متبل','فلافل','فتوش','تبولة','منسف','مقلوبة','كنافة'];const m=ck.find({kind:'heading',text:'قائمتنا'})[0];d.forEach((t,i)=>ck.tool('part.list',{id:m.node,part:'items',op:'add',index:[i],item:{title:t,body:ck.fmt.money(2+i,'JOD')}}));ck.note('ثمانية أطباق')";
    const expansion = await expand(scriptPlan(code), kernel);
    const commands = commandsOf(expansion);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ command: 'setProp', args: { id: 'menu-1', key: 'items' }, title: 'ثمانية أطباق' });
    const items = commands[0]?.args['value'] as { title: string; body: string }[];
    expect(items.map(({ title }) => title)).toEqual(['حمص', 'متبل', 'فلافل', 'فتوش', 'تبولة', 'منسف', 'مقلوبة', 'كنافة']);
    expect(items[0]?.body).toBe('2 د.أ');
    expect(expansion.runs[0]?.notes).toEqual(['ثمانية أطباق']);
    door(expansion.plan, kernel);
  });

  it('inserts a kit section through ck.tool(kit.insert)', async () => {
    const kernel = arabicKernel();
    const kit = sectionKit('stats-row');
    if (kit === undefined) throw new Error('stats-row');
    const code = `ck.tool('kit.insert',${JSON.stringify({ kit: 'stats-row', slots: kitSamples(kit, 'ar') })})`;
    const commands = commandsOf(await expand(scriptPlan(code), kernel));
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ command: 'insertNode', args: { type: 'customCode', parentId: 'root' } });
    door({ rationale: 'kit', commands }, kernel);
  });

  it('reads the page as the plan’s earlier steps leave it', async () => {
    const kernel = styleKernel();
    const plan = {
      rationale: 'prefix',
      commands: [
        { command: 'tool', args: { name: 'copy.set', input: { edits: [{ find: 'Fresh coffee daily', text: 'Hot coffee' }] } } },
        { command: 'tool', args: { name: 'script.run', input: { code: "ck.find({text:'hot coffee'}).forEach(e=>ck.set(e,{text:'Hot tea'}))" } } },
      ],
    };
    const commands = commandsOf(await expand(plan, kernel));
    expect(commands[0]).toBe(plan.commands[0]);
    expect(commands).toHaveLength(2);
    expect(JSON.stringify(commands[1])).toContain('Hot tea');
    // The plan still judges as one: the prefix tool expands, the script's write lands on top.
    const expanded = expandAgentTools({ rationale: 'prefix', commands }, kernel);
    expect(expanded.issues).toEqual([]);
    const judged = door(expanded.plan, kernel);
    applyAiPlan({ kernel, plan: judged, policy: policyOf(kernel), validationPorts: scriptPorts() });
    expect(JSON.stringify(asTreeRoot(kernel.getDocument().nodes['r-hero']?.props['tree']))).toContain('Hot tea');
  });

  it('skips elements that already look like that (a no-op is not an error)', async () => {
    const kernel = buttonsKernel();
    const first = await expand(scriptPlan("ck.style(ck.find({kind:'button',section:'Hero'}),{borderRadius:'full'})"), kernel);
    applyAiPlan({ kernel, plan: door(first.plan, kernel), policy: policyOf(kernel), validationPorts: scriptPorts() });
    const second = commandsOf(await expand(scriptPlan(ROUND), kernel));
    expect(second.map(({ args }) => args['id'])).toEqual(['r-b', 'r-c']);
  });

  it('accepts a script wrapped in fences or a function', async () => {
    const kernel = buttonsKernel();
    const fenced = '```js\n(() => {\n  ' + ROUND + ';\n})()\n```';
    expect(commandsOf(await expand(scriptPlan(fenced), kernel))).toHaveLength(3);
  });
});

describe('expandScriptSteps — errors the repair round reads', () => {
  it('lanes [section] refuse an edit-only tool with E_NO_TOOL', async () => {
    const kernel = arabicKernel();
    const expansion = await expand(scriptPlan("ck.tool('kit.insert',{kit:'stats-row',slots:{}})"), kernel, { lanes: ['section'] });
    expect(issueOf(expansion)).toMatch(/^Step 0 \(tool script\.run\): E_NO_TOOL call #1 \(line 1\): no tool "kit\.insert" here\./u);
    expect(expansion.plan).toEqual(scriptPlan("ck.tool('kit.insert',{kit:'stats-row',slots:{}})"));
  });

  it('E_TOOL_INPUT carries the call number and the script line', async () => {
    const kernel = menuKernel();
    const expansion = await expand(scriptPlan("ck.note('menu');\nck.tool('part.list',{id:'menu-1'})"), kernel);
    expect(issueOf(expansion)).toMatch(/E_TOOL_INPUT call #1 \(line 2\) tool "part\.list": /u);
  });

  it('a tool that refuses when it runs → E_TOOL_INPUT for that call', async () => {
    const kernel = menuKernel();
    const expansion = await expand(scriptPlan("ck.tool('part.list',{id:'menu-1',part:'items',op:'remove',index:[5]})"), kernel);
    expect(issueOf(expansion)).toMatch(/E_TOOL_INPUT call #1 \(line 1\) tool "part\.list": /u);
  });

  it('E_EMPTY lists the kinds on the page', async () => {
    const kernel = buttonsKernel();
    expect(issueOf(await expand(scriptPlan("ck.find({kind:'video'})"), kernel))).toMatch(
      /E_EMPTY: the script changed nothing\. Kinds on this page: button 14, section 3, heading 2, text 1$/u,
    );
    const done = await expand(scriptPlan(ROUND), kernel);
    applyAiPlan({ kernel, plan: door(done.plan, kernel), policy: policyOf(kernel), validationPorts: scriptPorts() });
    expect(issueOf(await expand(scriptPlan(ROUND), kernel))).toContain("E_EMPTY: the script changed nothing. ck.find({kind:'button'}) found 14 here;");
  });

  it('E_TOO_MANY_WRITES past the policy cap', async () => {
    const kernel = buttonsKernel();
    const expansion = await expand(scriptPlan(ROUND), kernel, { policy: { ...policyOf(kernel), maxCommands: 2 } });
    expect(issueOf(expansion)).toContain('E_TOO_MANY_WRITES: the script touches 3 sections (max 2 writes per plan).');
  });

  it('E_BAD_TARGET for a write the element cannot take', async () => {
    const kernel = buttonsKernel();
    expect(issueOf(await expand(scriptPlan("ck.set(ck.find({kind:'section'}),{text:'x'})"), kernel))).toContain(
      'E_BAD_TARGET call #1 (line 1): a section has no own text',
    );
  });

  it('E_OTHER_PAGE for a write to another page without a site', async () => {
    const kernel = buttonsKernel();
    const fake: ScriptRunner = {
      run: () =>
        Promise.resolve({
          ok: true,
          calls: [{ n: 1, line: 1, op: 'tool', name: 'nav.sync', input: {}, page: 'about' }],
          notes: [],
          stats: { ms: 0, calls: 1, found: 0 },
        }),
      dispose: () => undefined,
    };
    expect(issueOf(await expand(scriptPlan("ck.tool('nav.sync',{},{page:'about'})"), kernel, { runner: fake }))).toContain(
      'E_OTHER_PAGE: this edit can only change the open page (page "Brew")',
    );
  });

  it('engine-side errors pass through (E_SYNTAX), and a runner that throws is E_ENGINE', async () => {
    const kernel = buttonsKernel();
    expect(issueOf(await expand(scriptPlan('ck.style('), kernel))).toContain('E_SYNTAX');
    const broken: ScriptRunner = { run: () => Promise.reject(new Error('wasm')), dispose: () => undefined };
    expect(issueOf(await expand(scriptPlan(ROUND), kernel, { runner: broken }))).toContain('E_ENGINE');
  });

  it('a script.run input that is not {code} is refused', async () => {
    const kernel = buttonsKernel();
    const plan = { rationale: 'x', commands: [{ command: 'tool', args: { name: 'script.run', input: { code: ROUND, extra: 1 } } }] };
    expect(issueOf(await expand(plan, kernel))).toContain('E_TOOL_INPUT tool "script.run": input must be exactly {"code":"…"}');
  });
});

describe('expandScriptSteps — pages, determinism, the fast path', () => {
  it('writes to another page become crossPage steps, door-valid on that page, ONE site transaction', async () => {
    const { site, scriptSite } = twoPageSite();
    const home = site.page(site.currentPage());
    const code = "ck.find({kind:'heading',page:'*'}).forEach(h=>ck.set(h,{text:h.text.replace('Brew Co','Bean Co')}))";
    const expansion = await expand(scriptPlan(code), home, { site: scriptSite });
    const commands = commandsOf(expansion);
    expect(commands.map(({ args }) => args['id'])).toEqual(['r-h']);
    expect(expansion.crossPage.map(({ pageId, commands: steps }) => [pageId, steps.map(({ args }) => args['id'])])).toEqual([['about', ['r-s']]]);
    const about = site.page('about');
    const crossSteps = expansion.crossPage[0]?.commands ?? [];
    expect(validateAiPlan({ rationale: 'x', commands: crossSteps }, about, scriptPorts(), policyOf(about)).ok).toBe(true);

    const before = structuredClone(site.getSite());
    site.dispatchGroup(
      [
        ...commands.map(({ command, args }) => ({ command, args, pageId: site.currentPage() })),
        ...crossSteps.map(({ command, args }) => ({ command, args, pageId: 'about' })),
      ],
      { author: 'ai', label: 'Rename the brand' },
    );
    expect(JSON.stringify(site.getSite())).not.toContain('Brew Co');
    expect(site.undo()).toBe(true);
    expect(site.getSite()).toEqual(before);
  });

  it('is deterministic: the same plan on the same page gives the same steps', async () => {
    const code = "ck.find({kind:'button'}).forEach((b,i)=>{if(Math.random()<2)ck.set(b,{text:'B'+i})})";
    const first = await expand(scriptPlan(code), buttonsKernel());
    const second = await expand(scriptPlan(code), buttonsKernel());
    expect(JSON.stringify(first.plan)).toBe(JSON.stringify(second.plan));
  });

  it('returns a plan without script.run as the same object, loading no runner', async () => {
    const kernel = buttonsKernel();
    const plan = { rationale: 'plain', commands: [{ command: 'setProp', args: { id: 'r-a', key: 'label', value: 'x' } }] };
    const refusing: ScriptRunner = { run: () => Promise.reject(new Error('must not run')), dispose: () => undefined };
    const expansion = await expandScriptSteps(plan, kernel, { runner: refusing });
    expect(expansion.plan).toBe(plan);
    expect(expansion).toEqual({ plan, issues: [], runs: [], crossPage: [] });
    const notAPlan = 'nope';
    expect((await expandScriptSteps(notAPlan, kernel)).plan).toBe(notAPlan);
  });

  it('keeps the steps around the script in order', async () => {
    const kernel = buttonsKernel();
    const plan = {
      rationale: 'mixed',
      commands: [
        { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'Top' } },
        { command: 'tool', args: { name: 'script.run', input: { code: ROUND } } },
        { command: 'setProp', args: { id: 'r-c', key: 'label', value: 'Bottom' } },
      ],
    };
    const commands = commandsOf(await expand(plan, kernel));
    expect(commands.map(({ args }) => [args['id'], args['key']])).toEqual([
      ['r-a', 'label'],
      ['r-a', 'tree'],
      ['r-b', 'tree'],
      ['r-c', 'tree'],
      ['r-c', 'label'],
    ]);
    const judged: AiPlan = door({ rationale: 'mixed', commands }, kernel);
    expect(judged.commands).toHaveLength(5);
  });
});
