import type {
  ArtifactFile,
  BuildArtifact,
  CodeFile,
  CodeProject,
  CompileDiagnostic,
  JsonRecord,
  ManagedCatalogManifest,
  SourceHandle,
} from '@craftkit/builder-schema';

export interface RuntimeSnapshot {
  readonly projectId: string;
  readonly pageId: string;
  readonly address: string;
  readonly entry: string;
  readonly project: CodeProject;
  readonly inputs: JsonRecord;
}

/** Trusted, prebuilt catalog content. Never resolves from the host filesystem. */
export interface ManagedCatalog {
  readonly manifest: ManagedCatalogManifest;
  readonly modules: Readonly<Record<string, CodeFile>>;
  readonly stylesheet?: string;
}

export interface SourceElement {
  readonly handle: SourceHandle;
  readonly start: number;
  readonly end: number;
  readonly tag: string;
  readonly dynamic: boolean;
  /** Original JSX text span, present only when the element contains static text alone. */
  readonly staticText?: {
    readonly start: number;
    readonly end: number;
    readonly source: string;
  };
}

export interface CompiledPageArtifact extends BuildArtifact {
  readonly projectId: string;
  readonly pageId: string;
  readonly sourceRevision: string;
  readonly entry: string;
  readonly sourceElements: readonly SourceElement[];
}

export interface BuildCache {
  get(key: string): Promise<CompiledPageArtifact | undefined>;
  put(key: string, artifact: CompiledPageArtifact): Promise<void>;
}

export interface CompileOptions {
  readonly catalog: ManagedCatalog;
  readonly cache?: BuildCache;
  readonly signal?: AbortSignal;
  readonly maxSourceBytes?: number;
  readonly maxOutputBytes?: number;
}

export type CompileResult =
  | { readonly ok: true; readonly artifact: CompiledPageArtifact; readonly cacheHit: boolean }
  | { readonly ok: false; readonly diagnostics: readonly CompileDiagnostic[] };

export interface ExportPage extends RuntimeSnapshot {
  readonly title: string;
  readonly description: string;
  /** Omitted until the host knows the published website domain. */
  readonly canonicalUrl?: string;
  readonly language?: string;
  readonly direction?: 'ltr' | 'rtl';
  readonly noIndex?: boolean;
  /**
   * The page root's `seo` prop, as stored. Untrusted wire data: the exporter
   * parses it with `pageSeoSchema` and ignores it when it does not parse. The
   * home page's (`address: '/'`) `seo.site` carries the site-wide settings.
   */
  readonly seo?: JsonRecord;
  readonly socialTitle?: string;
  readonly socialDescription?: string;
  /** An https image URL for og:image / twitter:image. */
  readonly socialImage?: string;
}

export interface PrerenderResult {
  readonly html: string;
  readonly hasPrimaryContent: boolean;
}

export interface ExportOptions {
  readonly catalog: ManagedCatalog;
  readonly artifacts: ReadonlyMap<string, CompiledPageArtifact>;
  /** Runs in the host's isolated worker. The exporter never executes authored JS. */
  readonly prerender: (
    page: ExportPage,
    artifact: CompiledPageArtifact,
    signal?: AbortSignal,
  ) => Promise<PrerenderResult>;
  readonly signal?: AbortSignal;
  /**
   * The published https origin. Enables absolute canonical/og URLs, the
   * sitemap and robots.txt; falls back to the home page's `seo.site.origin`.
   */
  readonly origin?: string;
  /** The sitemap's lastmod; defaults to the export time. */
  readonly now?: Date;
}

export type ExportResult =
  | {
      readonly ok: true;
      readonly files: readonly ArtifactFile[];
      readonly artifactIds: readonly string[];
    }
  | { readonly ok: false; readonly diagnostics: readonly CompileDiagnostic[] };

export type PreviewEventType =
  'ready' | 'heartbeat' | 'geometry' | 'focus' | 'diagnostic' | 'navigate';
export interface PreviewEnvelope {
  readonly version: 1;
  readonly channel: string;
  readonly projectId: string;
  readonly pageId: string;
  readonly artifactId: string;
  readonly sourceRevision: string;
  readonly type: PreviewEventType;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Published artifact URLs, never authored source or host credentials. */
export interface PreviewArtifact {
  readonly artifactId: string;
  readonly projectId: string;
  readonly pageId: string;
  readonly sourceRevision: string;
  readonly scriptUrls: readonly string[];
  readonly stylesheetUrls: readonly string[];
  readonly targetIds: readonly string[];
}

export type PreviewHostCommand =
  | (Omit<PreviewEnvelope, 'type' | 'payload'> & {
      readonly type: 'init';
      readonly payload: { readonly artifact: PreviewArtifact; readonly publicData: JsonRecord };
    })
  | (Omit<PreviewEnvelope, 'type' | 'payload'> & {
      readonly type: 'focus';
      readonly payload: { readonly astNodeId: string };
    });

export interface PreviewBridge {
  onMessage(message: PreviewEnvelope): void;
  onRejected(reason: string): void;
  onState(state: 'loading' | 'ready' | 'unresponsive' | 'disposed'): void;
}
