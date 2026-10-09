import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { SCRIPT_CARD, SCRIPT_TIP, buildPrompt, planPromptVariant } from './prompt';
import { prefersScriptServer } from './script-intent';

/**
 * The edit-script card and the bulk heuristic are COPIES (agent-script DESIGN
 * §A.11): this app reaches the builder only through `@craftkit/builder/wire`,
 * which carries neither. The real ones are imported here from their source
 * files — the technique prompt.test.ts uses for the tool catalog — so a card
 * edit or a heuristic change in builder-ai fails this test, not a live edit.
 */
async function builderScript<T>(file: string): Promise<T> {
  const url = new URL(`../../../packages/builder/ai/src/script/${file}`, import.meta.url).href;
  return (await import(/* @vite-ignore */ url)) as T;
}

interface IntentRow {
  readonly text: string;
  readonly expected: boolean;
}

/** An edit as the panel sends one: markup, a page with content, no page playbook pinned. */
function editRequest(request: string): AiPlanWireRequest {
  return {
    version: 1,
    request,
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [{ type: 'customCode', description: 'A freely composed region.' }],
      templates: [],
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'rtl',
        rootId: 'root',
        nodes: [
          { id: 'root', type: 'page', props: {}, slots: { default: ['pg-hero'] } },
          {
            id: 'pg-hero',
            type: 'customCode',
            props: { label: 'Hero', tree: "<section class='bg-stone-950'>…</section>", css: '' },
            slots: {},
          },
        ],
      } as unknown as AiPlanWireRequest['context']['document'],
      selection: { ids: [] },
      commands: [{ name: 'setProp', argsSchema: { type: 'object' } }],
      outputContract: { version: 1, schema: { type: 'object' } },
      treeMarkup: true,
      utilities: 'tailwind',
    },
  };
}

/** The same words on an empty page: a build, whose rules never carry the card. */
function buildRequest(request: string): AiPlanWireRequest {
  const edit = editRequest(request);
  return {
    ...edit,
    context: {
      ...edit.context,
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'rtl',
        rootId: 'root',
        nodes: [{ id: 'root', type: 'page', props: {}, slots: { default: [] } }],
      } as unknown as AiPlanWireRequest['context']['document'],
    },
  };
}

function lastMessage(request: AiPlanWireRequest): string {
  return buildPrompt(request).messages.at(-1)?.content ?? '';
}

describe('the edit-script card (drift guard)', () => {
  it('is exactly builder-ai SCRIPT_CARD', async () => {
    const real = await builderScript<{ SCRIPT_CARD: string }>('api-card.ts');
    expect(SCRIPT_CARD).toBe(real.SCRIPT_CARD);
  }, 30_000);

  it('sits in the frozen edit rules under "## Edit scripts", after the tool preference', () => {
    const rules = buildPrompt(editRequest('خلي كل الأزرار مدورة')).system[0]?.text ?? '';
    expect(rules).toContain(`## Edit scripts\n\n${SCRIPT_CARD}`);
    expect(rules.indexOf('## Edit scripts')).toBeGreaterThan(rules.indexOf('## Tools'));
    expect(rules.indexOf('## Edit scripts')).toBeLessThan(rules.indexOf('## Refusing'));
  });
});

describe('the bulk heuristic (parity with builder-ai prefersScript)', () => {
  it('agrees with builder-ai on every row of PREFERS_SCRIPT_TABLE', async () => {
    const real = await builderScript<{
      PREFERS_SCRIPT_TABLE: readonly IntentRow[];
      prefersScript: (request: string) => boolean;
    }>('script-intent.ts');
    expect(real.PREFERS_SCRIPT_TABLE.length).toBeGreaterThanOrEqual(30);
    for (const { text, expected } of real.PREFERS_SCRIPT_TABLE) {
      expect(real.prefersScript(text), `builder: ${text}`).toBe(expected);
      expect(prefersScriptServer(text), `server: ${text}`).toBe(expected);
    }
  }, 30_000);
});

describe('the per-request tip', () => {
  it('nudges a bulk edit toward ONE script.run step, after the cached prefix', () => {
    for (const request of ['خلي كل الأزرار مدورة', 'translate all headings']) {
      const edit = editRequest(request);
      expect(planPromptVariant(edit), request).toBe('edit');
      const last = lastMessage(edit);
      expect(last, request).toContain(`# Tip\n${SCRIPT_TIP}`);
      expect(last.indexOf('# Tip'), request).toBeLessThan(last.indexOf('# The request'));
      // The cached segments do not move for it.
      expect(buildPrompt(edit).system, request).toEqual(
        buildPrompt(editRequest('make the hero title bigger')).system,
      );
    }
  });

  it('stays out of a precise edit and out of every build or page-plan prompt', () => {
    expect(lastMessage(editRequest('make the hero title bigger'))).not.toContain('# Tip');

    const build = buildRequest('خلي كل الأزرار مدورة');
    expect(planPromptVariant(build)).toBe('build');
    expect(JSON.stringify(buildPrompt(build))).not.toContain(SCRIPT_TIP);
    expect(buildPrompt(build).system[0]?.text).not.toContain(SCRIPT_CARD);

    const pagePlan: AiPlanWireRequest = {
      ...buildRequest('اعمل منيو فيه 12 طبق لكل الأقسام'),
      task: 'page-plan',
    };
    expect(planPromptVariant(pagePlan)).toBe('page-plan');
    const planned = JSON.stringify(buildPrompt(pagePlan));
    expect(planned).not.toContain(SCRIPT_TIP);
    expect(planned).not.toContain('## Edit scripts');
  });

  it('names script.run as an edit the editor runs, never a page <script>', () => {
    expect(SCRIPT_TIP).toContain('ONE script.run step');
    expect(SCRIPT_TIP).toContain('(Edit scripts above)');
  });
});
