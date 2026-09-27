import './App.css';
import { AssistantPanel } from '../features/preview/components/AssistantPanel';
import { SiteBuilderPanel } from '../features/preview/components/SiteBuilderPanel';
import { createLocalAssetLibrary } from '../features/preview/local-asset-library';
import {
  IDLE_SITE_RUN_SEAM,
  type SiteRunSeam,
} from '../features/preview/components/AssistantPanel/use-site-run';
import {
  planModelsFromEnv,
  planProviderFromEnv,
} from '../features/preview/components/AssistantPanel/planProviderFromEnv';
import { RailSectionNotice } from './rail-section-notice';
import { RAIL_SECTIONS, RAIL_UTILITIES } from './rail-sections';
import { useRecentChanges } from './use-recent-changes';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import {
  createOfflineSiteStageProvider,
  createSiteBuilder,
  themeFromDesignSystem,
  bucketForWidth,
  AssetTableProvider,
  BuilderShell,
  BuilderTheme,
  ChromeButton,
  CodePreviewFrame,
  IconRail,
  StatusBar,
  TopBar,
  EditorCanvas,
  Inspector,
  LayersTree,
  SitePages,
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
  type BuilderSite,
  type ArtifactFile,
} from '@craftkit/builder';

import {
  playgroundExtensions,
  type PlaygroundFixture,
} from '../features/preview/create-playground-kernel';
import { HistoryPanel } from '../features/preview/components/HistoryPanel';
import { useVaultKernel, type VaultKernelState } from '../features/vault/use-vault';
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
import { createCodeRuntimeClient } from '../features/preview/code-runtime-client';
import { useCodePageSession } from '../features/preview/use-code-page-session';
import { useCodeWorkspace } from '../features/preview/use-code-workspace';
import { CodeWorkspace } from '../features/preview/code-workspace';
import { createSourceAgentClient } from '../features/preview/source-agent-client';
import { useSourceAgent } from '../features/preview/use-source-agent';
import { useLiveUtilities } from '../features/preview/use-live-utilities';
import { SourceAgentPanel } from '../features/preview/components/SourceAgentPanel';
import { PersistenceStatus } from '../features/vault/components/PersistenceStatus';
import { PROFESSIONAL_BUILDER_FLAGS } from '../features/preview/feature-flags';
import { createArtifactArchive } from '../features/preview/artifact-archive';
import {
  readCurrentWorkspace,
  rememberCurrentWorkspace,
} from '../features/preview/workspace-preferences';
import { PageWorkspace } from '../features/preview/page-workspace';

/**
 * Product composition. Kernel source, runtime sessions, and Vault persistence
 * each have a single owner outside this React layout.
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
 * The models the assistant header may offer, from VITE_AI_PLAN_MODELS. The
 * provider itself is built inside `App`, per chosen model: the choice travels
 * as a request header, and a provider carries its headers from construction.
 */
const envPlanModels = planModelsFromEnv(import.meta.env);
const PLAN_MODEL_KEY = 'pg-ai-model-v1';
const CODE_RUNTIME_ENDPOINT = import.meta.env['VITE_CODE_RUNTIME_ENDPOINT'] as string | undefined;
const CODE_RUNTIME_TOKEN = import.meta.env['VITE_CODE_RUNTIME_TOKEN'] as string | undefined;
const EXPORT_SITE_ORIGIN = import.meta.env['VITE_EXPORT_SITE_ORIGIN'] as string | undefined;
const CODE_PREVIEW_URL_TEMPLATE =
  (import.meta.env['VITE_CODE_PREVIEW_URL_TEMPLATE'] as string | undefined) ??
  'http://{project}.localhost:5175/';

/** The remembered choice, honoured only while it is still on offer. */
function storedPlanModel(): string | undefined {
  try {
    const stored = localStorage.getItem(PLAN_MODEL_KEY);
    return stored !== null && envPlanModels.includes(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

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

function downloadArtifactFiles(files: readonly ArtifactFile[]): void {
  const url = URL.createObjectURL(
    new Blob([createArtifactArchive(files)], { type: 'application/zip' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'craftkit-site.zip';
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [asideOpen, setAsideOpen] = useState(true);
  const [visiblePanes, setVisiblePanes] = useState({ panel: true, aside: true, overlay: false });
  const [activeSide, setActiveSide] = useState<'panel' | 'aside'>('panel');
  const [panelWidth, setPanelWidth] = useState(320);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [zoomChoice, setZoomChoice] = useState('fit');
  const [workspaceView, setWorkspaceView] = useState<'canvas' | 'sitemap'>('canvas');
  const [planModel, setPlanModel] = useState<string | undefined>(storedPlanModel);
  const selectPlanModel = useCallback((model: string) => {
    setPlanModel(model);
    try {
      localStorage.setItem(PLAN_MODEL_KEY, model);
    } catch {
      // A private window forgets the choice; the picker still works for the session.
    }
  }, []);
  /*
    A remote assistant server when VITE_AI_PLAN_ENDPOINT is set, otherwise
    undefined and the panel keeps its built-in deterministic provider. Rebuilt
    when the model changes: the header is fixed at construction, and a fresh
    provider also starts a fresh cache, which is right — a different model is
    a different answer to the same page.
  */
  const envPlanProvider = useMemo(
    () => planProviderFromEnv(import.meta.env, planModel),
    [planModel],
  );
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
  useLiveUtilities(siteKernel);
  const codeRuntimeClient = useMemo(
    () =>
      CODE_RUNTIME_ENDPOINT === undefined
        ? undefined
        : createCodeRuntimeClient({
            endpoint: CODE_RUNTIME_ENDPOINT,
            previewUrlTemplate: CODE_PREVIEW_URL_TEMPLATE,
            ...(CODE_RUNTIME_TOKEN === undefined ? {} : { token: CODE_RUNTIME_TOKEN }),
          }),
    [],
  );
  const codePage = useCodePageSession(
    siteKernel,
    codeRuntimeClient,
    PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing,
    PROFESSIONAL_BUILDER_FLAGS.codeExport,
    EXPORT_SITE_ORIGIN,
  );
  const {
    source: codeSnapshot,
    compiled: visibleCompiledCodePage,
    selection: selectedSource,
    text: selectedText,
  } = codePage;
  const sourceWorkspace = useCodeWorkspace(
    siteKernel,
    codePage.controller,
    session?.vault.store,
    fixture,
  );
  const sourceAgentClient = useMemo(() => CODE_RUNTIME_ENDPOINT === undefined ? undefined : createSourceAgentClient(CODE_RUNTIME_ENDPOINT, CODE_RUNTIME_TOKEN), []);
  const reviewSource = useCallback((files: readonly string[]) => {
    if (files[0] !== undefined) sourceWorkspace?.selectFile(files[0]);
    setRailSection('code');
  }, [sourceWorkspace]);
  const sourceAgent = useSourceAgent(siteKernel, codePage.controller, codeRuntimeClient, sourceAgentClient, session?.vault, fixture, PROFESSIONAL_BUILDER_FLAGS.remoteCodeGeneration, reviewSource);
  const compileCodePage = () => codePage.controller?.rebuild();
  const exportCodePage = async () => {
    const exported = await codePage.controller?.exportPage();
    if (exported !== undefined) downloadArtifactFiles(exported.files);
  };
  /**
   * What the assistant needs to build a whole site, in one object.
   *
   * The DRAFT factory is the load-bearing part. A run writes command by command
   * into a throwaway and lands the result as one transaction, and that
   * throwaway has to share the live site's vocabulary — otherwise every stage
   * validates against one registry and the commit is judged by another. Only
   * this file knows the fixture that decides it.
   *
   * The provider is offline until a stage server exists: an offline site is a
   * template, and the day a person is shown one it must be because the host
   * chose it here, not because a fallback quietly took over.
   */
  /*
    The assistant panel owns the ONE run lease and lends it here. Held in state
    rather than derived, because the panel hands it up after it mounts and the
    site destination may be the first thing a person opens.
  */
  const [siteSeam, setSiteSeam] = useState<SiteRunSeam>(IDLE_SITE_RUN_SEAM);
  const assetLibrary = useMemo(() => createLocalAssetLibrary(), []);
  const siteHost = useMemo(
    () =>
      siteKernel === undefined
        ? undefined
        : {
            kernel: siteKernel,
            createDraft: (site: BuilderSite) =>
              createSiteBuilder({
                site,
                extensions: playgroundExtensions(fixture),
              }),
            provider: createOfflineSiteStageProvider(),
            /*
              Built once with the host, not per render: `AssetPicker` lists per
              `library` identity, and a fresh port object every render would
              list on every render.
            */
            library: assetLibrary,
          },
    [siteKernel, fixture, assetLibrary],
  );
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
  /*
    The SITE's own palette, subscribed (FR-012).

    Read through the site kernel rather than from `lightTheme`, because a
    site's design system IS its palette: generated for that business and
    checked for contrast. Painting the canvas from a named module theme instead
    would mean the system a person sees in the panel and the colours actually on
    the page came from two different places, and only one of them was ever
    validated.

    It is one rule above every page, so a token change reaches all of them and
    rewrites no document — which is what keeps a palette edit one undo instead
    of one per page.
  */
  const siteTokens = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        siteKernel === undefined ? () => undefined : siteKernel.subscribe(onStoreChange),
      [siteKernel],
    ),
    useCallback(() => siteKernel?.getSite().designSystem, [siteKernel]),
  );
  /*
    Subscribed, not read at render time. A generation registers pictures in the
    same transaction that places them, and an unsubscribed read would leave the
    canvas holding the table from BEFORE the run — every new picture a labelled
    absence until something else happened to re-render the app.
  */
  const siteAssets = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        siteKernel === undefined ? () => undefined : siteKernel.subscribe(onStoreChange),
      [siteKernel],
    ),
    useCallback(() => siteKernel?.getSite().assets, [siteKernel]),
  );
  /*
    The site's palette is the DEFAULT; the harness picker is a layer over it.

    Both things have to stay true. FR-012 says a site's own design system paints
    its pages — so "light" is not a named module theme any more, it is whatever
    the site was generated with. And the harness's picker still has to recolour
    the frame in place, because that is a control a person uses to inspect a
    page in the dark, not a claim about the site's design.

    Layered rather than swapped, which is the whole reason
    `themeFromDesignSystem` takes overrides beside a system instead of merging
    them into it: a stored site never acquires colours nobody generated for it,
    however long someone leaves the picker on dark.
  */
  const theme = useMemo(() => {
    const overrides = themeName === 'dark' ? { ...darkTheme, ...roleOverrides } : roleOverrides;
    return siteTokens === undefined
      ? { ...(themeName === 'light' ? lightTheme : darkTheme), ...roleOverrides }
      : themeFromDesignSystem(siteTokens, overrides);
  }, [siteTokens, themeName, roleOverrides]);
  const retheme = useCallback((role: ColorRole, value: string) => {
    setRoleOverrides((current) => ({ ...current, [role]: value }));
  }, []);
  const breakpoint = device.bucket === 'base' ? 'desktop' : device.bucket;
  // Named once: the status bar is rendered by two branches now (with a live
  // provenance strip, and without one while the document is opening), and the
  // device is the same fact in both.
  const deviceLabel = `${device.bucket === 'base' ? 'Desktop' : device.bucket === 'tablet' ? 'Tablet' : 'Mobile'} · ${String(device.width)} px`;
  const canvasZoom =
    zoomChoice === 'fit'
      ? Math.max(0.1, Math.min(1, (canvasWidth - 32) / device.width))
      : Number(zoomChoice);
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

  if (preview && kernel !== undefined && codeSnapshot === undefined) {
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
          if (codeSnapshot !== undefined) {
            void compileCodePage();
          } else if (kernel !== undefined) {
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
          <>
            <div className="pg-workspace-view" role="group" aria-label="Workspace view">
              <ChromeButton
                size="sm"
                variant="toggle"
                aria-pressed={workspaceView === 'canvas'}
                onClick={() => {
                  setWorkspaceView('canvas');
                }}
              >
                Canvas
              </ChromeButton>
              <ChromeButton
                size="sm"
                variant="toggle"
                aria-pressed={workspaceView === 'sitemap'}
                onClick={() => {
                  setWorkspaceView('sitemap');
                }}
              >
                Sitemap
              </ChromeButton>
            </div>
            <ChromeButton
              size="sm"
              variant="toggle"
              aria-label="Toggle workspace panel"
              aria-pressed={visiblePanes.panel}
              onClick={() => {
                setPanelOpen(!visiblePanes.panel);
                setActiveSide('panel');
              }}
            >
              Panel
            </ChromeButton>
            <ChromeButton
              size="sm"
              variant="toggle"
              aria-label="Toggle inspector"
              aria-pressed={visiblePanes.aside}
              onClick={() => {
                setAsideOpen(!visiblePanes.aside);
                setActiveSide('aside');
              }}
            >
              Inspector
            </ChromeButton>
            {showcaseOwnsLawSControls ? null : (
              <span className="bldr-visually-hidden">
                <output aria-label="Transactions" data-testid="pg-tx-count">
                  {kernel === undefined ? 0 : <TransactionCount kernel={kernel} />}
                </output>
              </span>
            )}
          </>
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
      {session === undefined ? null : (
        <PersistenceStatus
          value={session.save}
          shared={session.save.shared}
          onRetry={() => {
            void session.siteKernel.flush();
          }}
          onDownload={() => {
            const source = session.vault.downloadSource();
            const url = URL.createObjectURL(
              new Blob([source.contents], { type: source.mediaType }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = source.fileName;
            link.click();
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 1000);
          }}
        />
      )}
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
          adaptive
          panelOpen={panelOpen}
          asideOpen={asideOpen && workspaceView === 'canvas'}
          activeSide={activeSide}
          panelWidth={panelWidth}
          onPanelWidthChange={setPanelWidth}
          onCanvasWidthChange={setCanvasWidth}
          onLayoutChange={setVisiblePanes}
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
                setPanelOpen(true);
                setActiveSide('panel');
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
                  <div className="pg-legacy-agent-host" hidden={codeSnapshot !== undefined}>
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
                    models={envPlanModels}
                    model={planModel ?? envPlanModels[0]}
                    onSelectModel={selectPlanModel}
                    /*
                      The one place that knows what the provider is: it came
                      from VITE_AI_PLAN_ENDPOINT, so it is a model over the
                      network and gets the cheap catalog. Absent, the offline
                      provider answers and needs the full one.
                    */
                    providerKind={envPlanProvider === undefined ? 'offline' : 'remote'}
                    persistKey="pg-assistant-sessions-v1"
                    /*
                      A person who asks for a page gets the page: every section
                      lands as its own undoable entry, so an extra Apply bought
                      no safety. Ask and Plan stay one click away.
                    */
                    defaultMode="auto"
                    /*
                      The panel keeps the ONE run lease and hands it up; the
                      site builder on its own rail destination borrows it, so
                      two destinations can never both start a run.
                    */
                    onSiteSeam={setSiteSeam}
                    onReviewAsCode={() => {
                      setRailSection('code');
                    }}
                  />
                  </div>
                  {sourceAgent === undefined ? null : <div className="pg-source-agent-host" hidden={codeSnapshot === undefined}>
                    <SourceAgentPanel port={sourceAgent} visible={railSection === 'assistant' && codeSnapshot !== undefined} />
                  </div>}
                </div>
                {railSection === 'pages' ? (
                  <PageWorkspace siteKernel={session.siteKernel} />
                ) : railSection === 'layers' ? (
                  /*
                    The pages ABOVE the layers, in the same panel. The layer tree
                    shows one page's structure; the list above says which page
                    that is and lets a person move between them — reading the two
                    in the other order tells you the shape of something you have
                    not been told the name of.
                  */
                  <div className="pg-structure">
                    <SitePages siteKernel={session.siteKernel} />
                    <LayersTree kernel={session.kernel} />
                  </div>
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
                    <FixturePicker
                      value={fixture}
                      onChange={(next) => {
                        rememberCurrentWorkspace(next);
                        setFixture(next);
                      }}
                      showCodePage={
                        PROFESSIONAL_BUILDER_FLAGS.v2Authoring || fixture === 'code-page'
                      }
                    />
                    <ChromePicker value={chromeChoice} onChange={setChromeChoice} />
                    <ThemePicker value={themeName} onChange={setThemeName} />
                    <DirectionFlip kernel={session.kernel} siteKernel={session.siteKernel} />
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
                ) : railSection === 'site' ? (
                  <div className="pg-panel-scroll">
                    <SiteBuilderPanel
                      site={siteHost}
                      seam={siteSeam}
                      onStop={() => {
                        siteSeam.stop();
                      }}
                    />
                  </div>
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
            ) : workspaceView === 'sitemap' ? (
              <PageWorkspace siteKernel={session.siteKernel} view="map" />
            ) : codeSnapshot !== undefined ? (
              <section className="pg-code-runtime" aria-label="Authored code page">
                <div
                  className="pg-code-runtime__toolbar"
                  role="toolbar"
                  aria-label="Code page actions"
                >
                  <ChromeButton size="sm" onClick={() => void compileCodePage()}>
                    Build preview
                  </ChromeButton>
                  <ChromeButton
                    size="sm"
                    disabled={!siteKernel?.canUndo()}
                    onClick={() => {
                      siteKernel?.undo();
                    }}
                  >
                    Undo source
                  </ChromeButton>
                  <ChromeButton
                    size="sm"
                    onClick={() => {
                      void siteKernel?.flush().then(
                        () => undefined,
                        (error: unknown) => {
                          codePage.controller?.report(
                            error instanceof Error
                              ? error.message
                              : 'Storage did not acknowledge the source.',
                          );
                        },
                      );
                    }}
                  >
                    Save now
                  </ChromeButton>
                  <ChromeButton
                    size="sm"
                    disabled={
                      !PROFESSIONAL_BUILDER_FLAGS.codeExport ||
                      codePage.exporting ||
                      visibleCompiledCodePage?.artifact.sourceRevision !==
                        codeSnapshot.project.revision
                    }
                    onClick={() => void exportCodePage()}
                  >
                    Export files
                  </ChromeButton>
                  <span className="pg-code-runtime__revision">
                    Revision {codeSnapshot.project.revision}
                  </span>
                </div>
                <div className="pg-code-runtime__stage">
                  {codeOpen && sourceWorkspace !== undefined ? (
                    <CodeWorkspace port={sourceWorkspace} />
                  ) : (
                    <CodePreviewFrame
                      artifact={visibleCompiledCodePage?.artifact}
                      sourceRevision={codeSnapshot.project.revision}
                      previewUrl={
                        visibleCompiledCodePage?.previewUrl ?? 'http://unbuilt.localhost:5175/'
                      }
                      expectedOrigin={
                        new URL(
                          visibleCompiledCodePage?.previewUrl ?? 'http://unbuilt.localhost:5175/',
                        ).origin
                      }
                      publicData={codeSnapshot.inputs}
                      frameWidth={device.width}
                      zoom={canvasZoom}
                      status={codePage.status}
                      message={codePage.message}
                      onMessage={codePage.controller?.select}
                      onRetry={() => void compileCodePage()}
                    />
                  )}
                </div>
              </section>
            ) : codeOpen ? (
              <CodeViewShowcase key={fixture} kernel={session.kernel} />
            ) : (
              /*
                The site's asset table, made reachable from inside a block. An
                image prop holds an id, not an address, so a canvas rendered
                without this shows every picture as a labelled absence — which
                is the correct degradation, and the wrong thing to ship.
              */
              <AssetTableProvider assets={siteAssets ?? {}}>
                <EditorCanvas
                  kernel={session.kernel}
                  theme={theme}
                  editable
                  onDragHandle={setDragHandle}
                  frameWidth={device.width}
                  zoom={canvasZoom}
                  breakpoint={breakpoint}
                />
              </AssetTableProvider>
            )
          }
          status={
            <div className="pg-canvas-status">
              {session === undefined ? (
                <StatusBar changes={[]} deviceLabel={deviceLabel} />
              ) : (
                <ProvenanceStatusBar kernel={session.kernel} deviceLabel={deviceLabel} />
              )}
              <label className="pg-canvas-zoom">
                Zoom
                <select
                  aria-label="Canvas zoom"
                  value={zoomChoice}
                  onChange={(event) => {
                    setZoomChoice(event.currentTarget.value);
                  }}
                >
                  <option value="fit">Fit · {Math.round(canvasZoom * 100)}%</option>
                  <option value="0.5">50%</option>
                  <option value="0.75">75%</option>
                  <option value="1">100%</option>
                  <option value="1.25">125%</option>
                </select>
              </label>
            </div>
          }
          /*
              The PAGE theme, not the editor's: a colour swatch has to show the
              colour the page will actually paint, so a dark page's "Surface"
              swatch must read dark even while the editor chrome is light.
            */
          aside={
            session === undefined ? undefined : codeSnapshot !== undefined ? (
              <aside className="pg-code-runtime__selection" aria-label="Selected source element">
                <h2>Selected element</h2>
                {selectedSource === undefined ? (
                  <p>Click an element in the isolated preview to edit its static text.</p>
                ) : (
                  <>
                    <p>
                      <strong>{selectedSource.tag}</strong>
                      <span>{selectedSource.handle.modulePath}</span>
                    </p>
                    <ChromeButton
                      size="sm"
                      onClick={() => {
                        sourceWorkspace?.navigateToSource(selectedSource.handle);
                        setRailSection('code');
                        setPanelOpen(true);
                      }}
                    >
                      Open source
                    </ChromeButton>
                    <label>
                      Text
                      <textarea
                        rows={4}
                        disabled={
                          !PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing ||
                          selectedSource.staticText === undefined ||
                          selectedSource.dynamic
                        }
                        value={selectedText}
                        onChange={(event) => {
                          codePage.controller?.setText(event.currentTarget.value);
                        }}
                      />
                    </label>
                    <ChromeButton
                      size="sm"
                      variant="primary"
                      disabled={
                        !PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing ||
                        selectedSource.staticText === undefined ||
                        selectedSource.dynamic
                      }
                      onClick={() => {
                        codePage.controller?.applyText();
                      }}
                    >
                      Apply as one change
                    </ChromeButton>
                  </>
                )}
              </aside>
            ) : (
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
