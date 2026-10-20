/**
 * What a run remembers of its conversation (2026-10-13). Ours to prove: every kind of turn
 * gives the model words (a build and a page plan name their sections); up to 40 messages are
 * kept whole; past that the window steps 16 messages at once, so between steps each request
 * only appends to the previous one's history (the cache reads it), and what it left behind is
 * a digest on the first kept request; the skills a conversation woke are carried, and handed
 * to every `prepare` of the run.
 */
import { describe, expect, it, vi } from 'vitest';

import type { AiChatTurn, AiSkillActivationPin, AiSkillRegistry } from '@craftkit/builder';

import {
  HISTORY_MAX_MESSAGES,
  HISTORY_STEP_MESSAGES,
  carriedSkillIdsOf,
  assistantWords,
  historyOf,
  withCarriedSkills,
} from './conversation-memory';
import type { BuildTurn, Turn } from './turns';

function user(i: number, text = `request ${String(i)}`): Turn {
  return { id: `u${String(i)}`, kind: 'user', text, context: [] };
}

function answer(i: number, skills?: readonly AiSkillActivationPin[]): Turn {
  return {
    id: `a${String(i)}`,
    kind: 'answer',
    text: `answer ${String(i)}`,
    ...(skills ? { skills } : {}),
  };
}

function build(titles: readonly string[]): BuildTurn {
  return {
    id: 'b1',
    kind: 'build',
    request: 'A dental clinic page',
    progress: {
      runId: 'run-1',
      phase: 'building',
      direction: 'Calm, clinical, teal.',
      tasks: titles.map((title, index) => ({
        id: `n${String(index)}`,
        title,
        position: index + 1,
        status: 'landed',
        attempts: 1,
      })),
      startedAt: 1,
      writers: 3,
      skeleton: null,
      report: null,
      lastEventAt: 2,
    },
    status: 'settled',
    outcomes: {},
  };
}

/** `exchanges` request/answer pairs, oldest first. */
function conversation(exchanges: number): Turn[] {
  return Array.from({ length: exchanges }, (_, i) => [user(i + 1), answer(i + 1)]).flat();
}

function pin(id: string, reason: AiSkillActivationPin['reason'] = 'auto'): AiSkillActivationPin {
  return { id, version: '1', contentFingerprint: 'f', reason };
}

describe('the words each turn gives the model', () => {
  it('names the sections a build wrote and a page plan proposes', () => {
    const turns: Turn[] = [
      user(1, 'A dental clinic page'),
      build(['Hero', 'Services', 'Contact']),
      user(2, 'Plan a café page'),
      {
        id: 'p1',
        kind: 'page-plan',
        status: 'ready',
        subject: 'A café',
        direction: { mood: 'Warm and roasted.' },
        sections: [
          { key: 's1', title: 'Hero' },
          { key: 's2', title: 'Menu' },
        ],
        note: 'mayDiffer',
        editable: false,
      },
      { id: 'e1', kind: 'end', key: 'planDiscarded' },
    ];
    expect(historyOf(turns)).toEqual([
      { role: 'user', text: 'A dental clinic page' },
      {
        role: 'assistant',
        text: 'Build settled. Applied sections: Hero [n0], Services [n1], Contact [n2]. Direction: Calm, clinical, teal.',
      },
      { role: 'user', text: 'Plan a café page' },
      {
        role: 'assistant',
        text: 'Proposed page plan; not applied. Warm and roasted. Sections: Hero, Menu.',
      },
    ]);
  });

  it('separates applied, failed and undone sections in a partial build', () => {
    const original = build(['Game', 'Story', 'Mural']);
    const turn: BuildTurn = {
      ...original,
      progress: {
        ...original.progress,
        tasks: original.progress.tasks.map((task) =>
          task.id === 'n1' ? { ...task, status: 'failed' } : task,
        ),
      },
      outcomes: { 'v1-section:n2': { kind: 'undone' } },
    };
    const words = assistantWords(turn);
    expect(words).toContain('Applied sections: Game [n0].');
    expect(words).toContain('Not applied: Story (failed), Mural (undone).');
    expect(assistantWords({ ...turn, undone: true })).toContain(
      'Build undone. No applied sections.',
    );
  });

  it('never describes an unapplied proposal or an undone/no-op edit as a completed change', () => {
    const edit = {
      id: 'e1',
      kind: 'edit',
      origin: 'request',
      status: 'done',
      targetNodeId: 'game-1',
      changes: [],
      summary: 'Added another level.',
    } as const;
    expect(assistantWords(edit)).toBe('Edit applied to [game-1]. Added another level.');
    expect(assistantWords({ ...edit, outcome: { kind: 'undone' } })).toContain('Edit undone.');
    expect(assistantWords({ ...edit, status: 'noChange' })).toContain('No change applied.');
    expect(
      assistantWords({
        id: 'p1',
        kind: 'proposal',
        status: 'ready',
        changes: [],
        plan: { rationale: 'Added another level.', commands: [] },
      }),
    ).toContain('Proposal only; not applied.');
  });
});

describe('the conversation window', () => {
  it(`keeps a conversation of up to ${String(HISTORY_MAX_MESSAGES)} messages whole`, () => {
    const history = historyOf(conversation(HISTORY_MAX_MESSAGES / 2));
    expect(history).toHaveLength(HISTORY_MAX_MESSAGES);
    expect(history[0]).toEqual({ role: 'user', text: 'request 1' });
  });

  it('only appends between steps, so the cached conversation is read', () => {
    const sent: AiChatTurn[][] = [];
    for (let exchanges = 1; exchanges <= 60; exchanges += 1) {
      sent.push(historyOf([...conversation(exchanges), user(exchanges + 1)]));
    }
    let steps = 0;
    for (const [i, history] of sent.entries()) {
      const previous = sent[i - 1];
      if (previous === undefined) continue;
      const appended = previous.every(
        (turn, k) => history[k]?.role === turn.role && history[k].text === turn.text,
      );
      if (!appended) steps += 1;
      expect(history.length).toBeLessThanOrEqual(HISTORY_MAX_MESSAGES + 1);
    }
    // 121 messages at most: the window moved only every 8 exchanges, never every turn.
    expect(steps).toBeLessThanOrEqual(
      Math.ceil((121 - HISTORY_MAX_MESSAGES) / HISTORY_STEP_MESSAGES),
    );
    expect(steps).toBeGreaterThan(0);
  });

  it('opens on the digest of what it left behind, then the request it kept', () => {
    const history = historyOf([...conversation(30), user(31)]);
    const first = history[0];
    expect(first?.role).toBe('user');
    expect(first?.text).toMatch(
      /^Earlier in this conversation \(\d+ older requests, oldest first\):/u,
    );
    expect(first?.text).toContain('- "request 1" → answer 1');
    expect(first?.text).toMatch(/The request then:\nrequest \d+$/u);
    expect(history.at(-1)).toEqual({ role: 'user', text: 'request 31' });
  });

  it('clips long earlier lines and never sends an empty one', () => {
    const long = 'x'.repeat(500);
    const history = historyOf([user(1, long), answer(1), ...conversation(40).slice(2), user(99)]);
    expect(history[0]?.text).toContain(`"${'x'.repeat(159)}…"`);
    expect(history.every(({ text }) => text.trim() !== '')).toBe(true);
  });

  it('sends nothing when no person spoke', () => {
    expect(historyOf([answer(1), answer(2)])).toEqual([]);
  });
});

describe('the skills a conversation carries', () => {
  it('carries the skills that woke on their own, newest first, at most eight', () => {
    const turns: Turn[] = [
      user(1),
      answer(1, [pin('old'), pin('pinned', 'explicit')]),
      user(2),
      answer(2, [pin('a'), pin('b'), pin('c'), pin('d'), pin('e'), pin('f'), pin('g'), pin('h')]),
    ];
    expect(carriedSkillIdsOf(turns)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(carriedSkillIdsOf(turns.slice(0, 2))).toEqual(['old']);
  });

  it('hands them to every prepare, beside any the run already carries', () => {
    const prepare = vi.fn(() => ({
      catalog: [],
      active: [],
      activations: [],
      omitted: [],
      totalTokens: 0,
    }));
    const registry = {
      list: () => [],
      get: () => undefined,
      prepare,
    } as unknown as AiSkillRegistry;
    expect(withCarriedSkills(registry, [])).toBe(registry);
    withCarriedSkills(registry, ['a', 'b']).prepare({ request: 'x', carriedSkillIds: ['b', 'z'] });
    expect(prepare).toHaveBeenCalledWith({ request: 'x', carriedSkillIds: ['b', 'z', 'a'] });
  });
});
