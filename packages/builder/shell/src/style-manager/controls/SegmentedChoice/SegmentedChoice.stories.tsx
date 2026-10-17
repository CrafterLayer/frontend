import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { OptionIcon } from '../OptionIcon';
import { SegmentedChoice, type SegmentedChoiceProps } from './SegmentedChoice';

const JUSTIFY = [
  ['start', 'Start', 'البداية'],
  ['center', 'Centre', 'الوسط'],
  ['end', 'End', 'النهاية'],
  ['between', 'Space between', 'توزيع بين'],
  ['around', 'Space around', 'توزيع حول'],
  ['evenly', 'Space evenly', 'توزيع متساوٍ'],
  ['stretch', 'Stretch', 'تمديد'],
  ['normal', 'Normal', 'عادي'],
] as const;

const optionsIn = (locale: 'en' | 'ar') =>
  JUSTIFY.map(([value, en, ar]) => ({
    value,
    label: locale === 'ar' ? ar : en,
    icon: value === 'stretch' || value === 'normal' ? undefined : <OptionIcon property="justifyContent" value={value} />,
  }));

function Controlled(props: SegmentedChoiceProps) {
  const [value, setValue] = useState(props.value);
  return <SegmentedChoice {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Builder/Shell/StyleManager/SegmentedChoice',
  component: SegmentedChoice,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story, context) => (
      <div
        className="bldr-root"
        data-bldr-theme={context.name.includes('Dark') ? 'dark' : 'light'}
        dir={context.args.dir}
        style={{ background: 'var(--bldr-panel)', maxInlineSize: '17rem', padding: '16px' }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Justify',
    options: optionsIn('en'),
    value: 'between',
    dir: 'ltr',
    moreLabel: 'More Justify options',
    onChange: () => undefined,
  },
} satisfies Meta<typeof SegmentedChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Centre' }));
    await expect(canvas.getByRole('radio', { name: 'Centre' })).toHaveAttribute('aria-checked', 'true');
    /*
      Fix pass (2026-10-06): the "…" menu is one small square at the END of the
      icon row, on the same line, never a full-width row under the icons.
    */
    const more = canvas.getByRole('combobox', { name: 'More Justify options' }).getBoundingClientRect();
    const last = canvas.getByRole('radio', { name: 'Space evenly' }).getBoundingClientRect();
    await expect(Math.abs((more.top + more.bottom) / 2 - (last.top + last.bottom) / 2)).toBeLessThan(4);
    await expect(more.width).toBeLessThanOrEqual(last.width * 1.5);
  },
};
export const Dark: Story = {};
export const OverflowValue: Story = { args: { value: 'stretch' } };
export const ArabicLight: Story = {
  args: { dir: 'rtl', options: optionsIn('ar'), label: 'المحاذاة الأفقية', moreLabel: 'خيارات أخرى' },
};
export const ArabicDark: Story = {
  args: { dir: 'rtl', options: optionsIn('ar'), label: 'المحاذاة الأفقية', moreLabel: 'خيارات أخرى' },
};
