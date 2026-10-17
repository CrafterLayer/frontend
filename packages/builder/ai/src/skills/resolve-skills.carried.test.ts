/**
 * Skills carried across a conversation (2026-10-13). Ours to prove, with the real built-in
 * registry: a skill the first request woke stays awake for a follow-up in other words when
 * it is carried, exactly as an auto match (optional, under its intent gate), and is left out
 * when its intent gate refuses the follow-up — carrying never forces a skill.
 */
import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from './index';

const registry = createCraftkitAiSkillRegistry();
const auto = (request: string, carriedSkillIds?: readonly string[]) =>
  registry
    .prepare({ request, intent: 'edit', ...(carriedSkillIds ? { carriedSkillIds } : {}) })
    .activations.filter(({ reason }) => reason === 'auto')
    .map(({ id }) => id);

describe('carried skills', () => {
  it('keeps the skills an earlier request woke for a follow-up in other words', () => {
    const first = auto('Make the headline bigger and bolder');
    expect(first.length).toBeGreaterThan(0);
    const followUp = auto('Rename the brand to Nova');
    const carried = auto('Rename the brand to Nova', first);
    for (const id of first) expect(carried).toContain(id);
    expect(carried.length).toBeGreaterThan(followUp.length);
  });

  it('is the same set, in the same order, as the first request saw', () => {
    const first = auto('Make the headline bigger and bolder');
    expect(auto('Rename the brand to Nova', first).slice(0, first.length).sort()).toEqual(
      [...first].sort(),
    );
  });

  it('never activates a carried skill its intent gate refuses, nor an unknown id', () => {
    // A page-level playbook: its gate admits page and site builds, never an edit.
    const pageLevel = registry.get('craftkit.page-composition');
    expect(pageLevel).toBeDefined();
    const ids = [pageLevel?.id ?? '', 'no.such.skill'];
    const carried = auto('Rename the brand to Nova', ids);
    expect(carried).not.toContain(pageLevel?.id);
    expect(carried).not.toContain('no.such.skill');
  });
});
