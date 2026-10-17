import { useEffect, useRef, useState, type ComponentType } from 'react';

import {
  EditorCanvas,
  createCodeViewWorkerClient,
  lightTheme,
  type BuilderKernel,
  type CanvasInlineEditHandle,
  type CodeViewPanelProps,
  type TransformWorkerClient,
} from '@craftkit/builder';

import { useTransactionCount } from '../../use-transaction-count';
import {
  CODE_VIEW_SHOWCASE_LABELS_EN,
  type CodeViewShowcaseLabels,
} from './CodeViewShowcase.labels';
import {
  createCodeViewKernelAdapter,
  type CodeViewKernelAdapterHandle,
} from './create-code-view-kernel-adapter';

export interface CodeViewShowcaseProps {
  kernel: BuilderKernel;
  /** Tests inject the loopback client; browser sessions create the real module worker on open. */
  workerClient?: TransformWorkerClient | undefined;
  /** Keeps the scenario deterministic without changing the panel's production default. */
  debounceMs?: number | undefined;
  /** Every string the showcase shows; English unless the host passes its locale's set. */
  labels?: CodeViewShowcaseLabels | undefined;
}

interface PanelSession {
  readonly Panel: ComponentType<CodeViewPanelProps>;
  readonly adapterHandle: CodeViewKernelAdapterHandle;
  readonly client: TransformWorkerClient;
  readonly ownsClient: boolean;
}

function causeMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message.length > 0 ? cause.message : fallback;
}

/**
 * Scenario 10: select on the real editable canvas, resolve the contributed
 * panel only when requested, edit through its worker road, then watch one
 * transaction and one exact undo stay in lockstep.
 */
export function CodeViewShowcase({
  kernel,
  workerClient,
  debounceMs,
  labels = CODE_VIEW_SHOWCASE_LABELS_EN,
}: CodeViewShowcaseProps) {
  const transactionCount = useTransactionCount(kernel);
  const [session, setSession] = useState<PanelSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const inlineEditRef = useRef<CanvasInlineEditHandle | null>(null);
  // Opening awaits twice (the lazy panel, then the module worker). Unmounting
  // in between must not strand what those awaits went on to create: the
  // disposal effect below never observed a session it was never told about
  // (011 T033 review, finding 9).
  const mountedRef = useRef(true);
  useEffect(() => {
    /*
      The BODY matters as much as the cleanup. This effect used to be
      cleanup-only, so under `StrictMode` — which this app runs — React's
      simulated unmount set the flag to false and nothing ever set it back.
      From then on every open took the "component went away" branch: it disposed
      the adapter it had just built, terminated the worker it had just started,
      and returned without clearing `opening`. No error was thrown and none was
      shown, so in a real browser the button read "Opening code view…" forever
      and the code view could not be opened at all. Every module still loaded
      with a 200, which is why nothing in the network or the console said so.
    */
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      session?.adapterHandle.dispose();
      if (session?.ownsClient === true) {
        session.client.terminate();
      }
    },
    [session],
  );

  const openCodeView = async (): Promise<void> => {
    if (opening || session !== null) {
      return;
    }
    setOpening(true);
    setOpenError(null);
    let createdClient: TransformWorkerClient | null = null;
    let createdAdapter: CodeViewKernelAdapterHandle | null = null;
    try {
      const contribution = kernel.context.registry.panel('code-view');
      if (contribution === undefined) {
        throw new Error(labels.notRegistered);
      }

      const loaded = await contribution.load();
      const Panel = loaded.default as unknown as ComponentType<CodeViewPanelProps>;
      const client = workerClient ?? (createdClient = await createCodeViewWorkerClient());
      const adapterHandle = (createdAdapter = createCodeViewKernelAdapter(kernel));
      if (!mountedRef.current) {
        createdAdapter.dispose();
        createdClient?.terminate();
        return;
      }
      // The code view is a SECOND way to edit the same node. Ending the inline
      // session first keeps exactly one editing surface live (spec edge case
      // 7); `end` never dispatches, so opening still records zero transactions.
      inlineEditRef.current?.end();
      setSession({
        Panel,
        adapterHandle,
        client,
        ownsClient: workerClient === undefined,
      });
    } catch (cause: unknown) {
      createdAdapter?.dispose();
      createdClient?.terminate();
      setOpenError(causeMessage(cause, labels.openFailed));
    } finally {
      if (mountedRef.current) {
        setOpening(false);
      }
    }
  };

  /** Closing returns focus to the control that opened it — never to `<body>`. */
  const closeCodeView = (): void => {
    setSession(null); // the disposal effect above owns adapter + worker teardown
    toggleRef.current?.focus();
  };

  return (
    <section
      aria-label={labels.region}
      /*
        Fills the region it is placed in, and divides THAT — it used to be a
        column of intrinsic heights, so with the panel open it measured 991px
        inside a 907px canvas region and the editor's last lines sat below the
        fold. The canvas takes what is left after the strip; the panel takes a
        bounded share and scrolls inside itself.
      */
      style={{
        blockSize: '100%',
        display: 'flex',
        flexDirection: 'column',
        minBlockSize: 0,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flex: '0 0 auto',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 16px',
        }}
      >
        <p style={{ flex: '1 1 360px', fontSize: '0.875rem', margin: 0 }}>{labels.steps}</p>
        {/*
          ONE control that persists across both states. Swapping the trigger for
          a status span on open destroyed the focused element, dropping a
          keyboard user on `<body>` with no way back or out (T033 finding 2).
        */}
        <button
          ref={toggleRef}
          type="button"
          disabled={opening}
          aria-expanded={session !== null}
          onClick={() => {
            if (session === null) {
              void openCodeView();
            } else {
              closeCodeView();
            }
          }}
        >
          {opening ? labels.opening : session === null ? labels.open : labels.close}
        </button>
        <button
          type="button"
          onClick={() => {
            kernel.undo();
          }}
        >
          {labels.undo}
        </button>
        <output aria-label={labels.transactions} data-testid="pg-tx-count">
          {transactionCount}
        </output>
      </div>
      {openError === null ? null : <p role="alert">{openError}</p>}
      <div style={{ flex: '1 1 auto', minBlockSize: 0 }}>
        <EditorCanvas
          kernel={kernel}
          theme={lightTheme}
          editable
          onInlineEditHandle={(handle) => {
            inlineEditRef.current = handle;
          }}
        />
      </div>
      {session === null ? null : (
        // Escape is the documented way out of every editing surface in this
        // builder; the code view is not an exception. The handler sits on the
        // wrapper so it catches the key wherever focus is inside the panel.
        <div
          style={{ flex: '0 1 auto', maxBlockSize: '45%', minBlockSize: 0, overflow: 'auto' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeCodeView();
            }
          }}
        >
          <session.Panel
            kernel={session.adapterHandle.adapter}
            workerClient={session.client}
            debounceMs={debounceMs}
          />
        </div>
      )}
    </section>
  );
}
