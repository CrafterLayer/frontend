import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import CustomCodeTreeField from './CustomCodeTreeField';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'ck-card',
      children: [
        { kind: 'element', tag: 'h2', className: 'ck-card__title', text: 'Handmade in Amman' },
        { kind: 'element', tag: 'p', text: 'Thrown, trimmed and glazed by hand.' },
      ],
    },
  ],
};

const WITH_REFERENCE: CustomCodeRoot = {
  kind: 'root',
  children: [
    { kind: 'element', tag: 'h2', text: 'This season' },
    { kind: 'component', component: 'hero', props: { heading: 'Winter glazes' } },
  ],
};

/** The field holding its own value, the way the Inspector holds it. */
function LiveField({ initial, disabled = false }: { initial?: unknown; disabled?: boolean }) {
  const [value, setValue] = useState<unknown>(initial ?? TREE);
  return (
    <div style={{ maxWidth: 460 }}>
      <CustomCodeTreeField
        schema={z.unknown()}
        value={value}
        path={['props', 'tree']}
        onChange={setValue}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/CustomCodeTreeField',
  component: LiveField,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LiveField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A small authored region. The summary above the box counts what is inside. */
export const Default: Story = {};

/** A tree that references a registered block, which the summary names. */
export const WithComponentReference: Story = { args: { initial: WITH_REFERENCE } };

/** Nothing authored yet. */
export const EmptyRegion: Story = { args: { initial: { kind: 'root', children: [] } } };

/**
 * Break the JSON and leave the box: it refuses, says why, and keeps the text as
 * typed. It never writes an invalid tree — parse first, commit second.
 */
export const InvalidJson: Story = { args: { initial: TREE } };

// ── block-parts (2026-10-06) ──
/** In an Arabic (RTL) Inspector: the hint and the source toggle speak Arabic; the JSON stays LTR. */
export const Arabic: Story = {
  render: () => (
    <div dir="rtl">
      <LiveField />
    </div>
  ),
};
// ── /block-parts ──

/** Closed by the host. */
export const Disabled: Story = { args: { disabled: true } };
