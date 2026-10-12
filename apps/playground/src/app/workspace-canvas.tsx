import {
  AssetTableProvider,
  EditorCanvas,
  StaticDocument,
  type BuilderSiteKernel,
  type CanvasDragHandle,
  type ElementTarget,
  type StyleBucket,
} from '@craftkit/builder';

import type { ProposalPreview } from '../features/agent';
import { CodeViewShowcase } from '../features/preview/components/CodeViewShowcase';
import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import { PageWorkspace } from '../features/preview/page-workspace';
import type { VaultKernelState } from '../features/vault/use-vault';
import type { ReadySession } from './app-helpers';
import { BootState } from './boot-state';
import { CodeRuntimeView } from './code-runtime-view';
import type { EditorLabels } from './editor-labels';
import type { CodeSession } from './use-code-session';
import type { EditorChrome } from './use-editor-chrome';
import type { InspectorFocus } from './use-inspector-focus';
import type { PartWiring } from './use-part-wiring';
import type { SiteDesign } from './use-site-design';

export interface WorkspaceCanvasProps {
  readonly vault: VaultKernelState;
  readonly session: ReadySession | undefined;
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly workspaceView: 'canvas' | 'sitemap';
  readonly labels: EditorLabels;
  readonly code: CodeSession;
  /** The rail's Code destination is open. */
  readonly codeOpen: boolean;
  readonly fixture: PlaygroundFixture;
  /** An Ask proposal shown before it is applied, or null. */
  readonly agentPreview: ProposalPreview | null;
  readonly breakpoint: 'desktop' | 'tablet' | 'mobile';
  readonly frameWidth: number;
  readonly zoom: number;
  readonly design: SiteDesign;
  readonly chrome: EditorChrome;
  readonly styleBucket: StyleBucket;
  readonly inspectorFocus: InspectorFocus;
  readonly partWiring: PartWiring;
  readonly editWithAi: (target: ElementTarget) => void;
  readonly onDragHandle: (handle: CanvasDragHandle | undefined) => void;
  readonly onReplaceMedia: () => void;
}

/**
 * The editor's main view: the boot state while there is no kernel, else the site
 * map, the authored code page, the code view, a proposal preview or the canvas.
 */
export function WorkspaceCanvas({
  vault,
  session,
  siteKernel,
  workspaceView,
  labels,
  code,
  codeOpen,
  fixture,
  agentPreview,
  breakpoint,
  frameWidth,
  zoom,
  design,
  chrome,
  styleBucket,
  inspectorFocus,
  partWiring,
  editWithAi,
  onDragHandle,
  onReplaceMedia,
}: WorkspaceCanvasProps) {
  const { codeSnapshot } = code;
  return session === undefined ? (
    <BootState state={vault} />
  ) : workspaceView === 'sitemap' ? (
    <PageWorkspace siteKernel={session.siteKernel} view="map" labels={labels.pageWorkspace} />
  ) : codeSnapshot !== undefined ? (
    <CodeRuntimeView
      code={code}
      codeSnapshot={codeSnapshot}
      siteKernel={siteKernel}
      codeOpen={codeOpen}
      labels={labels.codeWorkspace}
      frameWidth={frameWidth}
      zoom={zoom}
    />
  ) : codeOpen ? (
    <CodeViewShowcase key={fixture} kernel={session.kernel} labels={labels.codeViewShowcase} />
  ) : agentPreview !== null ? (
    <section
      className="pg-agent-preview"
      aria-label="Preview of the proposed change. Nothing is applied yet."
    >
      <div className="pg-agent-preview__page">
        <StaticDocument
          document={agentPreview.document}
          blocks={session.kernel.context.registry.block}
          breakpoint={breakpoint}
        />
      </div>
    </section>
  ) : (
    /*
      The site's asset table, made reachable from inside a block. An
      image prop holds an id, not an address, so a canvas rendered
      without this shows every picture as a labelled absence — which
      is the correct degradation, and the wrong thing to ship.
    */
    <AssetTableProvider assets={design.siteAssets ?? {}}>
      <EditorCanvas
        kernel={session.kernel}
        theme={design.theme}
        editable
        onDragHandle={onDragHandle}
        frameWidth={frameWidth}
        zoom={zoom}
        breakpoint={breakpoint}
        elementSelection={chrome.selection}
        styleBucket={styleBucket}
        onOpenStyleSector={inspectorFocus.openStyleSector}
        onAnimate={inspectorFocus.animate}
        onAnimateBlock={inspectorFocus.animateBlock} /* gsap-pixi additions (2026-10-08) */
        activeSector={inspectorFocus.styleContext.sector}
        styleState={inspectorFocus.styleContext.state}
        onEditWithAi={editWithAi}
        // ── block-parts (2026-10-06) ──
        onReplacePartImage={partWiring.onReplacePartImage}
        onOpenPartStyle={partWiring.onOpenPartStyle}
        onEditWithAiPart={partWiring.onEditWithAiPart}
        // ── /block-parts ──
        onSaveTemplate={chrome.saveTargetAsTemplate}
        onReplaceMedia={onReplaceMedia}
        onShortcut={chrome.onFrameShortcut}
        palette={design.siteLibrary?.palette}
        namedStyles={design.namedStyleChoices}
        namedStyleClasses={design.namedStyleClasses}
        quickBarLabels={labels.quickBar}
        treeTextLabels={labels.treeText}
        richTextLabels={labels.richText}
        elementNameWords={labels.elementWords}
        editorDir={labels.dir}
        canvasLabels={labels.canvas}
        symbolTree={design.symbolTree}
      />
    </AssetTableProvider>
  );
}
