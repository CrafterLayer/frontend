import { useEffect, useEffectEvent } from 'react';

import { localHistoryLabel, type BuilderKernel } from '@craftkit/builder';

import { feedbackLabels, notifyHistoryStep } from '../features/feedback';
import type { EditorLabels, EditorLocale } from './editor-labels';

type HistoryWords = EditorLabels['historyList'];

/** A step's name as the History list writes it: a phrased command, or its recorded label. */
export function historyStepName(label: string, words: HistoryWords): string {
  const known = words.commands[label];
  if (known !== undefined) return known;
  if (/^[a-z][A-Za-z]*$/u.test(label)) {
    const spaced = label.replace(/([a-z])([A-Z])/gu, '$1 $2').toLowerCase();
    return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
  }
  return localHistoryLabel(label, words.locale === 'ar' ? 'ar' : 'en');
}

/**
 * Says every single undo and redo, whichever door it came through — the top bar, the
 * keyboard, the command palette (UX pass, 2026-10-13). It watches the history CURSOR, not
 * the buttons: one step back over an unchanged stack is an undo, one step forward a redo.
 * A jump of several steps (the History list) announces itself, and a new change is not a
 * step, so neither is toasted here.
 */
export function useHistoryFeedback(
  kernel: BuilderKernel | undefined,
  locale: EditorLocale,
  words: HistoryWords,
): void {
  const announce = useEffectEvent((direction: 'undo' | 'redo', label: string) => {
    if (kernel === undefined) return;
    notifyHistoryStep(
      {
        direction,
        step: historyStepName(label, words),
        reverse: () => {
          if (direction === 'undo') kernel.redo();
          else kernel.undo();
        },
      },
      feedbackLabels(locale),
    );
  });
  useEffect(() => {
    const history = kernel?.history?.();
    if (kernel === undefined || history === undefined) return undefined;
    let entries = history.entries();
    let position = history.position();
    return kernel.context.store.subscribe(() => {
      const nextEntries = history.entries();
      const nextPosition = history.position();
      const sameStack =
        nextEntries.length === entries.length && nextEntries.at(-1)?.id === entries.at(-1)?.id;
      const delta = nextPosition - position;
      entries = nextEntries;
      position = nextPosition;
      if (!sameStack) return;
      if (delta === -1) {
        const undone = nextEntries[nextPosition];
        if (undone !== undefined) announce('undo', undone.label);
      } else if (delta === 1) {
        const redone = nextEntries[nextPosition - 1];
        if (redone !== undefined) announce('redo', redone.label);
      }
    });
  }, [kernel]);
}
