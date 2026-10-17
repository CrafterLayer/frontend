import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createSiteBuilder,
  defaultBlocks,
  emptyDocument,
  type BuilderSiteKernel,
  type JsonValue,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { createReferenceCodePageSite } from './code-page-fixture';
import { PageWorkspace } from './page-workspace';
import { PAGE_WORKSPACE_LABELS_AR } from './page-workspace.labels';

function workspaceKernel(withLinkedAbout = false): BuilderSiteKernel {
  const site = createReferenceCodePageSite();
  if (withLinkedAbout) {
    const home = site.pages[0];
    const root = home?.document.nodes[home.document.rootId];
    if (root === undefined) throw new Error('code page root absent');
    root.props['inputs'] = {
      ...(root.props['inputs'] as Record<string, JsonValue>),
      destination: { kind: 'page', pageId: 'about' },
    };
  }
  site.pages = [
    ...site.pages,
    {
      id: 'about',
      address: '/about',
      title: 'About',
      purpose: 'Explain the studio.',
      audience: 'Prospective clients',
      document: emptyDocument(),
      regions: [],
    },
  ];
  return createSiteBuilder({
    site,
    ports: { clock: fixedClock(), ids: seededIds('page-workspace') },
    extensions: [defaultBlocks],
  });
}

describe('PageWorkspace', () => {
  it('supports initial and controlled view ownership for shell integration', async () => {
    const kernel = workspaceKernel();
    const user = userEvent.setup();
    const changes: string[] = [];
    const { unmount } = render(
      <PageWorkspace
        siteKernel={kernel}
        view="map"
        onViewChange={(view) => {
          changes.push(view);
        }}
      />,
    );
    expect(screen.getByRole('region', { name: 'Site map' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(changes).toEqual(['list']);
    expect(screen.getByRole('region', { name: 'Site map' })).toBeVisible();

    unmount();
    render(<PageWorkspace siteKernel={kernel} initialView="map" />);
    expect(screen.getByRole('region', { name: 'Site map' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('list', { name: 'Site pages' })).toBeVisible();
  });

  it('keeps list and sitemap on one current-page state', async () => {
    const kernel = workspaceKernel();
    render(<PageWorkspace siteKernel={kernel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sitemap' }));
    await user.click(screen.getByRole('button', { name: 'Open About, /about' }));
    expect(kernel.currentPage()).toBe('about');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: /^About/ })).toHaveAttribute('aria-current', 'page');
  });

  it('connects duplicate and reorder actions to atomic page commands', async () => {
    const kernel = workspaceKernel();
    render(<PageWorkspace siteKernel={kernel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for About' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(kernel.getSite().pages).toHaveLength(3);
    const copy = kernel.getSite().pages.find((page) => page.id !== 'home' && page.id !== 'about');
    expect(copy?.title).toBe('About copy');
    expect(kernel.currentPage()).toBe(copy?.id);
    expect(kernel.transactions().at(-1)?.command).toBe('duplicatePage');
  });

  it('saves code-page metadata and whole-site direction in one undoable transaction', async () => {
    const kernel = workspaceKernel();
    const before = kernel.getSite();
    render(<PageWorkspace siteKernel={kernel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Northstar Studio' }));
    await user.click(screen.getByRole('menuitem', { name: 'SEO and settings' }));
    const form = screen.getByRole('form', { name: 'Settings for Northstar Studio' });
    await user.clear(within(form).getByRole('textbox', { name: 'Page title' }));
    await user.type(within(form).getByRole('textbox', { name: 'Page title' }), 'Northstar Works');
    await user.clear(within(form).getByRole('textbox', { name: 'Purpose' }));
    await user.type(within(form).getByRole('textbox', { name: 'Purpose' }), 'Show selected work.');
    await user.clear(within(form).getByRole('textbox', { name: 'SEO title' }));
    await user.type(
      within(form).getByRole('textbox', { name: 'SEO title' }),
      'Northstar portfolio',
    );
    await user.type(
      within(form).getByRole('textbox', { name: 'SEO and share image' }),
      '/share.png',
    );
    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'Site content direction' }),
      'rtl',
    );
    const count = kernel.transactions().length;
    await user.click(within(form).getByRole('button', { name: 'Save page settings' }));

    expect(kernel.transactions()).toHaveLength(count + 1);
    const page = kernel.getSite().pages.find((candidate) => candidate.id === 'home')!;
    expect(page.title).toBe('Northstar Works');
    expect(page.purpose).toBe('Show selected work.');
    expect(page.document.dir).toBe('rtl');
    const seo = page.document.nodes[page.document.rootId]?.props['seo'] as Record<
      string,
      JsonValue
    >;
    expect(seo).toMatchObject({ title: 'Northstar portfolio', image: '/share.png' });
    expect(kernel.getSite().dir).toBe('rtl');

    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite()).toEqual(before);
  });

  it('disables unsupported social metadata instead of claiming to save it', async () => {
    const kernel = workspaceKernel();
    render(<PageWorkspace siteKernel={kernel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for About' }));
    await user.click(screen.getByRole('menuitem', { name: 'SEO and settings' }));
    const form = screen.getByRole('form', { name: 'Settings for About' });
    expect(within(form).getByRole('group', { name: 'SEO and sharing' })).toBeDisabled();
    expect(within(form).getByText(/without claiming separate SEO storage/i)).toBeInTheDocument();
  });

  it('deletes a referenced page and unlinks its references in one change', async () => {
    const kernel = workspaceKernel(true);
    const codePage = kernel.getSite().pages.find((page) => page.id === 'home')!;
    const root = codePage.document.nodes[codePage.document.rootId]!;
    render(<PageWorkspace siteKernel={kernel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Actions for About' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete page' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('1 internal link');
    const count = kernel.transactions().length;
    await user.click(within(dialog).getByRole('button', { name: 'Delete and unlink' }));
    expect(kernel.getSite().pages.map((page) => page.id)).not.toContain('about');
    expect(
      (
        kernel.getSite().pages[0]?.document.nodes[root.id]?.props['inputs'] as Record<
          string,
          JsonValue
        >
      )['destination'],
    ).toBeNull();
    expect(kernel.transactions()).toHaveLength(count + 1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getSite().pages.map((page) => page.id)).toContain('about');
  });

  it('reads in Arabic with the Arabic labels, page counts agreeing in number', async () => {
    const kernel = workspaceKernel();
    render(<PageWorkspace siteKernel={kernel} labels={PAGE_WORKSPACE_LABELS_AR} />);
    const user = userEvent.setup();
    const region = screen.getByRole('region', { name: 'مساحة عمل الصفحات' });
    expect(within(region).getByRole('heading', { name: 'الصفحات' })).toBeVisible();
    expect(region).toHaveTextContent('صفحتان · سجل تغييرات واحد مشترك');
    expect(within(region).getByRole('group', { name: 'طريقة عرض الصفحات' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'قائمة' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(region).getByRole('list', { name: 'صفحات الموقع' })).toBeVisible();
    expect(region).toHaveTextContent('/ · الرئيسية');
    expect(arabicOnly(region, DATA)).toEqual([]);

    await user.click(within(region).getByRole('button', { name: 'إضافة صفحة' }));
    expect(region).toHaveTextContent('3 صفحات · سجل تغييرات واحد مشترك');
    expect(region).toHaveTextContent('أُضيفت صفحة.');
    expect(kernel.getSite().pages.at(-1)?.title).toBe('صفحة 3');

    // The counted forms the header never reaches in this fixture.
    expect(PAGE_WORKSPACE_LABELS_AR.summary(1)).toBe('صفحة واحدة · سجل تغييرات واحد مشترك');
    expect(PAGE_WORKSPACE_LABELS_AR.summary(11)).toBe('11 صفحة · سجل تغييرات واحد مشترك');

    await user.click(within(region).getByRole('button', { name: 'خريطة الموقع' }));
    const map = within(region).getByRole('region', { name: 'خريطة الموقع' });
    expect(map).toHaveTextContent('3 صفحات · المسارات والمصادر المشتركة');
    expect(within(map).getByRole('button', { name: 'فتح About، /about' })).toBeVisible();
    // The map's thumbnails show each title's initials (data too).
    expect(arabicOnly(region, [...DATA, '/page-3', 'NS', 'A'])).toEqual([]);

    await user.click(within(region).getByRole('button', { name: 'إجراءات About' }));
    await user.click(within(region).getByRole('menuitem', { name: 'الإعدادات والظهور في البحث' }));
    const form = within(region).getByRole('form', { name: 'إعدادات About' });
    expect(within(form).getByRole('textbox', { name: 'عنوان الصفحة' })).toHaveValue('About');
    expect(within(form).getByRole('textbox', { name: 'المسار' })).toHaveValue('/about');
    expect(within(form).getByRole('group', { name: 'محركات البحث والمشاركة' })).toBeDisabled();
    expect(within(form).getByRole('option', { name: 'من اليمين إلى اليسار' })).toBeInTheDocument();
    expect(arabicOnly(form, DATA)).toEqual([]);
    await user.click(within(form).getByRole('button', { name: 'حفظ إعدادات الصفحة' }));
    expect(region).toHaveTextContent('إعدادات الصفحة محدّثة أصلًا.');
  });
});

/** The fixture's own words: page titles, routes, purposes and shared module names. */
const DATA = [
  'Northstar Studio',
  'About',
  'Explain the studio.',
  'Prospective clients',
  '/about',
  '../../shared/Metric',
  'Metric',
];

/**
 * Every Latin word the element shows or announces once the page DATA is set
 * aside — text, accessible names, titles, placeholders. Empty means no English
 * chrome is left.
 */
function arabicOnly(element: HTMLElement, data: readonly string[]): string[] {
  const strip = (text: string): string =>
    data.reduce((rest, word) => rest.split(word).join(' '), text);
  const texts = [element.textContent];
  for (const node of [element, ...element.querySelectorAll('*')]) {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = node.getAttribute(attribute);
      if (value !== null) texts.push(value);
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      texts.push(node.value === '' ? '' : ' ');
    }
  }
  return texts.flatMap((text) => strip(text).match(/[A-Za-z][A-Za-z-]*/g) ?? []);
}
