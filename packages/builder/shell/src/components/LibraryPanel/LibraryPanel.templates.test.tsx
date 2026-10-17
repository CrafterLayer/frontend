import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { ELEMENT_ACTION_LABELS_EN } from '../../clipboard/element-actions.labels';
import { TREE_FIXTURE_VOCAB } from '../../clipboard/tree-commands.fixture';
import { installBrowserStandIns } from '../../style-manager/test-support';
import type { TemplateCardInfo } from '../TemplateCard';
import { insertLibraryTree, pageKitStep, type LibraryPageKit } from './library-insert';
import { LibraryPanel, type LibrarySectionEntry } from './LibraryPanel';
import { LIBRARY_PANEL_LABELS_AR } from './LibraryPanel.labels';

/*
  library-playground (agent-script DESIGN §B.5):
  - a top-level Templates tab of photo cards, the page's language first;
  - a section's page kit installed on the page root in the SAME transaction
    as the section (one Undo), once per page, and drawn into its thumbnail.
*/

afterEach(cleanup);

/** The fixture region, rendered with its css so a thumbnail's styles can be read back. */
const RegionRender = ((props: BlockRenderProps<{ css?: string }>) => (
  <div data-region="">{props.props.css === undefined ? null : <style>{props.props.css}</style>}</div>
)) as unknown as BlockRenderComponent;

function vocab(pageCssMax = 20_000): TrustedExtensionManifest {
  const blocks = (TREE_FIXTURE_VOCAB.contributes?.blocks ?? []).map((entry) => {
    if (entry.schema.type === 'page') {
      return {
        ...entry,
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({ lang: z.string().max(12).default(''), pageCss: z.string().max(pageCssMax).default('') }),
          slots: { default: { allow: ['region', 'text'] } },
          examples: [],
        }),
      };
    }
    return entry.schema.type === 'region' ? { ...entry, render: RegionRender } : entry;
  });
  return { ...TREE_FIXTURE_VOCAB, name: 'library-template-vocab', contributes: { ...TREE_FIXTURE_VOCAB.contributes, blocks } };
}

function makeKernel(options: { dir?: 'ltr' | 'rtl'; pageCss?: string; pageCssMax?: number } = {}) {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: options.dir ?? 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: { lang: '', pageCss: options.pageCss ?? '' }, slots: { default: ['t1'] } },
      t1: { id: 't1', type: 'text', props: {} },
    },
  };
  const kernel = createBuilder({
    document,
    extensions: [vocab(options.pageCssMax)],
    ports: { clock: fixedClock(), ids: seededIds('lt') },
  });
  kernel.extensions.hydrateDeclarative({
    tier: 2,
    name: 'library-template-compositions',
    version: '1.0.0',
    contributes: {
      compositions: ['clinic', 'clinic-ar', 'plain'].map((id) => ({
        id,
        name: id === 'plain' ? 'Plain page' : `Composition ${id}`,
        version: 1,
        surfaces: ['site'],
        rootId: `${id}-text`,
        nodes: { [`${id}-text`]: { id: `${id}-text`, type: 'text', props: {} } },
      })),
    },
  });
  return kernel;
}

const card = (id: string, lang: 'en' | 'ar'): TemplateCardInfo => ({
  id,
  templateKey: 'clinic',
  lang,
  category: 'clinic',
  name: { en: 'Smile clinic', ar: 'عيادات ابتسامة' },
  description: { en: 'Services, doctors and booking.', ar: 'الخدمات والأطباء والحجز.' },
  sections: 10,
  thumbnail: { src: `https://images.example/${id}.jpg`, alt: lang === 'ar' ? 'عيادة' : 'A clinic' },
});
const CARDS = [card('clinic', 'en'), card('clinic-ar', 'ar')];

const KIT: LibraryPageKit = {
  marker: '.ck-page-plan{',
  css: '.ck-page-plan{--ck-page-plan:1}> *{--ck-bg:#ffffff}.ck-btn{padding:1rem}.ck-page-plan-end{--ck-page-plan:0}',
};
const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'section', className: 'ck-ground', children: [{ kind: 'element', tag: 'h2', text: 'Hello' }] }],
};
const SECTION: LibrarySectionEntry = { id: 'kit-hero', name: 'Hero kit', nameAr: 'قسم الواجهة', group: 'hero', tree: TREE, pageKit: KIT };

const contentLangs = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[data-content-lang]')?.getAttribute('data-content-lang') ?? 'plain');

describe('LibraryPanel — the Templates tab', () => {
  beforeAll(() => {
    installBrowserStandIns();
  });

  it('is a top-level tab of photo cards: the page language first, then "Other language"', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates' }));
    const panel = screen.getByRole('tabpanel');
    const [first] = within(panel).getAllByRole('list');
    expect(contentLangs(first!)).toEqual(['en', 'plain']);
    const other = within(panel).getByRole('region', { name: 'Other language' });
    expect(contentLangs(within(other).getByRole('list'))).toEqual(['ar']);
    expect(within(panel).getAllByRole('img', { name: /clinic/iu }).every((img) => img.getAttribute('loading') === 'lazy')).toBe(true);
  });

  it('an RTL page puts the Arabic card first; the Arabic editor reads Arabic', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel({ dir: 'rtl' })} templateCards={CARDS} labels={LIBRARY_PANEL_LABELS_AR} />);
    await user.click(screen.getByRole('tab', { name: 'القوالب' }));
    const panel = screen.getByRole('tabpanel');
    expect(contentLangs(within(panel).getAllByRole('list')[0]!)).toEqual(['ar', 'plain']);
    expect(within(panel).getByRole('region', { name: 'لغة أخرى' })).toBeInTheDocument();
    expect(within(panel).getAllByRole('button', { name: 'إدراج القالب عيادات ابتسامة' })).toHaveLength(2);
  });

  it('a click inserts the composition as one transaction, and search matches either language', async () => {
    const user = userEvent.setup();
    const kernel = makeKernel();
    render(<LibraryPanel kernel={kernel} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the library' }), 'ابتسامة');
    expect(screen.getAllByRole('button', { name: 'Insert template Smile clinic' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Insert Plain page' })).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Insert template Smile clinic' })[0]!);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Inserted Smile clinic');
  });

  it('carded templates live in Templates, not Sections; a composition without a card stays in both', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} templateCards={CARDS} sections={[SECTION]} />);
    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'Insert Hero kit' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Insert Plain page' })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /Composition clinic/u })).toBeNull();
  });
});

describe('the section page kit (one transaction, one Undo)', () => {
  beforeAll(() => {
    installBrowserStandIns();
  });

  it('inserting a kit section also writes the page kit on the root, in the same transaction', async () => {
    const user = userEvent.setup();
    const kernel = makeKernel({ pageCss: '.mine{color:red}' });
    const before = structuredClone(kernel.getDocument());
    render(<LibraryPanel kernel={kernel} sections={[SECTION, { ...SECTION, id: 'kit-two', name: 'Second kit' }]} />);
    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    await user.click(screen.getByRole('button', { name: 'Insert Hero kit' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.props['pageCss']).toBe(`.mine{color:red}\n${KIT.css}`);
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);

    // A second kit section finds the marker: no second copy of the kit.
    await user.click(screen.getByRole('button', { name: 'Insert Second kit' }));
    expect(kernel.transactions()).toHaveLength(2);
    const pageCss = kernel.getDocument().nodes['root']?.props['pageCss'];
    expect(typeof pageCss === 'string' ? pageCss.split(KIT.marker) : []).toHaveLength(2);

    act(() => {
      kernel.undo();
      kernel.undo();
    });
    expect(kernel.getDocument()).toEqual(before);
  });

  it('insertLibraryTree: one group with insertNode + setProp pageCss; one Undo removes both', () => {
    const kernel = makeKernel();
    const outcome = insertLibraryTree({
      kernel,
      kind: 'section',
      name: 'Hero kit',
      tree: TREE,
      actionLabels: ELEMENT_ACTION_LABELS_EN,
      noRegionType: 'none',
      pageKit: KIT,
    });
    expect(outcome).toEqual({ ok: true });
    expect(kernel.transactions()).toHaveLength(1);
    const paths = kernel.transactions()[0]!.patches.map((patch) => patch.path.join('/'));
    expect(paths.some((path) => path.startsWith('nodes/lt-'))).toBe(true);
    expect(paths).toContain('nodes/root/props/pageCss');
    expect(kernel.getDocument().nodes['root']?.props['pageCss']).toBe(KIT.css);
    act(() => {
      kernel.undo();
    });
    expect(kernel.getDocument().nodes['root']?.props['pageCss']).toBe('');
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['t1']);
  });

  it('no setProp when the page already holds the marker, or the root has no pageCss prop', () => {
    const marked = makeKernel({ pageCss: `${KIT.css}\n.mine{}` });
    expect(pageKitStep(marked, KIT)).toBeUndefined();
    insertLibraryTree({ kernel: marked, kind: 'section', name: 'Hero kit', tree: TREE, actionLabels: ELEMENT_ACTION_LABELS_EN, noRegionType: 'none', pageKit: KIT });
    expect(marked.transactions()[0]!.patches.some((patch) => patch.path.join('/') === 'nodes/root/props/pageCss')).toBe(false);

    const bare = createBuilder({
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
      },
      extensions: [TREE_FIXTURE_VOCAB],
      ports: { clock: fixedClock(), ids: seededIds('bare') },
    });
    expect(pageKitStep(bare, KIT)).toBeUndefined();
    expect(pageKitStep(makeKernel(), undefined)).toBeUndefined();
    expect(pageKitStep(makeKernel(), KIT)).toEqual({ command: 'setProp', args: { id: 'root', key: 'pageCss', value: KIT.css } });
  });

  it('a page whose css cannot take the kit still gets the section', () => {
    const kernel = makeKernel({ pageCssMax: 40 });
    const outcome = insertLibraryTree({
      kernel,
      kind: 'section',
      name: 'Hero kit',
      tree: TREE,
      actionLabels: ELEMENT_ACTION_LABELS_EN,
      noRegionType: 'none',
      pageKit: KIT,
    });
    expect(outcome).toEqual({ ok: true });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.props['pageCss']).toBe('');
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);
  });

  it("a kit section's thumbnail is drawn with its page kit", async () => {
    const callbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          callbacks.push(callback);
        }
        observe() {
          callbacks.at(-1)?.([{ isIntersecting: true }]);
        }
        disconnect() {
          // Nothing to release: the stand-in holds no observation.
        }
      },
    );
    try {
      const user = userEvent.setup();
      render(<LibraryPanel kernel={makeKernel()} sections={[SECTION]} />);
      await user.click(screen.getByRole('tab', { name: 'Sections' }));
      const tile = screen.getByRole('button', { name: 'Insert Hero kit' });
      await waitFor(() => {
        expect(tile.querySelector('iframe')).not.toBeNull();
      });
      const srcdoc = tile.querySelector('iframe')?.getAttribute('srcdoc') ?? '';
      expect(srcdoc).toContain('--ck-bg:#ffffff');
      expect(srcdoc).toContain('.ck-btn');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
