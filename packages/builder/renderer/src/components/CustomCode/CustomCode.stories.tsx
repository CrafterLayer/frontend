import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import type { BlockRenderProps, CustomCodeRoot, RegisteredBlock } from '@craftkit/builder-schema';

import { CustomCode } from './CustomCode';
import { CustomCodeRegistryContext, type CustomCodeBlockLookup } from './registry-context';

const tree = (...children: CustomCodeRoot['children']): CustomCodeRoot => ({
  kind: 'root',
  children,
});

/*
  The kernel's OWN fixture blocks, not one written for these stories. A tree
  that references `hero` here references the same schema the product registers,
  so a story cannot drift into showing a reference resolving against a shape
  nothing else has.
*/
function Hero({ props, slots }: BlockRenderProps<{ tone: string; heading: string }>) {
  return (
    <div data-tone={props.tone} style={{ border: '1px dashed currentColor', padding: 12 }}>
      <strong>{props.heading}</strong>
      {slots['default']}
    </div>
  );
}

const heroSchema = (fixtureBlocks.contributes?.blocks ?? []).find(
  (contribution) => contribution.schema.type === 'hero',
)?.schema;

const lookup: CustomCodeBlockLookup = (type) =>
  type === 'hero' && heroSchema !== undefined
    ? ({ schema: heroSchema, render: Hero as NonNullable<RegisteredBlock['render']> } as const)
    : undefined;

const meta = {
  title: 'Builder/Renderer/CustomCode',
  component: CustomCode,
  parameters: { layout: 'padded' },
  args: { hostId: 'host', tree: tree() },
  decorators: [
    (Story) => (
      <CustomCodeRegistryContext.Provider value={lookup}>
        <Story />
      </CustomCodeRegistryContext.Provider>
    ),
  ],
} satisfies Meta<typeof CustomCode>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A small authored region: a heading, a paragraph, and a link. */
export const Default: Story = {
  args: {
    tree: tree(
      { kind: 'element', tag: 'h2', text: 'Handmade in Amman' },
      {
        kind: 'element',
        tag: 'p',
        text: 'Every piece is thrown, trimmed and glazed by one pair of hands.',
      },
      {
        kind: 'element',
        tag: 'a',
        text: 'See the work',
        attributes: { href: 'https://example.com/work' },
      },
    ),
  },
};

/** Nested elements with class names, which is how an authored region is styled. */
export const Nested: Story = {
  args: {
    tree: tree({
      kind: 'element',
      tag: 'section',
      className: 'ck-hero',
      children: [
        { kind: 'element', tag: 'h1', className: 'ck-hero__title', text: 'قهوة كل صباح' },
        { kind: 'element', tag: 'p', className: 'ck-hero__lede', text: 'محمّصة على نار هادئة.' },
      ],
    }),
  },
};

/** An icon leaf, by its Lucide name. */
export const WithIcon: Story = {
  args: {
    tree: tree({
      kind: 'element',
      tag: 'p',
      children: [
        { kind: 'icon', name: 'mail' },
        { kind: 'element', tag: 'span', text: ' hello@example.com' },
      ],
    }),
  },
};

/** A reference to a registered block, rendered by that block's own component. */
export const ComponentReference: Story = {
  args: {
    tree: tree({
      kind: 'component',
      component: 'hero',
      props: { heading: 'Shipping pauses in August', tone: 'dark' },
    }),
  },
};

/**
 * A reference to a block that is not registered — after an extension was
 * disposed, or a document written elsewhere. It degrades, it does not throw.
 */
export const UnknownComponent: Story = {
  args: {
    tree: tree({ kind: 'component', component: 'widget:reviews' }),
    isCanvas: true,
  },
};

/**
 * A MALFORMED tree, of the kind a hand edit through the code view produces.
 * An unknown tag is skipped and a missing child list is empty — nothing throws
 * into a canvas that has no error boundary.
 */
export const Malformed: Story = {
  args: {
    tree: {
      kind: 'root',
      children: [
        { kind: 'element', tag: 'script', text: 'alert(1)' },
        { kind: 'element', tag: 'p', text: 'This still renders.' },
        { kind: 'nonsense' },
        null,
      ],
    },
  },
};

/** Nothing stored at all. An empty region is a region, not an error. */
export const Empty: Story = {};

/*
  Design markup (2026-09-28): what a professional section reaches for, with no
  script — each story is the pattern the craftkit.design-code skill teaches.
*/

/** A FAQ that opens without script; `name` keeps one answer open at a time. */
export const Faq: Story = {
  args: {
    tree: tree(
      ...[
        ['Do you roast every day?', 'Every morning at seven, in small batches.'],
        ['Can I order beans online?', 'Yes — delivery inside Amman the same day.'],
        ['Do you offer decaf?', 'A Swiss-water decaf from Colombia, always on the shelf.'],
      ].map(([question = '', answer = ''], at): CustomCodeRoot['children'][number] => ({
        kind: 'element',
        tag: 'details',
        attributes: at === 0 ? { name: 'faq', open: '' } : { name: 'faq' },
        children: [
          { kind: 'element', tag: 'summary', text: question },
          { kind: 'element', tag: 'p', text: answer },
        ],
      })),
    ),
  },
};

/** A comparison table: header scopes for screen readers, a caption for the table's name. */
export const PricingTable: Story = {
  args: {
    tree: tree({
      kind: 'element',
      tag: 'table',
      children: [
        { kind: 'element', tag: 'caption', text: 'Plans compared' },
        {
          kind: 'element',
          tag: 'thead',
          children: [
            {
              kind: 'element',
              tag: 'tr',
              children: [
                { kind: 'element', tag: 'th', attributes: { scope: 'col' }, text: 'Feature' },
                { kind: 'element', tag: 'th', attributes: { scope: 'col' }, text: 'Basic' },
                { kind: 'element', tag: 'th', attributes: { scope: 'col' }, text: 'Pro' },
              ],
            },
          ],
        },
        {
          kind: 'element',
          tag: 'tbody',
          children: [
            {
              kind: 'element',
              tag: 'tr',
              children: [
                { kind: 'element', tag: 'th', attributes: { scope: 'row' }, text: 'Seats' },
                { kind: 'element', tag: 'td', text: '1' },
                { kind: 'element', tag: 'td', text: '5' },
              ],
            },
          ],
        },
      ],
    }),
  },
};

/** A wave divider drawn in place: paint from `currentColor`, geometry only. */
export const WaveDivider: Story = {
  args: {
    tree: tree({
      kind: 'element',
      tag: 'svg',
      attributes: { viewBox: '0 0 1440 80', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      className: 'block h-16 w-full text-stone-200',
      children: [
        {
          kind: 'element',
          tag: 'path',
          attributes: { d: 'M0 40C360 80 1080 0 1440 40V80H0Z', fill: 'currentColor' },
        },
      ],
    }),
  },
};

/**
 * A menu a phone opens: the button names the popover by id, a tap outside
 * closes it — and so does following one of its links, which the renderer does
 * (HTML closes a popover from a button only). Checked in a real browser: the
 * Popover API is not in jsdom, where design-markup.test.tsx stubs it.
 */
export const PopoverMenu: Story = {
  args: {
    tree: tree(
      {
        kind: 'element',
        tag: 'button',
        attributes: { popovertarget: 'story-menu', 'aria-label': 'Page sections' },
        children: [{ kind: 'icon', name: 'menu' }],
      },
      {
        kind: 'element',
        tag: 'nav',
        attributes: { id: 'story-menu', popover: '', 'aria-label': 'Page sections' },
        children: ['Menu', 'Story', 'Visit'].map((label): CustomCodeRoot['children'][number] => ({
          kind: 'element',
          tag: 'a',
          text: label,
          attributes: { href: `#${label.toLowerCase()}` },
        })),
      },
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Closed, the sheet is display:none and out of the accessibility tree: found by its id.
    const sheet = canvasElement.querySelector<HTMLElement>('#story-menu');
    if (sheet === null) throw new Error('the popover sheet did not render');
    await expect(sheet.matches(':popover-open')).toBe(false);

    await userEvent.click(canvas.getByRole('button', { name: 'Page sections' }));
    await expect(sheet.matches(':popover-open')).toBe(true);

    /*
      The link is not followed here: following it unloaded the test runner's
      frame mid-run (the browser connection closed). The window hears the
      click after the renderer's own handler, so this stops the navigation
      only (design-markup.test.tsx asserts the link still follows). A tap on a
      link inside the sheet is not a light dismiss, so only the renderer can
      have closed it.
    */
    const stay = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener('click', stay, { once: true });
    await userEvent.click(within(sheet).getByRole('link', { name: 'Story' }));
    await expect(sheet.matches(':popover-open')).toBe(false);
  },
};

/**
 * A video backdrop: it plays by itself, so the renderer mutes it and keeps it
 * inline whatever the tree says. The poster shows until the first frame.
 */
export const VideoHero: Story = {
  args: {
    tree: tree({
      kind: 'element',
      tag: 'video',
      attributes: {
        autoplay: '',
        loop: '',
        poster: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1280',
        width: '1280',
        height: '720',
      },
      children: [
        {
          kind: 'element',
          tag: 'source',
          attributes: {
            src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            type: 'video/mp4',
          },
        },
      ],
    }),
  },
};
