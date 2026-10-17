import { describe, expect, it } from 'vitest';

import { gradeCommandPolicy } from './grade-command-policy';
import { planWith, runOutput } from './test-support';

describe('gradeCommandPolicy', () => {
  it('passes a plan whose commands are all in the run’s own allowlist', () => {
    expect(gradeCommandPolicy(runOutput()).pass).toBe(true);
  });

  it('fails a plan that reaches for a command the run was not granted', () => {
    const result = gradeCommandPolicy(
      runOutput({
        plan: planWith([{ command: 'applyPatches', args: { patches: [] } }]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('applyPatches');
  });

  it('fails a plan longer than the ceiling the run resolved', () => {
    const step = { command: 'insertNode', args: { type: 'faq', parentId: 'root' } };
    const result = gradeCommandPolicy(
      runOutput({
        plan: planWith([step, step, step]),
        policy: {
          allowedCommands: ['insertNode'],
          maxCommands: 2,
          maxOperations: 256,
        },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('ceiling was 2');
  });

  it('fails a plan that inserts a second document root', () => {
    const result = gradeCommandPolicy(
      runOutput({
        plan: planWith([
          { command: 'insertNode', args: { type: 'page', props: {}, parentId: 'root' } },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('root type');
  });

  it('reads the root type from the document rather than assuming "page"', () => {
    const plan = planWith([
      { command: 'insertNode', args: { type: 'article', props: {}, parentId: 'root' } },
    ]);
    expect(gradeCommandPolicy(runOutput({ plan })).pass).toBe(true);
    expect(
      gradeCommandPolicy(
        runOutput({
          plan,
          document: { rootId: 'root', rootType: 'article', nodeIds: ['root'] },
        }),
      ).pass,
    ).toBe(false);
  });

  it('passes a refusal and fails a crashed run', () => {
    const refusal = runOutput({
      outcome: 'refusal',
      plan: null,
      policy: null,
      failure: { source: 'provider', code: 'refusal', message: 'No.', retryable: false },
    });
    expect(gradeCommandPolicy(refusal).pass).toBe(true);
    expect(gradeCommandPolicy({ ...refusal, outcome: 'error' }).pass).toBe(false);
  });

  it('cannot judge a plan that arrived without the policy that produced it', () => {
    const result = gradeCommandPolicy(runOutput({ policy: null }));
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('effective command policy');
  });
});
