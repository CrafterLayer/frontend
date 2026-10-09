import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTreeProblems,
  customCodeTreeSchema,
  // gsap-pixi additions (2026-10-08)
  mediaRecipeProblems,
  // end gsap-pixi additions
  type CustomCodeRoot,
  type SavedTemplate,
} from '@craftkit/builder-schema';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { LIBRARY_ELEMENT_PRESETS } from './library-presets';
import { previewSrcdoc, treeClassNames } from './library-preview';
import { LibraryPanel } from './LibraryPanel';
import { LIBRARY_PANEL_LABELS_AR } from './LibraryPanel.labels';

const makeKernel = () =>
  createBuilder({
    document: treeFixtureDocument(),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(0, 5_000), ids: seededIds('lib') },
  });
type Kernel = ReturnType<typeof makeKernel>;
const treeOf = (kernel: Kernel, id: string) => kernel.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;

describe('LibraryPanel', () => {
  beforeAll(() => {
    installBrowserStandIns();
  });

  it.each(['en', 'ar'] as const)('every Elements preset is a valid tree node (%s)', (language) => {
    // gsap-pixi additions (2026-10-08): +3 motion sections (animated hero, scroll reveal features / section)
    expect(LIBRARY_ELEMENT_PRESETS).toHaveLength(34);
    for (const preset of LIBRARY_ELEMENT_PRESETS) {
      const tree = { kind: 'root', children: [preset.node(language)] };
      expect({ id: preset.id, problems: customCodeTreeProblems(tree) }).toEqual({ id: preset.id, problems: [] });
      expect(customCodeTreeSchema.safeParse(tree).success, preset.id).toBe(true);
    }
  });

  it('clicking an element inserts it after the focused element — one transaction, one undo', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    act(() => {
      kernel.focusElement('rA', [0]);
    });
    render(<LibraryPanel kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Insert Heading' }));
    const children = treeOf(kernel, 'rA').children;
    expect(children).toHaveLength(3);
    expect(children[1]).toMatchObject({ kind: 'element', tag: 'h2', text: 'A clear heading' });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Insert · Heading “A clear heading”');
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'rA', path: [1] });
    act(() => {
      kernel.undo();
    });
    expect(treeOf(kernel, 'rA').children).toHaveLength(2);
  });

  it('with nothing editable selected an element becomes a new custom section', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LibraryPanel kernel={kernel} labels={LIBRARY_PANEL_LABELS_AR} />);
    await user.click(screen.getByRole('button', { name: 'إدراج بطاقة' }));
    const root = kernel.getDocument().nodes['root'];
    expect(root?.slots?.['default']).toHaveLength(4);
    const created = root?.slots?.['default']?.[3] ?? '';
    expect(treeOf(kernel, created).children[0]).toMatchObject({ tag: 'article' });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: created, path: [0] });
  });

  it('search filters across both languages', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} />);
    await user.type(screen.getByRole('searchbox'), 'خريطة');
    const tiles = screen.getAllByRole('button', { name: /^Insert / });
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(['Insert Map embed', 'Insert Map (loads on click)']);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText('Nothing matches. Try another word.')).toBeInTheDocument();
  });

  it('Sections insert a whole new region; Saved lists templates, inserts and removes them', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    const onRemoveTemplate = vi.fn();
    const sectionTree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'section', className: 'p-8', children: [{ kind: 'element', tag: 'h2', text: 'Hero' }] }],
    };
    const templates: Record<string, SavedTemplate> = {
      quote: {
        id: 'quote',
        name: 'Pull quote',
        kind: 'element',
        tree: { kind: 'root', children: [{ kind: 'element', tag: 'blockquote', text: 'Well said.' }] },
        savedAt: '2026-10-05T10:00:00.000Z',
      },
    };
    act(() => {
      kernel.focusElement('rB', [0]);
    });
    render(
      <LibraryPanel
        kernel={kernel}
        sections={[{ id: 'hero-split', name: 'Split hero', group: 'hero', tree: sectionTree }]}
        templates={templates}
        onRemoveTemplate={onRemoveTemplate}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    await user.click(screen.getByRole('button', { name: 'Insert Split hero' }));
    const slots = kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    expect(slots).toHaveLength(4);
    // After the selected region (rB), not at the end.
    expect(slots[2]).not.toBe('t1');
    expect(treeOf(kernel, slots[2] ?? '').children[0]).toMatchObject({ tag: 'section' });

    await user.click(screen.getByRole('tab', { name: /Saved/u }));
    const saved = screen.getByRole('tabpanel');
    expect(within(saved).getByText('Pull quote')).toBeInTheDocument();
    await user.click(within(saved).getByRole('button', { name: 'Remove Pull quote from Saved' }));
    expect(onRemoveTemplate).toHaveBeenCalledWith('quote');
  });

  it('the Blocks tab is the Palette, composed', async () => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} />);
    await user.click(screen.getByRole('tab', { name: 'Blocks' }));
    expect(screen.getByRole('navigation', { name: 'Block palette' })).toBeInTheDocument();
  });

  it('builds thumbnails from the classes a tree uses, sandboxed and directional', () => {
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'p-4 flex', children: [{ kind: 'icon', name: 'star', className: 'text-accent' }] }],
    };
    expect(treeClassNames(tree)).toEqual(['p-4', 'flex', 'text-accent']);
    const doc = previewSrcdoc({ markup: '<p>Hi</p>', css: 'p{color:red}</style><script>', dir: 'rtl', lang: 'ar' });
    expect(doc).toContain('<html dir="rtl" lang="ar">');
    expect(doc).not.toContain('</style><script>');
  });
});

// media-motion (2026-10-06) additions: the media presets are the schema recipes' trees.
describe('LibraryPanel — media presets (media-motion DESIGN D10)', () => {
  const MEDIA_IDS = [
    'gallery-grid',
    'gallery-masonry',
    'gallery-carousel',
    'video-player',
    'video-youtube',
    'bg-video-hero',
    'scene-particles',
    'scene-mural',
    'compare',
    'pricing-toggle',
    'map-facade',
  ];
  const preset = (id: string) => {
    const found = LIBRARY_ELEMENT_PRESETS.find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`no preset ${id}`);
    return found;
  };
  const attributesOf = (node: CustomCodeRoot['children'][number]) =>
    node.kind === 'element' ? (node.attributes ?? {}) : {};

  beforeAll(() => {
    installBrowserStandIns();
  });

  it('every media preset id is unique and searchable in Arabic and English', () => {
    const ids = LIBRARY_ELEMENT_PRESETS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of MEDIA_IDS) {
      const entry = preset(id);
      expect(entry.keywords, id).toMatch(/[؀-ۿ]/u);
      expect(entry.keywords, id).toMatch(/[a-z]/u);
    }
  });

  it.each(['en', 'ar'] as const)('each media preset carries its behaviour or engine marker (%s)', (language) => {
    expect(attributesOf(preset('gallery-grid').node(language))).toMatchObject({ 'data-ck-behavior': 'gallery' });
    expect(attributesOf(preset('gallery-masonry').node(language))).toMatchObject({ 'data-ck-behavior': 'gallery' });
    expect(attributesOf(preset('gallery-carousel').node(language))).toMatchObject({ 'data-ck-behavior': 'gallery' });
    expect(attributesOf(preset('video-player').node(language))).toMatchObject({ 'data-ck-behavior': 'video-player' });
    expect(attributesOf(preset('video-youtube').node(language))).toMatchObject({ 'data-ck-behavior': 'embed-facade' });
    expect(attributesOf(preset('bg-video-hero').node(language))).toMatchObject({ 'data-ck-behavior': 'bg-video' });
    expect(attributesOf(preset('compare').node(language))).toMatchObject({ 'data-ck-behavior': 'compare' });
    expect(attributesOf(preset('pricing-toggle').node(language))).toMatchObject({ 'data-ck-behavior': 'toggle-group' });
    expect(attributesOf(preset('map-facade').node(language))).toMatchObject({ 'data-ck-behavior': 'embed-facade' });
    const scene = preset('scene-mural').node(language);
    const layer = scene.kind === 'element' ? scene.children?.[0] : undefined;
    expect(layer === undefined ? {} : attributesOf(layer)).toMatchObject({ 'data-ck-scene': 'mural', 'aria-hidden': 'true' });
    expect(attributesOf(scene)).toMatchObject(language === 'ar' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' });
  });

  it('a gallery whose layout needs region hooks carries the recipe CSS', () => {
    expect(preset('gallery-masonry').css?.('ar')).toContain('.ck-masonry');
    expect(preset('gallery-grid').css?.('en') ?? '').toBe('');
  });

  it('inserting the masonry gallery is ONE transaction that writes the tree and its CSS; one undo removes it', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LibraryPanel kernel={kernel} labels={LIBRARY_PANEL_LABELS_AR} />);
    await user.click(screen.getByRole('button', { name: 'إدراج معرض صور متداخل' }));
    expect(kernel.transactions()).toHaveLength(1);
    const slots = kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    const created = slots[3] ?? '';
    expect(treeOf(kernel, created).children[0]).toMatchObject({
      tag: 'div',
      attributes: { 'data-ck-behavior': 'gallery' },
    });
    expect((kernel.getDocument().nodes[created]?.props['css'] as string | undefined) ?? '').toContain('.ck-masonry');
    act(() => {
      kernel.undo();
    });
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(3);
  });
});

// gsap-pixi additions (2026-10-08): sections that move (diagnosis blocker 10).
describe('LibraryPanel — motion presets (gsap-pixi)', () => {
  const MOTION_IDS = ['animated-hero', 'scroll-reveal-features', 'scroll-reveal-section'];
  const preset = (id: string) => {
    const found = LIBRARY_ELEMENT_PRESETS.find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`no preset ${id}`);
    return found;
  };
  type TreeNode = CustomCodeRoot['children'][number];
  const all = (node: TreeNode): TreeNode[] =>
    node.kind === 'element' ? [node, ...(node.children ?? []).flatMap(all)] : [node];
  const timelines = (node: TreeNode) =>
    all(node).flatMap((entry) => (entry.kind === 'element' && entry.attributes?.['data-ck-timeline'] !== undefined ? [entry.attributes['data-ck-timeline']] : []));

  beforeAll(() => {
    installBrowserStandIns();
  });

  it.each(['en', 'ar'] as const)('each motion preset passes the media door and carries its engine markers (%s)', (language) => {
    for (const id of MOTION_IDS) {
      const node = preset(id).node(language);
      expect(mediaRecipeProblems({ label: { ar: id, en: id }, tree: { kind: 'root', children: [node] }, css: '' }), id).toEqual([]);
      expect(node).toMatchObject({ tag: 'section', attributes: language === 'ar' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' } });
    }
    const hero = preset('animated-hero').node(language);
    expect(hero.kind === 'element' ? hero.attributes : {}).toMatchObject({ 'data-ck-scene': 'particles' });
    expect(timelines(hero)).toEqual(['split-reveal', 'fade-in', 'fade-in']);
    expect(timelines(preset('scroll-reveal-features').node(language))).toEqual(['fade-in', 'fade-in', 'stagger-in']);
    expect(timelines(preset('scroll-reveal-section').node(language))).toEqual(['stagger-in']);
  });

  it.each([
    ['animated hero', 'Insert Animated hero'],
    ['scroll reveal', 'Insert Scroll reveal features'],
    ['حركة', 'Insert Scroll reveal features'],
    ['انميشن', 'Insert Animated hero'],
    ['متحرك', 'Insert Animated hero'],
  ])('search «%s» finds the motion sections', async (query, expected) => {
    const user = userEvent.setup();
    render(<LibraryPanel kernel={makeKernel()} />);
    await user.type(screen.getByRole('searchbox'), query);
    const names = screen.getAllByRole('button', { name: /^Insert / }).map((tile) => tile.getAttribute('aria-label'));
    expect(names).toContain(expected);
  });

  it('inserting the animated hero is ONE transaction; one undo removes it', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<LibraryPanel kernel={kernel} labels={LIBRARY_PANEL_LABELS_AR} />);
    await user.click(screen.getByRole('button', { name: 'إدراج هيرو متحرك' }));
    expect(kernel.transactions()).toHaveLength(1);
    const slots = kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];
    const created = slots[3] ?? '';
    expect(treeOf(kernel, created).children[0]).toMatchObject({ tag: 'section', attributes: { 'data-ck-scene': 'particles' } });
    act(() => {
      kernel.undo();
    });
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(3);
  });
});
// end gsap-pixi additions
