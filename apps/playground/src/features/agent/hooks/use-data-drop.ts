import { useEffect, useEffectEvent, type RefObject } from 'react';

import { dropLabels } from '../copy/drop-labels';
import type { Locale } from '../model/view-types';

/** The zero-token chart path reads at most this much; a larger file goes nowhere. */
export const DATA_DROP_MAX_BYTES = 20_000;
const DATA_FILE = /\.(?:csv|tsv|tab|txt|md|markdown)$/iu;
/** How long a refusal stays over the panel. */
const REFUSAL_MS = 3_000;

/** The draft after a drop: its own words (or the instruction line), then the rows. */
export function dataDraft(draft: string, rows: string, instruction: string): string {
  const head = draft.trim() === '' ? instruction : draft.trimEnd();
  return `${head}\n${rows.replace(/\r\n?/gu, '\n').trim()}`;
}

export interface DataDropOptions {
  readonly locale: Locale;
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  /** The composer's textarea: it takes focus, the caret at the end, once the rows are in. */
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
}

function carriesFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

/**
 * Drop a data file on the panel (2026-10-12): a .csv, .tsv, .md or .txt file dragged over the
 * panel shows what it takes (`data-drop="over"` and `data-drop-label`, drawn by the panel's CSS),
 * and dropped, its rows go into the draft under "Chart this:" — the line the zero-token chart
 * path reads — for the person to send or edit. Any other file is refused for a few seconds in
 * the same place; no file ever opens in the tab instead.
 */
export function useDataDrop(target: RefObject<HTMLElement | null>, options: DataDropOptions): void {
  const labels = useEffectEvent(() => dropLabels(options.locale));
  const accept = useEffectEvent((rows: string) => {
    options.setDraft(dataDraft(options.draft, rows, labels().instruction));
    const field = options.inputRef.current;
    if (field === null) return;
    field.focus();
    requestAnimationFrame(() => {
      field.setSelectionRange(field.value.length, field.value.length);
    });
  });

  useEffect(() => {
    const element = target.current;
    if (element === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (state?: 'over' | 'refused', label = '') => {
      clearTimeout(timer);
      if (state === undefined) {
        element.removeAttribute('data-drop');
        element.removeAttribute('data-drop-label');
        return;
      }
      element.setAttribute('data-drop', state);
      element.setAttribute('data-drop-label', label);
      if (state === 'refused') timer = setTimeout(show, REFUSAL_MS);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
      if (element.getAttribute('data-drop') !== 'over') show('over', labels().hint);
    };
    const leave = (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
      if (element.getAttribute('data-drop') === 'over') show();
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      const file = [...(event.dataTransfer?.files ?? [])].find(({ name }) => DATA_FILE.test(name));
      if (file === undefined) {
        show('refused', labels().refused);
        return;
      }
      if (file.size > DATA_DROP_MAX_BYTES) {
        show('refused', labels().tooLarge);
        return;
      }
      show();
      void file.text().then(accept);
    };
    element.addEventListener('dragenter', over);
    element.addEventListener('dragover', over);
    element.addEventListener('dragleave', leave);
    element.addEventListener('drop', drop);
    return () => {
      show();
      element.removeEventListener('dragenter', over);
      element.removeEventListener('dragover', over);
      element.removeEventListener('dragleave', leave);
      element.removeEventListener('drop', drop);
    };
  }, [target]);
}
