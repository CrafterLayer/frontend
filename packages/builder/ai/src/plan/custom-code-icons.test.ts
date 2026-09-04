import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { validateAiPlan } from './validate-plan';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(100), ids: seededIds('icons') },
  });
}

const ports = () => ({ clock: fixedClock(200), ids: seededIds('icons-validate') });

function planWithIcons(...names: string[]) {
  return {
    rationale: 'add a region with icons',
    commands: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: 'root',
          props: {
            tree: {
              kind: 'root',
              children: [
                {
                  kind: 'element',
                  tag: 'div',
                  className: 'flex gap-2',
                  children: names.map((name) => ({ kind: 'icon', name })),
                },
              ],
            },
          },
        },
      },
    ],
  };
}

/**
 * The icon door: a name that is not in the set is refused BY NAME, before it
 * can reach a page as a placeholder.
 */
describe('custom-code icon enforcement', () => {
  it('refuses a brand logo — Lucide ships none — and says which', () => {
    // The mistake a model actually makes: `github` on a CV page. Refused by
    // name so the repair round can reach for `link` or `globe` instead.
    const result = validateAiPlan(planWithIcons('mail', 'github'), kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('github');
  });

  it('refuses an icon the set does not have and says which', () => {
    const result = validateAiPlan(planWithIcons('mail', 'not-a-real-icon'), kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('not-a-real-icon');
    expect(result.issues[0]?.message).toContain('lucide.dev/icons');
    expect(result.issues[0]?.message).not.toContain('mail,');
  });

  it('lets a real icon through the icon gate', () => {
    // Later gates (the fixture registry has no customCode block) may still
    // reject; this asserts the ICON gate did not.
    const result = validateAiPlan(planWithIcons('mail', 'globe', 'arrow-right'), kernel(), ports());

    if (!result.ok) {
      expect(result.issues.every((issue) => !issue.message.includes('Lucide'))).toBe(true);
    }
  });

  it('checks icons nested anywhere in the tree', () => {
    const nested = planWithIcons();
    const args = nested.commands[0]?.args as { props: { tree: { children: unknown[] } } };
    args.props.tree.children = [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'div', children: [{ kind: 'icon', name: 'made-up-icon' }] },
        ],
      },
    ];

    const result = validateAiPlan(nested, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes('made-up-icon'))).toBe(true);
  });
});
