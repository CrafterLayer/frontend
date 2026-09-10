import { z } from 'zod';

import {
  builderError,
  codePageReferenceSchema,
  emptyDocument,
  pageLinkSchema,
  type BuilderDocument,
  type BuilderSite,
  type CodeFile,
  type CodePageReference,
  type CommandRuntime,
  type JsonValue,
  type Node,
  type RegisteredSiteCommand,
  type SitePage,
} from '@craftkit/builder-schema';

import { defineSiteCommand } from './define-site-command';

const id = z.string().min(1);
export const pageLinkResolutionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('retarget'), pageId: id }),
  z.strictObject({ action: z.literal('unlink') }),
]);
export type PageLinkResolution = z.infer<typeof pageLinkResolutionSchema>;

export interface PageCommands {
  addPage: {
    address: string;
    title: string;
    purpose?: string;
    audience?: string;
    regions?: string[];
    index?: number;
  };
  renamePage: { pageId: string; title?: string; address?: string };
  reorderPage: { pageId: string; toIndex: number };
  duplicatePage: { pageId: string; title?: string; address?: string; index?: number };
  setHomePage: { pageId: string };
  clearPage: { pageId: string };
  /** Legacy callers may omit an empty resolution only when no inbound links exist. */
  removePage: {
    pageId: string;
    linkResolution?: PageLinkResolution;
    replacementHomePageId?: string;
  };
  setCodePage: { pageId: string; reference: CodePageReference };
}

export const pageCommands: Record<keyof PageCommands, RegisteredSiteCommand> = {
  addPage: defineSiteCommand({
    args: z.strictObject({
      address: id,
      title: id,
      purpose: z.string().optional(),
      audience: z.string().optional(),
      regions: z.array(id).optional(),
      index: z.number().int().nonnegative().optional(),
    }),
    run: (args) => (draft, rt) => {
      requireAvailableAddress(draft, args.address);
      const regions = args.regions ?? [];
      if (new Set(regions).size !== regions.length)
        throw violation('The same shared region was listed twice.');
      if (regions.some((region) => !Object.hasOwn(draft.sharedRegions, region)))
        throw violation('A shared region does not exist.');
      const index = args.index ?? draft.pages.length;
      if (index > draft.pages.length)
        throw violation(
          `Cannot insert a page at index ${String(index)}; the site has ${String(draft.pages.length)} pages.`,
        );
      const page: SitePage = {
        id: rt.ids.newId(),
        address: args.address,
        title: args.title,
        purpose: args.purpose ?? '',
        audience: args.audience ?? '',
        document: emptyDocument('site', draft.dir),
        regions,
      };
      (draft.pages as SitePage[]).splice(index, 0, page);
    },
  }),
  renamePage: defineSiteCommand({
    args: z
      .strictObject({ pageId: id, title: id.optional(), address: id.optional() })
      .refine(
        (args) => args.title !== undefined || args.address !== undefined,
        'renamePage needs a title, an address, or both.',
      ),
    run: (args) => (draft) => {
      const page = requirePage(draft, args.pageId);
      if (args.address !== undefined && args.address !== page.address) {
        if (page.address === '/')
          throw violation('The home page must stay at "/"; use setHomePage first.');
        requireAvailableAddress(draft, args.address);
        page.address = args.address;
      }
      if (args.title !== undefined) page.title = args.title;
    },
  }),
  reorderPage: defineSiteCommand({
    args: z.strictObject({ pageId: id, toIndex: z.number().int().nonnegative() }),
    run: (args) => (draft) => {
      const page = requirePage(draft, args.pageId);
      if (args.toIndex >= draft.pages.length)
        throw violation(
          `Cannot move a page to index ${String(args.toIndex)}; the site has ${String(draft.pages.length)} pages.`,
        );
      const pages = draft.pages as SitePage[];
      pages.splice(pages.indexOf(page), 1);
      pages.splice(args.toIndex, 0, page);
    },
  }),
  duplicatePage: defineSiteCommand({
    args: z.strictObject({
      pageId: id,
      title: id.optional(),
      address: id.optional(),
      index: z.number().int().nonnegative().optional(),
    }),
    run: (args) => (draft, rt) => {
      const original = requirePage(draft, args.pageId);
      const newId = rt.ids.newId();
      const address =
        args.address ??
        uniquePageAddress(draft, `${original.address === '/' ? '/home' : original.address}-copy`);
      requireAvailableAddress(draft, address);
      const index = args.index ?? draft.pages.indexOf(original) + 1;
      if (index > draft.pages.length)
        throw violation('The duplicate insertion index is outside the page list.');
      const document = cloneDocument(original.document, rt);
      const root = document.nodes[document.rootId];
      if (root?.type === 'codePage') {
        const reference = codePageReferenceSchema.parse(root.props);
        const project = draft.codeProjects?.[reference.projectId];
        if (!project) throw violation('The code project does not exist.');
        const oldPrefix = `pages/${original.id}/`;
        const newPrefix = `pages/${newId}/`;
        const files: Record<string, CodeFile> = { ...project.files };
        for (const [path, file] of Object.entries(project.files)) {
          if (!path.startsWith(oldPrefix)) continue;
          // The managed resolver admits relative private imports only. Moving the
          // entire directory preserves those imports and keeps shared imports explicit;
          // source identities change because instrumentation includes the module path.
          files[newPrefix + path.slice(oldPrefix.length)] = { ...file };
        }
        draft.codeProjects = {
          ...draft.codeProjects,
          [reference.projectId]: { ...project, files, revision: rt.ids.newId() },
        };
        root.props = { ...root.props, entry: newPrefix + reference.entry.slice(oldPrefix.length) };
      }
      const duplicate: SitePage = {
        ...original,
        id: newId,
        address,
        title: args.title ?? `${original.title} copy`,
        document,
        regions: [...original.regions],
      };
      (draft.pages as SitePage[]).splice(index, 0, duplicate);
    },
  }),
  setHomePage: defineSiteCommand({
    args: z.strictObject({ pageId: id }),
    run: (args) => (draft) => {
      setHome(draft, args.pageId);
    },
  }),
  clearPage: defineSiteCommand({
    args: z.strictObject({ pageId: id }),
    run: (args) => (draft, rt) => {
      const page = requirePage(draft, args.pageId);
      const root = page.document.nodes[page.document.rootId];
      if (root?.type === 'codePage') {
        const reference = codePageReferenceSchema.parse(root.props);
        const project = draft.codeProjects?.[reference.projectId];
        if (!project) throw violation('The code project does not exist.');
        const files = withoutPrivateFiles(project.files, page.id);
        files[reference.entry] = {
          language: 'tsx',
          source: 'export default function Page() { return <main />; }\n',
        };
        draft.codeProjects = {
          ...draft.codeProjects,
          [reference.projectId]: { ...project, files, revision: rt.ids.newId() },
        };
        root.props = { ...root.props, inputs: {} };
      } else {
        page.document = cloneDocument(emptyDocument(page.document.surface, draft.dir), rt);
      }
    },
  }),
  removePage: defineSiteCommand({
    args: z.strictObject({
      pageId: id,
      linkResolution: pageLinkResolutionSchema.optional(),
      replacementHomePageId: id.optional(),
    }),
    run: (args) => (draft, rt) => {
      const page = requirePage(draft, args.pageId);
      if (draft.pages.length === 1)
        throw violation('The home page cannot be removed: it is the final page.');
      const resolution = args.linkResolution;
      if (resolution?.action === 'retarget') {
        if (resolution.pageId === page.id)
          throw violation('A removed page cannot be its own link replacement.');
        requirePage(draft, resolution.pageId);
      }
      const documents = [
        ...draft.pages
          .filter((candidate) => candidate.id !== page.id)
          .map((candidate) => candidate.document),
        ...Object.values(draft.sharedRegions).map((region) => region.document),
      ];
      if (
        resolution === undefined &&
        documents.some((document) => hasPageLink(document, page.id))
      ) {
        throw violation('Removing a linked page requires an explicit link resolution plan.');
      }
      if (page.address === '/') {
        if (!args.replacementHomePageId || args.replacementHomePageId === page.id) {
          throw violation('The home page cannot be removed without a replacement home page.');
        }
        setHome(draft, args.replacementHomePageId);
      }
      if (resolution)
        for (const document of documents) rewritePageLinks(document, page.id, resolution);
      for (const [projectId, project] of Object.entries(draft.codeProjects ?? {})) {
        const files = withoutPrivateFiles(project.files, page.id);
        if (Object.keys(files).length !== Object.keys(project.files).length) {
          draft.codeProjects = {
            ...draft.codeProjects,
            [projectId]: { ...project, files, revision: rt.ids.newId() },
          };
        }
      }
      (draft.pages as SitePage[]).splice(
        draft.pages.findIndex((candidate) => candidate.id === page.id),
        1,
      );
    },
  }),
  setCodePage: defineSiteCommand({
    args: z.strictObject({ pageId: id, reference: codePageReferenceSchema }),
    run: (args) => (draft, rt) => {
      const page = requirePage(draft, args.pageId);
      const project = draft.codeProjects?.[args.reference.projectId];
      if (
        !project ||
        !Object.hasOwn(project.files, args.reference.entry) ||
        !args.reference.entry.startsWith(`pages/${page.id}/`)
      )
        throw violation('The private code-page entry does not exist.');
      const rootId = rt.ids.newId();
      // Parsed JSON removes optional undefined values before this command executes.
      const props = JSON.parse(JSON.stringify(args.reference)) as Record<string, JsonValue>;
      page.document = {
        ...emptyDocument(page.document.surface, draft.dir),
        rootId,
        nodes: { [rootId]: { id: rootId, type: 'codePage', props } },
      };
      page.regions = [];
    },
  }),
};

export function resolvePageLink(
  site: BuilderSite,
  link: { pageId: string; fragment?: string },
): string {
  const page = requirePage(site, link.pageId);
  return page.address + (link.fragment ? `#${encodeURIComponent(link.fragment)}` : '');
}

function setHome(site: BuilderSite, pageId: string): void {
  const target = requirePage(site, pageId);
  if (target.address === '/') return;
  const previous = site.pages.find((page) => page.address === '/');
  if (!previous) throw violation('The site has no home page.');
  const slug =
    previous.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'home';
  previous.address = uniquePageAddress(site, `/${slug}`);
  target.address = '/';
}

function uniquePageAddress(site: BuilderSite, base: string): string {
  let candidate = base;
  let suffix = 2;
  while (site.pages.some((page) => page.address === candidate))
    candidate = `${base}-${String(suffix++)}`;
  return candidate;
}

function requireAvailableAddress(site: BuilderSite, address: string): void {
  if (
    !/^\/(?:[^\s?#/]+(?:\/[^\s?#/]+)*)?$/.test(address) ||
    address.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw violation('A page address must start with "/" and be a normalized route.');
  }
  if (site.pages.some((page) => page.address === address))
    throw violation(`Another page already lives at "${address}".`);
}

function requirePage(site: BuilderSite, pageId: string): SitePage {
  const page = site.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw violation(`Page "${pageId}" does not exist.`);
  return page;
}

function cloneDocument(document: BuilderDocument, rt: CommandRuntime): BuilderDocument {
  const ids = new Map(Object.keys(document.nodes).map((id) => [id, rt.ids.newId()]));
  const nodes: Record<string, Node> = {};
  for (const node of Object.values(document.nodes)) {
    const id = ids.get(node.id);
    if (!id) throw violation('A document node has no stable identity.');
    const clone = JSON.parse(JSON.stringify(node)) as Node;
    clone.id = id;
    if (clone.slots)
      clone.slots = Object.fromEntries(
        Object.entries(clone.slots).map(([slot, children]) => [
          slot,
          children.map((child) => ids.get(child) ?? child),
        ]),
      );
    if (clone.variantOf) clone.variantOf = ids.get(clone.variantOf) ?? clone.variantOf;
    nodes[id] = clone;
  }
  return { ...document, rootId: ids.get(document.rootId) ?? document.rootId, nodes };
}

function withoutPrivateFiles(
  files: Readonly<Record<string, CodeFile>>,
  pageId: string,
): Record<string, CodeFile> {
  return Object.fromEntries(
    Object.entries(files).filter(([path]) => !path.startsWith(`pages/${pageId}/`)),
  );
}

function hasPageLink(document: BuilderDocument, pageId: string): boolean {
  let found = false;
  visitDocumentValues(
    document,
    (value) => {
      const link = pageLinkSchema.safeParse(value);
      if (link.success && link.data.pageId === pageId) found = true;
      return value;
    },
    false,
  );
  return found;
}

function rewritePageLinks(
  document: BuilderDocument,
  pageId: string,
  resolution: PageLinkResolution,
): void {
  visitDocumentValues(
    document,
    (value) => {
      const link = pageLinkSchema.safeParse(value);
      if (!link.success || link.data.pageId !== pageId) return value;
      return resolution.action === 'unlink'
        ? null
        : { ...(value as Record<string, JsonValue>), pageId: resolution.pageId };
    },
    true,
  );
}

function visitDocumentValues(
  document: BuilderDocument,
  transform: (value: JsonValue) => JsonValue,
  write: boolean,
): void {
  function visit(value: JsonValue): JsonValue {
    const next = transform(value);
    if (next !== value || typeof value !== 'object' || value === null) return next;
    if (Array.isArray(value)) return value.map(visit);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
  }
  for (const node of Object.values(document.nodes)) {
    const props = visit(node.props) as Record<string, JsonValue>;
    if (write) node.props = props;
    for (const breakpoint of ['tablet', 'mobile'] as const) {
      const responsive = node.responsive?.[breakpoint];
      if (responsive) {
        const next = visit(responsive) as Record<string, JsonValue>;
        if (write && node.responsive) node.responsive[breakpoint] = next;
      }
    }
  }
}

function violation(message: string) {
  return builderError('site/structural-violation', message);
}
