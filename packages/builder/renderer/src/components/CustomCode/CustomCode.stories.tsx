import type { Meta, StoryObj } from '@storybook/react-vite';

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
