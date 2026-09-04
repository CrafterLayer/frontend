import './App.css';
import { AssistantPanel } from '../features/preview/components/AssistantPanel';
import { planProviderFromEnv } from '../features/preview/components/AssistantPanel/planProviderFromEnv';
import { RailSectionNotice } from './rail-section-notice';
import { RAIL_SECTIONS, RAIL_UTILITIES } from './rail-sections';
import { useRecentChanges } from './use-recent-changes';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  bucketForWidth,
  BuilderShell,
  BuilderTheme,
  ChromeButton,
  IconRail,
  StatusBar,
  TopBar,
  EditorCanvas,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  darkTheme,
  type BuilderKernel,
  type ColorRole,
  lightTheme,
  type CanvasDragHandle,
  type DeviceState,
  type RailItem,
  type TopBarDevice,
} from '@craftkit/builder';

import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import { HistoryPanel } from '../features/preview/components/HistoryPanel';
import {
  useVaultKernel,
  type VaultKernelState,
  type VaultSaveState,
} from '../features/vault/use-vault';
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

/**
 * Resolved once at module load: a remote assistant server when
 * VITE_AI_PLAN_ENDPOINT is set, otherwise undefined and the panel keeps its
 * built-in deterministic provider.
 */
const envPlanProvider = planProviderFromEnv(import.meta.env);

/*
  The rail's newest destination. It is composed HERE rather than added to
  `rail-sections.tsx` for the same reason the rail takes its items as data: what
  the sections ARE belongs to the host, and History only exists because this app
  opens its documents from a vault.
*/
const HISTORY_SECTION: RailItem = {
  id: 'history',
  label: 'History',
  icon: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 4.6V8l2.3 1.4" />
      <path d="M2.7 8a5.3 5.3 0 1 0 1.7-3.9" />
      <path d="M2.4 2.7v2.2h2.2" />
    </svg>
  ),
};

const RAIL_DESTINATIONS: readonly RailItem[] = [...RAIL_SECTIONS, HISTORY_SECTION];

/**
 * The sealed-store counter, split out for one reason: `useTransactionCount`
 * needs a kernel, and the app now has a state that has none. A hook cannot be
 * called conditionally, so the conditional is a component instead.
 */
function TransactionCount({ kernel }: { kernel: BuilderKernel }) {
  return <>{useTransactionCount(kernel)}</>;
}

/** Same reason: the provenance strip reads the transaction log through a hook. */
function ProvenanceStatusBar({
  kernel,
  deviceLabel,
}: {
  kernel: BuilderKernel;
  deviceLabel: string;
}) {
  return <StatusBar changes={useRecentChanges(kernel)} deviceLabel={deviceLabel} />;
}

/**
 * What the editing area shows while there is no kernel.
 *
 * A stored page that will not open must land somewhere a person can act on. It
 * is the one failure with an obvious cause and an obvious cure — a save written
 * by a vocabulary this build no longer has, or half-written by a browser that
 * was closed — and "the editor is blank" is not an acceptable rendering of it.
 */
function BootState({ state }: { state: VaultKernelState }) {
  if (state.status === 'failed') {
    return (
      <section className="pg-boot pg-boot--failed" aria-label="Saved page">
        <h2>This saved page could not be opened</h2>
        <p className="pg-boot__reason">{state.reason}</p>
        {/*
          TRY AGAIN LEADS, and it is the primary action.

          Not every failed boot is a broken document. A read that blipped, a
          database another tab held for a moment: the save is intact and only
          the attempt failed. This screen used to offer "start over" as its ONLY
          action, so the single button on it deleted a page that was never
          damaged — the person performing the deletion, on the app's advice.
        */}
        <p>
          Trying again re-opens the stored page and deletes nothing. Starting over discards the
          stored copy and opens the fixture again; restore points are kept either way.
        </p>
        <div className="pg-boot__actions">
          <ChromeButton
            variant="primary"
            onClick={() => {
              state.retry();
            }}
          >
            Try again
          </ChromeButton>
          <ChromeButton
            onClick={() => {
              state.startOver();
            }}
          >
            Start over
          </ChromeButton>
        </div>
      </section>
    );
  }
  return (
    <p className="pg-boot" role="status">
      Opening your page…
    </p>
  );
}

/**
 * The one thing a person cannot check for themselves: whether their work is
 * actually being kept.
 *
 * It says nothing at all while saving is working, which is almost always. It
 * speaks for the two states that used to be invisible — storage refusing every
 * write, and a second tab holding the same page — because a session that keeps
 * quiet through either loses everything on the next reload with a green screen
 * up to the last second.
 */
function SaveNotice({ save }: { save: VaultSaveState }) {
  if (save.status === 'error') {
    return (
      <div className="pg-save pg-save--error" role="alert">
        <p>
          <strong>Your changes are not being saved.</strong> They are still on screen and the next
          edit tries again — keep this tab open. Restore points use the same storage, so if you need
          this page somewhere safe, copy it out of Code.
        </p>
        {/* Storage's own words, never rewritten: "quota exceeded" and "this
            browser exposes no indexedDB" are different problems with different
            cures, and a single house sentence hides which one you have. */}
        {save.reason === undefined ? null : <p className="pg-save__reason">{save.reason}</p>}
      </div>
    );
  }
  if (save.shared) {
    return (
      <div className="pg-save" role="status">
        <p>
          This page is open in another tab. Both are still editing it, and whichever saves last is
          the copy that comes back.
        </p>
      </div>
    );
  }
  return null;
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

  /*
    One SESSION per fixture, opened from the vault.

    This used to be `useMemo(() => createPlaygroundKernel({ fixture }))` — a
    kernel conjured synchronously in the render body, which is exactly why the
    playground could never keep anything: a document that exists only for as
    long as the tab does has nowhere to be stored. `openDocument` reads storage,
    migrates, replays the tail and validates twice before a kernel exists, so
    for the first time this app has a state with no kernel in it. It says so
    rather than pretending, and a save it cannot open is a thing a person can
    act on rather than a blank editor.
  */
  const vault = useVaultKernel(fixture);
  const session = vault.status === 'ready' ? vault : undefined;
  const kernel = session?.kernel;
  // Dismissal is per fixture: choosing another document is a new answer to
  // "was this restored?", and a dismissal must not carry across it.
  const [noticeDismissedFor, setNoticeDismissedFor] = useState<PlaygroundFixture | undefined>(
    undefined,
  );

  // Every observable change pairs 1:1 with a transaction (Law S), so a live
  // counter is both a user-facing session gauge and the SC-004 arithmetic probe.
  const txSubscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel === undefined ? () => undefined : kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  // Subscribed read (never a bare render-body getState): the preview flip
  // derives from the LIVE document direction.
  const docDir = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.getDocument().dir ?? 'ltr', [kernel]),
  );
  // History is external kernel state too. Primitive snapshots keep the top
  // bar truthful on first render and after every undo/redo cursor movement.
  const canUndo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.canUndo() ?? false, [kernel]),
  );
  const canRedo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.canRedo() ?? false, [kernel]),
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
  // Named once: the status bar is rendered by two branches now (with a live
  // provenance strip, and without one while the document is opening), and the
  // device is the same fact in both.
  const deviceLabel = `${device.bucket === 'base' ? 'Desktop' : device.bucket === 'tablet' ? 'Tablet' : 'Mobile'} · ${String(device.width)} px`;
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

  if (preview && kernel !== undefined) {
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
          breakpoint={breakpoint}
          frameWidth={device.width}
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
          kernel?.undo();
        }}
        onRedo={() => {
          kernel?.redo();
        }}
        onPreview={() => {
          // There is nothing to preview until the document is open.
          if (kernel !== undefined) {
            setPreview(true);
          }
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
                {kernel === undefined ? 0 : <TransactionCount kernel={kernel} />}
              </output>
            </span>
          )
        }
      />
      <output aria-live="polite" aria-label="Mode" className="bldr-visually-hidden">
        {modeMessage.text}
        {modeMessage.nonce % 2 === 1 ? '\u200b' : ''}
      </output>
      {/*
        The one line the vault owes a person, and it costs the layout nothing:
        absolutely positioned inside `.pg-app`, so the editor beneath it is the
        same editor whether the page came from storage or from the fixture. A
        restore that happens silently is a restore a person cannot disagree with.
      */}
      {session === undefined ? null : <SaveNotice save={session.save} />}
      {session !== undefined && session.restored && noticeDismissedFor !== fixture ? (
        <div className="pg-restored" role="status">
          <p>Picked up where you left off — this page came back from your last session.</p>
          <ChromeButton
            size="sm"
            onClick={() => {
              session.startOver();
            }}
          >
            Start over
          </ChromeButton>
          <ChromeButton
            variant="icon"
            size="sm"
            aria-label="Dismiss restored notice"
            onClick={() => {
              setNoticeDismissedFor(fixture);
            }}
          >
            <span aria-hidden="true">×</span>
          </ChromeButton>
        </div>
      ) : null}
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
              items={RAIL_DESTINATIONS}
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
                The rail's content destinations are real panels; the rest say
                what they are. Blocks and Layers share the left column the way
                every builder of this kind does, which is also what frees the
                right column entirely for the inspector — the layer tree used to
                sit on top of it and take a third of its height.

                Every one of them needs the kernel, so while there is none the
                whole column is one quiet placeholder rather than five separate
                absences.
              */
            session === undefined ? (
              <div className="pg-boot-panel" />
            ) : (
              /*
                THE ASSISTANT STAYS MOUNTED. It used to be one arm of the same
                ternary as every other section, so opening Blocks unmounted it —
                and its unmount cleanup aborts the run in flight. A person who
                looked at their layers lost the page being built for them. It is
                hidden with `hidden`, not unmounted: the run, the conversation,
                the draft and the face all survive a tab that was never about
                them. Every other section still mounts on demand, because none
                of them owns work that outlives a glance.
              */
              <>
                <div
                  className="pg-rail-panel"
                  hidden={railSection !== 'assistant'}
                  data-section="assistant"
                >
                  <AssistantPanel
                    /*
                      KEYED ON THE BOOT. Staying mounted across rail
                      destinations is the point; staying mounted across a
                      DOCUMENT is not. "Start over" installs a brand new kernel
                      for the same fixture, and an unkeyed panel would carry its
                      conversation, its draft, its preview and any run whose
                      closures captured the discarded kernel into a page they
                      were never about. Same reason `RegisterDemoExtension` is
                      keyed on the fixture below.
                    */
                    key={session.bootId}
                    /*
                      Mounted, and told whether anyone is looking: a hidden
                      element measures zero, so the thread cannot follow the
                      newest turn while the person is on Layers.
                    */
                    visible={railSection === 'assistant'}
                    kernel={session.kernel}
                    planProvider={envPlanProvider}
                    /*
                      The one place that knows what the provider is: it came
                      from VITE_AI_PLAN_ENDPOINT, so it is a model over the
                      network and gets the cheap catalog. Absent, the offline
                      provider answers and needs the full one.
                    */
                    providerKind={envPlanProvider === undefined ? 'offline' : 'remote'}
                    persistKey="pg-assistant-sessions-v1"
                    onReviewAsCode={() => {
                      setRailSection('code');
                    }}
                  />
                </div>
                {railSection === 'layers' ? (
                  <LayersTree kernel={session.kernel} />
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
                    <DirectionFlip kernel={session.kernel} />
                    <RegisterDemoExtension key={fixture} kernel={session.kernel} />
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
                ) : railSection === 'history' ? (
                  /*
                      Restore points: the one part of the vault a person addresses
                      directly. The session's own saving is continuous and invisible;
                      this is the shelf they put something on deliberately.
                    */
                  <HistoryPanel kernel={session.kernel} shelf={session.shelf} />
                ) : railSection === 'assets' || railSection === 'help' ? (
                  <RailSectionNotice section={railSection} />
                ) : railSection === 'assistant' ? null : (
                  // Blocks, and Code: the palette stays beside the projection,
                  // because reading the document as text is not a reason to
                  // lose the ability to add to it.
                  <Palette kernel={session.kernel} dragHandle={dragHandle} />
                )}
              </>
            )
          }
          canvas={
            session === undefined ? (
              <BootState state={vault} />
            ) : codeOpen ? (
              <CodeViewShowcase key={fixture} kernel={session.kernel} />
            ) : (
              <EditorCanvas
                kernel={session.kernel}
                theme={theme}
                editable
                onDragHandle={setDragHandle}
                frameWidth={device.width}
                breakpoint={breakpoint}
              />
            )
          }
          status={
            session === undefined ? (
              <StatusBar changes={[]} deviceLabel={deviceLabel} />
            ) : (
              <ProvenanceStatusBar kernel={session.kernel} deviceLabel={deviceLabel} />
            )
          }
          /*
              The PAGE theme, not the editor's: a colour swatch has to show the
              colour the page will actually paint, so a dark page's "Surface"
              swatch must read dark even while the editor chrome is light.
            */
          aside={
            session === undefined ? undefined : (
              <Inspector
                kernel={session.kernel}
                bucket={device.bucket}
                theme={theme}
                onRetheme={retheme}
              />
            )
          }
        />
      </div>
    </BuilderTheme>
  );
}
