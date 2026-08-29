import './App.css';
import { AssistantPanel } from '../features/preview/components/AssistantPanel';
import { RailSectionNotice } from './rail-section-notice';
import { RAIL_SECTIONS, RAIL_UTILITIES } from './rail-sections';
import { useRecentChanges } from './use-recent-changes';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  bucketForWidth,
  BuilderShell,
  BuilderTheme,
  IconRail,
  StatusBar,
  TopBar,
  EditorCanvas,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  darkTheme,
  type ColorRole,
  lightTheme,
  type CanvasDragHandle,
  type DeviceState,
  type TopBarDevice,
} from '@craftkit/builder';

import {
  createPlaygroundKernel,
  type PlaygroundFixture,
} from '../features/preview/create-playground-kernel';
import { DirectionFlip } from '../features/preview/components/DirectionFlip';
import { FixturePicker } from '../features/preview/components/FixturePicker';
import { CodeViewShowcase } from '../features/preview/components/CodeViewShowcase';
import { RegisterDemoExtension } from '../features/preview/components/RegisterDemoExtension';
import {
  ChromePicker,
  chromeThemeFor,
  type ChromeChoice,
} from '../features/preview/components/ChromePicker';
import { ThemePicker, type ThemeName } from '../features/preview/components/ThemePicker';
import { useTransactionCount } from '../features/preview/use-transaction-count';

/**
 * Thin composition shell: fixtures + deterministic ports + the preset entrypoint.
 * Zero backend, zero network (FR-014) — everything below runs in memory.
 */
/**
 * The top bar speaks in device NAMES; the canvas measures in pixels. One place
 * translates, so the two vocabularies never have to know about each other and a
 * width typed by hand still resolves to the right bucket.
 */
function deviceForBucket(name: TopBarDevice): DeviceState {
  if (name === 'mobile') {
    return { width: 390, bucket: 'mobile' };
  }
  if (name === 'tablet') {
    return { width: 834, bucket: 'tablet' };
  }
  return { width: 1280, bucket: 'base' };
}

export function App() {
  const [themeName, setThemeName] = useState<ThemeName>('light');
  /*
    The EDITOR's theme, which is not the page's. `system` is the honest default:
    it passes no theme at all, so the stylesheet's `prefers-color-scheme` block
    answers — the state every viewer actually starts in.
  */
  const [chromeChoice, setChromeChoice] = useState<ChromeChoice>('system');
  /*
    Which rail section is open. The rail used to be handed a hard-coded
    `activeId` and no handler at all: it drew a selected state, moved focus,
    announced `aria-current`, and did nothing whatever when clicked. A control
    that looks live and is not is worse than no control.
  */
  const [railSection, setRailSection] = useState('blocks');
  /*
    The scenario harness is a disclosure, not a strip. Eight controls plus the
    product's own do not fit a 56px bar: measured at 1600px they came to 722px
    inside a 372px slot, so two of them sat outside the visible region — still
    focusable, no longer clickable. Opening OVER the canvas costs no layout
    pixels at all, which is the whole point.
  */
  const [fixture, setFixture] = useState<PlaygroundFixture>('landing');
  /*
    There is no "edit mode". A builder IS an editor — you do not switch it on —
    and `Preview` is the one control that shows the page without the chrome. The
    checkbox that used to sit in the product's action band was harness
    scaffolding wearing a product control's clothes; the `editMode = true`
    constant that outlived it was the same scaffolding, reduced to a conditional
    that could only ever take one branch.
  */
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
  // The provenance strip reads a field the kernel has always recorded.
  const recentChanges = useRecentChanges(kernel);

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
  // History is external kernel state too. Primitive snapshots keep the top
  // bar truthful on first render and after every undo/redo cursor movement.
  const canUndo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel.canUndo(), [kernel]),
  );
  const canRedo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel.canRedo(), [kernel]),
  );

  /*
    The page theme, plus whatever the colour control has re-pointed.

    Overrides are kept BESIDE the named theme rather than replacing it, so
    switching light↔dark still lands on a complete theme and the edits a person
    made are not silently carried onto a palette they were never chosen for.
  */
  const [roleOverrides, setRoleOverrides] = useState<Partial<Record<ColorRole, string>>>({});
  const theme = useMemo(
    () => ({ ...(themeName === 'light' ? lightTheme : darkTheme), ...roleOverrides }),
    [themeName, roleOverrides],
  );
  const retheme = useCallback((role: ColorRole, value: string) => {
    setRoleOverrides((current) => ({ ...current, [role]: value }));
  }, []);
  const breakpoint = device.bucket === 'base' ? 'desktop' : device.bucket;
  /*
    The code view is ONE destination, reached one way: the rail. It used to be
    reachable only by choosing a document fixture named "Code view", which made
    a harness setting the door to a product feature and left the rail's own Code
    item with nothing to do but describe where the feature was.

    While it is open the showcase owns the sealed-store instruments — it renders
    its own transaction counter and drives undo/redo through its adapter — so
    this file must not render a second set with the same names.
  */
  const codeOpen = railSection === 'code';
  const showcaseOwnsLawSControls = codeOpen;

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
    // The chrome root: this is what turns twenty stylesheets' fallback values
    // into an actual theme, and it is the element a host re-points a token on.
    <BuilderTheme className="pg-app" theme={chromeThemeFor(chromeChoice)}>
      {/*
        The designed bar replaces what was a debug harness: a fieldset of radio
        buttons, a bare select, a checkbox and six unstyled buttons in a row.
        The scenario controls that only the PLAYGROUND needs ride in `extra`,
        which is exactly the slot the component offers for them.
      */}
      <TopBar
        productName="CraftKit Builder"
        logo={<span className="pg-mark">CK</span>}
        device={device.bucket === 'base' ? 'desktop' : device.bucket}
        onDeviceChange={(next) => {
          setDevice(deviceForBucket(next));
        }}
        canUndo={!showcaseOwnsLawSControls && canUndo}
        canRedo={!showcaseOwnsLawSControls && canRedo}
        onUndo={() => {
          kernel.undo();
        }}
        onRedo={() => {
          kernel.redo();
        }}
        onPreview={() => {
          setPreview(true);
        }}
        extra={
          /*
            The action band belongs to the PRODUCT. Every scenario control moved
            to the rail's Settings panel, where a dev harness belongs; what is
            left here is the sealed-store counter, which must stay in the DOM in
            every view for the law's assertions and has no business being seen.
          */
          showcaseOwnsLawSControls ? undefined : (
            <span className="bldr-visually-hidden">
              <output aria-label="Transactions" data-testid="pg-tx-count">
                {txCount}
              </output>
            </span>
          )
        }
      />
      <output aria-live="polite" aria-label="Mode" className="bldr-visually-hidden">
        {modeMessage.text}
        {modeMessage.nonce % 2 === 1 ? '\u200b' : ''}
      </output>
      <div style={{ flex: 1, minBlockSize: 0 }}>
        {/*
          The editor's layout is BuilderShell's job, not this file's. Before it
          the playground nested flexboxes with inline sizes here, which meant the
          shape of the editor was described in one place and approximated in
          every other — and a region could only be removed by editing this JSX.
          Now an absent region is simply an omitted prop.
        */}
        <BuilderShell
          label="Playground editor"
          rail={
            <IconRail
              items={RAIL_SECTIONS}
              secondary={RAIL_UTILITIES}
              activeId={railSection}
              onSelect={(id) => {
                /*
                    Settings is an ACTION, not a destination. The scenario
                    controls have to work in preview too, where there is no
                    panel to put them in, so they live in a disclosure — and the
                    rail's settings item opens exactly that rather than pointing
                    at it in prose. Nothing about the panel changes, so the
                    current destination keeps its `aria-current`.
                  */
                setRailSection(id);
              }}
              account={<div className="pg-avatar">CK</div>}
            />
          }
          /*
              The structure of the document is how a person navigates it, so
              when the panel is holding it the canvas narrows rather than the
              tree disappearing. The palette keeps the old behaviour: it is a
              source you dip into, and the canvas is the subject.
            */
          panelPriority={railSection === 'layers' ? 'essential' : 'optional'}
          panel={
            /*
                The rail's two content destinations are real panels; the rest say
                what they are. Blocks and Layers share the left column the way
                every builder of this kind does, which is also what frees the
                right column entirely for the inspector — the layer tree used to
                sit on top of it and take a third of its height.
              */
            railSection === 'assistant' ? (
              <AssistantPanel
                kernel={kernel}
                onReviewAsCode={() => {
                  setRailSection('code');
                }}
              />
            ) : railSection === 'layers' ? (
              <LayersTree kernel={kernel} />
            ) : railSection === 'settings' ? (
              /*
                  The scenario harness, in a panel of its own. It used to ride in
                  the product's action band and then in a sheet floating over the
                  canvas — neither is where a developer harness belongs. Here it
                  has room, it costs the page nothing when closed, and the action
                  band is left to the product.
                */
              <section className="pg-settings" aria-label="Scenario harness">
                <h2>Harness</h2>
                <p>Scenario controls. None of this is part of the product.</p>
                <FixturePicker value={fixture} onChange={setFixture} />
                <ChromePicker value={chromeChoice} onChange={setChromeChoice} />
                <ThemePicker value={themeName} onChange={setThemeName} />
                <DirectionFlip kernel={kernel} />
                <RegisterDemoExtension key={fixture} kernel={kernel} />
                {codeOpen ? null : (
                  <label className="pg-width">
                    <span>Canvas width</span>
                    <input
                      type="number"
                      min={320}
                      max={2560}
                      step={10}
                      value={device.width}
                      onChange={(event) => {
                        const width = Number(event.currentTarget.value);
                        setDevice({ width, bucket: bucketForWidth(width) });
                      }}
                    />
                  </label>
                )}
              </section>
            ) : railSection === 'assets' || railSection === 'help' ? (
              <RailSectionNotice section={railSection} />
            ) : (
              // Blocks, and Code: the palette stays beside the projection,
              // because reading the document as text is not a reason to lose
              // the ability to add to it.
              <Palette kernel={kernel} dragHandle={dragHandle} />
            )
          }
          canvas={
            codeOpen ? (
              <CodeViewShowcase key={fixture} kernel={kernel} />
            ) : (
              <EditorCanvas
                kernel={kernel}
                theme={theme}
                editable
                onDragHandle={setDragHandle}
                frameWidth={device.width}
                breakpoint={breakpoint}
              />
            )
          }
          status={
            <StatusBar
              changes={recentChanges}
              deviceLabel={`${device.bucket === 'base' ? 'Desktop' : device.bucket === 'tablet' ? 'Tablet' : 'Mobile'} · ${String(device.width)} px`}
            />
          }
          /*
              The PAGE theme, not the editor's: a colour swatch has to show the
              colour the page will actually paint, so a dark page's "Surface"
              swatch must read dark even while the editor chrome is light.
            */
          aside={
            <Inspector kernel={kernel} bucket={device.bucket} theme={theme} onRetheme={retheme} />
          }
        />
      </div>
    </BuilderTheme>
  );
}
