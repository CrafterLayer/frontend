/**
 * The one live region's voice (SPEC §4.3, §6.1; §7.4 `hooks/use-live-status.ts`).
 *
 * `model/agent-status.ts` decides everything (what is said at once, how landings are
 * coalesced into one count per 4s, when "blocked" is said) and is pure, with time passed
 * in. This hook is its only clock: it feeds the announcer what the controller reports and
 * owns the ONE timer, set to `nextWakeAt`, that lets a held count or a blocked line be
 * spoken when its time comes. LiveStatus renders `announcement`; its `seq` rises on every
 * announcement, so the same sentence twice is spoken twice.
 *
 * Time is read when an input arrives, never inside the reducer, so a replayed reduction
 * (StrictMode) reaches the same state.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import {
  INITIAL_ANNOUNCER,
  nextWakeAt,
  reduceAnnouncer,
  type AnnouncerInput,
  type AnnouncerState,
  type ImmediateAnnouncementKey,
  type VisibleStatus,
} from '../model/agent-status';
import type { AnnouncementView, CopyParams } from '../model/view-types';

export interface LiveStatus {
  /** The newest announcement, for LiveStatus; null before the first. */
  readonly announcement: AnnouncementView | null;
  /** Speak a moment on the always-announced list (SPEC §4.3). */
  readonly say: (key: ImmediateAnnouncementKey, params?: CopyParams) => void;
  /** A section landed; `done` of `total` are on the page now (coalesced, SPEC §4.3). */
  readonly landed: (done: number, total: number) => void;
  /** The RunBar line changed (`null` when it unmounts): how a blocked episode starts and ends. */
  readonly status: (status: VisibleStatus | null) => void;
}

export interface UseLiveStatusOptions {
  /** Epoch ms; injected so tests drive the 4s window and the 10s blocked rule exactly. */
  readonly now?: (() => number) | undefined;
}

interface Voice {
  readonly announcer: AnnouncerState;
  readonly announcement: AnnouncementView | null;
}

interface Action {
  readonly input: AnnouncerInput;
  readonly now: number;
}

const INITIAL: Voice = { announcer: INITIAL_ANNOUNCER, announcement: null };

function reduce(voice: Voice, action: Action): Voice {
  const step = reduceAnnouncer(voice.announcer, action.input, action.now);
  if (step.state === voice.announcer && step.speak === null) return voice;
  return { announcer: step.state, announcement: step.speak ?? voice.announcement };
}

export function useLiveStatus(options: UseLiveStatusOptions = {}): LiveStatus {
  const [clock] = useState(() => options.now ?? Date.now);
  const [voice, dispatch] = useReducer(reduce, INITIAL);

  const send = useCallback(
    (input: AnnouncerInput) => {
      dispatch({ input, now: clock() });
    },
    [clock],
  );

  // The one timer: a held count or a blocked line is spoken when its window opens.
  const wakeAt = nextWakeAt(voice.announcer);
  useEffect(() => {
    if (wakeAt === null) return undefined;
    const timer = setTimeout(
      () => {
        // A timer may land a hair early; never earlier than its own deadline.
        dispatch({ input: { type: 'tick' }, now: Math.max(clock(), wakeAt) });
      },
      Math.max(0, wakeAt - clock()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [clock, wakeAt]);

  const say = useCallback(
    (key: ImmediateAnnouncementKey, params?: CopyParams) => {
      send({ type: 'say', key, ...(params === undefined ? {} : { params }) });
    },
    [send],
  );
  const landed = useCallback(
    (done: number, total: number) => {
      send({ type: 'landed', done, total });
    },
    [send],
  );
  const status = useCallback(
    (next: VisibleStatus | null) => {
      send({ type: 'status', status: next });
    },
    [send],
  );

  return useMemo(
    () => ({ announcement: voice.announcement, say, landed, status }),
    [voice.announcement, say, landed, status],
  );
}
