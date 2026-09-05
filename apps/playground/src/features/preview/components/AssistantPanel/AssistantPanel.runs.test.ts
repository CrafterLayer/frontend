import { describe, expect, it } from 'vitest';

import type { PlanTurn, Turn } from './AssistantPanel.turns';
import {
  lastDropped,
  lastFollowUp,
  ownsRun,
  PLAN_MODE_SKILL_ID,
  retrySkippedRequest,
  skillsForMode,
} from './AssistantPanel.runs';

const you = (id: string): Turn => ({ id, from: 'you', text: 'أضف قسم أسعار' });

const plan = (id: string, overrides: Partial<PlanTurn> = {}): Turn => ({
  id,
  from: 'assistant',
  kind: 'plan',
  plan: { rationale: 'r', commands: [] },
  applied: false,
  ...overrides,
});

const thinking = (id: string): Turn => ({
  id,
  from: 'assistant',
  kind: 'thinking',
  subject: 'the page',
  run: { stages: [], startedAt: 0, stageSince: null, failedAt: null },
});

const dropped = [{ step: 2, command: 'insertNode', reason: 'unregistered block' }];

describe('ownsRun', () => {
  it('is false with no lease at all', () => {
    expect(ownsRun(null, 'run-1')).toBe(false);
  });

  it('is true only for the run that holds the lease', () => {
    const lease = { runId: 'run-1', controller: new AbortController() };
    expect(ownsRun(lease, 'run-1')).toBe(true);
    expect(ownsRun(lease, 'run-2')).toBe(false);
  });
});

describe('skillsForMode', () => {
  it('leaves the host’s own selection alone outside Plan', () => {
    expect(skillsForMode('ask', ['craftkit.landing-page'])).toEqual(['craftkit.landing-page']);
    expect(skillsForMode('auto', undefined)).toBeUndefined();
  });

  it('adds the plan skill in Plan mode, keeping what the host pinned', () => {
    expect(skillsForMode('plan', ['craftkit.landing-page'])).toEqual([
      'craftkit.landing-page',
      PLAN_MODE_SKILL_ID,
    ]);
  });

  it('never adds it twice', () => {
    expect(skillsForMode('plan', [PLAN_MODE_SKILL_ID])).toEqual([PLAN_MODE_SKILL_ID]);
  });

  it('turns an empty selection into exactly the plan skill', () => {
    expect(skillsForMode('plan', undefined)).toEqual([PLAN_MODE_SKILL_ID]);
  });
});

describe('retrySkippedRequest', () => {
  it('names the skipped sections and nothing else', () => {
    const request = retrySkippedRequest(['Pricing', 'FAQ']);
    expect(request).toContain('“Pricing”, “FAQ”');
    expect(request).toContain('change nothing else');
  });

  it('never names a page, so a retry cannot scaffold a second one', () => {
    expect(retrySkippedRequest(['Pricing'])).not.toMatch(/landing page/i);
  });
});

describe('lastFollowUp', () => {
  it('finds nothing in an empty conversation', () => {
    expect(lastFollowUp([])).toBeUndefined();
  });

  it('reads the follow-up of the NEWEST answer', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'old' } }),
      you('b'),
      plan('c', { plan: { rationale: 'r', commands: [], followUp: 'new' } }),
    ];
    expect(lastFollowUp(turns)).toBe('new');
  });

  it('stops at the newest answer even when that one has none', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'old' } }),
      plan('c'),
    ];
    expect(lastFollowUp(turns)).toBeUndefined();
  });

  it('reads past a thinking bubble, so the strip does not go blank mid-sentence', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'keep me' } }),
      thinking('b'),
    ];
    expect(lastFollowUp(turns)).toBe('keep me');
  });
});

describe('lastDropped', () => {
  it('finds nothing in an empty conversation', () => {
    expect(lastDropped([])).toBeUndefined();
  });

  it('finds nothing when the newest answer salvaged nothing', () => {
    expect(lastDropped([plan('a')])).toBeUndefined();
  });

  it('reads the steps the NEWEST answer lost', () => {
    expect(lastDropped([plan('a', { salvaged: { kept: 3, dropped } })])).toEqual(dropped);
  });

  it('lets a stale salvage go once a newer answer arrives', () => {
    const turns = [plan('a', { salvaged: { kept: 3, dropped } }), you('b'), plan('c')];
    expect(lastDropped(turns)).toBeUndefined();
  });

  it('reads past a thinking bubble, exactly as the follow-up does', () => {
    const turns = [plan('a', { salvaged: { kept: 3, dropped } }), thinking('b')];
    expect(lastDropped(turns)).toEqual(dropped);
  });

  it('ignores what the person wrote — only an answer can salvage', () => {
    expect(lastDropped([plan('a', { salvaged: { kept: 3, dropped } }), you('b')])).toEqual(dropped);
  });
});
