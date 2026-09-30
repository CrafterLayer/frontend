/**
 * ✨ Improve, and the check before an unclear request runs (owner request, 2026-09-28;
 * view-types `EnhancementView`, `ClarifyView`).
 *
 * The owner asked for "a tool that reads my request and fixes it". This hook is that
 * tool's state, over the engine's `enhanceRequest()` / `canEnhance()`:
 * - `available` is false when the provider cannot rewrite requests (an offline provider,
 *   a server without the enhance route). The view is then `unavailable` and the Improve
 *   action is not shown at all: a button that can only fail is worse than none.
 * - `improve(input)` rewrites the draft: `enhancing` while it works, then `enhanced` with
 *   what it understood and what it fixed, and the person's own text kept for `restore()`.
 *   It resolves the rewritten text for the controller to put in the composer, or null.
 *   A failure is `failed` with its class, and the draft is left exactly as it was.
 * - `edited(draft)`: any change to the draft after an Improve (or a failure) returns to
 *   `idle`, so Restore disappears once the person types; their edit is the text now.
 * - `ask(input)` is the same call for a sent request: the clarify check (questions come
 *   back when the request is too unclear) and the rewrite once every question is answered.
 *   With `{ busy: true }` the view reads `enhancing` while it runs.
 * - A provider that says it can enhance but answers with the engine's deterministic tidy
 *   (`source: 'tidy'`: a server without the enhance route) is taken at its word once:
 *   a tidy that changed nothing, or any tidy to a sent request, turns Improve off for this
 *   provider, so no later send pays a round trip for nothing. A tidy that DID fix
 *   something is still shown, with its own notes.
 *
 * The host may pass its own `enhancer` (a story, a test, a server of its own); the port in
 * `model/enhance.ts` is what is called either way.
 */
import {
  canEnhance,
  classifyAiRunFailure,
  enhanceRequest,
  isAiProviderError,
  type AiPlanProvider,
} from '@craftkit/builder';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  engineEnhanceInput,
  enhanceFailureOf,
  readEnhanceResult,
  type EnhanceInput,
  type EnhanceResult,
  type PromptEnhancer,
} from '../model/enhance';
import { classifyRunFailure } from '../model/failure-class';
import type { EnhancementView } from '../model/view-types';

/**
 * The engine's enhancer (`enhanceRequest` over the provider's `enhancePrompt`) as the
 * port, or null when this provider cannot rewrite a request (`canEnhance`): the offline
 * local provider, a bare scripted one. The answer is read defensively and keeps its
 * `source`, so the hook can tell a model's rewrite from the engine's tidy.
 */
export function engineEnhancer(provider: AiPlanProvider): PromptEnhancer | null {
  if (!canEnhance(provider)) return null;
  return {
    enhance: async (input, signal) => {
      const answer = await enhanceRequest(engineEnhanceInput(input), {
        provider,
        ...(signal === undefined ? {} : { signal }),
      });
      return readEnhanceResult(answer);
    },
  };
}

export interface UsePromptEnhancerOptions {
  readonly provider: AiPlanProvider;
  /**
   * The host's own enhancer (a story, a test, a server of its own). `null` turns Improve
   * off; `undefined` uses the engine's when it has one for this provider.
   */
  readonly enhancer?: PromptEnhancer | null | undefined;
}

export interface PromptEnhancerHandle {
  readonly available: boolean;
  readonly view: EnhancementView;
  /** Rewrite the draft; the rewritten text, or null when it failed or was cancelled. */
  readonly improve: (input: EnhanceInput) => Promise<string | null>;
  /** The person's own text from before the last Improve (the view goes idle), or null. */
  readonly restore: () => string | null;
  /** The draft changed: an Improve's Restore, or a failure note, goes. */
  readonly edited: (draft: string) => void;
  /** Ask about a sent request (clarify check, or the rewrite with answers). Throws on failure. */
  readonly ask: (
    input: EnhanceInput,
    options?: { readonly busy?: boolean | undefined; readonly signal?: AbortSignal | undefined },
  ) => Promise<EnhanceResult>;
  /** Cancel an Improve in flight; the draft stays as it is. */
  readonly cancel: () => void;
}

interface Memory {
  /** The draft the person had before the last Improve. */
  readonly original: string | null;
  /** The text the last Improve put in the draft, to tell "still ours" from "edited". */
  readonly rewritten: string | null;
}

const IDLE: EnhancementView = { status: 'idle' };

/**
 * The enhance route answers 502 when the model answered without an improved request
 * (ai-server handler.ts: an answer that is not an enhancement, or a build handed back
 * unchanged) and when a backend failed; the body that says which never reaches the panel.
 * "The model didn't respond" is false for the first, so a 502 reads as `invalid`, whose
 * note says only what is true of both: "Couldn't improve the request. Your text is
 * unchanged."
 */
function answeredWithoutRewrite(cause: unknown): boolean {
  return isAiProviderError(cause) && cause.code === 'http-status' && cause.status === 502;
}

function failureOf(cause: unknown): EnhancementView {
  if (answeredWithoutRewrite(cause)) return { status: 'failed', reason: 'invalid' };
  const reason = enhanceFailureOf(
    classifyRunFailure(classifyAiRunFailure(cause), {
      offline: typeof navigator !== 'undefined' && !navigator.onLine,
    }),
  );
  return { status: 'failed', reason };
}

export function usePromptEnhancer(options: UsePromptEnhancerOptions): PromptEnhancerHandle {
  const { provider, enhancer: given } = options;
  const port = useMemo(
    () => (given === null ? null : (given ?? engineEnhancer(provider))),
    [given, provider],
  );
  const [view, setView] = useState<EnhancementView>(IDLE);
  // The port that answered with a tidy for nothing: it cannot read requests (see above).
  const [dead, setDead] = useState<PromptEnhancer | null>(null);
  const memory = useRef<Memory>({ original: null, rewritten: null });
  const inflight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    setView((current) => (current.status === 'enhancing' ? IDLE : current));
  }, []);

  const improve = useCallback(
    async (input: EnhanceInput): Promise<string | null> => {
      if (port === null || input.text.trim() === '') return null;
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      setView({ status: 'enhancing' });
      try {
        const result = await port.enhance(input, controller.signal);
        if (controller.signal.aborted) return null;
        const rewritten = result.enhanced.trim();
        if (result.source === 'tidy' && rewritten === input.text.trim()) {
          // The server cannot rewrite requests, and there was nothing to tidy: no button.
          setDead(port);
          setView(IDLE);
          return null;
        }
        if (rewritten === '') {
          setView({ status: 'failed', reason: 'unknown' });
          return null;
        }
        memory.current = { original: input.text, rewritten };
        setView({
          status: 'enhanced',
          understood: result.understood,
          changes: result.changes,
          canRestore: rewritten !== input.text.trim(),
        });
        return rewritten;
      } catch (cause: unknown) {
        if (controller.signal.aborted) return null;
        setView(failureOf(cause));
        return null;
      } finally {
        if (inflight.current === controller) inflight.current = null;
      }
    },
    [port],
  );

  const restore = useCallback((): string | null => {
    const { original } = memory.current;
    memory.current = { original: null, rewritten: null };
    setView(IDLE);
    return original;
  }, []);

  const edited = useCallback((draft: string) => {
    const { rewritten } = memory.current;
    // Still the rewrite, word for word: nothing the person did, nothing to forget.
    if (rewritten !== null && draft.trim() === rewritten) return;
    memory.current = { original: null, rewritten: null };
    setView((current) =>
      current.status === 'enhanced' || current.status === 'failed' ? IDLE : current,
    );
  }, []);

  const ask = useCallback(
    async (
      input: EnhanceInput,
      askOptions: { readonly busy?: boolean | undefined; readonly signal?: AbortSignal | undefined } = {},
    ): Promise<EnhanceResult> => {
      if (port === null) throw new Error('No enhancer is available for this provider.');
      if (askOptions.busy === true) setView({ status: 'enhancing' });
      try {
        const result = await port.enhance(input, askOptions.signal);
        // A tidy asks nothing and understands nothing: later sends skip the check.
        if (result.source === 'tidy') setDead(port);
        return result;
      } finally {
        if (askOptions.busy === true) {
          setView((current) => (current.status === 'enhancing' ? IDLE : current));
        }
      }
    },
    [port],
  );

  const available = port !== null && dead !== port;
  return useMemo(
    () => ({
      available,
      view: available ? view : { status: 'unavailable' as const },
      improve,
      restore,
      edited,
      ask,
      cancel,
    }),
    [available, view, improve, restore, edited, ask, cancel],
  );
}
