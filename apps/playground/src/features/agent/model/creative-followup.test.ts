import type { BuilderDocument, IntentRoute } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { resolveCreativeFollowup } from './creative-followup';
import { initialBuildProgress } from './build-progress';
import type { BuildTurn, EditTurn, Turn } from './turns';

const edit: IntentRoute = { kind: 'edit', confidence: 0.9, reason: 'Edit existing content.' };
const scene = (id: string, label: string) => ({
  id,
  type: 'customCode',
  props: { label, js: 'const s = await ck.scene({ libs: ["mural"] });' },
});
const document: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['sea', 'space', 'footer'] } },
    sea: scene('sea', 'البحر'),
    space: scene('space', 'Space Garden'),
    footer: { id: 'footer', type: 'customCode', props: { label: 'Footer', js: '' } },
  },
};
const done = (targetNodeId: string, extra: Partial<EditTurn> = {}): Turn => ({
  id: 'edit-1',
  kind: 'edit',
  origin: 'request',
  status: 'done',
  changes: [],
  targetNodeId,
  ...extra,
});
const resolve = (
  request: string,
  turns: readonly Turn[] = [],
  overrides: Partial<Parameters<typeof resolveCreativeFollowup>[0]> = {},
) => resolveCreativeFollowup({ request, document, turns, route: edit, pointed: [], ...overrides });

describe('grounded creative follow-up ownership', () => {
  it('uses landed build task node ids, excluding unfilled, undone and other-page work', () => {
    const built: BuildTurn = {
      id: 'build-1',
      kind: 'build',
      request: 'Create the sea mural',
      status: 'settled',
      outcomes: {},
      progress: {
        ...initialBuildProgress('build-run', 0),
        phase: 'completed',
        tasks: [
          { id: 'sea', title: 'البحر', position: 1, status: 'landed', attempts: 1 },
          { id: 'space', title: 'Space Garden', position: 2, status: 'failed', attempts: 2 },
          { id: 'footer', title: 'Footer', position: 3, status: 'landed', attempts: 1 },
        ],
      },
    };
    expect(resolve('add a scene to it', [built])).toEqual({ kind: 'target', id: 'sea' });
    expect(
      resolve('add a scene to it', [built], { otherPageBuilds: new Set(['build-1']) }),
    ).toEqual({ kind: 'clarify', reason: 'missing' });
    expect(
      resolve('add a scene to it', [
        { ...built, outcomes: { 'v1-section:sea': { kind: 'undone' } } },
      ]),
    ).toEqual({ kind: 'clarify', reason: 'missing' });
    expect(resolve('make it calmer', [{ ...built, revived: true }])).toEqual({
      kind: 'clarify',
      reason: 'ambiguous',
    });
  });

  it('continues the last successful artifact and respects a named replacement target', () => {
    expect(resolve('add a scene to it', [done('sea')])).toEqual({ kind: 'target', id: 'sea' });
    expect(resolve('عدل Space Garden', [done('sea')])).toEqual({ kind: 'target', id: 'space' });
    expect(resolve('عدّل البَحر', [done('space')])).toEqual({ kind: 'target', id: 'sea' });
    expect(resolve('make Footer darker', [done('sea')])).toEqual({ kind: 'target', id: 'footer' });
  });

  it('never replaces explicit ownership, questions or explicit creation with continuity', () => {
    expect(resolve('add a scene to it', [done('sea')], { pointed: ['space'] })).toEqual({
      kind: 'none',
    });
    for (const kind of ['question', 'build-page', 'build-site', 'add-section'] as const)
      expect(resolve('create a new game', [done('sea')], { route: { ...edit, kind } })).toEqual({
        kind: 'none',
      });
    expect(resolve('make this page darker', [done('sea')])).toEqual({ kind: 'none' });
    for (const request of [
      'Make the whole page darker including Footer',
      'Make this page match Footer',
      'Make all murals darker',
      'عدل كل الجداريات',
      'Make both scenes calmer',
    ])
      expect(resolve(request, [done('sea')])).toEqual({ kind: 'none' });
  });

  it('asks locally for ambiguous or missing targets instead of choosing another scene', () => {
    expect(resolve('خليها ليلية')).toEqual({ kind: 'clarify', reason: 'ambiguous' });
    expect(resolve('add a scene to it', [done('gone')])).toEqual({
      kind: 'clarify',
      reason: 'missing',
    });
    expect(resolve('make it blue', [], { pointed: ['gone'] })).toEqual({
      kind: 'clarify',
      reason: 'missing',
    });
  });

  it('ignores undone edits and distinguishes ordinary anaphora from explicit creative nouns', () => {
    expect(resolve('make it blue', [done('sea', { outcome: { kind: 'undone' } })])).toEqual({
      kind: 'clarify',
      reason: 'ambiguous',
    });
    expect(resolve('make it blue', [done('footer')])).toEqual({ kind: 'target', id: 'footer' });
    expect(resolve('كمل عليها', [done('footer')])).toEqual({ kind: 'target', id: 'footer' });
    expect(resolve('make the mural blue', [done('footer')])).toEqual({
      kind: 'clarify',
      reason: 'ambiguous',
    });
    expect(resolve('make it blue', [done('sea', { revived: true })])).toEqual({
      kind: 'clarify',
      reason: 'ambiguous',
    });
  });

  it('uses the explicitly requested medium instead of a contrary recent game', () => {
    const mixed: BuilderDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        space: {
          ...scene('space', 'Jumper'),
          props: { label: 'Jumper', js: 'const s = await ck.scene({libs:["game"]});' },
        },
      },
    };
    expect(resolve('Make the mural darker', [done('space')], { document: mixed })).toEqual({
      kind: 'target',
      id: 'sea',
    });
    expect(resolve('Make it darker', [done('space')], { document: mixed })).toEqual({
      kind: 'target',
      id: 'space',
    });
    expect(
      resolve('Make it darker', [done('space')], {
        document: mixed,
        otherPageEdits: new Set(['edit-1']),
      }),
    ).toEqual({ kind: 'clarify', reason: 'missing' });
  });

  it('distinguishes an added game or story from the existing destination', () => {
    const mixed: BuilderDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        root: {
          id: 'root',
          type: 'page',
          props: {},
          slots: { default: ['sea', 'space', 'footer', 'game'] },
        },
        game: {
          ...scene('game', 'Game'),
          props: { label: 'Game', js: 'const s = await ck.scene({libs:["game"]});' },
        },
        space: {
          ...scene('space', 'Bedtime'),
          props: { label: 'Bedtime', js: 'const s = await ck.scene({libs:["story"]});' },
        },
      },
    };
    expect(resolve('Add a game to it', [done('space')], { document: mixed })).toEqual({
      kind: 'target',
      id: 'space',
    });
    expect(resolve('ضيف قصة للجدارية', [done('space')], { document: mixed })).toEqual({
      kind: 'target',
      id: 'sea',
    });
    for (const request of ['Add a game inside the mural', 'Add a game inside the existing mural'])
      expect(resolve(request, [done('space')], { document: mixed })).toEqual({
        kind: 'target',
        id: 'sea',
      });
  });

  it('asks when continuing an absent artifact without blocking ordinary text edits about a game', () => {
    const empty: BuilderDocument = {
      ...document,
      nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
    };
    expect(resolve('Continue this mural', [], { document: empty })).toEqual({
      kind: 'clarify',
      reason: 'missing',
    });
    expect(resolve('Update the text about this game', [], { document: empty })).toEqual({
      kind: 'none',
    });
  });

  it('supports a unique live scene while ignoring detached scenes and unknown language grammar', () => {
    const one: BuilderDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['sea', 'footer'] } },
      },
    };
    expect(resolve('ضيف مشهد للجداريه', [], { document: one })).toEqual({
      kind: 'target',
      id: 'sea',
    });
    expect(resolve('añade estrellas', [], { document: one })).toEqual({ kind: 'none' });
    expect(resolve('añade estrellas a البحر', [], { document: one })).toEqual({
      kind: 'target',
      id: 'sea',
    });
  });
});
