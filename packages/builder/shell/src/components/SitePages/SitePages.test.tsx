import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createSiteBuilder, type BuilderSiteKernel } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder-core/testing';
import {
  defaultDesignSystem,
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type ContentDirection,
  type SitePage,
} from '@craftkit/builder-schema';

import { SitePages } from './SitePages';
import { SITE_PAGES_LABELS_AR } from './SitePages.labels';

function page(id: string, address: string, title: string, dir: ContentDirection): SitePage {
  return {
    id,
    address,
    title,
    purpose: 'test',
    audience: 'test',
    document: {
      schemaVersion: LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir,
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: {} } },
    },
    regions: [],
  };
}

function siteOf(
  entries: readonly (readonly [string, string, string])[],
  dir: ContentDirection = 'ltr',
): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir,
    pages: entries.map(([id, address, title]) => page(id, address, title, dir)),
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

const FOUR = [
  ['home', '/', 'Home'],
  ['about', '/about', 'About us'],
  ['work', '/work', 'Our work'],
  ['contact', '/contact', 'Contact'],
] as const;

function mount(site: BuilderSite = siteOf(FOUR)): BuilderSiteKernel {
  const siteKernel = createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('t') },
  });
  render(<SitePages siteKernel={siteKernel} />);
  return siteKernel;
}

const optionTitles = (): string[] =>
  screen
    .getAllByRole('option')
    .map((option) => option.querySelector('.bldr-site-pages__name')?.textContent ?? '');

describe('SitePages — listbox semantics', () => {
  it('lists every page in site order, with position and set size', () => {
    mount();
    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute('aria-posinset', '1');
    expect(options[0]).toHaveAttribute('aria-setsize', '4');
    expect(options[3]).toHaveAttribute('aria-posinset', '4');
  });

  it('marks the CURRENT page selected, and only that one', () => {
    const siteKernel = mount();
    expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);

    act(() => {
      siteKernel.setCurrentPage('work');
    });

    const selected = screen.getAllByRole('option', { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Our work');
  });

  it('opens a page on click', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();

    await user.click(screen.getByRole('option', { name: /Contact/ }));

    expect(siteKernel.currentPage()).toBe('contact');
  });

  it('says so when the site has no pages, instead of rendering an empty listbox', () => {
    /*
      Unreachable through the site kernel, which refuses to open on a site with
      no home page — but a listbox with no options is a dead end for a screen
      reader, and the component should not depend on an invariant it does not
      own for its own accessibility.
    */
    const siteKernel = createSiteBuilder({
      site: siteOf(FOUR),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('t') },
    });
    /*
      One frozen site value, not a fresh one per call. `useSyncExternalStore`
      compares snapshots by identity, so a stand-in that built a new object each
      time made React re-render forever — which is a fair description of the
      contract `getSite()` has to keep, and the real kernel does keep it.
    */
    const nothing = siteOf([]);
    const empty: BuilderSiteKernel = { ...siteKernel, getSite: () => nothing };
    render(<SitePages siteKernel={empty} />);

    expect(screen.getByText('This site has no pages yet.')).toBeVisible();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('SitePages — roving focus', () => {
  it('keeps exactly one page in the tab order', async () => {
    const user = userEvent.setup();
    mount();

    await user.tab();
    await user.tab();

    const tabbable = screen
      .getAllByRole('option')
      .filter((option) => option.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  it('walks with the arrows and jumps with Home and End', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('option', { name: /Home/ }));

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /About us/ })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: /Contact/ })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: /^Home/ })).toHaveFocus();
  });

  it('moves the active row without opening the page — Enter opens it', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /Home/ }));

    await user.keyboard('{ArrowDown}');
    // Arrowing is navigation, not selection: the canvas has not switched.
    expect(siteKernel.currentPage()).toBe('home');

    await user.keyboard('{Enter}');
    expect(siteKernel.currentPage()).toBe('about');
  });
});

describe('SitePages — add, rename, reorder, remove', () => {
  it('adds a page through the site door — one transaction — and OPENS it, blank', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();

    await user.click(screen.getByRole('button', { name: 'Add page' }));

    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(siteKernel.transactions()).toHaveLength(1);

    /*
      The new page is the CURRENT page, not a fifth row under an unchanged
      canvas: it is selected, it holds the keyboard, it is counted the way a
      person counts, and it is empty.
    */
    const created = siteKernel.getSite().pages[4];
    expect(created?.address).toBe('/page-5');
    expect(created?.title).toBe('Page 5');
    expect(siteKernel.currentPage()).toBe(created?.id);
    const row = screen.getByRole('option', { name: /Page 5/ });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row).toHaveFocus();
    expect(Object.keys(created?.document.nodes ?? {})).toEqual(['root']);

    act(() => {
      expect(siteKernel.undo()).toBe(true);
    });
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('renames in place, committing on Enter', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /About us/ }));

    await user.keyboard('{F2}');
    const field = screen.getByRole('textbox', { name: 'Rename About us' });
    await user.clear(field);
    await user.type(field, 'Our story{Enter}');

    expect(siteKernel.getSite().pages[1]?.title).toBe('Our story');
    expect(optionTitles()).toContain('Our story');
  });

  it('abandons a rename on Escape, and returns the keyboard to the row', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /About us/ }));

    await user.keyboard('{F2}');
    await user.type(screen.getByRole('textbox', { name: 'Rename About us' }), 'Discarded');
    await user.keyboard('{Escape}');

    expect(siteKernel.getSite().pages[1]?.title).toBe('About us');
    expect(siteKernel.transactions()).toHaveLength(0);
    // NAMED: focus is on the row, not merely off the field.
    expect(screen.getByRole('option', { name: /About us/ })).toHaveFocus();
  });

  it('reorders with Alt+Arrow and keeps the moved page focused', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /About us/ }));

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

    expect(siteKernel.pages()).toEqual(['home', 'work', 'about', 'contact']);
    /*
      NAMED destination, not `not.toHaveFocus()` on the old position: the moved
      page must still hold the keyboard, or a second Alt+ArrowDown would do
      nothing and the interaction would be unusable past the first press.
    */
    expect(screen.getByRole('option', { name: /About us/ })).toHaveFocus();
  });

  it('refuses to move past the ends rather than wrapping', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /^Home/ }));

    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');

    expect(siteKernel.pages()).toEqual(['home', 'about', 'work', 'contact']);
    expect(siteKernel.transactions()).toHaveLength(0);
  });

  it('deletes with Delete and puts focus on the NEXT page, by name', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /About us/ }));

    await user.keyboard('{Delete}');

    expect(siteKernel.pages()).toEqual(['home', 'work', 'contact']);
    /*
      The destination is NAMED. `expect(deletedRow).not.toHaveFocus()` would
      pass when focus fell all the way to <body> — which is the exact failure
      this assertion exists to catch, and the one a removed <li> causes by
      default.
    */
    expect(screen.getByRole('option', { name: /Our work/ })).toHaveFocus();
  });

  it('names the destination when the deleted page was NOT the current one', async () => {
    /*
      The case that tells the component's rule apart from the kernel's. When the
      CURRENT page is deleted the site kernel moves itself to the neighbour and
      focus follows for free — so a test that only ever deletes the current page
      passes with `focusDestinationAfterDelete` removed entirely, which is what
      the mutation check found.

      Here the person arrowed to a page WITHOUT opening it and pressed Delete.
      The kernel has no reason to move, so nothing but this component decides
      where the keyboard goes — and "wherever the current page happens to be" is
      not an answer: it throws the person to the other end of the list.
    */
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /^Home/ }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /About us/ })).toHaveFocus();
    // Still on Home: arrowing navigates, it does not open.
    expect(siteKernel.currentPage()).toBe('home');

    await user.keyboard('{Delete}');

    expect(siteKernel.pages()).toEqual(['home', 'work', 'contact']);
    expect(siteKernel.currentPage()).toBe('home');
    expect(screen.getByRole('option', { name: /Our work/ })).toHaveFocus();
  });

  it('falls back to the PREVIOUS page when the last one is deleted', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /Contact/ }));

    await user.keyboard('{Delete}');

    expect(siteKernel.pages()).toEqual(['home', 'about', 'work']);
    expect(screen.getByRole('option', { name: /Our work/ })).toHaveFocus();
  });

  it('lets the door refuse the home page, and keeps the list intact', async () => {
    const user = userEvent.setup();
    const siteKernel = mount();
    await user.click(screen.getByRole('option', { name: /^Home/ }));

    /*
      The refusal belongs to `removePage`, not to this component — which is why
      the component does not re-implement it. What it must do is REPORT it: an
      exception escaping an event handler unmounts the tree in development and
      tells the person nothing, and "you cannot delete the home page" is normal
      use, not a crash.
    */
    await user.keyboard('{Delete}');

    expect(screen.getByRole('status')).toHaveTextContent(/home page cannot be removed/);
    expect(siteKernel.pages()).toEqual(['home', 'about', 'work', 'contact']);
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });
});

describe('SitePages — direction', () => {
  it('mirrors the horizontal keys in an RTL site', async () => {
    const user = userEvent.setup();
    const siteKernel = createSiteBuilder({
      site: siteOf(
        [
          ['home', '/', 'الرئيسية'],
          ['about', '/about', 'من نحن'],
          ['work', '/work', 'أعمالنا'],
        ],
        'rtl',
      ),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('t') },
    });
    render(<SitePages siteKernel={siteKernel} />);
    await user.click(screen.getByRole('option', { name: /الرئيسية/ }));

    // In Arabic the list runs right-to-left, so ArrowLeft is FORWARD.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('option', { name: /من نحن/ })).toHaveFocus();

    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(siteKernel.pages()).toEqual(['home', 'work', 'about']);
  });
});

/**
 * FR-004's editing half: a page opts into a shared region, and out of it, on
 * its own — without touching the region or any other page.
 */
describe('shared regions', () => {
  const withRegions = (): BuilderSite => {
    const base = siteOf(FOUR);
    const regionDocument = (words: string) => ({
      schemaVersion: 1,
      surface: 'site' as const,
      dir: 'ltr' as const,
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['line'] } },
        line: { id: 'line', type: 'text', props: { content: words } },
      },
    });
    return {
      ...base,
      pages: base.pages.map((entry, at) =>
        at === 0 ? { ...entry, regions: ['masthead'] } : entry,
      ),
      sharedRegions: {
        masthead: { id: 'masthead', kind: 'header', document: regionDocument('the masthead') },
        colophon: { id: 'colophon', kind: 'footer', document: regionDocument('the colophon') },
      },
    };
  };

  it('offers nothing at all when the site has no shared regions', () => {
    mount();
    expect(screen.queryByRole('group', { name: /Shared regions/u })).toBeNull();
  });

  it('shows the ACTIVE page regions, named with their kind', () => {
    mount(withRegions());
    const fieldset = screen.getByRole('group', { name: 'Shared regions on Home' });
    expect(fieldset).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /masthead \(header\)/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /colophon \(footer\)/u })).not.toBeChecked();
  });

  it('opts a page IN with one transaction, touching no other page', async () => {
    const user = userEvent.setup();
    const kernel = mount(withRegions());
    const others = JSON.stringify(kernel.getSite().pages.slice(1));

    await user.click(screen.getByRole('checkbox', { name: /colophon/u }));

    expect(kernel.getSite().pages[0]?.regions).toEqual(['masthead', 'colophon']);
    expect(kernel.transactions()).toHaveLength(1);
    /*
      Opting in is a page's decision about itself. A design that wrote to the
      REGION would make one page's choice change every page carrying it.
    */
    expect(JSON.stringify(kernel.getSite().pages.slice(1))).toBe(others);
    expect(kernel.getSite().sharedRegions['colophon']?.document.nodes['line']).toBeDefined();
  });

  it('opts a page OUT, and only that page', async () => {
    const user = userEvent.setup();
    const kernel = mount(withRegions());

    await user.click(screen.getByRole('checkbox', { name: /masthead/u }));

    expect(kernel.getSite().pages[0]?.regions).toEqual([]);
    expect(Object.keys(kernel.getSite().sharedRegions).sort()).toEqual(['colophon', 'masthead']);
  });

  it('follows the selected page, so the toggles are always about the row in focus', async () => {
    const user = userEvent.setup();
    mount(withRegions());

    await user.click(screen.getByRole('option', { name: /Our work/u }));

    expect(screen.getByRole('group', { name: 'Shared regions on Our work' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /masthead/u })).not.toBeChecked();
  });

  it('keeps the list a listbox, with the toggles outside it', () => {
    mount(withRegions());
    /*
      An `option` containing checkboxes is a control inside a control, which no
      screen reader has a sensible reading for — so the toggles live below the
      list, where the active page is already the subject.
    */
    const list = screen.getByRole('listbox', { name: 'Site pages' });
    expect(list.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});

describe('SitePages in the Arabic editor (arabic-editor)', () => {
  it('draws its own words in Arabic and mirrors keys by the editor direction over an LTR site', async () => {
    const siteKernel = createSiteBuilder({
      site: siteOf(FOUR),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('ar') },
    });
    render(
      <div dir="rtl">
        <SitePages siteKernel={siteKernel} labels={SITE_PAGES_LABELS_AR} />
      </div>,
    );
    expect(screen.getByRole('navigation', { name: 'الصفحات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة صفحة' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'صفحات الموقع' })).toBeInTheDocument();

    const user = userEvent.setup();
    const first = screen.getAllByRole('option')[0]!;
    act(() => {
      first.focus();
    });
    // RTL chrome: ArrowLeft is FORWARD, to the next page.
    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('option')[1]).toHaveFocus();
  });
});
