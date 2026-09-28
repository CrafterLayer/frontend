/**
 * The rules around "read my request and fix it" (owner request): which routes are asked
 * about first, how model output is read, and what runs when a rewrite fails.
 */
import { describe, expect, it } from 'vitest';

import {
  answersOf,
  clarifyQuestionsOf,
  enhanceFailureOf,
  needsClarifying,
  readEnhanceResult,
  requestWithAnswers,
} from './enhance';

describe('needsClarifying', () => {
  it.each([
    [{ kind: 'edit', confidence: 0.5 }, true],
    [{ kind: 'edit', confidence: 0.6 }, false],
    [{ kind: 'build-page', confidence: 0.5 }, true],
    // The owner's own example routes to a new page at exactly 0.6: a build that unsure is asked about.
    [{ kind: 'build-page', confidence: 0.6 }, true],
    [{ kind: 'build-site', confidence: 0.6 }, true],
    [{ kind: 'build-page', confidence: 0.75 }, false],
    [{ kind: 'add-section', confidence: 0.4 }, true],
    [{ kind: 'question', confidence: 0.3 }, false],
  ] as const)('%o → %s', (route, expected) => {
    expect(needsClarifying(route)).toBe(expected);
  });
});

describe('readEnhanceResult', () => {
  it('reads model output defensively', () => {
    expect(readEnhanceResult(null)).toEqual({ enhanced: '', understood: '', changes: [], questions: [] });
    const result = readEnhanceResult({
      enhanced: '  A page.  ',
      understood: ' one   line ',
      changes: ['x', 'x', '', 3],
      questions: [
        { id: 'a', text: 'Which?', choices: ['1', '2', '3', '4', '5'] },
        { id: 'a', text: 'Again?', choices: ['y'] },
        { text: 'No choices', choices: [] },
        { id: 'c', text: '', choices: ['z'] },
        { id: 'd', text: 'Fourth', choices: ['w'] },
        { id: 'e', text: 'Fifth', choices: ['v'] },
      ],
    });
    expect(result.enhanced).toBe('A page.');
    expect(result.understood).toBe('one line');
    expect(result.changes).toEqual(['x']);
    expect(result.questions.map((question) => question.id)).toEqual(['a', 'q2', 'd']);
    expect(result.questions[0]?.choices).toHaveLength(4);
  });
});

describe('answers', () => {
  it('pairs each answer with its question, and falls back to the person’s own words', () => {
    const questions = clarifyQuestionsOf(
      readEnhanceResult({
        questions: [
          { id: 'where', text: 'Where?', choices: ['Header'] },
          { id: 'what', text: 'What?', choices: ['A link'] },
        ],
      }),
    ).map((question, index) => (index === 0 ? { ...question, answer: 'Header' } : question));
    expect(answersOf(questions)).toEqual([{ id: 'where', question: 'Where?', answer: 'Header' }]);
    expect(requestWithAnswers('link this page', questions)).toBe('link this page\nHeader');
  });

  it('maps a failure to the note under the draft', () => {
    expect(enhanceFailureOf('offline')).toBe('unreachable');
    expect(enhanceFailureOf('tooLarge')).toBe('unknown');
    expect(enhanceFailureOf('busy')).toBe('busy');
  });
});
