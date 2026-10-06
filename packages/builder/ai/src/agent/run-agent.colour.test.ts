import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { BuilderDocument } from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import { AiPlanRejectedError } from '../plan/validate-plan';
import { agentToolsFixtureBlocks, kitCss } from '../tools/agent/agent-tools.fixtures';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiAgent } from './run-agent';

/*
  colour-target fix, model path (2026-10-05): «عنوان قسم الخبرات خليه أحمر»
  reached the MODEL, which answered theme.apply on an accent no element on
  the page reads. The door accepted it, it landed, and the panel said
  «عُدِّلت الصفحة» with nothing changed on screen. A model plan whose only
  effect is an invisible page-css rewrite is repaired once, then refused.
*/

const HEADING = "<section class='py-16'><h2 class='text-3xl'>الخبرات</h2><p>عشر سنوات</p></section>";

function pageKernel(markup = HEADING): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'rtl',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'سارة', lang: 'ar', pageCss: kitCss('ar') }, slots: { default: ['experience'] } },
        experience: {
          id: 'experience',
          type: 'customCode',
          props: { label: 'الخبرات', tree: parseTreeMarkup(markup), css: '' },
          slots: {},
        },
      },
    } as unknown as BuilderDocument,
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('colour-model') },
  });
}

const THEME: AiPlan = {
  rationale: 'لون أحمر',
  commands: [{ command: 'tool', args: { name: 'theme.apply', input: { accent: 'red-700' } } }],
};

const HEADING_BLUE: AiPlan = {
  rationale: 'عنوان الخبرات أحمر',
  commands: [
    {
      command: 'setProp',
      args: {
        id: 'experience',
        key: 'tree',
        value: parseTreeMarkup(
          "<section class='py-16'><h2 class='text-3xl text-red-700'>الخبرات</h2><p>عشر سنوات</p></section>",
        ),
      },
    },
  ],
};

function scripted(answers: { propose: AiPlan; repair?: AiPlan }) {
  const seen: string[][] = [];
  let proposals = 0;
  const repaired = answers.repair;
  const provider: AiPlanProvider = {
    propose: () => {
      proposals += 1;
      return Promise.resolve(answers.propose);
    },
    ...(repaired === undefined
      ? {}
      : {
          repair: (_request, _context, _plan, issues) => {
            seen.push(issues.map(({ message }) => message));
            return Promise.resolve(repaired);
          },
        }),
  };
  return { provider, seen, proposals: () => proposals };
}

function rootCss(kernel: BuilderKernel): unknown {
  const document = kernel.getDocument();
  return document.nodes[document.rootId]?.props['pageCss'];
}

function run(kernel: BuilderKernel, provider: AiPlanProvider, runId: string) {
  return runAiAgent({
    runId,
    clock: fixedClock(1),
    kernel,
    provider,
    request: 'عنوان قسم الخبرات خليه أحمر',
    apply: 'auto',
    directEdits: false,
    validationPorts: { clock: fixedClock(2), ids: seededIds(runId) },
  });
}

describe('runAiAgent — a model theme plan that changes nothing on screen', () => {
  it('repairs it once, naming the element-colour rule, and lands the element colour', async () => {
    const kernel = pageKernel();
    const before = rootCss(kernel);
    const { provider, seen, proposals } = scripted({ propose: THEME, repair: HEADING_BLUE });

    const result = await run(kernel, provider, 'colour-repair');

    expect(proposals()).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.join(' ')).toContain('changes nothing anyone can see');
    expect(seen[0]?.join(' ')).toContain('text-<colour>-<shade>');
    expect(seen[0]?.join(' ')).toContain('Use theme.apply only when the request is about the whole page');
    expect(result).toMatchObject({ status: 'applied', source: 'model' });
    expect(rootCss(kernel)).toBe(before);
    expect(JSON.stringify(kernel.getDocument().nodes['experience']?.props['tree'])).toContain('text-red-700');
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('refuses it when the repair is still invisible, and writes nothing', async () => {
    const kernel = pageKernel();
    const before = rootCss(kernel);
    const { provider, seen } = scripted({ propose: THEME, repair: THEME });

    await expect(run(kernel, provider, 'colour-refuse')).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(seen).toHaveLength(1);
    expect(rootCss(kernel)).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('refuses it outright when the provider cannot repair', async () => {
    const kernel = pageKernel();
    const { provider } = scripted({ propose: THEME });

    await expect(run(kernel, provider, 'colour-no-repair')).rejects.toBeInstanceOf(AiPlanRejectedError);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('lands a theme change an element reads, with no repair round', async () => {
    const kernel = pageKernel(
      "<section class='py-16'><h2 class='text-3xl' style='color: var(--ck-accent)'>الخبرات</h2></section>",
    );
    const before = rootCss(kernel);
    const { provider, seen } = scripted({ propose: THEME, repair: HEADING_BLUE });

    const result = await run(kernel, provider, 'colour-visible');

    expect(seen).toHaveLength(0);
    expect(result).toMatchObject({ status: 'applied', source: 'model' });
    expect(rootCss(kernel)).not.toBe(before);
  });
});
