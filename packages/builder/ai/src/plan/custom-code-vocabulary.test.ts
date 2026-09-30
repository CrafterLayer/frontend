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
    ports: { clock: fixedClock(100), ids: seededIds('vocab') },
  });
}

const ports = () => ({ clock: fixedClock(200), ids: seededIds('vocab-validate') });

function planWith(className: string) {
  return {
    rationale: 'add a region',
    commands: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: 'root',
          props: {
            tree: {
              kind: 'root',
              children: [{ kind: 'element', tag: 'section', className }],
            },
          },
        },
      },
    ],
  };
}

/**
 * The vocabulary door.
 *
 * A class Tailwind never generated has no CSS at all — it is inert on the
 * canvas and absent from the production build, and neither reports anything.
 * These tests pin that this fails LOUDLY, at the door, naming the class.
 */
describe('custom-code utility vocabulary enforcement', () => {
  it('names the classes with no generated CSS instead of failing vaguely', () => {
    const result = validateAiPlan(planWith('bg-hotpink p-4 totally-made-up'), kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('bg-hotpink');
    expect(result.issues[0]?.message).toContain('totally-made-up');
    expect(result.issues[0]?.step).toBe(0);
  });

  it('accepts a class the vocabulary generates', () => {
    // Rejected later by the dry run (the fixture registry has no customCode
    // block), so this asserts the vocabulary gate specifically let it through.
    const result = validateAiPlan(
      planWith('min-h-screen bg-surface md:grid-cols-3'),
      kernel(),
      ports(),
    );

    if (!result.ok) {
      expect(result.issues.every((issue) => !issue.message.includes('no generated CSS'))).toBe(
        true,
      );
    }
  });

  it('finds a tree nested anywhere in the args, not only in a known command shape', () => {
    const patchPlan = {
      rationale: 'patch a region',
      commands: [
        {
          command: 'applyPatches',
          args: {
            patches: [
              {
                op: 'replace',
                path: ['nodes', 'x', 'props', 'tree'],
                value: {
                  kind: 'root',
                  children: [{ kind: 'element', tag: 'div', className: 'bg-nonsense-500' }],
                },
              },
            ],
          },
        },
      ],
    };

    const result = validateAiPlan(patchPlan, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes('bg-nonsense-500'))).toBe(true);
  });

  it('walks into nested children, not only the top level', () => {
    const nested = {
      rationale: 'nested',
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
                    tag: 'section',
                    className: 'p-8',
                    children: [{ kind: 'element', tag: 'p', className: 'text-buried-nonsense' }],
                  },
                ],
              },
            },
          },
        },
      ],
    };

    const result = validateAiPlan(nested, kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes('text-buried-nonsense'))).toBe(
      true,
    );
  });

  it('can be switched off for a host that generates its own CSS', () => {
    const result = validateAiPlan(planWith('bg-hotpink'), kernel(), ports(), undefined, {
      enforceUtilityVocabulary: false,
    });

    if (!result.ok) {
      expect(result.issues.every((issue) => !issue.message.includes('no generated CSS'))).toBe(
        true,
      );
    }
  });

  it('is on by default — the only guard on this policy whose default is strict', () => {
    const result = validateAiPlan(planWith('bg-hotpink'), kernel(), ports(), undefined, undefined);

    expect(result.ok).toBe(false);
  });

  it('lets a tree use the Tailwind palette by default — colours are free', () => {
    /*
      The product decision, pinned: a first version applied the theming law
      to trees and the assistant could not make white text on a blue panel.
      `bg-blue-500` is in the generated vocabulary and passes both gates.
    */
    const result = validateAiPlan(planWith('bg-blue-500 text-white'), kernel(), ports());

    if (!result.ok) {
      expect(
        result.issues.every(
          (issue) =>
            !issue.message.includes('no generated CSS') &&
            !issue.message.includes('unusable class'),
        ),
      ).toBe(true);
    }
  });

  it('applies the theming law to trees when a host asks for tokens only', () => {
    const result = validateAiPlan(planWith('bg-blue-500'), kernel(), ports(), undefined, {
      colourPolicy: 'tokens',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain("Tailwind's own palette");
  });

  it('still refuses an arbitrary value — it has no CSS — and says where exact values go', () => {
    const result = validateAiPlan(planWith('p-[17px] bg-[#1e3a8a]'), kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('no generated CSS');
    expect(result.issues[0]?.message).toContain('css prop');
  });

  it('closes the prefix loophole: a bracketed ck- class is still refused', () => {
    const result = validateAiPlan(planWith('ck-[17px]'), kernel(), ports());

    expect(result.ok).toBe(false);
  });

  it('admits a region-local hook class, which is what makes the css prop usable', () => {
    const result = validateAiPlan(planWith('ck-hero-glow bg-surface'), kernel(), ports());

    if (!result.ok) {
      expect(
        result.issues.every(
          (issue) =>
            !issue.message.includes('no generated CSS') &&
            !issue.message.includes('unusable class'),
        ),
      ).toBe(true);
    }
  });

  it('caps the names it lists so one bad tree cannot produce an unreadable message', () => {
    const many = Array.from({ length: 20 }, (_unused, at) => `made-up-${String(at)}`).join(' ');

    const result = validateAiPlan(planWith(many), kernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('and 12 more');
  });
});

describe('icon lists are complete (final test 2026-09-30)', () => {
  const card = (icon: boolean, title: string) => ({
    kind: 'element',
    tag: 'article',
    className: 'rounded-3xl p-6',
    children: [
      ...(icon ? [{ kind: 'icon', name: 'stethoscope', size: 28 }] : []),
      { kind: 'element', tag: 'h3', text: title },
    ],
  });
  const rowPlan = (cards: unknown[]) => ({
    rationale: 'services',
    commands: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: 'root',
          props: {
            tree: {
              kind: 'root',
              children: [{ kind: 'element', tag: 'div', className: 'grid gap-4', children: cards }],
            },
          },
        },
      },
    ],
  });

  it('refuses a row where the last card has no icon, naming the count', () => {
    const result = validateAiPlan(
      rowPlan([card(true, 'Check-up'), card(true, 'Braces'), card(true, 'Implants'), card(false, 'Whitening')]),
      kernel(),
      ports(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('icon on 3 of 4');
    expect(result.issues[0]?.message).toContain('give the other 1 an icon');
  });

  it('lets a complete row, or a row with no icons at all, through the icon rule', () => {
    for (const cards of [
      [card(true, 'a'), card(true, 'b'), card(true, 'c')],
      [card(false, 'a'), card(false, 'b'), card(false, 'c')],
    ]) {
      const result = validateAiPlan(rowPlan(cards), kernel(), ports());
      if (!result.ok) {
        expect(result.issues.every((issue) => !issue.message.includes('look-alike'))).toBe(true);
      }
    }
  });
});
