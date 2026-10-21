import {
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  defaultDesignSystem,
  type BuilderSite,
  type BuilderSiteKernel,
  type CodePageReference,
  type CodeProject,
  type JsonValue,
  type SitePage,
  type Transaction,
} from '@craftkit/builder';
import { referenceManagedCatalog } from '@craftkit/builder/code-runtime';

export const REFERENCE_CODE_PROJECT_ID = 'reference-react-project';
export const REFERENCE_CODE_PAGE_ID = 'home';
export const REFERENCE_CODE_PROJECT_REVISION = 'reference-source-r1';
export const REFERENCE_CATALOG_VERSION = 'craftkit-managed-reference-v1';

export interface ReferenceCodePageOptions {
  readonly projectId?: string;
  readonly pageId?: string;
  readonly address?: string;
  readonly title?: string;
  readonly projectRevision?: string;
  readonly catalogVersion?: string;
}

export interface ReferenceCodePageFixture {
  readonly projectId: string;
  readonly project: CodeProject;
  readonly page: SitePage;
  readonly reference: CodePageReference;
}

const pageSource = `import { useState } from 'react';
import { Metric } from '../../shared/Metric';
import './styles.css';

export interface ReferencePageProps {
  brand?: string;
}

export default function ReferencePage({
  brand = 'Northstar Studio',
}: ReferencePageProps) {
  const [briefs, setBriefs] = useState(12);

  return (
    <main className="reference-page">
      <nav className="reference-nav" aria-label="Primary navigation">
        <strong>{brand}</strong>
        <a href="#proof">Our work</a>
      </nav>
      <section className="reference-hero">
        <p className="reference-kicker">Independent digital studio</p>
        <h1>Turn ambitious ideas into a site people remember.</h1>
        <p className="reference-lede">
          Strategy, identity, and interaction design shaped as one clear experience.
        </p>
        <button type="button" onClick={() => setBriefs((count) => count + 1)}>
          Start brief · {briefs}
        </button>
      </section>
      <section id="proof" className="reference-proof" aria-labelledby="proof-heading">
        <div>
          <p className="reference-kicker">Measured craft</p>
          <h2 id="proof-heading">Built to feel specific, then tested to work everywhere.</h2>
        </div>
        <div className="reference-metrics">
          <Metric value="4.8/5" label="Average launch score" />
          <Metric value="18 days" label="From brief to first release" />
        </div>
      </section>
    </main>
  );
}
`;

const metricSource = `export interface MetricProps {
  value: string;
  label: string;
}

export function Metric({ value, label }: MetricProps) {
  return (
    <article className="reference-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
`;

const pageStyles = `:root {
  color: #f5f2ea;
  background: #121315;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; }

.reference-page {
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 16%, rgba(199, 255, 93, .18), transparent 30rem),
    #121315;
}

.reference-nav,
.reference-hero,
.reference-proof {
  width: min(1120px, calc(100% - 40px));
  margin-inline: auto;
}

.reference-nav {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(245, 242, 234, .15);
}

.reference-nav a { color: inherit; text-underline-offset: 5px; }

.reference-hero {
  min-height: 68vh;
  display: grid;
  align-content: center;
  padding-block: 80px;
}

.reference-kicker {
  color: #c7ff5d;
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.reference-hero h1 {
  max-width: 13ch;
  margin: 16px 0 24px;
  font-size: clamp(3rem, 8vw, 7.5rem);
  font-weight: 560;
  letter-spacing: -.065em;
  line-height: .92;
}

.reference-lede { max-width: 42rem; color: #b9bbc0; font-size: clamp(1rem, 2vw, 1.35rem); }

.reference-hero button {
  width: fit-content;
  margin-top: 28px;
  border: 0;
  border-radius: 999px;
  padding: 14px 20px;
  background: #c7ff5d;
  color: #121315;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.reference-proof {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, .65fr);
  gap: 48px;
  padding-block: 72px 96px;
  border-top: 1px solid rgba(245, 242, 234, .15);
}

.reference-proof h2 { max-width: 22ch; font-size: clamp(2rem, 4vw, 4rem); line-height: 1; }
.reference-metrics { display: grid; gap: 12px; }
.reference-metric { padding: 24px; border: 1px solid rgba(245, 242, 234, .15); border-radius: 20px; }
.reference-metric strong { display: block; font-size: 2rem; color: #c7ff5d; }
.reference-metric span { display: block; margin-top: 8px; color: #b9bbc0; }

@media (max-width: 720px) {
  .reference-proof { grid-template-columns: 1fr; }
  .reference-nav, .reference-hero, .reference-proof { width: min(100% - 28px, 1120px); }
}

@media (prefers-reduced-motion: no-preference) {
  .reference-hero button { transition: transform 160ms ease, background 160ms ease; }
  .reference-hero button:hover { transform: translateY(-2px); background: #d7ff8b; }
}
`;

export function createReferenceCodePageFixture(
  options: ReferenceCodePageOptions = {},
): ReferenceCodePageFixture {
  const projectId = options.projectId ?? REFERENCE_CODE_PROJECT_ID;
  const pageId = options.pageId ?? REFERENCE_CODE_PAGE_ID;
  requireIdentity(projectId, 'projectId');
  requireIdentity(pageId, 'pageId');
  const entry = `pages/${pageId}/index.tsx`;
  const project: CodeProject = {
    formatVersion: 1,
    runtimeProfile: 'craftkit-react-v1',
    dependencyLock: {
      catalogVersion: options.catalogVersion ?? REFERENCE_CATALOG_VERSION,
      packages: Object.fromEntries(
        referenceManagedCatalog.manifest.packages
          .filter(({ packageId }) => ['react', 'react-dom', '@base-ui/react'].includes(packageId))
          .map(({ packageId, version }) => [packageId, version]),
      ),
    },
    revision: options.projectRevision ?? REFERENCE_CODE_PROJECT_REVISION,
    files: {
      [entry]: { language: 'tsx', source: pageSource },
      [`pages/${pageId}/styles.css`]: { language: 'css', source: pageStyles },
      'shared/Metric.tsx': { language: 'tsx', source: metricSource },
    },
  };
  const reference: CodePageReference = {
    projectId,
    entry,
    exportName: 'default',
    inputs: {
      brand: 'Northstar Studio',
    },
    seo: {
      title: options.title ?? 'Northstar Studio',
      description: 'An interactive reference page for the CraftKit code runtime.',
    },
  };
  const rootId = `code-page-${pageId}`;
  const referenceProps = JSON.parse(JSON.stringify(reference)) as Record<string, JsonValue>;
  const page: SitePage = {
    id: pageId,
    address: options.address ?? '/',
    title: options.title ?? 'Northstar Studio',
    purpose: 'Prove the TSX create, preview, edit, persist, undo, and export path.',
    audience: 'CraftKit creators and runtime reviewers',
    document: {
      schemaVersion: LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir: 'ltr',
      rootId,
      nodes: { [rootId]: { id: rootId, type: 'codePage', props: referenceProps } },
    },
    regions: [],
  };
  return { projectId, project, page, reference };
}

export function createReferenceCodePageSite(options: ReferenceCodePageOptions = {}): BuilderSite {
  const fixture = createReferenceCodePageFixture(options);
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [fixture.page],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
    codeProjects: { [fixture.projectId]: fixture.project },
  };
}

/** Converts an existing page to the reference project as one site transaction and one undo. */
export function installReferenceCodePage(
  kernel: BuilderSiteKernel,
  pageId: string,
  options: Omit<ReferenceCodePageOptions, 'pageId'> = {},
): Transaction {
  if (!kernel.pages().includes(pageId)) {
    throw new Error(`Cannot install a reference code page for missing page "${pageId}".`);
  }
  const fixture = createReferenceCodePageFixture({ ...options, pageId });
  return kernel.dispatchGroup(
    [
      {
        command: 'createCodeProject',
        args: { projectId: fixture.projectId, project: fixture.project },
      },
      {
        command: 'setCodePage',
        args: { pageId, reference: fixture.reference },
      },
    ],
    { author: 'user', label: 'Create code page' },
  );
}

function requireIdentity(value: string, name: string): void {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(`${name} must contain letters, digits, underscores, or hyphens only.`);
  }
}
