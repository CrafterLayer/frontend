import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createSiteBuilder } from '@craftkit/builder-core';
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

function page(id: string, address: string, title: string, dir: ContentDirection): SitePage {
  return {
    id,
    address,
    title,
    purpose: 'story',
    audience: 'story',
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

function kernelOf(site: BuilderSite) {
  return createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('story') },
  });
}

const FOUR = [
  ['home', '/', 'Home'],
  ['about', '/about', 'About us'],
  ['work', '/work', 'Our work'],
  ['contact', '/contact', 'Contact'],
] as const;

const meta = {
  title: 'Shell/SitePages',
  component: SitePages,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '18rem', blockSize: '20rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SitePages>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: several pages, the first one current. */
export const Default: Story = {
  args: { siteKernel: kernelOf(siteOf(FOUR)) },
};

/** A site that has only its home page — the one page it cannot be without. */
export const SinglePage: Story = {
  args: { siteKernel: kernelOf(siteOf([['home', '/', 'Home']])) },
};

/** Enough pages that the list scrolls inside its panel. */
export const ManyPages: Story = {
  args: {
    siteKernel: kernelOf(
      siteOf([
        ['home', '/', 'Home'],
        ...Array.from(
          { length: 14 },
          (_, i) => [`p${String(i)}`, `/p${String(i)}`, `Page ${String(i + 1)}`] as const,
        ),
      ]),
    ),
  },
};

/** Arabic: the list mirrors, and Alt+Left MOVES DOWN because left is forward. */
export const RightToLeft: Story = {
  args: {
    siteKernel: kernelOf(
      siteOf(
        [
          ['home', '/', 'الرئيسية'],
          ['about', '/about', 'من نحن'],
          ['work', '/work', 'أعمالنا'],
        ],
        'rtl',
      ),
    ),
  },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '18rem', blockSize: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};

/** Keyboard reorder: Alt+ArrowDown moves the focused page one place later. */
export const KeyboardReorder: Story = {
  args: { siteKernel: kernelOf(siteOf(FOUR)) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('option', { name: /About us/ }));
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');

    await expect(args.siteKernel.pages()).toEqual(['home', 'work', 'about', 'contact']);
    // One command, one transaction — undoable in a single step.
    await expect(args.siteKernel.transactions()).toHaveLength(1);
    // The moved page keeps the keyboard, which is what makes a second press work.
    await expect(canvas.getByRole('option', { name: /About us/ })).toHaveFocus();
  },
};

/** Renaming in place: F2 opens the field, Enter commits it. */
export const RenameInPlace: Story = {
  args: { siteKernel: kernelOf(siteOf(FOUR)) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('option', { name: /About us/ }));
    await userEvent.keyboard('{F2}');

    const field = canvas.getByRole('textbox', { name: 'Rename About us' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Our story{Enter}');

    await expect(args.siteKernel.getSite().pages[1]?.title).toBe('Our story');
  },
};
