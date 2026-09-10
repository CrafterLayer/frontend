import { describe, expect, it, vi } from 'vitest';

import type { SelectionTarget } from '@craftkit/builder-schema';

import {
  SITE_TOOL_NAMES,
  registerSiteTools,
  type SiteToolExecutionContext,
  type SiteToolHandlers,
} from './site-tools';

const selection: SelectionTarget = {
  pageId: 'home',
  sourceOrNodeId: 'hero',
  revision: 'site-1',
  capabilities: ['inspect', 'editText'],
};

function handlers(): SiteToolHandlers {
  return {
    get_project_index: () => ({
      formatVersion: 1,
      siteId: 'site',
      siteRevision: 'site-1',
      direction: 'ltr',
      pages: [],
      projects: [],
      sharedRegions: [],
    }),
    get_selection_context: () => ({
      formatVersion: 1,
      siteRevision: 'site-1',
      selection,
      page: {
        pageId: 'home',
        title: 'Home',
        address: '/',
        purpose: '',
        audience: '',
        regionIds: [],
        codePage: null,
      },
      target: { kind: 'node', node: { id: 'hero', type: 'hero', props: {} }, ancestors: [] },
    }),
    resolve_component: (input) => ({
      catalogVersion: input.catalogVersion,
      packageId: input.packageId,
      version: '1.0.0',
      importSpecifier: '@craftkit/ui',
      exportName: input.exportName ?? 'Button',
      source: 'export function Button() {}',
      css: [],
      props: {},
    }),
    edit_element: () => ({
      siteRevision: 'site-2',
      sourceRevision: null,
      changedTargetIds: ['hero'],
    }),
    apply_module_patch: (input) => ({
      projectId: input.projectId,
      beforeRevision: input.expectedProjectRevision,
      afterRevision: 'source-2',
      changedPaths: input.changes.map(({ path }) => path),
    }),
    insert_section: () => ({ siteRevision: 'site-2', selection }),
    page_operations: () => ({ siteRevision: 'site-2', affectedPageIds: ['home'] }),
    compile_preview: (input) => ({
      artifactId: 'artifact-1',
      sourceRevision: input.sourceRevision,
      status: 'valid',
      diagnostics: [],
    }),
    inspect_preview: (input) => ({
      artifactId: input.artifactId,
      sourceRevision: input.sourceRevision,
      passed: true,
      findings: [],
    }),
    commit_draft: (input) => ({
      siteRevision: 'site-2',
      projectRevision: input.draftRevision,
      transactionId: 'tx-1',
    }),
  };
}

function context(signal = new AbortController().signal): SiteToolExecutionContext {
  return { invocationId: 'invocation-1', origin: 'agent', runId: 'run-1', signal };
}

describe('site tool registry', () => {
  it('registers exactly the ten versioned deterministic tools with JSON schemas', () => {
    const registry = registerSiteTools(handlers());

    expect(registry.names()).toEqual(SITE_TOOL_NAMES);
    expect(registry.definitions()).toHaveLength(10);
    for (const tool of registry.definitions()) {
      expect(tool).toMatchObject({ version: 1, execution: 'deterministic' });
      expect(typeof tool.inputSchema).toBe('object');
      expect(typeof tool.outputSchema).toBe('object');
    }
    expect(registry.definition('commit_draft')).toMatchObject({ mutatesProject: true });
    expect(registry.definition('get_project_index')).toMatchObject({ mutatesProject: false });
  });

  it('rejects missing or extra handlers rather than publishing a partial protocol', () => {
    const complete = handlers();
    const missing: Partial<SiteToolHandlers> = { ...complete };
    delete missing.commit_draft;
    expect(() => registerSiteTools(missing as SiteToolHandlers)).toThrow(/exactly the ten/);
    expect(() =>
      registerSiteTools({ ...complete, unexpected: () => ({}) } as SiteToolHandlers),
    ).toThrow(/exactly the ten/);
  });

  it('validates unknown JSON input before calling a typed handler', async () => {
    const siteHandlers = handlers();
    siteHandlers.edit_element = vi.fn(siteHandlers.edit_element);
    const registry = registerSiteTools(siteHandlers);

    await expect(
      registry.executeUnknown(
        'edit_element',
        {
          runId: 'run-1',
          unitId: 'unit-1',
          expectedSiteRevision: 'site-1',
          target: selection,
          edit: { kind: 'text', value: 'Updated' },
          surprise: true,
        },
        context(),
      ),
    ).rejects.toThrow(/surprise is not allowed/);
    expect(siteHandlers.edit_element).not.toHaveBeenCalled();
  });

  it('checks run ownership and rejects non-JSON handler output', async () => {
    const registry = registerSiteTools(handlers());
    await expect(
      registry.execute(
        'compile_preview',
        { runId: 'another-run', projectId: 'project', sourceRevision: 'source-1', pageIds: [] },
        context(),
      ),
    ).rejects.toThrow(/runId does not match/);

    const invalid = handlers();
    invalid.compile_preview = (() => ({ callback: () => undefined })) as never;
    await expect(
      registerSiteTools(invalid).execute(
        'compile_preview',
        { runId: 'run-1', projectId: 'project', sourceRevision: 'source-1', pageIds: [] },
        context(),
      ),
    ).rejects.toThrow(/non-JSON data/);

    const incomplete = handlers();
    incomplete.commit_draft = (() => ({ siteRevision: 'site-2' })) as never;
    await expect(
      registerSiteTools(incomplete).execute(
        'commit_draft',
        {
          runId: 'run-1',
          projectId: 'project',
          expectedBaseRevision: 'source-1',
          draftRevision: 'source-2',
        },
        context(),
      ),
    ).rejects.toThrow(/omitted projectRevision/);
  });

  it('honors cancellation before and after a deterministic host handler', async () => {
    const before = new AbortController();
    before.abort();
    await expect(
      registerSiteTools(handlers()).execute(
        'get_project_index',
        { siteId: 'site', siteRevision: 'site-1' },
        context(before.signal),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    let release: (() => void) | undefined;
    const delayed = handlers();
    delayed.get_project_index = async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return handlers().get_project_index(
        { siteId: 'site', siteRevision: 'site-1' },
        context(),
      );
    };
    const during = new AbortController();
    const pending = registerSiteTools(delayed).execute(
      'get_project_index',
      { siteId: 'site', siteRevision: 'site-1' },
      context(during.signal),
    );
    during.abort();
    release?.();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
