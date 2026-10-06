import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleValue } from '@craftkit/builder-schema';

import { ScaleNumberControl, type ScaleNumberControlProps } from './ScaleNumberControl';
import { spacingModel } from './spacing-model';

function Controlled(props: ScaleNumberControlProps) {
  const [value, setValue] = useState<StyleValue | undefined>(props.value);
  return (
    <ScaleNumberControl
      {...props}
      value={value}
      onCommit={(next) => {
        setValue(next ?? undefined);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/ScaleNumberControl',
  component: ScaleNumberControl,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '12rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Padding',
    value: { kind: 'token', token: '4' },
    model: spacingModel(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16']),
    units: ['px', 'rem', '%'],
    keywords: ['auto'],
    onCommit: () => undefined,
  },
} satisfies Meta<typeof ScaleNumberControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spacing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', { name: 'Padding' });
    input.focus();
    await userEvent.keyboard('{PageUp}');
    await expect(input).toHaveValue('24');
  },
};

export const TokensOnly: Story = { args: { mode: 'tokens' } };

export const Mixed: Story = { args: { mixed: true, value: undefined } };

/** The side panel's number field: drag the grip at its start to scrub, release to write once. */
export const Scrubbable: Story = { args: { scrub: true } };

/*
  Fix pass (2026-10-06): the unit/keyword menu is as wide as the word it
  shows, in both directions. A 40px cap had cut "full" to "ful" (and to
  "ull" in Arabic): the native arrow alone takes ~20px.
*/
async function expectMenuFitsItsWord(canvasElement: HTMLElement, word: string): Promise<void> {
  const select = within(canvasElement).getByRole('combobox');
  const probe = canvasElement.ownerDocument.createElement('span');
  const style = getComputedStyle(select);
  probe.style.font = style.font;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.textContent = word;
  canvasElement.append(probe);
  const text = probe.getBoundingClientRect().width;
  probe.remove();
  const inner =
    select.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  // The word plus room for the native arrow.
  await expect(inner - text).toBeGreaterThanOrEqual(14);
}

export const LongKeyword: Story = {
  args: {
    label: 'Width',
    value: { kind: 'token', token: 'full' },
    keywords: ['full', 'first', 'none', 'screen'],
  },
  play: async ({ canvasElement }) => {
    await expectMenuFitsItsWord(canvasElement, 'full');
  },
};

export const LongKeywordArabic: Story = {
  args: {
    label: 'العرض',
    value: { kind: 'token', token: 'screen' },
    keywords: ['full', 'first', 'none', 'screen'],
  },
  decorators: [
    (Story) => (
      <div dir="rtl" lang="ar">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expectMenuFitsItsWord(canvasElement, 'screen');
  },
};
