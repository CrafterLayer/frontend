import { describe, expect, it } from 'vitest';

import { gradeNodeReferences } from './grade-node-references';
import { planWith, runOutput } from './test-support';

describe('gradeNodeReferences', () => {
  it('passes a plan that only names nodes the document already has', () => {
    const result = gradeNodeReferences(
      runOutput({
        plan: planWith([
          { command: 'setProp', args: { id: 'ev-0001', key: 'heading', value: 'New' } },
          { command: 'removeNode', args: { id: 'ev-0002' } },
        ]),
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('fails a plan that invents a node id', () => {
    const result = gradeNodeReferences(
      runOutput({
        plan: planWith([{ command: 'removeNode', args: { id: 'hero-2' } }]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('hero-2');
  });

  it('fails a plan that refers to a node it inserts in the same plan', () => {
    /*
      The failure this rule exists for. The id of an inserted node is minted by
      the kernel from its id port while the plan runs, so no model can know it
      — a later step naming it is always addressing something that does not
      exist yet, however plausible the name looks.
    */
    const result = gradeNodeReferences(
      runOutput({
        plan: planWith([
          { command: 'insertNode', args: { type: 'faq', props: {}, parentId: 'root' } },
          { command: 'setProp', args: { id: 'faq-1', key: 'heading', value: 'Questions' } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('faq-1');
  });

  it('resolves move targets, not only the node being moved', () => {
    const result = gradeNodeReferences(
      runOutput({
        plan: planWith([
          { command: 'moveNode', args: { id: 'ev-0001', toParentId: 'nowhere', toIndex: 0 } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('nowhere');
  });

  it('resolves every id in a grouping command', () => {
    const result = gradeNodeReferences(
      runOutput({
        plan: planWith([
          { command: 'groupNodes', args: { ids: ['ev-0001', 'ev-0009'], groupType: 'stack' } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('ev-0009');
  });

  it('passes a plan that addresses nothing existing at all', () => {
    const result = gradeNodeReferences(
      runOutput({ plan: planWith([{ command: 'setDocMeta', args: { dir: 'rtl' } }]) }),
    );
    expect(result.pass).toBe(true);
    expect(result.reason).toContain('nothing to resolve');
  });
});
