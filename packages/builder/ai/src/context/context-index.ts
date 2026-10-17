import {
  codePageReferenceSchema,
  type BuilderSite,
  type CodeFile,
  type Node,
  type SelectionTarget,
  type SourceHandle,
} from '@craftkit/builder-schema';

export const CONTEXT_INDEX_VERSION = 1 as const;

export type ContextIndexErrorCode =
  | 'missing-module'
  | 'missing-page'
  | 'missing-project'
  | 'stale-selection';

export class ContextIndexError extends Error {
  readonly code: ContextIndexErrorCode;

  constructor(code: ContextIndexErrorCode, message: string) {
    super(message);
    this.name = 'ContextIndexError';
    this.code = code;
  }
}

export interface ProjectIndexFile {
  path: string;
  language: CodeFile['language'];
  sourceBytes: number;
  scope: 'page' | 'shared';
  pageId?: string;
}

export interface ProjectIndexPage {
  pageId: string;
  title: string;
  address: string;
  purpose: string;
  audience: string;
  regionIds: readonly string[];
  codePage:
    | {
        projectId: string;
        entry: string;
        exportName: 'default';
      }
    | null;
}

export interface ProjectIndex {
  formatVersion: typeof CONTEXT_INDEX_VERSION;
  siteId: string;
  siteRevision: string;
  direction: BuilderSite['dir'];
  pages: readonly ProjectIndexPage[];
  projects: readonly {
    projectId: string;
    revision: string;
    runtimeProfile: string;
    catalogVersion: string;
    files: readonly ProjectIndexFile[];
  }[];
  sharedRegions: readonly {
    regionId: string;
    kind: string;
    pageIds: readonly string[];
  }[];
}

export interface SelectionSourceContext {
  kind: 'source';
  handle: SourceHandle;
  language: CodeFile['language'];
  source: string;
}

export interface SelectionNodeContext {
  kind: 'node';
  node: Node;
  ancestors: readonly Pick<Node, 'id' | 'type'>[];
}

export interface IndexedSelectionContext {
  formatVersion: typeof CONTEXT_INDEX_VERSION;
  siteRevision: string;
  selection: SelectionTarget;
  page: ProjectIndexPage;
  target: SelectionSourceContext | SelectionNodeContext;
}

export interface CreateContextIndexInput {
  siteId: string;
  siteRevision: string;
  site: Readonly<BuilderSite>;
}

export interface ContextIndex {
  getProjectIndex(): ProjectIndex;
  getSelectionContext(selection: SelectionTarget): IndexedSelectionContext;
}

/**
 * Builds a source-free site map once, then resolves only the selected module
 * or document ancestry on demand. No API on this object can return every
 * module body, which keeps whole-project prompting out of the normal path.
 */
export function createContextIndex(input: CreateContextIndexInput): ContextIndex {
  const projectIndex = buildProjectIndex(input);
  const pages = new Map(input.site.pages.map((page) => [page.id, page]));

  function getSelectionContext(selection: SelectionTarget): IndexedSelectionContext {
    if (selection.revision !== input.siteRevision) {
      throw contextFailure('stale-selection', 'The selection belongs to an older site revision.');
    }
    const page = pages.get(selection.pageId);
    const indexedPage = projectIndex.pages.find((candidate) => candidate.pageId === selection.pageId);
    if (!page || !indexedPage) {
      throw contextFailure('missing-page', `Page "${selection.pageId}" does not exist.`);
    }

    const target =
      typeof selection.sourceOrNodeId === 'string'
        ? resolveNodeContext(page.document.nodes, page.document.rootId, selection.sourceOrNodeId)
        : resolveSourceContext(input.site, selection.sourceOrNodeId);

    return freezeJson({
      formatVersion: CONTEXT_INDEX_VERSION,
      siteRevision: input.siteRevision,
      selection: clone(selection),
      page: indexedPage,
      target,
    });
  }

  return Object.freeze({
    getProjectIndex: () => clone(projectIndex),
    getSelectionContext,
  });
}

export function buildProjectIndex(input: CreateContextIndexInput): ProjectIndex {
  const pages = input.site.pages.map((page): ProjectIndexPage => {
    const root = page.document.nodes[page.document.rootId];
    let codePage: ProjectIndexPage['codePage'] = null;
    if (root?.type === 'codePage') {
      const parsed = codePageReferenceSchema.safeParse(root.props);
      if (parsed.success) {
        codePage = {
          projectId: parsed.data.projectId,
          entry: parsed.data.entry,
          exportName: parsed.data.exportName,
        };
      }
    }
    return {
      pageId: page.id,
      title: page.title,
      address: page.address,
      purpose: page.purpose,
      audience: page.audience,
      regionIds: [...page.regions],
      codePage,
    };
  });

  const projects = Object.entries(input.site.codeProjects ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectId, project]) => ({
      projectId,
      revision: project.revision,
      runtimeProfile: project.runtimeProfile,
      catalogVersion: project.dependencyLock.catalogVersion,
      files: Object.entries(project.files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, file]): ProjectIndexFile => {
          const pageMatch = /^pages\/([^/]+)\//.exec(path);
          return {
            path,
            language: file.language,
            sourceBytes: utf8Length(file.source),
            scope: pageMatch ? 'page' : 'shared',
            ...(pageMatch?.[1] === undefined ? {} : { pageId: pageMatch[1] }),
          };
        }),
    }));

  const sharedRegions = Object.values(input.site.sharedRegions)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((region) => ({
      regionId: region.id,
      kind: region.kind,
      pageIds: input.site.pages
        .filter((page) => page.regions.includes(region.id))
        .map((page) => page.id),
    }));

  return freezeJson({
    formatVersion: CONTEXT_INDEX_VERSION,
    siteId: input.siteId,
    siteRevision: input.siteRevision,
    direction: input.site.dir,
    pages,
    projects,
    sharedRegions,
  });
}

function resolveSourceContext(
  site: Readonly<BuilderSite>,
  handle: SourceHandle,
): SelectionSourceContext {
  const project = site.codeProjects?.[handle.projectId];
  if (!project) {
    throw contextFailure('missing-project', `Project "${handle.projectId}" does not exist.`);
  }
  if (project.revision !== handle.sourceRevision) {
    throw contextFailure('stale-selection', 'The source selection belongs to an older project revision.');
  }
  const file = project.files[handle.modulePath];
  if (!file) {
    throw contextFailure('missing-module', `Module "${handle.modulePath}" does not exist.`);
  }
  return freezeJson({
    kind: 'source',
    handle: clone(handle),
    language: file.language,
    source: file.source,
  });
}

function resolveNodeContext(
  nodes: Readonly<Record<string, Node>>,
  rootId: string,
  nodeId: string,
): SelectionNodeContext {
  const node = nodes[nodeId];
  if (!node) throw contextFailure('stale-selection', `Node "${nodeId}" no longer exists.`);
  const parents = new Map<string, string>();
  for (const candidate of Object.values(nodes)) {
    for (const children of Object.values(candidate.slots ?? {})) {
      for (const childId of children) parents.set(childId, candidate.id);
    }
  }
  const ancestors: Pick<Node, 'id' | 'type'>[] = [];
  const seen = new Set<string>([nodeId]);
  let currentId = parents.get(nodeId);
  while (currentId !== undefined) {
    if (seen.has(currentId)) {
      throw contextFailure('stale-selection', 'The selected document ancestry is cyclic.');
    }
    seen.add(currentId);
    const parent = nodes[currentId];
    if (!parent) break;
    ancestors.unshift({ id: parent.id, type: parent.type });
    if (parent.id === rootId) break;
    currentId = parents.get(parent.id);
  }
  return freezeJson({ kind: 'node', node: clone(node), ancestors });
}

function contextFailure(code: ContextIndexErrorCode, message: string): ContextIndexError {
  return new ContextIndexError(code, message);
}

function utf8Length(value: string): number {
  // Blob/TextEncoder are browser APIs and this package is deliberately
  // headless. Count code units directly and treat an unpaired surrogate as
  // the UTF-8 replacement character, matching normal encoders.
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function freezeJson<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}
