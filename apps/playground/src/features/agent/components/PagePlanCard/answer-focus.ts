/**
 * Where focus goes once a decision is answered (SPEC §6.3), across the moment the card
 * stops existing.
 *
 * A decision card's answer replaces the card: "Build this page" turns the page-plan turn
 * into a build turn, "Apply" turns a proposal into an edit record, "Discard" into an end
 * note. The button that was pressed is gone with the card, and focus that followed it would
 * fall to `body` (the failure a bare `not.toHaveFocus()` cannot see). So the card names the
 * destination at the moment it is answered, and this module waits for it to appear:
 *
 * | answer                     | destination (SPEC §6.3)           | where it is looked for      |
 * |----------------------------|-----------------------------------|-----------------------------|
 * | Build this page, Run plan  | the new record's head (`h3`)      | the turn's own `<li>`       |
 * | Apply                      | the resulting record's Undo       | the turn's own `<li>`       |
 * | Discard (plan or proposal) | the composer's textarea           | the panel (`.ck-agent`)     |
 *
 * The turn's `<li>` survives the change of kind (view-types `TurnView`: "a turn keeps its
 * `turnId` across kinds, so its `<li>` and focus target survive the change"), so it is the
 * one place the new record is sure to appear. A destination is recognised by its mark,
 * `data-ck-focus="head" | "undo" | "composer"`, which a record should set; until every
 * record does, by what the shared primitives already draw: RunRecord's head
 * (`.ck-agent-record__title`), a footer button reading the catalog's Undo, the one textarea.
 *
 * It never steals focus: it stops the moment focus lands anywhere outside the old card (the
 * person moved on, or the new record took focus itself), and gives up after
 * `ANSWER_FOCUS_WAIT_MS` (an answer the controller refused leaves the card, and focus, where
 * they were). If the card was replaced by something with no such destination (an Apply that
 * failed into an error record), focus goes to that record's head rather than to `body`.
 */
import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

/** What an answer sends focus to. */
export type AnswerFocusTarget = 'head' | 'undo' | 'composer';

/** The mark a record puts on its answer destination: `data-ck-focus="undo"`. */
export const ANSWER_FOCUS_ATTRIBUTE = 'data-ck-focus';

/** How long an answer waits for its turn to become the record that holds the destination. */
export const ANSWER_FOCUS_WAIT_MS = 3_000;

/** RunRecord's head: every record's `h3`, `tabindex="-1"` (RunRecord.tsx). */
const RECORD_HEAD = '.ck-agent-record__title';

/** A record footer's buttons (RunRecord.tsx). */
const RECORD_ACTIONS = '.ck-agent-record__actions button';

export interface AnswerFocusOptions {
  /** Defaults to `ANSWER_FOCUS_WAIT_MS`. */
  readonly waitMs?: number | undefined;
}

function marked(scope: ParentNode, target: AnswerFocusTarget): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`[${ANSWER_FOCUS_ATTRIBUTE}="${target}"]`)];
}

/**
 * Sends focus to `target` once `card` has been answered and replaced. Call it right after
 * the answer's callback. Returns a function that stops waiting.
 */
export function focusAfterAnswer(
  card: HTMLElement,
  target: AnswerFocusTarget,
  locale: Locale,
  options: AnswerFocusOptions = {},
): () => void {
  const doc = card.ownerDocument;
  const turn = card.closest('li') ?? card.parentElement;
  const panel = card.closest<HTMLElement>('.ck-agent');

  /* A candidate counts only once it is on the page and not part of the answered card. */
  const first = (candidates: readonly HTMLElement[]): HTMLElement | null =>
    candidates.find((element) => element.isConnected && !card.contains(element)) ?? null;

  const head = (): HTMLElement | null =>
    turn === null
      ? null
      : first([...marked(turn, 'head'), ...turn.querySelectorAll<HTMLElement>(RECORD_HEAD)]);

  const destination = (): HTMLElement | null => {
    switch (target) {
      case 'head':
        return head();
      case 'undo': {
        if (turn === null) return null;
        const undo = t(locale, 'edit.undo');
        const labelled = [...turn.querySelectorAll<HTMLElement>(RECORD_ACTIONS)].filter(
          (button) => button.textContent.trim() === undo,
        );
        return first([...marked(turn, 'undo'), ...labelled]);
      }
      case 'composer': {
        const scope: ParentNode = panel ?? doc;
        return first([
          ...marked(scope, 'composer'),
          ...scope.querySelectorAll<HTMLElement>('textarea'),
        ]);
      }
    }
  };

  let done = false;
  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = (): void => {
    if (done) return;
    done = true;
    observer?.disconnect();
    if (timer !== null) clearTimeout(timer);
    doc.removeEventListener('focusin', onFocusIn, true);
  };

  function onFocusIn(event: FocusEvent): void {
    if (event.target instanceof Node && card.contains(event.target)) return;
    stop();
  }

  const attempt = (): boolean => {
    const element = destination();
    if (element === null) return false;
    stop();
    element.focus();
    return true;
  };

  if (attempt()) return stop;

  doc.addEventListener('focusin', onFocusIn, true);
  const scope = target === 'composer' ? (panel ?? doc.body) : (turn ?? doc.body);
  observer = new MutationObserver(() => {
    attempt();
  });
  observer.observe(scope, { childList: true, subtree: true });
  timer = setTimeout(() => {
    stop();
    // Replaced by something with no such destination: its head, never `body`.
    const active = doc.activeElement;
    if (!card.isConnected && (active === null || active === doc.body)) head()?.focus();
  }, options.waitMs ?? ANSWER_FOCUS_WAIT_MS);
  return stop;
}
