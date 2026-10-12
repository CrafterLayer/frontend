/*
  The order the editor's modules are first evaluated in, pinned.

  Many of these modules import their own stylesheet, and stylesheets cascade in
  the order their modules are first evaluated. App.tsx used to import every one
  of them itself, in exactly this order; splitting it moved those imports into
  the editor's pieces, which would have re-ordered the cascade (measured: eight
  stylesheets moved, among them PersistenceStatus, Announcement and
  code-workspace). Importing them here, first, keeps the cascade — and every
  module's evaluation — exactly as it was. App.tsx imports this right after
  App.css. Do not sort these lines.
*/
import '../features/preview/components/AssistantPanel';
import '../features/preview/components/SiteBuilderPanel';
import '../features/preview/local-asset-library';
import '../features/preview/components/AssistantPanel/use-site-run';
import '../features/preview/components/AssistantPanel/planProviderFromEnv';
import '../features/agent';
import './agent-host';
import './rail-section-notice';
import './rail-sections';
import './site-design-host';
import './design-rail-panel';
import './editor-labels';
import './editor-shortcuts-host';
import './use-offered-models';
import './use-canvas-frame-document';
import './use-editor-chrome';
import './use-inspector-focus';
import './use-part-wiring';
import './library-sections';
import './preview-toolbar';
import './use-recent-changes';
import 'react';
import '@radix-ui/react-direction';
import '@craftkit/builder';
import '../features/preview/create-playground-kernel';
import '../features/preview/components/HistoryPanel';
import '../features/vault/use-vault';
import '../features/preview/components/DirectionFlip';
import '../features/preview/components/FixturePicker';
import '../features/preview/components/CodeViewShowcase';
import '../features/preview/components/RegisterDemoExtension';
import '../features/preview/components/ChromePicker';
import '../features/preview/components/ThemePicker';
import '../features/preview/use-transaction-count';
import '../features/preview/code-runtime-client';
import '../features/preview/use-code-page-session';
import '../features/preview/use-code-workspace';
import '../features/export';
import '../features/preview/code-workspace';
import '../features/preview/source-agent-client';
import '../features/preview/use-source-agent';
import '../features/preview/use-component-schema-resolver';
import '../features/preview/use-live-utilities';
import '../features/preview/components/SourceAgentPanel';
import '../features/vault/components/PersistenceStatus';
import '../features/preview/feature-flags';
import '../features/preview/artifact-archive';
import '../features/preview/workspace-preferences';
import '../features/preview/page-workspace';
