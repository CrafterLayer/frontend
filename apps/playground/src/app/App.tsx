import './App.css';
// Before anything else: the modules' evaluation order, and so the stylesheet cascade, as it was.
import './module-order';
import { SiteDesignHost } from './site-design-host';
import { EditorShortcutsHost } from './editor-shortcuts-host';
import { useCanvasFrameDocument } from './use-canvas-frame-document';
import { useEditorChrome } from './use-editor-chrome';
import { librarySections } from './library-sections';
import { AGENT_PANEL } from './app-env';
import { deviceForBucket } from './app-helpers';
import { useEditorPanes } from './use-editor-panes';
import { useAgentModelSettings } from './use-agent-model-settings';
import { useEditorLanguage } from './use-editor-language';
import { useCanvasGestures } from './use-canvas-gestures';
import { useCodeSession } from './use-code-session';
import { useAgentHost } from './use-agent-host';
import { useKernelSnapshot } from './use-kernel-snapshot';
import { useSiteDesign } from './use-site-design';
import { PlaygroundPreview } from './playground-preview';
import { EditorTopBar } from './editor-top-bar';
import { VaultNotices } from './vault-notices';
import { EditorRail } from './editor-rail';
import { AssistantRailPanel } from './assistant-rail-panel';
import { RailSectionPanel } from './rail-section-panel';
import { HarnessSettingsPanel } from './harness-settings-panel';
import { WorkspaceCanvas } from './workspace-canvas';
import { CanvasStatus } from './canvas-status';
import { CodeSourceSelection } from './code-source-selection';
import { PageInspector } from './page-inspector';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { DirectionProvider } from '@radix-ui/react-direction';

import {
  themeToCssVars,
  bucketForWidth,
  BuilderShell,
  BuilderTheme,
  ShortcutsDialog,
  type EditorDevice,
  type StyleBucket,
  type CanvasDragHandle,
  type DeviceState,
  type TopBarDevice,
} from '@craftkit/builder';

import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import { useVaultKernel } from '../features/vault/use-vault';
import { chromeThemeFor, type ChromeChoice } from '../features/preview/components/ChromePicker';
import type { ThemeName } from '../features/preview/components/ThemePicker';
import { useComponentSchemaResolver } from '../features/preview/use-component-schema-resolver';
import { useLiveUtilities } from '../features/preview/use-live-utilities';
import { readCurrentWorkspace } from '../features/preview/workspace-preferences';
import { FeedbackToaster, feedbackLabels } from '../features/feedback';

/**
 * Product composition. Kernel source, runtime sessions, and Vault persistence
 * each have a single owner outside this React layout.
 */
export function App() {
  const [themeName, setThemeName] = useState<ThemeName>('light');
  /*
    The EDITOR's theme, which is not the page's. `system` is the honest default:
    it passes no theme at all, so the stylesheet's `prefers-color-scheme` block
    answers — the state every viewer actually starts in.
  */
  const [chromeChoice, setChromeChoice] = useState<ChromeChoice>('system');
  // The rail section, the panes, their widths, the zoom and the workspace view.
  const panes = useEditorPanes();
  const {
    railSection,
    setRailSection,
    panelOpen,
    setPanelOpen,
    asideOpen,
    setAsideOpen,
    setActiveSide,
    panelWidth,
    setPanelWidth,
  } = panes;
  // The assistant's model, effort and free-code choices, and the provider they decide.
  const agentSettings = useAgentModelSettings();
  /*
    The scenario harness is a disclosure, not a strip. Eight controls plus the
    product's own do not fit a 56px bar: measured at 1600px they came to 722px
    inside a 372px slot, so two of them sat outside the visible region — still
    focusable, no longer clickable. Opening OVER the canvas costs no layout
    pixels at all, which is the whole point.
  */
  const [fixture, setFixture] = useState<PlaygroundFixture>(readCurrentWorkspace);
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
  /*
    The style bucket the panel, the quick bar and the canvas handles write at
    (style-manager DESIGN §A.7). It follows the device; a custom width chosen in
    the panel ("Edit at ≤ N px") overrides it until the device changes again.
  */
  const [customBucket, setCustomBucket] = useState<{ readonly maxWidth: number } | undefined>(
    undefined,
  );
  const styleBucket: StyleBucket = customBucket ?? device.bucket;
  // The editor's language: its labels, the document's lang/dir, the rail items.
  const language = useEditorLanguage();
  const { editorLocale, setEditorLocale, labels, railDestinations, railUtilities } = language;
  // The editor actions' polite channel: outcomes and refusals of shortcuts, Layers, templates.
  const [chromeMessage, setChromeMessage] = useState({ text: '', nonce: 0 });
  const announceChrome = useCallback((text: string) => {
    setChromeMessage((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);
  const changeDevice = useCallback((next: TopBarDevice) => {
    setCustomBucket(undefined);
    setDevice(deviceForBucket(next));
  }, []);
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
  const siteKernel = session?.siteKernel;
  // Any Tailwind class the assistant writes renders, and the door judges classes by the same compiler.
  const liveUtilities = useLiveUtilities(siteKernel);
  // Component props inside a tree are judged by their block's own schema.
  useComponentSchemaResolver(kernel);
  const frameDocument = useCanvasFrameDocument();
  const chrome = useEditorChrome({
    kernel,
    siteKernel,
    labels,
    bucket: styleBucket,
    frameDocument,
    onDevice: (next: EditorDevice) => {
      changeDevice(next);
    },
    announce: announceChrome,
  });
  // Edit with AI, the Inspector's focus requests, the part gestures, Replace media.
  const { editWithAi, inspectorFocus, partWiring, openAssets } = useCanvasGestures({
    kernel,
    labels,
    editorLocale,
    announce: announceChrome,
    setRailSection,
    setPanelOpen,
    setAsideOpen,
    setActiveSide,
  });
  // The code page, its source workspace and source agent, and the static-site publish.
  const code = useCodeSession({
    siteKernel,
    vault: session?.vault,
    fixture,
    liveUtilities,
    setRailSection,
  });
  const { codeSnapshot } = code;
  // The assistant's seams into this host: run lease, pill, proposal preview, sheet, site host.
  const agentHost = useAgentHost({ siteKernel, fixture, railSection });
  const { agentAsSheet, assetLibrary } = agentHost;
  // Dismissal is per fixture: choosing another document is a new answer to
  // "was this restored?", and a dismissal must not carry across it.
  const [noticeDismissedFor, setNoticeDismissedFor] = useState<PlaygroundFixture | undefined>(
    undefined,
  );

  // The live document direction and undo/redo state (Law S: subscribed, never read bare).
  const { docDir, canUndo, canRedo } = useKernelSnapshot(kernel);
  // The site's palette (as the page theme), asset table and design library, subscribed.
  const design = useSiteDesign(siteKernel, themeName);
  const { theme, retheme, siteLibrary } = design;
  const breakpoint = device.bucket === 'base' ? 'desktop' : device.bucket;
  // Named once: the status bar is rendered by two branches now (with a live
  // provenance strip, and without one while the document is opening), and the
  // device is the same fact in both.
  const deviceLabel = labels.chrome.deviceLine(labels.chrome.device[device.bucket], device.width);
  // The Library's thumbnails: the page theme's tokens and a readable base font, and the kits as Sections.
  const libraryPreviewCss = useMemo(
    () =>
      `${themeToCssVars(theme)}\nbody{font-family:ui-sans-serif,system-ui,sans-serif;color:var(--t-text);background:var(--t-surface);line-height:1.5}\nimg{max-inline-size:100%;block-size:auto}`,
    [theme],
  );
  const libraryKitSections = useMemo(() => librarySections(editorLocale), [editorLocale]);
  const canvasZoom =
    panes.zoomChoice === 'fit'
      ? Math.max(0.1, Math.min(1, (panes.canvasWidth - 32) / device.width))
      : Number(panes.zoomChoice);
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
  const agentPanelPending = <div className="pg-boot-panel" hidden={railSection !== 'assistant'} />;
  const showcaseOwnsLawSControls = codeOpen;

  if (preview && kernel !== undefined && codeSnapshot === undefined) {
    return (
      <SiteDesignHost siteKernel={siteKernel}>
        <PlaygroundPreview
          kernel={kernel}
          theme={theme}
          editorLocale={editorLocale}
          labels={labels}
          docDir={docDir}
          breakpoint={breakpoint}
          frameWidth={device.width}
          previewFlipped={previewFlipped}
          setPreviewFlipped={setPreviewFlipped}
          setPreview={setPreview}
          setModeMessage={setModeMessage}
        />
      </SiteDesignHost>
    );
  }

  return (
    // The chrome root: this is what turns twenty stylesheets' fallback values
    // into an actual theme, and it is the element a host re-points a token on.
    // The site design library (palette, named styles, symbols) around every page render.
    <SiteDesignHost siteKernel={siteKernel}>
      {/* Radix menus, tabs and popovers read the chrome's direction from here. */}
      <DirectionProvider dir={labels.dir}>
        <BuilderTheme className="pg-app" theme={chromeThemeFor(chromeChoice)} dir={labels.dir}>
          <EditorTopBar
            labels={labels}
            language={language}
            code={code}
            device={device}
            changeDevice={changeDevice}
            canUndo={canUndo}
            canRedo={canRedo}
            showcaseOwnsLawSControls={showcaseOwnsLawSControls}
            kernel={kernel}
            siteKernel={siteKernel}
            setPreview={setPreview}
            panes={panes}
            openShortcuts={chrome.setShortcutsOpen}
          />
          {/* The outcome of a person's own action (publish first), said once near the canvas. */}
          <FeedbackToaster labels={feedbackLabels(editorLocale)} dir={labels.dir} />
          <output aria-live="polite" aria-label="Mode" className="bldr-visually-hidden">
            {modeMessage.text}
            {modeMessage.nonce % 2 === 1 ? '​' : ''}
          </output>
          <output aria-live="polite" aria-label="Editor actions" className="bldr-visually-hidden">
            {chromeMessage.text}
            {chromeMessage.nonce % 2 === 1 ? '​' : ''}
          </output>
          {/* The editor keymap (style-manager §E): undo/redo, copy/paste, duplicate, wrap, devices, `?`. */}
          {session === undefined || codeSnapshot !== undefined || codeOpen ? null : (
            <EditorShortcutsHost
              kernel={session.kernel}
              onAction={chrome.runShortcut}
              enabled={!chrome.shortcutsOpen}
            />
          )}
          <ShortcutsDialog
            open={chrome.shortcutsOpen}
            onClose={() => {
              chrome.setShortcutsOpen(false);
            }}
            labels={labels.shortcuts}
          />
          {session === undefined ? null : (
            <VaultNotices
              session={session}
              fixture={fixture}
              noticeDismissedFor={noticeDismissedFor}
              onDismissRestored={setNoticeDismissedFor}
              labels={labels.chrome}
            />
          )}
          <div style={{ flex: 1, minBlockSize: 0 }}>
            {/*
          The editor's layout is BuilderShell's job, not this file's. Before it
          the playground nested flexboxes with inline sizes here, which meant the
          shape of the editor was described in one place and approximated in
          every other — and a region could only be removed by editing this JSX.
          Now an absent region is simply an omitted prop.
        */}
            <BuilderShell
              label={labels.chrome.editor}
              adaptive
              panelOpen={panelOpen && !agentAsSheet}
              /*
            While the agent is the phone sheet, the inspector stays closed. Left open, it
            was an overlay 288px wide over a 342px canvas: the sheet's mini detent showed
            the rail, "No block selected" and a 40px sliver of the page (final test,
            2026-09-29). The canvas is what the mini detent is for (SPEC §3.16).
          */
              asideOpen={asideOpen && panes.workspaceView === 'canvas' && !agentAsSheet}
              activeSide={panes.activeSide}
              panelWidth={panelWidth}
              /*
            The v2 agent panel carries its own separator (SPEC §4.1: 16px steps,
            48 with Shift); two separators on one edge would fight, so the shell's
            steps aside while the agent holds the column.
          */
              onPanelWidthChange={
                AGENT_PANEL === 'v2' && railSection === 'assistant' && codeSnapshot === undefined
                  ? undefined
                  : setPanelWidth
              }
              onCanvasWidthChange={panes.setCanvasWidth}
              onLayoutChange={panes.setVisiblePanes}
              rail={
                <EditorRail
                  items={railDestinations}
                  secondary={railUtilities}
                  label={labels.chrome.railLabel}
                  panes={panes}
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
                    {/* The agent panels' own chunk: until it lands, the quiet placeholder. */}
                    <Suspense fallback={agentPanelPending}>
                      <AssistantRailPanel
                        bootId={session.bootId}
                        kernel={session.kernel}
                        shelf={session.shelf}
                        panes={panes}
                        host={agentHost}
                        code={code}
                        settings={agentSettings}
                        returnFocusToRailAgent={language.returnFocusToRailAgent}
                      />
                    </Suspense>
                    <RailSectionPanel
                      railSection={railSection}
                      session={session}
                      labels={labels}
                      editorLocale={editorLocale}
                      chrome={chrome}
                      styleBucket={styleBucket}
                      harness={
                        <HarnessSettingsPanel
                          fixture={fixture}
                          onFixtureChange={setFixture}
                          chromeChoice={chromeChoice}
                          onChromeChoiceChange={setChromeChoice}
                          themeName={themeName}
                          onThemeNameChange={setThemeName}
                          languageLabel={labels.chrome.editorLanguage}
                          editorLocale={editorLocale}
                          onEditorLocaleChange={setEditorLocale}
                          kernel={session.kernel}
                          siteKernel={session.siteKernel}
                          codeOpen={codeOpen}
                          canvasWidth={device.width}
                          onCanvasWidthChange={(width) => {
                            setCustomBucket(undefined);
                            setDevice({ width, bucket: bucketForWidth(width) });
                          }}
                        />
                      }
                      host={agentHost}
                      theme={theme}
                      docDir={docDir}
                      announce={announceChrome}
                      dragHandle={dragHandle}
                      templates={siteLibrary?.templates}
                      libraryKitSections={libraryKitSections}
                      libraryPreviewCss={libraryPreviewCss}
                      liveUtilities={liveUtilities}
                    />
                  </>
                )
              }
              canvas={
                <WorkspaceCanvas
                  vault={vault}
                  session={session}
                  siteKernel={siteKernel}
                  workspaceView={panes.workspaceView}
                  labels={labels}
                  code={code}
                  codeOpen={codeOpen}
                  fixture={fixture}
                  agentPreview={agentHost.agentPreview}
                  breakpoint={breakpoint}
                  frameWidth={device.width}
                  zoom={canvasZoom}
                  design={design}
                  chrome={chrome}
                  styleBucket={styleBucket}
                  inspectorFocus={inspectorFocus}
                  partWiring={partWiring}
                  editWithAi={editWithAi}
                  onDragHandle={setDragHandle}
                  onReplaceMedia={openAssets}
                />
              }
              status={
                <CanvasStatus
                  session={session}
                  deviceLabel={deviceLabel}
                  labels={labels}
                  editorLocale={editorLocale}
                  setAgentPillHost={agentHost.setAgentPillHost}
                  panes={panes}
                  canvasZoom={canvasZoom}
                />
              }
              /*
              The PAGE theme, not the editor's: a colour swatch has to show the
              colour the page will actually paint, so a dark page's "Surface"
              swatch must read dark even while the editor chrome is light.
            */
              aside={
                session === undefined ? undefined : codeSnapshot !== undefined ? (
                  <CodeSourceSelection code={code} panes={panes} />
                ) : (
                  <PageInspector
                    kernel={session.kernel}
                    device={device}
                    theme={theme}
                    onRetheme={retheme}
                    onDeviceChange={changeDevice}
                    onDeviceStateChange={setDevice}
                    onCustomBucketChange={setCustomBucket}
                    locale={editorLocale}
                    library={siteLibrary}
                    chrome={chrome}
                    frameDocument={frameDocument}
                    inspectorFocus={inspectorFocus}
                    assetLibrary={assetLibrary}
                  />
                )
              }
            />
          </div>
        </BuilderTheme>
      </DirectionProvider>
    </SiteDesignHost>
  );
}
