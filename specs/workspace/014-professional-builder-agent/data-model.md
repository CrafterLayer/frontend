# Data Model: Professional Builder and Agent

## Site version 2

`BuilderSite` gains an optional `codeProjects` table. A v1 site migrates to v2 with an empty table;
its pages and documents remain byte-equivalent apart from the site version.

## CodeProject

```ts
interface CodeProject {
  formatVersion: 1;
  runtimeProfile: 'craftkit-react-v1';
  dependencyLock: ManagedDependencyLock;
  revision: string;
  files: Readonly<Record<ModulePath, CodeFile>>;
}

interface CodeFile {
  language: 'js' | 'jsx' | 'ts' | 'tsx' | 'css' | 'json';
  source: string;
}
```

- Paths are normalized, project-relative POSIX paths without `..`, empty segments, or leading `/`.
- Revisions change whenever source or dependency lock changes.
- Page-private modules live below `pages/<pageId>/`; shared modules live below `shared/`.
- Invalid source is permitted as stored text. Structural validation does not claim compilability.

## CodePageReference

Stored as props of the only root node in a code-backed page document:

```ts
interface CodePageReference {
  projectId: string;
  entry: ModulePath;
  exportName: 'default';
  inputs: JsonRecord;
  seo?: PageSeo;
}
```

- The referenced project and entry must exist.
- The document contains no other nodes or slots.
- `SitePage.address` is the canonical route.
- A code-backed page imports its shared layout source; `SitePage.regions` remains empty to prevent a
  second host-rendered header or footer.

## SourceHandle and SelectionTarget

```ts
interface SourceHandle {
  projectId: string;
  modulePath: ModulePath;
  sourceRevision: string;
  astNodeId: string;
  instanceKey?: string;
}

interface SelectionTarget {
  pageId: PageId;
  sourceOrNodeId: SourceHandle | NodeId;
  revision: string;
  capabilities: readonly SelectionCapability[];
}
```

Capabilities include inspect, edit text, edit props, edit classes, edit source, duplicate, move,
delete, and insert-inside. A rendered target may expose fewer capabilities than its source.
`SelectionTarget.revision` is the owning site transaction revision; `SourceHandle.sourceRevision` is
the authored project revision. Reconciliation preserves a target only while its stable identity and
edit capability remain valid and unambiguous. Page switches clear visual selection, while a submitted
request retains its independently captured target. Removed or identity-changing source invalidates
pending visual operations instead of redirecting them.

## InsertionAnchor

```ts
interface InsertionAnchor {
  pageId: PageId;
  owner: SourceHandle | NodeId;
  slot: string;
  mode: 'before' | 'after' | 'inside';
  beforeId?: string;
  afterId?: string;
  revision: string;
}
```

The anchor resolves by identities, not indexes. Missing ownership or irreconcilable neighbors makes
the command fail without patches.

## ManagedCatalogManifest

Contains a catalog version, runtime profile, package ids and versions, allowed import specifiers,
component prop descriptors, source/CSS artifact identities, license metadata, and integrity hashes.
Catalog entries never expose editor kernel objects to generated code.

## BuildArtifact

Contains artifact id; source, dependency, compiler, runtime, and catalog fingerprints; route entry;
JavaScript and CSS artifact references; source map reference; prerendered HTML reference; diagnostics;
and creation metadata. It is valid only for its complete fingerprint.

## RunRecord

Contains run id, site and page identity, captured target and base revision, routing policy version,
stage/unit records, draft revision, cancellation state, timing, provider/model/effort, usage, cache
usage, attempts, and recovery point. A completed unit is persisted before its completion event is
shown. Resuming creates a successor record with a new run id and references the stopped predecessor.
It restores completed units as immutable checkpoints, revalidates target and revisions, and may restart
only interrupted work within the retry limit. A queued request stays paused after Stop until explicit
continuation.

## PersistenceAck

```ts
type PersistenceAck =
  | { kind: 'durable'; sequence: number }
  | { kind: 'session-only'; sequence: number; reason: string }
  | { kind: 'failed'; sequence: number; reason: string; recoverable: boolean };
```

The acknowledgement is part of persistence state, not a console-only signal. Quota and write failures
do not advance the durable sequence. Session memory retains the draft and exposes download/recovery;
the latest acknowledged source remains intact. Rebuildable artifacts are the first eviction class.

## State transitions

- Source: clean → dirty → saving → durable/session-only or failed.
- Build: queued → compiling → valid/invalid/cancelled/stale.
- Preview: none → matching or last-good-older-revision.
- Run: queued → active → stopped/failed/completed; a stopped run never becomes completed. Resume creates
  a new queued successor and never reopens the stopped record.
- Review result: planned → applied/rejected/failed; applied → undone is recorded as a distinct outcome.
- Export: requested → validating → ready/refused/cancelled.
