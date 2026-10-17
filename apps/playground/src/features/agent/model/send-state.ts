import type { SendState } from './view-types';

/**
 * The Send slot's machine (SPEC §4.17 SendButton, §3.9 queue, §6.5 "Stop is never in the
 * Send slot").
 *
 * The old panel swapped Stop into the Send button while a run was live, so a double press
 * on Send could stop the run the first press had started (SPEC Appendix A.2). Stop now
 * lives in the RunBar; this slot is Send, Queue or Queued and nothing else. Keeping the
 * decision in one pure table means the Composer, the controller's Enter handling and the
 * stories all read the same five answers, and a test can walk every input.
 */

/**
 * Where the run is. `stopping` is its own value, not folded into `live` by the caller,
 * so the one SPEC row about it ("as running-ready or running-queued") is a property the
 * table test checks rather than an assumption each caller makes.
 */
export type RunLife = 'idle' | 'live' | 'stopping';

/** Every run life once, for exhaustive tables and stories. */
export const RUN_LIVES = ['idle', 'live', 'stopping'] as const satisfies readonly RunLife[];

/** Every Send state once, in SPEC §4.17's order. */
export const SEND_STATES = [
  'idle-empty',
  'idle-ready',
  'running-empty',
  'running-ready',
  'running-queued',
] as const satisfies readonly SendState[];

export interface SendInputs {
  readonly run: RunLife;
  /** The composer's text, as typed. Whitespace alone is empty: Enter would send nothing. */
  readonly draft: string;
  /**
   * The composer's text IS the one queued request (SPEC §3.9, FR-025): there is no second
   * field, so "queued" is a fact about the draft, not a separate request.
   */
  readonly queued: boolean;
}

/**
 * What the slot shows, whether it is `aria-disabled`, and what Enter does.
 * `announceQueued` means Enter changes nothing and LiveStatus says `queue.already`.
 */
export interface SendSlot {
  readonly label: 'send' | 'queue' | 'queued';
  readonly disabled: boolean;
  readonly enter: 'nothing' | 'send' | 'queue' | 'announceQueued';
}

/**
 * SPEC §4.17's table. `disabled` is `aria-disabled`, never `disabled`: the button keeps
 * focus and its tooltip (`keys.hint`) stays reachable.
 */
export const SEND_SLOT: Readonly<Record<SendState, SendSlot>> = {
  'idle-empty': { label: 'send', disabled: true, enter: 'nothing' },
  'idle-ready': { label: 'send', disabled: false, enter: 'send' },
  'running-empty': { label: 'send', disabled: true, enter: 'nothing' },
  'running-ready': { label: 'queue', disabled: false, enter: 'queue' },
  'running-queued': { label: 'queued', disabled: true, enter: 'announceQueued' },
};

export function sendState({ run, draft, queued }: SendInputs): SendState {
  const empty = draft.trim().length === 0;
  /*
    Idle ignores `queued`. A queue paused after Stop keeps its own text in the
    QueueHeader while the composer empties (SPEC §3.10), so the box below it is a new
    draft: Send sends that, and the paused request waits for Continue.
  */
  if (run === 'idle') return empty ? 'idle-empty' : 'idle-ready';
  /*
    An empty draft wins over `queued`: the queued request is this very text, so an
    emptied box leaves nothing that could run. Saying "Queued" over an empty field would
    promise a request that does not exist; the controller drops the queue instead.
  */
  if (empty) return 'running-empty';
  return queued ? 'running-queued' : 'running-ready';
}
