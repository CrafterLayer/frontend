/**
 * The composer frames of `fakeViewState`: SPEC §3.1 empty, §3.2 composing and the
 * mention list, and the Improve and clarify states (owner request).
 */
import type { AgentViewState } from '../../model/view-types';

import type { ScenarioContext } from './scenario-context';
import type { FakeScenario } from './scenarios';
import { announce, candidates, clarifyView, suggestions } from './views';

export type ComposerScenario = Extract<
  FakeScenario,
  | 'empty'
  | 'emptyHasContent'
  | 'emptyCreative'
  | 'emptySelection'
  | 'composing'
  | 'mention'
  | 'enhanceUnavailable'
  | 'enhancing'
  | 'enhanced'
  | 'enhanceFailed'
  | 'clarifyAsking'
  | 'clarifyPartly'
  | 'clarifyRewriting'
>;

/** The view of one composer scenario. */
export function composerViewState(
  context: ScenarioContext,
  scenario: ComposerScenario,
): AgentViewState {
  const { words, start, hasContent, heroChip } = context;
  switch (scenario) {
    case 'empty':
      return start;
    case 'emptyHasContent':
      return {
        ...start,
        empty: { kind: 'hasContent', sections: 8 },
        suggestions: suggestions(words, 'followUp'),
      };
    case 'emptySelection':
      return {
        ...start,
        empty: { kind: 'selection', title: words.sections[1] ?? '' },
        chips: [heroChip],
        suggestions: suggestions(words, 'followUp').slice(0, 3),
      };
    case 'composing':
      return {
        ...start,
        ...hasContent,
        draft: words.editRequest,
        chips: [heroChip],
        send: 'idle-ready',
        suggestions: [],
        face: { mood: 'listening', typing: true },
      };
    case 'mention':
      return {
        ...start,
        ...hasContent,
        draft: `${words.editRequest} @`,
        chips: [heroChip],
        mention: { query: '', candidates: candidates(words) },
        send: 'idle-ready',
        suggestions: [],
        face: { mood: 'listening', typing: true },
      };
    case 'emptyCreative':
      return { ...start, freeCode: { enabled: true } };
    case 'enhanceUnavailable':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'unavailable' },
      };
    case 'enhancing':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'enhancing' },
        face: { mood: 'thinking', typing: false },
      };
    case 'enhanced':
      return {
        ...start,
        draft: words.enhanced,
        send: 'idle-ready',
        suggestions: [],
        enhancement: {
          status: 'enhanced',
          understood: words.understood,
          changes: words.enhanceChanges,
          canRestore: true,
        },
        announcement: announce('enhance.ready'),
      };
    case 'enhanceFailed':
      return {
        ...start,
        draft: words.request,
        send: 'idle-ready',
        suggestions: [],
        enhancement: { status: 'failed', reason: 'unreachable' },
      };
    case 'clarifyAsking':
    case 'clarifyPartly':
    case 'clarifyRewriting':
      return {
        ...start,
        ...hasContent,
        clarify: clarifyView(
          words,
          scenario === 'clarifyAsking' ? 0 : scenario === 'clarifyPartly' ? 1 : 2,
          scenario === 'clarifyRewriting' ? 'rewriting' : 'asking',
        ),
        announcement: scenario === 'clarifyAsking' ? announce('clarify.ready') : null,
        face:
          scenario === 'clarifyRewriting'
            ? { mood: 'thinking', typing: false }
            : { mood: 'idle', typing: false },
      };
  }
}
