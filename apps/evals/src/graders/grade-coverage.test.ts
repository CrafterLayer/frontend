import { describe, expect, it } from 'vitest';

import { gradeCoverage } from './grade-coverage';
import { evalCase, planWith, runOutput } from './test-support';

const threeSections = evalCase({
  should: {
    minCommands: 3,
    maxCommands: 10,
    allBlockTypes: ['hero', 'features', 'pricing'],
  },
});

function insert(type: string): { command: string; args: unknown } {
  return { command: 'insertNode', args: { type, props: {}, parentId: 'root' } };
}

describe('gradeCoverage', () => {
  it('scores a complete answer 1', () => {
    const result = gradeCoverage(
      runOutput({ plan: planWith([insert('hero'), insert('features'), insert('pricing')]) }),
      threeSections,
    );
    expect(result.score).toBe(1);
    expect(result.reason).toContain('100%');
  });

  it('scores a partial answer strictly below a complete one', () => {
    const partial = gradeCoverage(
      runOutput({ plan: planWith([insert('hero'), insert('features')]) }),
      threeSections,
    );
    const complete = gradeCoverage(
      runOutput({ plan: planWith([insert('hero'), insert('features'), insert('pricing')]) }),
      threeSections,
    );
    expect(partial.score).toBeLessThan(complete.score);
    expect(partial.reason).toContain('inserts a pricing');
  });

  it('degrades in proportion, so nine of ten sections beats none of ten', () => {
    /*
      The property the whole metric rests on. If `allBlockTypes` were ever
      collapsed into a single all-or-nothing clause, an answer that produced
      every section but one would score the same as an answer that produced
      nothing — and the number would stop being able to show progress.
    */
    const nearly = gradeCoverage(
      runOutput({ plan: planWith([insert('hero'), insert('features'), insert('cta')]) }),
      threeSections,
    );
    const nothing = gradeCoverage(runOutput({ plan: planWith([insert('cta')]) }), threeSections);
    expect(nearly.score).toBeGreaterThan(nothing.score);
    expect(nothing.score).toBeGreaterThanOrEqual(0);
  });

  it('scores a refusal to an answerable request at zero without failing the row', () => {
    const result = gradeCoverage(
      runOutput({ outcome: 'refusal', plan: null, policy: null }),
      threeSections,
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(true);
  });

  it('counts a forbidden duplicate section as a miss', () => {
    const noSecondHero = evalCase({
      should: { anyCommands: ['setProp'], forbiddenBlockTypes: ['hero'] },
    });
    const duplicated = gradeCoverage(runOutput({ plan: planWith([insert('hero')]) }), noSecondHero);
    const edited = gradeCoverage(
      runOutput({
        plan: planWith([
          { command: 'setProp', args: { id: 'ev-0001', key: 'heading', value: 'New' } },
        ]),
      }),
      noSecondHero,
    );
    expect(duplicated.score).toBe(0);
    expect(edited.score).toBe(1);
  });

  it('scores 1 when a case declares no coverage clauses', () => {
    const result = gradeCoverage(runOutput(), evalCase({ should: {} }));
    expect(result.score).toBe(1);
  });
});
