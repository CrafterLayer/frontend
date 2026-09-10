import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';

import {
  mountPreview,
  type PreviewArtifact,
  type PreviewEnvelope,
  type PreviewSession,
} from '@craftkit/builder-code-runtime/browser';
import type { JsonRecord } from '@craftkit/builder-schema';

import './CodePreviewFrame.css';

export type CodePreviewFrameStatus = 'loading' | 'ready' | 'error' | 'unavailable';
export type PreviewMount = typeof mountPreview;

export interface CodePreviewFrameProps {
  /** The immutable, published artifact that the isolated application may load. */
  artifact?: PreviewArtifact | undefined;
  /** Revision currently selected in the editor. Used to label a last-good older preview. */
  sourceRevision: string;
  /** Cross-origin application URL. The authored page never runs in the editor document. */
  previewUrl: string;
  /** Exact origin accepted by the parent-side bridge. */
  expectedOrigin: string;
  /** Public page input only. Do not pass editor state, credentials, source, or kernel handles. */
  publicData?: JsonRecord | undefined;
  status: CodePreviewFrameStatus;
  title?: string | undefined;
  message?: string | undefined;
  heartbeatTimeoutMs?: number | undefined;
  /** Authored device width, independent from editor space and display zoom. */
  frameWidth?: number | undefined;
  zoom?: number | undefined;
  /** Runtime port; normally omitted. Stories and alternate hosts may supply a compatible mount. */
  previewMount?: PreviewMount | undefined;
  onMessage?: ((message: PreviewEnvelope) => void) | undefined;
  onRejected?: ((reason: string) => void) | undefined;
  onStateChange?: ((state: 'loading' | 'ready' | 'unresponsive' | 'disposed') => void) | undefined;
  onRetry?: (() => void) | undefined;
}

const EMPTY_PUBLIC_DATA: JsonRecord = {};

type RuntimeState = 'idle' | 'loading' | 'ready' | 'unresponsive' | 'disposed' | 'failed';

/**
 * Hosts one whole code-backed page in the cross-origin preview application.
 *
 * The component owns only the frame lifecycle and user-visible state. Message
 * validation and the narrow capability bridge live in builder-code-runtime.
 */
export function CodePreviewFrame({
  artifact,
  sourceRevision,
  previewUrl,
  expectedOrigin,
  publicData = EMPTY_PUBLIC_DATA,
  status,
  title = 'Code page preview',
  message,
  heartbeatTimeoutMs,
  frameWidth,
  zoom = 1,
  previewMount = mountPreview,
  onMessage,
  onRejected,
  onStateChange,
  onRetry,
}: CodePreviewFrameProps) {
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PreviewSession | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>('idle');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const isOlder = artifact !== undefined && artifact.sourceRevision !== sourceRevision;
  const unavailable = status === 'unavailable';
  const displayZoom = Number.isFinite(zoom) ? Math.max(0.1, Math.min(2, zoom)) : 1;
  const deviceWidth =
    frameWidth !== undefined && Number.isFinite(frameWidth) ? Math.max(240, frameWidth) : undefined;
  // Callback identity and new source status must not restart the last-good page.
  const receiveMessage = useEffectEvent((event: PreviewEnvelope) => onMessage?.(event));
  const receiveRejection = useEffectEvent((reason: string) => onRejected?.(reason));
  const receiveState = useEffectEvent((next: 'loading' | 'ready' | 'unresponsive' | 'disposed') =>
    onStateChange?.(next),
  );
  const readPublicData = useEffectEvent(() => publicData);
  const labelFrame = useEffectEvent((frame: HTMLIFrameElement) => {
    frame.title = title;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (unavailable || container === null || artifact === undefined) {
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setRuntimeError(null);
    setRejection(null);

    void previewMount(container, {
      artifact,
      publicData: readPublicData(),
      previewUrl,
      expectedOrigin,
      bridge: {
        onMessage: (event) => {
          if (active) receiveMessage(event);
        },
        onRejected: (reason) => {
          if (!active) return;
          setRejection(reason);
          receiveRejection(reason);
        },
        onState: (next) => {
          if (!active) return;
          setRuntimeState((current) =>
            next === 'disposed' && current === 'unresponsive' ? current : next,
          );
          receiveState(next);
        },
      },
      signal: controller.signal,
      ...(heartbeatTimeoutMs === undefined ? {} : { heartbeatTimeoutMs }),
    })
      .then((session) => {
        if (!active) {
          session.dispose();
          return;
        }
        sessionRef.current = session;
        labelFrame(session.frame);
        session.frame.setAttribute('aria-describedby', statusId);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setRuntimeState('failed');
        setRuntimeError(
          error instanceof Error ? error.message : 'The isolated preview could not start.',
        );
      });

    return () => {
      active = false;
      controller.abort();
      sessionRef.current?.dispose();
      sessionRef.current = null;
      container.replaceChildren();
    };
  }, [
    artifact,
    expectedOrigin,
    heartbeatTimeoutMs,
    previewUrl,
    previewMount,
    unavailable,
    statusId,
  ]);

  useEffect(() => {
    if (sessionRef.current !== null) sessionRef.current.frame.title = title;
  }, [title]);

  const presentation = useMemo(() => {
    if (status === 'unavailable') {
      return {
        kind: 'unavailable' as const,
        label: 'Preview unavailable',
        detail: message ?? 'The isolated preview service is not available.',
      };
    }
    if (status === 'error' || runtimeState === 'failed') {
      return {
        kind: 'error' as const,
        label: artifact === undefined ? 'Preview failed' : 'Source has errors',
        detail:
          runtimeError ??
          message ??
          (artifact === undefined
            ? 'The page could not be previewed.'
            : 'Showing the last successful preview.'),
      };
    }
    if (runtimeState === 'unresponsive') {
      return {
        kind: 'error' as const,
        label: 'Preview is not responding',
        detail: 'The page stopped answering heartbeats. Restart the isolated preview.',
      };
    }
    if (isOlder) {
      return {
        kind: 'older' as const,
        label: 'Older preview',
        detail: message ?? 'Showing the last successful build while the current source is rebuilt.',
      };
    }
    if (status === 'loading' || runtimeState === 'idle' || runtimeState === 'loading') {
      return {
        kind: 'loading' as const,
        label: 'Building preview',
        detail: message ?? 'Preparing the authored page in an isolated frame.',
      };
    }
    if (rejection !== null) {
      return {
        kind: 'warning' as const,
        label: 'Preview message rejected',
        detail: rejection,
      };
    }
    return {
      kind: 'matching' as const,
      label: 'Preview matches source',
      detail: message ?? 'The visible page matches the selected source revision.',
    };
  }, [artifact, isOlder, message, rejection, runtimeError, runtimeState, status]);

  const showBlockingState = artifact === undefined || status === 'unavailable';

  return (
    <section
      className="bldr-code-preview"
      data-preview-state={presentation.kind}
      aria-label={title}
      aria-busy={presentation.kind === 'loading'}
    >
      <div className="bldr-code-preview__status" id={statusId} role="status" aria-live="polite">
        <span className="bldr-code-preview__status-dot" aria-hidden="true" />
        <span>
          <strong>{presentation.label}</strong>
          <span className="bldr-code-preview__status-detail">{presentation.detail}</span>
        </span>
        {onRetry !== undefined &&
        (presentation.kind === 'error' || presentation.kind === 'unavailable') ? (
          <button type="button" className="bldr-code-preview__retry" onClick={onRetry}>
            Retry preview
          </button>
        ) : null}
      </div>

      <div className="bldr-code-preview__viewport">
        <div
          ref={containerRef}
          className="bldr-code-preview__mount"
          data-device-width={deviceWidth}
          style={{
            inlineSize:
              deviceWidth === undefined ? `calc(100% / ${String(displayZoom)})` : `${String(deviceWidth)}px`,
            blockSize: `calc(100% / ${String(displayZoom)})`,
            zoom: displayZoom,
          }}
        />
        {showBlockingState ? (
          <div className="bldr-code-preview__empty" aria-hidden="true">
            <span className="bldr-code-preview__empty-mark">CK</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
