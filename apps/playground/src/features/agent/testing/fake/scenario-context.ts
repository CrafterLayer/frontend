/**
 * What every `fakeViewState` scenario is built from: the locale's words, the resting
 * state, the hero selection chip, and the running / settled / built shapes the scenario
 * families share.
 */
import type {
  AgentViewState,
  ContextChipView,
  Locale,
  RowState,
  RunBarView,
  TurnView,
} from '../../model/view-types';

import { FAKE_NOW, type FakeViewOptions } from './scenarios';
import {
  ALL_LANDED,
  NO_ACTIONS,
  WRITING_STATES,
  base,
  buildView,
  conversation,
  rows,
  sectionId,
  suggestions,
} from './views';
import { WORDS, type Words } from './words';

export interface ScenarioContext {
  readonly locale: Locale;
  readonly now: number;
  readonly words: Words;
  readonly start: AgentViewState;
  readonly hasContent: Partial<AgentViewState>;
  readonly heroChip: ContextChipView;
  readonly running: (record: TurnView, bar: RunBarView, request?: string) => AgentViewState;
  readonly settled: (record: TurnView, extra?: Partial<AgentViewState>) => AgentViewState;
  readonly built: () => TurnView;
  readonly buildingRecord: (states?: readonly RowState[]) => TurnView;
}

/** The shared shapes for one locale and clock (the same for every scenario). */
export function scenarioContext(locale: Locale, options: FakeViewOptions): ScenarioContext {
  const now = options.now ?? FAKE_NOW;
  const words = WORDS[locale];
  const start = base(locale, words);
  const hasContent: Partial<AgentViewState> = {
    empty: { kind: 'hasContent', sections: 8 },
    suggestions: [],
  };
  const heroChip: ContextChipView = {
    kind: 'selection',
    id: sectionId(2),
    label: words.sections[1] ?? '',
    stale: false,
  };
  const running = (
    record: TurnView,
    bar: RunBarView,
    request: string = words.request,
  ): AgentViewState => ({
    ...start,
    ...hasContent,
    turns: conversation(words, record, request),
    run: bar,
    send: 'running-empty',
    face: { mood: 'working', typing: false },
  });
  const settled = (record: TurnView, extra: Partial<AgentViewState> = {}): AgentViewState => ({
    ...start,
    ...hasContent,
    turns: conversation(words, record),
    suggestions: suggestions(words, 'followUp').slice(0, 3),
    ...extra,
  });
  const built = (): TurnView => ({
    kind: 'build',
    view: buildView(words, {
      phase: 'done',
      rows: rows(words, ALL_LANDED, true),
      elapsedMs: 141_000,
      facts: words.facts.map((fact) => ({
        sample: fact.sample,
        section: words.sections[fact.section] ?? '',
        nodeId: sectionId(fact.section + 1),
      })),
      actions: { ...NO_ACTIONS, undoBuild: true },
      menu: ['reuse', 'copySummary'],
    }),
  });
  const buildingRecord = (states: readonly RowState[] = WRITING_STATES): TurnView => ({
    kind: 'build',
    view: buildView(words, { phase: 'building', rows: rows(words, states), remainingMs: 90_000 }),
  });
  return {
    locale,
    now,
    words,
    start,
    hasContent,
    heroChip,
    running,
    settled,
    built,
    buildingRecord,
  };
}
