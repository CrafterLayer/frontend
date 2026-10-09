import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { scriptCrossPage } from '../script/cross-page';
import { createInlineScriptRunner } from '../script/runner-inline';
import { scriptPlan, twoPageSite } from '../script/script.fixtures';
import { resolveAiCommandPolicy } from '../skills';
import { applyAiPlan } from './apply-plan';
import { generateAiPlan } from './generate-plan';

/*
  agent-script DESIGN §A.9 (script-wiring): the owner's "rename across pages".
  A script with a site reads every page and writes two of them; the open
  page's steps and the other page's land as ONE site transaction, and one Undo
  reverts both pages.
*/

const RENAME =
  "ck.find({page:'*',kind:'heading',text:'Brew Co'}).forEach(function(h){ck.set(h,{text:h.text.replace('Brew Co','Bean Co')})})";

const ports = (seed: string) => ({ clock: fixedClock(2), ids: seededIds(seed) });

function region(site: ReturnType<typeof twoPageSite>['site'], pageId: string): string {
  const document = site.page(pageId).getDocument();
  const [regionId] = document.nodes[document.rootId]?.slots?.['default'] ?? [];
  return JSON.stringify(regionId === undefined ? null : document.nodes[regionId]?.props['tree']);
}

async function renamePlan(withSite: boolean) {
  const fixture = twoPageSite();
  const lens = fixture.site.page(fixture.site.currentPage());
  const runner = createInlineScriptRunner();
  const plan = await generateAiPlan({
    kernel: lens,
    provider: { propose: () => Promise.resolve(scriptPlan(RENAME)) },
    request: 'rename Brew Co to Bean Co on every page',
    validationPorts: ports('cross-generate'),
    scriptRunner: runner,
    ...(withSite ? { scriptSite: fixture.scriptSite } : {}),
  });
  runner.dispose();
  const policy = resolveAiCommandPolicy({ registeredCommands: lens.context.registry.commandNames() });
  return { ...fixture, lens, plan, policy };
}

describe('applyAiPlan — a script that writes every page', () => {
  it('lands the open page and the other page as ONE site transaction; one Undo reverts both', async () => {
    const { site, lens, plan, policy } = await renamePlan(true);
    const home = site.currentPage();
    const crossPage = scriptCrossPage(plan);
    expect(crossPage.map(({ pageId }) => pageId)).toEqual(['about']);
    expect(plan.commands.length).toBeGreaterThan(0);
    expect(region(site, home)).toContain('Brew Co');
    expect(region(site, 'about')).toContain('About Brew Co');
    const logged = site.transactions().length;

    const applied = applyAiPlan({
      kernel: lens,
      plan,
      policy,
      validationPorts: ports('cross-apply'),
      label: 'Rename the brand',
      site,
      crossPage,
    });

    expect(applied.transactions).toHaveLength(1);
    expect(site.transactions().length - logged).toBe(1);
    expect(region(site, home)).toContain('Bean Co');
    expect(region(site, home)).not.toContain('Brew Co');
    expect(region(site, 'about')).toContain('About Bean Co');

    expect(site.undo()).toBe(true);
    expect(region(site, home)).toContain('Brew Co');
    expect(region(site, 'about')).toContain('About Brew Co');
    expect(region(site, 'about')).not.toContain('Bean Co');
  });

  it('refuses other-page writes without a site, before writing anything', async () => {
    const { site, lens, plan, policy } = await renamePlan(true);
    const logged = site.transactions().length;
    expect(() =>
      applyAiPlan({
        kernel: lens,
        plan,
        policy,
        validationPorts: ports('cross-no-site'),
        crossPage: scriptCrossPage(plan),
      }),
    ).toThrow(/pass `site`/u);
    expect(site.transactions()).toHaveLength(logged);
    expect(region(site, 'about')).toContain('About Brew Co');
  });

  it('refuses a site whose current page is not the plan’s page', async () => {
    const { site, plan, policy } = await renamePlan(true);
    expect(() =>
      applyAiPlan({
        kernel: site.page('about'),
        plan,
        policy,
        validationPorts: ports('cross-wrong-page'),
        site,
        crossPage: scriptCrossPage(plan),
      }),
    ).toThrow(/not the page this plan was made for/u);
  });

  it('without a site the same script edits the open page only and carries no other-page writes', async () => {
    const { site, lens, plan, policy } = await renamePlan(false);
    expect(scriptCrossPage(plan)).toEqual([]);
    applyAiPlan({ kernel: lens, plan, policy, validationPorts: ports('cross-open-only') });
    expect(region(site, site.currentPage())).toContain('Bean Co');
    expect(region(site, 'about')).toContain('About Brew Co');
  });
});
