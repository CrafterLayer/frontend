import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  Builder,
  DeviceBar,
  EditorCanvas,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  darkTheme,
  lightTheme,
  type CanvasDragHandle,
  type DeviceState,
} from '@craftkit/builder';

import {
  createPlaygroundKernel,
  type PlaygroundFixture,
} from '../features/preview/create-playground-kernel';
import { DirectionFlip } from '../features/preview/components/DirectionFlip';
import { EditMode } from '../features/preview/components/EditMode';
import { FixturePicker } from '../features/preview/components/FixturePicker';
import { CodeViewShowcase } from '../features/preview/components/CodeViewShowcase';
import { RegisterDemoExtension } from '../features/preview/components/RegisterDemoExtension';
import { ThemePicker, type ThemeName } from '../features/preview/components/ThemePicker';
import { useTransactionCount } from '../features/preview/use-transaction-count';

/**
 * Thin composition shell: fixtures + deterministic ports + the preset entrypoint.
 * Zero backend, zero network (FR-014) — everything below runs in memory.
 */
export function App() {
  const [themeName, setThemeName] = useState<ThemeName>('light');
  const [fixture, setFixture] = useState<PlaygroundFixture>('landing');
  const [editMode, setEditMode] = useState(false);
  const [dragHandle, setDragHandle] = useState<CanvasDragHandle | undefined>(undefined);
  // B3a view state: device emulation and preview — never document, never kernel.
  const [device, setDevice] = useState<DeviceState>({ width: 1280, bucket: 'base' });
  const [preview, setPreview] = useState(false);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  // FR-010: preview EXIT must reach a polite channel, and PreviewMode's own
  // region unmounts with it — so the COMPOSER announces the return to editing,
  // after the edit tree mounts (a live region announces mutations, so the
  // message is set post-mount via rAF, the established entry pattern).
  const [modeMessage, setModeMessage] = useState({ text: '', nonce: 0 });

  // One kernel per fixture selection; recreating on change is the point —
  // documents are data, kernels are sessions.
  const kernel = useMemo(() => createPlaygroundKernel({ fixture }), [fixture]);

  // Every observable change pairs 1:1 with a transaction (Law S), so a live
  // counter is both a user-facing session gauge and the SC-004 arithmetic probe.
  const txSubscribe = useCallback(
    (onStoreChange: () => void) => kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  const txCount = useTransactionCount(kernel);
  // Subscribed read (never a bare render-body getState): the preview flip
  // derives from the LIVE document direction.
  const docDir = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel.getDocument().dir, [kernel]),
  );

  const theme = themeName === 'light' ? lightTheme : darkTheme;
  const showcaseOwnsLawSControls = editMode && fixture === 'code-view';

  if (preview) {
    // US4: EVERY piece of editing chrome disappears — the preview surface plus
    // two floating controls (exit lives inside PreviewMode). The direction
    // flip here is VIEW state: the document-mutating flip stays in the header.
    const dirOverride = previewFlipped ? (docDir === 'ltr' ? 'rtl' : 'ltr') : null;
    return (
      <div style={{ blockSize: '100vh', position: 'relative' }}>
        <PreviewMode
          kernel={kernel}
          theme={theme}
          dirOverride={dirOverride}
          onExit={() => {
            setPreview(false);
            setPreviewFlipped(false);
            requestAnimationFrame(() => {
              setModeMessage((current) => ({
                text: 'Preview closed — back to editing.',
                nonce: current.nonce + 1,
              }));
            });
          }}
        />
        <button
          type="button"
          style={{ insetBlockStart: '12px', insetInlineStart: '12px', position: 'absolute' }}
          onClick={() => {
            setPreviewFlipped((flipped) => !flipped);
          }}
        >
          Flip direction (preview)
        </button>
      </div>
    );
  }

  return (
    <div style={{ blockSize: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '12px 16px',
        }}
      >
        <h1 style={{ fontSize: '1rem', margin: 0 }}>CraftKit Builder Playground</h1>
        <ThemePicker value={themeName} onChange={setThemeName} />
        <FixturePicker value={fixture} onChange={setFixture} />
        <DirectionFlip kernel={kernel} />
        <EditMode value={editMode} onChange={setEditMode} />
        <RegisterDemoExtension key={fixture} kernel={kernel} />
        {showcaseOwnsLawSControls ? null : (
          <>
            <button
              type="button"
              onClick={() => {
                kernel.undo();
              }}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                kernel.redo();
              }}
            >
              Redo
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setPreview(true);
          }}
        >
          Preview
        </button>
        {showcaseOwnsLawSControls ? null : (
          <output aria-label="Transactions" data-testid="pg-tx-count">
            {txCount}
          </output>
        )}
        <output
          aria-live="polite"
          aria-label="Mode"
          style={{
            blockSize: '1px',
            clipPath: 'inset(50%)',
            inlineSize: '1px',
            overflow: 'hidden',
            position: 'absolute',
            whiteSpace: 'nowrap',
          }}
        >
          {modeMessage.text}
          {modeMessage.nonce % 2 === 1 ? '​' : ''}
        </output>
        {editMode && fixture !== 'code-view' ? (
          <DeviceBar value={device} onChange={setDevice} />
        ) : null}
      </header>
      <div style={{ display: 'flex', flex: 1, minBlockSize: 0 }}>
        {editMode && fixture === 'code-view' ? (
          <div style={{ flex: 1, minInlineSize: 0, overflow: 'auto' }}>
            <CodeViewShowcase key={fixture} kernel={kernel} />
          </div>
        ) : editMode ? (
          <>
            <Palette kernel={kernel} dragHandle={dragHandle} />
            <div style={{ flex: 1, minInlineSize: 0 }}>
              <EditorCanvas
                kernel={kernel}
                theme={theme}
                editable
                onDragHandle={setDragHandle}
                frameWidth={device.width}
                breakpoint={device.bucket === 'base' ? 'desktop' : device.bucket}
              />
            </div>
            <LayersTree kernel={kernel} />
            <Inspector kernel={kernel} bucket={device.bucket} />
          </>
        ) : (
          <Builder kernel={kernel} theme={theme} />
        )}
      </div>
    </div>
  );
}
