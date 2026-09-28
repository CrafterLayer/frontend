import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
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

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider } from '../types';
import {
  AiBuildRevertError,
  REMOVE_UNFILLED_SECTIONS_LABEL,
  removeUnfilledSections,
  revertBuildSection,
} from './build-revert';
import { runAiBuild, type AiBuildRunResult } from './index';

/*
  P1-9 and the cleanup half of P0-3 (agent-audit.md, 2026-09-28).

  Per-section Undo used to find the LAST transaction whose label matched
  "Assistant: i/N — Title" and call kernel.undo() until it was gone — which
  also undid everything the person did after it, and, with two builds in one
  session sharing labels, let an older card unwind the newer page. A section is
  now reverted FORWARD: its pre-fill value is written back as one new labelled
  transaction, found by the id the build recorded, touching nothing else.
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'build-revert-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region.',
          props: z.object({
            label: z.string().default('Custom section'),
            tree: customCodeTree().default(emptyCustomCodeTree()),
            css: customCss(8_000),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function kernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } },
      },
    },
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('page') },
  });
}

const ports = () => ({ clock: fixedClock(1), ids: seededIds('revert-ports') });

function region(text: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text, children: [] }],
      },
    ],
  };
}

function scaffold(titles: readonly string[]): AiPlan {
  return {
    rationale: 'A calm page. Palette white, slate. Faces Inter. 1 Hero · 2 Proof · 3 Pricing.',
    commands: titles.map((title) => ({
      command: 'insertNode',
      args: { type: 'customCode', parentId: 'root', props: { label: title, tree: region(title) } },
    })),
  };
}

/** Every fill writes its tree and its css, so the revert has two keys to put back. */
function provider(titles: readonly string[], text: string, onFill?: () => void): AiPlanProvider {
  return {
    propose(_request, context) {
      const [id] = context.selection.ids;
      if (id === undefined) return Promise.resolve(scaffold(titles));
      onFill?.();
      return Promise.resolve({
        rationale: 'ok',
        commands: [
          { command: 'setProp', args: { id, key: 'tree', value: region(`${text} body`) } },
          { command: 'setProp', args: { id, key: 'css', value: `.ck-${text}{color:red}` } },
        ],
      });
    },
  };
}

function build(
  live: BuilderKernel,
  runId: string,
  titles: readonly string[],
  text: string,
  signal?: AbortSignal,
  onFill?: () => void,
): Promise<AiBuildRunResult> {
  return runAiBuild({
    runId,
    clock: fixedClock(1000),
    kernel: live,
    provider: provider(titles, text, onFill),
    request: 'A studio page',
    validationPorts: ports(),
    skillRegistry: createCraftkitAiSkillRegistry(),
    ...(signal === undefined ? {} : { signal }),
  });
}

function propsOf(live: BuilderKernel, id: string) {
  return live.getDocument().nodes[id]?.props ?? {};
}

describe('revertBuildSection — a forward revert of one section', () => {
  it('reverts the first build’s section and leaves the person’s edit and the second build intact', async () => {
    const live = kernel();
    const first = await build(live, 'first', ['Hero', 'Proof', 'Pricing'], 'first');
    // The person edits the page by hand between the two builds.
    live.dispatch('setProp', { id: 'root', key: 'title', value: 'My studio' });
    const second = await build(live, 'second', ['Hero', 'Contact'], 'second');
    const logBefore = live.transactions().map(({ id }) => id);

    const proof = first.tasks[1];
    if (proof === undefined) throw new Error('The first build has no second section.');
    const reverted = revertBuildSection(live, proof, ports());

    // Exactly one new transaction, appended — nothing was undone.
    const log = live.transactions();
    expect(log.map(({ id }) => id).slice(0, logBefore.length)).toEqual(logBefore);
    expect(log).toHaveLength(logBefore.length + 1);
    expect(log.at(-1)?.command).toBe('Assistant: revert 2/3 — Proof');
    expect(reverted.transactions[0]?.id).toBe(log.at(-1)?.id);
    expect(log.at(-1)?.author).toBe('ai');

    // Proof holds its placeholder again, css included.
    expect(propsOf(live, proof.id)['tree']).toEqual(region('Proof'));
    expect(propsOf(live, proof.id)['css']).toBe('');
    // The person's edit and every other section, from both builds, are untouched.
    expect(propsOf(live, 'root')['title']).toBe('My studio');
    for (const task of [first.tasks[0], first.tasks[2], ...second.tasks]) {
      expect(JSON.stringify(propsOf(live, task?.id ?? '')['tree'])).toContain('body');
    }
  });

  it('records the landing transaction by id, so two builds with the same labels never collide', async () => {
    const live = kernel();
    const first = await build(live, 'first', ['Hero', 'Proof'], 'first');
    const second = await build(live, 'second', ['Hero', 'Proof'], 'second');

    const firstHero = first.tasks[0]?.landing;
    const secondHero = second.tasks[0]?.landing;
    expect(firstHero?.label).toBe('Assistant: 1/2 — Hero');
    expect(secondHero?.label).toBe('Assistant: 1/2 — Hero');
    expect(firstHero?.transactionId).not.toBe(secondHero?.transactionId);
    const byId = new Map(live.transactions().map((tx) => [tx.id, tx.command]));
    expect(byId.get(firstHero?.transactionId ?? '')).toBe('Assistant: 1/2 — Hero');
    expect(firstHero?.before).toEqual({ tree: region('Hero'), css: '' });
    expect(firstHero?.after).toEqual({
      tree: region('first body'),
      css: '.ck-first{color:red}',
    });

    // The OLDER card reverts the older section, not the newer one.
    const hero = first.tasks[0];
    if (hero === undefined) throw new Error('No hero.');
    revertBuildSection(live, hero, ports());
    expect(propsOf(live, hero.id)['tree']).toEqual(region('Hero'));
    expect(JSON.stringify(propsOf(live, second.tasks[0]?.id ?? '')['tree'])).toContain(
      'second body',
    );
  });

  it('refuses a section the person changed after it landed, and writes nothing', async () => {
    const live = kernel();
    const result = await build(live, 'edited', ['Hero', 'Proof'], 'built');
    const hero = result.tasks[0];
    if (hero === undefined) throw new Error('No hero.');
    live.dispatch('setProp', { id: hero.id, key: 'tree', value: region('My own hero') });
    const count = live.transactions().length;

    expect(() => revertBuildSection(live, hero, ports())).toThrow(AiBuildRevertError);
    try {
      revertBuildSection(live, hero, ports());
    } catch (error) {
      expect(error).toMatchObject({ code: 'changed-since' });
    }
    expect(live.transactions()).toHaveLength(count);
    expect(propsOf(live, hero.id)['tree']).toEqual(region('My own hero'));
  });

  it('refuses a section that never landed, and one whose region is gone', async () => {
    const live = kernel();
    const result = await build(live, 'gone', ['Hero', 'Proof'], 'built');
    const [hero, proof] = result.tasks;
    if (hero === undefined || proof === undefined) throw new Error('Two sections expected.');

    expect(() =>
      revertBuildSection(live, { ...hero, status: 'skipped', attempts: 2 }, ports()),
    ).toThrow(/never landed/u);

    live.dispatch('removeNode', { id: proof.id });
    try {
      revertBuildSection(live, proof, ports());
      throw new Error('A revert of a removed region went through.');
    } catch (error) {
      expect(error).toMatchObject({ code: 'region-missing' });
    }
  });
});

describe('removeUnfilledSections — the placeholders a stopped build left', () => {
  it('removes every unfilled placeholder in ONE labelled transaction, keeping one the person edited', async () => {
    const live = kernel();
    const controller = new AbortController();
    const result = await build(
      live,
      'stopped',
      ['Hero', 'Proof', 'Pricing', 'FAQ'],
      'never',
      controller.signal,
      () => {
        controller.abort();
      },
    );
    expect(result.outcome).toBe('signal');
    expect(result.unfilled).toHaveLength(4);

    // After the stop, the person writes into one placeholder by hand.
    const [, edited] = result.tasks;
    if (edited === undefined) throw new Error('No second section.');
    live.dispatch('setProp', { id: edited.id, key: 'tree', value: region('Mine now') });
    const count = live.transactions().length;

    const removal = removeUnfilledSections(live, result, ports());

    expect(live.transactions()).toHaveLength(count + 1);
    expect(live.transactions().at(-1)?.command).toBe(REMOVE_UNFILLED_SECTIONS_LABEL);
    expect(removal.applied?.transactions[0]?.id).toBe(live.transactions().at(-1)?.id);
    expect(removal.removed.map(({ title }) => title)).toEqual(['Hero', 'Pricing', 'FAQ']);
    expect(removal.kept).toMatchObject([{ task: { title: 'Proof' } }]);
    expect(live.getDocument().nodes['root']?.slots?.['default']).toEqual([edited.id]);
  });

  it('writes nothing when there is nothing left to remove', async () => {
    const live = kernel();
    const result = await build(live, 'complete', ['Hero', 'Proof'], 'built');
    const count = live.transactions().length;

    const removal = removeUnfilledSections(live, result, ports());

    expect(result.unfilled).toEqual([]);
    expect(removal.applied).toBeUndefined();
    expect(removal.removed).toEqual([]);
    expect(live.transactions()).toHaveLength(count);
  });
});
