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
  createCodeViewKernelAdapter,
  type CodeViewKernelAdapterHandle,
} from './create-code-view-kernel-adapter';

export interface CodeViewShowcaseProps {
  kernel: BuilderKernel;
  /** Tests inject the loopback client; browser sessions create the real module worker on open. */
  workerClient?: TransformWorkerClient | undefined;
  /** Keeps the scenario deterministic without changing the panel's production default. */
  debounceMs?: number | undefined;
}

interface PanelSession {
  readonly Panel: ComponentType<CodeViewPanelProps>;
  readonly adapterHandle: CodeViewKernelAdapterHandle;
  readonly client: TransformWorkerClient;
  readonly ownsClient: boolean;
}

function causeMessage(cause: unknown): string {
  return cause instanceof Error && cause.message.length > 0
    ? cause.message
    : 'The code view could not be opened.';
}

/**
 * Scenario 10: select on the real editable canvas, resolve the contributed
 * panel only when requested, edit through its worker road, then watch one
 * transaction and one exact undo stay in lockstep.
 */
export function CodeViewShowcase({ kernel, workerClient, debounceMs }: CodeViewShowcaseProps) {
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
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

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
        throw new Error('The code-view panel contribution is not registered.');
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
      setOpenError(causeMessage(cause));
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
    <section aria-label="Code view showcase" style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 16px',
        }}
      >
        <p style={{ flex: '1 1 360px', fontSize: '0.875rem', margin: 0 }}>
          Select a block · open code view · edit its JSON · watch one transaction · undo exactly
        </p>
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
          {opening ? 'Opening code view…' : session === null ? 'Open code view' : 'Close code view'}
        </button>
        <button
          type="button"
          onClick={() => {
            kernel.undo();
          }}
        >
          Undo code edit
        </button>
        <output aria-label="Transactions" data-testid="pg-tx-count">
          {transactionCount}
        </output>
      </div>
      {openError === null ? null : <p role="alert">{openError}</p>}
      <div style={{ blockSize: '560px' }}>
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
