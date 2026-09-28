import { describe, expect, expectTypeOf, it } from 'vitest';

import * as modes from './modes';
import {
  ASSISTANT_MODES,
  DEFAULT_ASSISTANT_MODE,
  applyPolicyFor,
  isAssistantMode,
  modeOrDefault,
  waitsForApproval,
  type AssistantMode,
} from './modes';
import type { AssistantMode as ContractMode } from './view-types';

describe('AssistantMode', () => {
  it('is the view contract’s union, re-exported rather than redeclared', () => {
    expectTypeOf<AssistantMode>().toEqualTypeOf<ContractMode>();
  });

  it('defaults to auto (SPEC §7.4)', () => {
    expect(DEFAULT_ASSISTANT_MODE).toBe('auto');
  });

  it('lists every mode once, in the ModeMenu’s order (SPEC §4.17: auto, ask, plan)', () => {
    expect(ASSISTANT_MODES).toEqual(['auto', 'ask', 'plan']);
  });

  it('ships no English labels: the copy catalog owns every word (SPEC §7.4)', () => {
    /*
      v1 exported `MODES` with `label: 'Ask'` and `hint: 'Propose, then wait for Apply'`:
      English UI words in a bilingual panel, beside the catalog that should have held them.
    */
    expect(Object.keys(modes)).not.toContain('MODES');
    expect(JSON.stringify(ASSISTANT_MODES)).not.toMatch(/label|hint/u);
  });
});

describe('isAssistantMode and modeOrDefault', () => {
  it('accepts exactly the three modes', () => {
    for (const mode of ASSISTANT_MODES) expect(isAssistantMode(mode)).toBe(true);
    for (const value of ['Auto', 'edit', '', null, undefined, 1, {}]) {
      expect(isAssistantMode(value)).toBe(false);
    }
  });

  it('reads a stored value back, and anything else as the default', () => {
    expect(modeOrDefault('plan')).toBe('plan');
    expect(modeOrDefault('ASK')).toBe('auto');
    expect(modeOrDefault(undefined)).toBe('auto');
    expect(modeOrDefault('nonsense', 'ask')).toBe('ask');
  });
});

describe('what a mode lets a run do', () => {
  it('writes only in Auto; Ask proposes and Plan never writes', () => {
    expect(applyPolicyFor('auto')).toBe('auto');
    expect(applyPolicyFor('ask')).toBe('never');
    expect(applyPolicyFor('plan')).toBe('never');
  });

  it('waits on the page plan only in Ask: Plan has nothing to approve, Auto does not wait', () => {
    expect(waitsForApproval('ask')).toBe(true);
    expect(waitsForApproval('auto')).toBe(false);
    expect(waitsForApproval('plan')).toBe(false);
  });
});
