import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';
import { CANONICAL_JSON_PROJECTION_ID } from '@craftkit/builder-transforms';

import { CodeViewErrors } from '../CodeViewErrors';
import { TransformWorkerClientError, type TransformWorkerClient } from '../worker/client';
import type {
  TransformParseError,
  TransformPatch,
  TransformResponse,
  TransformScope,
} from '../worker/protocol';
import './CodeViewPanel.css';

export type CodeViewStatus = 'clean' | 'typing' | 'invalid' | 'conflict' | 'busy';

/**
 * The host-owned snapshot boundary. Core deliberately seals writes and does
 * not expose an arbitrary-patch command or a document revision counter, so the
 * composition root supplies both as ONE narrow port rather than letting this
 * extension bypass the door.
 */
export interface CodeViewKernelSnapshot {
  readonly document: Readonly<BuilderDocument>;
  readonly selection: readonly NodeId[];
  /** Monotonic for every document write, including undo/redo. */
  readonly revision: number;
  /** Registry vocabulary copied as data into the worker snapshot. */
  readonly blockTypes: readonly string[];
}

export interface CodeViewKernel {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CodeViewKernelSnapshot;
  /** ONE call applies the complete patch batch through the host's kernel door. */
  dispatch(patches: readonly TransformPatch[]): void;
}

export interface CodeViewPanelProps {
  /** BY PROP — the panel never reaches a global kernel or React context. */
  kernel: CodeViewKernel;
  /** Injectable because jsdom has no Worker; the browser host supplies the real client. */
  workerClient: TransformWorkerClient;
  projectionId?: string | undefined;
  debounceMs?: number | undefined;
  label?: string | undefined;
}

interface Target {
  readonly owner: CodeViewKernel;
  readonly scope: TransformScope;
  readonly revision: number;
}

interface Settlement {
  readonly message: string;
  readonly nonce: number;
}

interface PanelState {
  readonly draft: string;
  readonly baseline: string;
  readonly projectedTarget: Target | null;
  readonly projectionFailureTarget: Target | null;
  readonly pin: Target | null;
  readonly inputGeneration: number;
  readonly activeParseGeneration: number | null;
  readonly errors: readonly TransformParseError[];
  readonly rejection: string | null;
  readonly settlement: Settlement;
}

interface SerializedDocumentPayload {
  readonly owner: CodeViewKernel;
  readonly revision: number;
  readonly blockTypes: readonly string[];
  readonly payload: string;
}

const CONFLICT_ANNOUNCEMENT =
  'Draft conflict. The selection or document changed. Nothing was applied.';

const INITIAL_STATE: PanelState = {
  draft: '',
  baseline: '',
  projectedTarget: null,
  projectionFailureTarget: null,
  pin: null,
  inputGeneration: 0,
  activeParseGeneration: null,
  errors: [],
  rejection: null,
  settlement: { message: '', nonce: 0 },
};

function scopeOf(selection: readonly NodeId[]): TransformScope {
  const nodeId = selection[0];
  return nodeId === undefined ? { kind: 'document' } : { kind: 'node', nodeId };
}

function sameScope(left: TransformScope, right: TransformScope): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === 'document' || (right.kind === 'node' && left.nodeId === right.nodeId))
  );
}

function sameBlockTypes(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((type, index) => type === right[index]);
}

function sameTarget(left: Target, right: Target): boolean {
  return (
    left.owner === right.owner &&
    left.revision === right.revision &&
    sameScope(left.scope, right.scope)
  );
}

function snapshotTarget(snapshot: CodeViewKernelSnapshot, owner: CodeViewKernel): Target {
  return { owner, scope: scopeOf(snapshot.selection), revision: snapshot.revision };
}

function documentPayload(snapshot: CodeViewKernelSnapshot): string {
  return JSON.stringify({ document: snapshot.document, blockTypes: snapshot.blockTypes });
}

function responseMatches(response: TransformResponse, generation: number, target: Target): boolean {
  return (
    response.generation === generation &&
    response.result.baseRevision === target.revision &&
    sameScope(response.result.scope, target.scope)
  );
}

function causeMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return typeof cause === 'string' && cause.length > 0 ? cause : 'The code view worker failed.';
}

function isExpectedSupersession(cause: unknown): boolean {
  return (
    cause instanceof TransformWorkerClientError &&
    (cause.code === 'superseded' || cause.code === 'stale-response')
  );
}

function settle(state: PanelState, message: string): Settlement {
  return { message, nonce: state.settlement.nonce + 1 };
}

function statusOf(state: PanelState, current: Target): CodeViewStatus {
  if (state.pin !== null && !sameTarget(state.pin, current)) {
    return 'conflict';
  }
  if (state.pin !== null) {
    if (state.errors.length > 0 || state.rejection !== null) {
      return 'invalid';
    }
    return state.activeParseGeneration === state.inputGeneration ? 'busy' : 'typing';
  }
  if (
    state.projectionFailureTarget !== null &&
    sameTarget(state.projectionFailureTarget, current)
  ) {
    return 'invalid';
  }
  return state.projectedTarget !== null && sameTarget(state.projectedTarget, current)
    ? 'clean'
    : 'busy';
}

function descriptionFor(
  status: CodeViewStatus,
  scope: TransformScope,
  errors: readonly TransformParseError[],
  rejection: string | null,
): string {
  if (status === 'conflict') {
    return 'The selection or document changed underneath this draft. Discard it or return to its pinned version; nothing was applied.';
  }
  if (rejection !== null) {
    return rejection;
  }
  if (status === 'invalid') {
    const count = errors.length;
    return count === 0
      ? 'The code could not be checked.'
      : `${String(count)} code ${count === 1 ? 'error' : 'errors'} found. Choose an error to select its line.`;
  }
  if (status === 'busy') {
    return 'Checking code against the current document.';
  }
  if (status === 'typing') {
    return 'Waiting for typing to settle before checking this draft.';
  }
  return scope.kind === 'document'
    ? 'Code matches the current document.'
    : `Code matches the selected node ${scope.nodeId}.`;
}

/**
 * The B4 code surface (011 contract p1–p7). Projection and parsing happen only
 * through the injected worker client. A draft becomes pinned on its FIRST
 * input; any scope or revision movement then derives a conflict during render,
 * before a debounce can request or dispatch against the wrong target.
 */
export function CodeViewPanel({
  kernel,
  workerClient,
  projectionId = CANONICAL_JSON_PROJECTION_ID,
  debounceMs = 300,
  label = 'Document code',
}: CodeViewPanelProps) {
  const uid = useId();
  const textareaId = `${uid}-textarea`;
  const descriptionId = `${uid}-description`;
  const errorsId = `${uid}-errors`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const generationRef = useRef(0);
  const serializedDocumentRef = useRef<SerializedDocumentPayload | null>(null);
  const requestedProjectionRef = useRef<{
    readonly client: TransformWorkerClient;
    readonly target: Target;
    readonly projectionId: string;
    readonly generation: number;
  } | null>(null);
  const [state, setState] = useState<PanelState>(INITIAL_STATE);
  const subscribe = useCallback((listener: () => void) => kernel.subscribe(listener), [kernel]);
  const readSnapshot = useCallback(() => kernel.getSnapshot(), [kernel]);
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  const currentTarget = useMemo(() => snapshotTarget(snapshot, kernel), [kernel, snapshot]);
  const status = statusOf(state, currentTarget);
  const invalid = status === 'invalid' || status === 'conflict';
  const description = descriptionFor(status, currentTarget.scope, state.errors, state.rejection);
  const describedBy = state.errors.length === 0 ? descriptionId : `${descriptionId} ${errorsId}`;
  const announcement = status === 'conflict' ? CONFLICT_ANNOUNCEMENT : state.settlement.message;
  const announcementNonce = status === 'conflict' ? 0 : state.settlement.nonce;

  // Serialization is keyed to document truth, not to parse attempts. This
  // effect is intentionally above every consumer of the ref so projection and
  // any number of parses reuse one payload for a revision/vocabulary pair.
  useEffect(() => {
    const cached = serializedDocumentRef.current;
    if (
      cached !== null &&
      cached.owner === kernel &&
      cached.revision === snapshot.revision &&
      sameBlockTypes(cached.blockTypes, snapshot.blockTypes)
    ) {
      return;
    }
    serializedDocumentRef.current = {
      owner: kernel,
      revision: snapshot.revision,
      blockTypes: [...snapshot.blockTypes],
      payload: documentPayload(snapshot),
    };
  }, [kernel, snapshot]);

  // A CLEAN draft follows document truth. No projection runs during render;
  // the document snapshot crosses once per revision and the worker resolves
  // only the response whose generation, revision, and scope still match.
  useEffect(() => {
    if (
      state.pin !== null ||
      (state.projectedTarget !== null && sameTarget(state.projectedTarget, currentTarget)) ||
      (state.projectionFailureTarget !== null &&
        sameTarget(state.projectionFailureTarget, currentTarget))
    ) {
      return undefined;
    }
    const serializedDocument = serializedDocumentRef.current;
    if (
      serializedDocument?.owner !== kernel ||
      serializedDocument.revision !== currentTarget.revision ||
      !sameBlockTypes(serializedDocument.blockTypes, snapshot.blockTypes)
    ) {
      return undefined;
    }
    const requested = requestedProjectionRef.current;
    if (
      requested?.client === workerClient &&
      requested.projectionId === projectionId &&
      sameTarget(requested.target, currentTarget)
    ) {
      return undefined;
    }
    generationRef.current += 1;
    const generation = generationRef.current;
    const requestedTarget = currentTarget;
    let cancelled = false;
    requestedProjectionRef.current = {
      client: workerClient,
      target: requestedTarget,
      projectionId,
      generation,
    };

    const requestIsCurrent = () =>
      !cancelled &&
      generationRef.current === generation &&
      sameTarget(snapshotTarget(kernel.getSnapshot(), kernel), requestedTarget);

    void Promise.resolve()
      .then(() => {
        workerClient.setDocument(requestedTarget.revision, serializedDocument.payload);
        return workerClient.request({
          operation: 'project',
          generation,
          baseRevision: requestedTarget.revision,
          scope: requestedTarget.scope,
          projectionId,
          payload: null,
        });
      })
      .then((response) => {
        if (!requestIsCurrent() || !responseMatches(response, generation, requestedTarget)) {
          return;
        }
        const result = response.result;
        if (result.kind !== 'projected') {
          const message =
            result.kind === 'protocol-error'
              ? result.message
              : 'The worker returned a parse result for a projection request.';
          setState((current) => ({
            ...current,
            projectionFailureTarget: requestedTarget,
            rejection: message,
          }));
          return;
        }
        setState((current) => {
          if (current.pin !== null) {
            return current;
          }
          return {
            ...current,
            draft: result.text,
            baseline: result.text,
            projectedTarget: requestedTarget,
            projectionFailureTarget: null,
            errors: [],
            rejection: null,
          };
        });
      })
      .catch((cause: unknown) => {
        if (!requestIsCurrent() || isExpectedSupersession(cause)) {
          return;
        }
        setState((current) => ({
          ...current,
          projectionFailureTarget: requestedTarget,
          rejection: causeMessage(cause),
        }));
      });
    return () => {
      cancelled = true;
      if (requestedProjectionRef.current?.generation === generation) {
        requestedProjectionRef.current = null;
      }
    };
  }, [
    currentTarget,
    kernel,
    projectionId,
    snapshot,
    state.pin,
    state.projectedTarget,
    state.projectionFailureTarget,
    workerClient,
  ]);

  // Parsing starts only after the latest input's debounce. The input handler
  // owns the generation increment, so an already-running response can observe
  // a newer keystroke as stale even before this timer posts the next request.
  useEffect(() => {
    const pin = state.pin;
    if (pin === null || !sameTarget(pin, currentTarget)) {
      return undefined;
    }
    const serializedDocument = serializedDocumentRef.current;
    if (
      serializedDocument?.owner !== kernel ||
      serializedDocument.revision !== pin.revision ||
      !sameBlockTypes(serializedDocument.blockTypes, snapshot.blockTypes)
    ) {
      return undefined;
    }
    const generation = state.inputGeneration;
    const draft = state.draft;
    let cancelled = false;
    const requestIsCurrent = () =>
      !cancelled &&
      generationRef.current === generation &&
      sameTarget(snapshotTarget(kernel.getSnapshot(), kernel), pin);
    const timer = setTimeout(
      () => {
        if (!requestIsCurrent()) {
          return;
        }
        setState((current) =>
          current.inputGeneration === generation
            ? { ...current, activeParseGeneration: generation, errors: [], rejection: null }
            : current,
        );
        void Promise.resolve()
          .then(() => {
            workerClient.setDocument(pin.revision, serializedDocument.payload);
            return workerClient.request({
              operation: 'parse',
              generation,
              baseRevision: pin.revision,
              scope: pin.scope,
              projectionId,
              payload: draft,
            });
          })
          .then((response) => {
            if (!requestIsCurrent() || !responseMatches(response, generation, pin)) {
              return;
            }
            const result = response.result;
            if (result.kind === 'protocol-error') {
              setState((current) => ({
                ...current,
                activeParseGeneration: null,
                rejection: result.message,
                settlement: settle(current, 'The code check failed.'),
              }));
              return;
            }
            if (result.kind !== 'parsed') {
              setState((current) => ({
                ...current,
                activeParseGeneration: null,
                rejection: 'The worker returned a projection for a parse request.',
                settlement: settle(current, 'The code check failed.'),
              }));
              return;
            }
            if (!result.ok) {
              setState((current) => ({
                ...current,
                activeParseGeneration: null,
                errors: result.errors,
                rejection: null,
                settlement: settle(
                  current,
                  `${String(result.errors.length)} code ${result.errors.length === 1 ? 'error' : 'errors'} found.`,
                ),
              }));
              return;
            }

            try {
              if (result.patches.length > 0) {
                // The panel sees ONE opaque patch batch and calls the SAME host
                // door exactly once. Validation/refusal and history stay kernel-owned.
                kernel.dispatch(result.patches);
              }
            } catch (cause: unknown) {
              setState((current) => ({
                ...current,
                activeParseGeneration: null,
                errors: [],
                rejection: causeMessage(cause),
                settlement: settle(current, 'The code edit was refused.'),
              }));
              return;
            }

            requestedProjectionRef.current = null;
            setState((current) => ({
              ...current,
              pin: null,
              activeParseGeneration: null,
              errors: [],
              rejection: null,
              projectedTarget: null,
              projectionFailureTarget: null,
              settlement: settle(
                current,
                result.patches.length > 0 ? 'Code edit applied.' : 'Code is valid.',
              ),
            }));
          })
          .catch((cause: unknown) => {
            if (!requestIsCurrent() || isExpectedSupersession(cause)) {
              return;
            }
            setState((current) => ({
              ...current,
              activeParseGeneration: null,
              rejection: causeMessage(cause),
              settlement: settle(current, 'The code check failed.'),
            }));
          });
      },
      Math.max(0, debounceMs),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    currentTarget,
    debounceMs,
    kernel,
    projectionId,
    snapshot,
    state.draft,
    state.inputGeneration,
    state.pin,
    workerClient,
  ]);

  return (
    <section className="bldr-code-view" aria-label="Code view">
      <header className="bldr-code-view__head">
        <h2 className="bldr-code-view__title">Code view</h2>
        <span className="bldr-code-view__status" data-status={status}>
          {status}
        </span>
      </header>
      <label className="bldr-code-view__label" htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        className="bldr-code-view__textarea"
        dir="ltr"
        spellCheck={false}
        value={state.draft}
        aria-invalid={invalid}
        aria-busy={status === 'busy'}
        aria-describedby={describedBy}
        onChange={(event) => {
          generationRef.current += 1;
          const generation = generationRef.current;
          const draft = event.currentTarget.value;
          setState((current) => {
            const returnedToBaseline = draft === current.baseline;
            return {
              ...current,
              draft,
              pin: returnedToBaseline ? null : (current.pin ?? current.projectedTarget),
              inputGeneration: generation,
              activeParseGeneration: null,
              errors: [],
              rejection: null,
              projectionFailureTarget: null,
            };
          });
        }}
      />
      <p
        id={descriptionId}
        className={
          invalid
            ? 'bldr-code-view__description bldr-code-view__description--error'
            : 'bldr-code-view__description'
        }
      >
        {description}
      </p>
      {status === 'conflict' ? (
        <button
          type="button"
          className="bldr-code-view__discard"
          onClick={() => {
            requestedProjectionRef.current = null;
            generationRef.current += 1;
            setState((current) => ({
              ...current,
              pin: null,
              projectedTarget: null,
              projectionFailureTarget: null,
              activeParseGeneration: null,
              errors: [],
              rejection: null,
            }));
            textareaRef.current?.focus({ preventScroll: true });
          }}
        >
          Discard draft and reload
        </button>
      ) : null}
      <CodeViewErrors
        id={errorsId}
        errors={state.errors}
        source={state.draft}
        textareaRef={textareaRef}
        announcement={announcement}
        announcementNonce={announcementNonce}
      />
    </section>
  );
}
