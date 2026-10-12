import { useMemo, useRef } from 'react';

import type { BuilderKernel } from '@craftkit/builder';

import type { SnapshotShelf } from '../features/vault/snapshots';
import { createAgentCheckpoints } from './agent-checkpoints';
import { AGENT_EDIT_EFFORT, AGENT_LOCALE, AGENT_PANEL } from './app-env';
import type { EditorLocale } from './editor-labels';
import type { AgentHost } from './use-agent-host';
import type { AgentModelSettings } from './use-agent-model-settings';
import type { CodeSession } from './use-code-session';
import { lazyPanel } from './lazy-panel';
import { usePinnedColumn } from './pin-column';
import type { EditorPanes } from './use-editor-panes';

export interface AssistantRailPanelProps {
  /** This opening of the document: what the panel is keyed on. */
  readonly bootId: string;
  /** The editor's language: the panel speaks it unless the build pins one. */
  readonly editorLocale: EditorLocale;
  readonly kernel: BuilderKernel;
  /** The page's restore-point shelf: the agent keeps a checkpoint there before each request. */
  readonly shelf?: SnapshotShelf | undefined;
  readonly panes: Pick<
    EditorPanes,
    | 'railSection'
    | 'setRailSection'
    | 'panelOpen'
    | 'setPanelOpen'
    | 'setActiveSide'
    | 'visiblePanes'
    | 'panelWidth'
    | 'setPanelWidth'
  >;
  readonly host: Pick<
    AgentHost,
    | 'openAgentPage'
    | 'languageVersions'
    | 'backgroundJobs'
    | 'setAgentPreview'
    | 'agentAsSheet'
    | 'agentPillHost'
    | 'setSiteSeam'
  >;
  /** The authored code page, when one is open: the source agent speaks instead. */
  readonly code: Pick<CodeSession, 'codeSnapshot' | 'sourceAgent'>;
  readonly settings: AgentModelSettings;
  /** The rail's own agent button: where focus returns when the phone sheet closes. */
  readonly returnFocusToRailAgent: () => HTMLElement | null;
}

/*
  The agent panels load in their own chunks (performance pass, 2026-10-12). They are mounted at
  boot, hidden, but none of them is part of the first paint: kept in the entry they were most of
  it (the agent feature and every builder-ai module the panel reaches through the facade). The
  import starts when this destination first renders and App's Suspense boundary holds the panel
  column's quiet placeholder until it lands. Their stylesheets travel with their chunks; the
  editor's computed styles were compared before and after (light and dark, five rail
  destinations, canvas included) and are identical. A chunk that will not load is retried, then
  leaves this column empty instead of the editor (lazy-panel.ts).
*/
const LiveAgentPanel = lazyPanel(() =>
  import('../features/agent').then((module) => module.LiveAgentPanel),
);
const AssistantPanel = lazyPanel(() =>
  import('../features/preview/components/AssistantPanel').then((module) => module.AssistantPanel),
);
const SourceAgentPanel = lazyPanel(() =>
  import('../features/preview/components/SourceAgentPanel').then(
    (module) => module.SourceAgentPanel,
  ),
);

/** This viewer's localStorage, or none where reading it throws (a sandboxed frame). */
function viewerStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** The rail's Assistant destination: the agent panel (v2, or the v1 rollback) and the source agent. */
export function AssistantRailPanel({
  bootId,
  editorLocale,
  kernel,
  shelf,
  panes,
  host,
  code,
  settings,
  returnFocusToRailAgent,
}: AssistantRailPanelProps) {
  const {
    railSection,
    setRailSection,
    panelOpen,
    setPanelOpen,
    setActiveSide,
    visiblePanes,
    panelWidth,
    setPanelWidth,
  } = panes;
  const {
    openAgentPage,
    languageVersions,
    backgroundJobs,
    setAgentPreview,
    agentAsSheet,
    agentPillHost,
    setSiteSeam,
  } = host;
  const { codeSnapshot, sourceAgent } = code;
  // The panel scrolls inside its thread; the shared column stays at its top (pin-column.ts).
  const railRef = useRef<HTMLDivElement | null>(null);
  usePinnedColumn(railRef, railSection === 'assistant');
  const {
    envPlanProvider,
    offeredModels,
    planModel,
    selectPlanModel,
    planEffort,
    selectPlanEffort,
    freeCode,
    toggleFreeCode,
    agentEditModel,
  } = settings;
  // The agent's checkpoints over the page's shelf (2026-10-12): kept before every request.
  const checkpoints = useMemo(
    () =>
      shelf === undefined
        ? undefined
        : createAgentCheckpoints({ shelf, kernel, storage: viewerStorage() }),
    [shelf, kernel],
  );
  return (
    <div
      ref={railRef}
      className="pg-rail-panel"
      hidden={railSection !== 'assistant'}
      data-section="assistant"
    >
      {AGENT_PANEL === 'v2' ? (
        <div className="pg-agent-host" hidden={codeSnapshot !== undefined}>
          <LiveAgentPanel
            /*
              KEYED ON THE BOOT, as the v1 panel was: mounted across rail
              destinations, never across a document. "Start over" installs
              a new kernel for the same fixture, and a panel carried over
              would run its conversation and any run in flight against a
              page it was never about. A page change (Pages, or the panel's
              own "new page") only hands it the new page's kernel.
            */
            key={bootId}
            kernel={kernel}
            locale={AGENT_LOCALE ?? editorLocale}
            provider={envPlanProvider}
            providerKind={envPlanProvider === undefined ? 'offline' : 'remote'}
            models={offeredModels}
            model={planModel}
            onSelectModel={selectPlanModel}
            /*
              The effort menu is for a server that takes a budget: with the
              offline provider there is none to set, so no menu is drawn.
            */
            {...(envPlanProvider === undefined
              ? {}
              : { effort: planEffort, onSelectEffort: selectPlanEffort })}
            freeCode={freeCode}
            onToggleFreeCode={toggleFreeCode}
            editModel={agentEditModel}
            editEffort={AGENT_EDIT_EFFORT}
            addPage={openAgentPage}
            languageVersions={languageVersions}
            backgroundJobs={backgroundJobs}
            /*
              A person who asks for a page gets the page: every section
              lands as its own undoable entry. Ask and Plan are one menu away.
            */
            defaultMode="auto"
            onViewAsCode={() => {
              setRailSection('code');
            }}
            onPreview={setAgentPreview}
            onOpenPageHistory={() => {
              setRailSection('history');
              setPanelOpen(true);
              setActiveSide('panel');
            }}
            /*
              Mounted, and told whether anyone is looking: hidden, it keeps
              its run and pauses its clocks, and its pill speaks for it in
              the status bar. On a phone it is the sheet, shown while the
              rail's Assistant is open.
            */
            visible={
              railSection === 'assistant' &&
              codeSnapshot === undefined &&
              (agentAsSheet ? panelOpen : visiblePanes.panel)
            }
            width={panelWidth}
            onWidthChange={setPanelWidth}
            onClose={() => {
              setPanelOpen(false);
            }}
            returnFocus={returnFocusToRailAgent}
            pillContainer={agentPillHost}
            onOpen={() => {
              setRailSection('assistant');
              setPanelOpen(true);
              setActiveSide('panel');
            }}
            onSiteSeam={setSiteSeam}
            checkpoints={checkpoints}
          />
        </div>
      ) : (
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
              keyed on the fixture in the harness panel.
            */
            key={bootId}
            /*
              Mounted, and told whether anyone is looking: a hidden
              element measures zero, so the thread cannot follow the
              newest turn while the person is on Layers.
            */
            visible={railSection === 'assistant'}
            kernel={kernel}
            planProvider={envPlanProvider}
            models={offeredModels}
            model={planModel}
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
      )}
      {sourceAgent === undefined ? null : (
        <div className="pg-source-agent-host" hidden={codeSnapshot === undefined}>
          <SourceAgentPanel
            port={sourceAgent}
            visible={railSection === 'assistant' && codeSnapshot !== undefined}
          />
        </div>
      )}
    </div>
  );
}
