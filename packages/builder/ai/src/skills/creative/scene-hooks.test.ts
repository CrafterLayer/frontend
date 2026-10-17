/**
 * The hooks the playbooks teach reach the page (2026-10-12). A scene's code finds its buttons and
 * status lines by data attributes the creative playbooks name (data-game-action, data-story-title,
 * data-hud-act…), and the tree door refused every one of them, so the normalizer dropped them from
 * every written game and story while the scene checks, which never pass through the door, stayed
 * green. Ours to prove: every data-* name any creative playbook, example, example tree or the
 * free-code card mentions is one the door admits, and every taught example tree keeps its hooks.
 */
import { describe, expect, it } from 'vitest';

import { customCodeAttributeSpelling, customCodeTreeProblems } from '@craftkit/builder-schema';

import { FREE_CODE_CARD } from '../../agent/free-code-card';
import { parseTreeMarkup, type MarkupTreeNode } from '../../plan/tree-markup';
import { CRAFTKIT_AI_SKILL_DEFINITIONS } from '../index';
import * as creativeEngines from './creative-engines';
import * as gameEngines from './game-engines';
import * as pixiCreative from './pixi-creative';
import * as sceneEngines from './scene-engines';

const MODULES = [creativeEngines, gameEngines, pixiCreative, sceneEngines];

/** A data attribute name, not a word that merely starts with one (`craftkit.data-viz`). */
const DATA_NAME = /(?<![\w.-])data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*/gu;

function exported(suffix: string): readonly [string, string][] {
  return MODULES.flatMap((module) =>
    Object.entries(module).filter(
      (entry): entry is [string, string] =>
        entry[0].endsWith(suffix) && typeof entry[1] === 'string',
    ),
  );
}

const TAUGHT = [
  ...CRAFTKIT_AI_SKILL_DEFINITIONS.filter(({ id }) => id.startsWith('craftkit.pixi-')).map(
    ({ instructions }) => instructions,
  ),
  ...exported('_CONTROLS').map(([, markup]) => markup),
  ...exported('_EXAMPLE').map(([, code]) => code),
  FREE_CODE_CARD,
];

function attributesIn(nodes: readonly MarkupTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...Object.keys((node['attributes'] as Record<string, string> | undefined) ?? {}),
    ...attributesIn((node['children'] as MarkupTreeNode[] | undefined) ?? []),
  ]);
}

describe('the hooks the creative playbooks teach', () => {
  const names = [...new Set(TAUGHT.flatMap((text) => text.match(DATA_NAME) ?? []))].sort();

  it('are found (the scan reads the playbooks at all)', () => {
    expect(names).toEqual(expect.arrayContaining(['data-game-action', 'data-story-title']));
  });

  it('are every one admitted by the tree door', () => {
    expect(names.filter((name) => customCodeAttributeSpelling(name) !== name)).toEqual([]);
  });

  it.each(exported('_CONTROLS'))('%s keeps every hook through the door', (_name, markup) => {
    const tree = parseTreeMarkup(markup);
    expect(customCodeTreeProblems(tree)).toEqual([]);
    const kept = new Set(attributesIn(tree.children));
    const written = new Set(markup.match(DATA_NAME) ?? []);
    expect([...written].filter((name) => !kept.has(name))).toEqual([]);
  });
});
