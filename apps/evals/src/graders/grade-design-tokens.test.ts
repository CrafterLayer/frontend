import { describe, expect, it } from 'vitest';

import { gradeDesignTokens } from './grade-design-tokens';
import { hardCodedColours } from './plan-inspect';
import { planWith, runOutput } from './test-support';

describe('gradeDesignTokens', () => {
  it('passes a plan that colours through the token vocabulary', () => {
    const result = gradeDesignTokens(
      runOutput({
        plan: planWith([
          {
            command: 'insertNode',
            args: {
              type: 'faq',
              props: { heading: 'Questions', className: 'bg-surface text-text-muted lg:p-8' },
              parentId: 'root',
            },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('fails a plan that reaches for Tailwind’s own palette', () => {
    const result = gradeDesignTokens(
      runOutput({
        plan: planWith([
          {
            command: 'setProp',
            args: { id: 'ev-0001', key: 'className', value: 'bg-slate-900 text-gray-100' },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('bg-slate-900');
    expect(result.reason).toContain('default-palette');
  });

  it('fails a plan that hard-codes a value in brackets', () => {
    const result = gradeDesignTokens(
      runOutput({
        plan: planWith([
          {
            command: 'insertNode',
            args: { type: 'faq', props: { className: 'bg-[#0b0b0c]' }, parentId: 'root' },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('arbitrary-value');
  });

  it('fails a plan that writes a literal colour into an ordinary block prop', () => {
    const result = gradeDesignTokens(
      runOutput({
        plan: planWith([
          {
            command: 'insertNode',
            args: { type: 'faq', props: { tone: 'rgb(11, 11, 12)' }, parentId: 'root' },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('raw-colour');
  });

  it('leaves colour inside custom CSS alone, which is a product decision', () => {
    /*
      A gradient headline or a keyframe cannot be written in token utilities.
      Refusing hex there made the `css` prop exist and be unusable, so the
      workspace decided colour is free in custom code and custom CSS. This test
      is the guard against someone "tightening" the grader back.
    */
    const result = gradeDesignTokens(
      runOutput({
        plan: planWith([
          {
            command: 'setProp',
            args: {
              id: 'root',
              key: 'pageCss',
              value: '.ck-x { background: linear-gradient(#ff0080, #7928ca); }',
            },
          },
        ]),
      }),
    );
    expect(result.pass).toBe(true);
  });

  it('names every offending fragment, not just the first', () => {
    const findings = hardCodedColours(
      planWith([
        {
          command: 'insertNode',
          args: {
            type: 'faq',
            props: { className: 'bg-blue-500 p-[17px]', tone: '#abcdef' },
            parentId: 'root',
          },
        },
      ]),
    );
    expect(findings.map((finding) => finding.reason).sort()).toEqual([
      'arbitrary-value',
      'default-palette',
      'raw-colour',
    ]);
  });

  it('does not mistake an ordinary numeric utility for a palette colour', () => {
    const findings = hardCodedColours(
      planWith([
        {
          command: 'insertNode',
          args: {
            type: 'faq',
            props: { className: 'grid-cols-3 gap-4 z-10 lg:p-8' },
            parentId: 'root',
          },
        },
      ]),
    );
    expect(findings).toEqual([]);
  });
});
