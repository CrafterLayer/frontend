import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { CRAFTKIT_DEFAULT_SKILLS, createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlanProvider, AssembledAiContext } from '../types';
import { runAiBuild } from './run-build';
import { planAiPage } from './plan-page';
import { BUILDER_PLAN } from './page-plan/tidy.fixtures';
import { validatePagePlan } from './page-plan/validate-page-plan';

const NullRender: BlockRenderComponent = () => null;
const extension: TrustedExtensionManifest = {
  tier: 1,
  name: 'free-design-fixture',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({
            title: z.string().default(''),
            description: z.string().default(''),
            lang: z.string().default(''),
            pageCss: customCss(20_000),
          }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'Authored composition',
          props: z.object({
            label: z.string().default(''),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
            js: z.string().default(''),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};
function kernel() {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
    },
    extensions: [extension],
    ports: { clock: fixedClock(1), ids: seededIds('free-design') },
  });
}
function candidate() {
  return {
    ...BUILDER_PLAN,
    design: {
      kind: 'website',
      composition: 'bespoke',
      chrome: 'none',
      concept: 'A journal with a narrow contents rail and generous article column.',
    },
    title: 'Field journal',
    primaryCta: { label: 'Read', href: '#article' },
    nav: [],
    facts: [],
    sections: [
      {
        key: 'article',
        anchorId: 'article',
        role: 'hero',
        title: 'Field journal',
        purpose: 'A complete authored editorial page.',
        layout: 'Contents rail beside the article; stack below 700px.',
        variant: 'split',
        kit: 'hero-split',
      },
    ],
  };
}
function writerTree(): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'article',
        attributes: { id: 'article' },
        className: 'ck-journal',
        children: [
          { kind: 'element', tag: 'aside', text: 'Contents', children: [] },
          {
            kind: 'element',
            tag: 'div',
            children: [
              { kind: 'element', tag: 'h1', text: 'Field journal', children: [] },
              { kind: 'element', tag: 'p', text: 'Notes from the field.', children: [] },
            ],
          },
        ],
      },
    ],
  };
}

describe('real build free composition and explicit expertise', () => {
  it.each([false, true])(
    'lands one authored region with custom CSS and required skills (streamed=%s)',
    async (streamed) => {
      const live = kernel();
      const contexts: AssembledAiContext[] = [];
      const requests: string[] = [];
      const css =
        '.ck-journal{display:grid;grid-template-columns:1fr 3fr;gap:32px;border-top:3px solid #345ab9}@media(max-width:700px){.ck-journal{grid-template-columns:1fr}}';
      const provider: AiPlanProvider = {
        proposePagePlan: (_request, context, options) => {
          contexts.push(context);
          const pagePlan = candidate();
          if (streamed) {
            options?.onDraft?.({ kind: 'start' });
            const wire = JSON.stringify({ rationale: 'Editorial hierarchy.', pagePlan });
            for (let offset = 0; offset < wire.length; offset += 80)
              options?.onDraft?.({ kind: 'text', text: wire.slice(offset, offset + 80) });
          }
          return Promise.resolve({ pagePlan, rationale: 'Editorial hierarchy.' });
        },
        propose: (request, context, options) => {
          requests.push(request);
          contexts.push(context);
          const id = /REGION ID: (\S+)/u.exec(request)?.[1];
          expect(id).toBeDefined();
          expect(options?.freeCode).toBe(true);
          return Promise.resolve({
            rationale: 'Authored journal.',
            commands: [
              { command: 'setProp', args: { id, key: 'tree', value: writerTree() } },
              { command: 'setProp', args: { id, key: 'css', value: css } },
            ],
          });
        },
      };
      const result = await runAiBuild({
        request: 'Build an editorial journal; use ux ui pro max',
        runId: 'free-build',
        kernel: live,
        clock: fixedClock(1),
        provider,
        validationPorts: { clock: fixedClock(1), ids: seededIds('free-validation') },
        skillRegistry: createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS),
        selectedSkillIds: ['craftkit.pro-max-design'],
        excludedSkillIds: ['craftkit.pro-max-design'],
        freeCode: true,
      });
      expect(result.tasks.map(({ status }) => status)).toEqual(['applied']);
      expect(result.pagePlan?.sections).toHaveLength(1);
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain('Contents rail beside the article');
      expect(requests[0]).not.toContain('ANSWER with ONE tool step');
      for (const context of contexts) {
        expect(context.skills?.map(({ id }) => id)).toContain('craftkit.pro-max-design');
        expect(context.skills?.map(({ id }) => id)).toContain('craftkit.pro-max-ux');
      }
      expect(contexts.at(-1)?.skills?.map(({ id }) => id)).not.toContain(
        'craftkit.pro-max-landing',
      );
      const region = Object.values(live.getDocument().nodes).find(
        ({ type }) => type === 'customCode',
      );
      expect(region?.props['tree']).toEqual(writerTree());
      expect(region?.props['css']).toBe(css);
    },
  );
  it('reports an impossible explicit skill budget before a provider call', async () => {
    let called = false;
    const provider: AiPlanProvider = {
      propose: () => {
        throw new Error('unexpected');
      },
      proposePagePlan: () => {
        called = true;
        return Promise.resolve({ pagePlan: candidate() });
      },
    };
    const result = await planAiPage('Build a page', {
      runId: 'limited',
      clock: fixedClock(1),
      kernel: kernel(),
      provider,
      skillRegistry: createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS),
      selectedSkillIds: ['craftkit.pro-max-design'],
      policy: { maxSkillTokens: 100 },
    });
    expect(called).toBe(false);
    expect(result).toHaveProperty('error');
  });
  it('starts a writer when a compact layout brief closes, before final plan, without rebuilding', async () => {
    const live = kernel();
    let releasePlan: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releasePlan = resolve;
    });
    let writes = 0;
    const requests: string[] = [];
    const { design, ...page } = candidate();
    const compact = {
      design,
      ...page,
      sections: [{ key: 'article', role: 'hero', title: 'Field journal', anchorId: 'article' }],
      briefs: [
        {
          key: 'article',
          purpose: 'A complete authored journal.',
          layout: 'A narrow index and broad article.',
          slots: { subtitle: 'The meadow opens at sunrise.' },
        },
      ],
    };
    const provider: AiPlanProvider = {
      proposePagePlan: async (_request, _context, options) => {
        options?.onDraft?.({ kind: 'start' });
        const wire = JSON.stringify({ rationale: 'Editorial hierarchy.', pagePlan: compact });
        for (let offset = 0; offset < wire.length; offset += 40)
          options?.onDraft?.({ kind: 'text', text: wire.slice(offset, offset + 40) });
        await gate;
        return { pagePlan: compact };
      },
      propose: (request) => {
        writes += 1;
        requests.push(request);
        return Promise.resolve({
          rationale: 'Authored journal from the completed brief.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: /REGION ID: (\S+)/u.exec(request)?.[1],
                key: 'tree',
                value: writerTree(),
              },
            },
          ],
        });
      },
    };
    const pending = runAiBuild({
      request: 'Create an editorial page',
      runId: 'stream-brief',
      kernel: live,
      clock: fixedClock(1),
      provider,
      validationPorts: { clock: fixedClock(1), ids: seededIds('compact') },
    });
    try {
      await vi.waitFor(
        () => {
          expect(writes).toBe(1);
        },
        { timeout: 4_000 },
      );
      expect(requests[0]).toContain('LAYOUT: A narrow index and broad article.');
      expect(requests[0]).toContain('The meadow opens at sunrise.');
    } finally {
      releasePlan?.();
    }
    const result = await pending;
    expect(
      result.tasks.map(({ status }) => status),
      JSON.stringify(result.tasks),
    ).toEqual(['applied']);
    expect(writes).toBe(1);
    expect(
      Object.values(live.getDocument().nodes).filter(({ type }) => type === 'customCode'),
    ).toHaveLength(1);
  });
  it('keeps a person-approved design intact instead of deriving another from the latest words', async () => {
    const checked = validatePagePlan(candidate());
    if (!checked.ok) throw new Error('invalid fixture');
    const live = kernel();
    const provider: AiPlanProvider = {
      propose: (request) =>
        Promise.resolve({
          rationale: 'Built approved design.',
          commands: [
            {
              command: 'setProp',
              args: {
                id: /REGION ID: (\S+)/u.exec(request)?.[1],
                key: 'tree',
                value: writerTree(),
              },
            },
          ],
        }),
    };
    const result = await runAiBuild({
      request: 'Build this using existing templates',
      pagePlan: checked.plan,
      runId: 'approved',
      kernel: live,
      clock: fixedClock(1),
      provider,
      validationPorts: { clock: fixedClock(1), ids: seededIds('approved') },
    });
    expect(result.pagePlan?.design).toEqual(checked.plan.design);
    expect(result.tasks[0]?.status).toBe('applied');
  });
  it.each(['personal-label', 'script-action'] as const)(
    'applies %s without a misleading repair call',
    async (mode) => {
      const live = kernel();
      const page = candidate();
      const checked = validatePagePlan({
        ...page,
        design: { ...page.design, kind: mode === 'personal-label' ? 'resume' : 'website' },
        primaryCta: { label: 'Calculate', href: '#article' },
      });
      if (!checked.ok) throw new Error('invalid fixture');
      const tree: CustomCodeRoot = {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'article',
            attributes: { id: 'article' },
            children: [
              { kind: 'element', tag: 'h1', text: 'Field journal', children: [] },
              mode === 'personal-label'
                ? { kind: 'element', tag: 'p', text: '[your email]', children: [] }
                : {
                    kind: 'element',
                    tag: 'button',
                    attributes: { id: 'calculate', type: 'button' },
                    text: 'Calculate',
                    children: [],
                  },
            ],
          },
        ],
      };
      let calls = 0;
      const js =
        "const button = ck.root.querySelector('#calculate'); const calculate = () => { ck.root.dataset.calculated = 'yes'; }; button.addEventListener('click', calculate); ck.onDispose(() => button.removeEventListener('click', calculate));";
      const result = await runAiBuild({
        request: 'Build the approved design',
        pagePlan: checked.plan,
        runId: mode,
        kernel: live,
        clock: fixedClock(1),
        freeCode: true,
        validationPorts: { clock: fixedClock(1), ids: seededIds(mode) },
        provider: {
          propose: (request) => {
            calls += 1;
            const id = /REGION ID: (\S+)/u.exec(request)?.[1];
            return Promise.resolve({
              rationale: 'Authored content and behavior.',
              commands: [
                { command: 'setProp', args: { id, key: 'tree', value: tree } },
                ...(mode === 'script-action'
                  ? [{ command: 'setProp', args: { id, key: 'js', value: js } }]
                  : []),
              ],
            });
          },
        },
      });
      expect(result.tasks[0]?.status).toBe('applied');
      expect(result.tasks[0]?.check).toEqual({ issues: [], repaired: false });
      expect(calls).toBe(1);
      const region = Object.values(live.getDocument().nodes).find(
        ({ type }) => type === 'customCode',
      );
      expect(region?.props['tree']).toEqual(tree);
      if (mode === 'script-action') expect(region?.props['js']).toBe(js);
    },
  );
});
