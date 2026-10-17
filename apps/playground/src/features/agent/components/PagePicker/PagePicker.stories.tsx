import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { jobsLabels } from '../../copy/jobs-labels';
import type { BatchPageOption } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';
import { SAMPLE_PAGES, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';
import { jobsFrame } from '../../testing/jobs-story-frame';

import { PagePicker } from './PagePicker';

interface LivePickerProps {
  readonly locale: Locale;
  /** Checked when the story starts. */
  readonly initial?: readonly string[];
  /** The pages listed; the sample site's when left out. */
  readonly pages?: readonly BatchPageOption[];
  readonly invalid?: boolean;
}

/** The picker over its own selection, as the form holds it. */
function LivePicker({ locale, initial = ['home'], pages, invalid }: LivePickerProps) {
  const [selected, setSelected] = useState<readonly string[]>(initial);
  return (
    <PagePicker
      locale={locale}
      pages={pages ?? (locale === 'ar' ? SAMPLE_PAGES_AR : SAMPLE_PAGES)}
      selected={selected}
      onChange={setSelected}
      label={jobsLabels(locale).form.pages}
      invalid={invalid}
    />
  );
}

const MANY: readonly BatchPageOption[] = Array.from({ length: 24 }, (_, index) => ({
  id: `page-${String(index)}`,
  title: index === 0 ? 'Home' : `Service ${String(index)}: a page with a rather long title`,
  address: index === 0 ? '/' : `/services/service-${String(index)}`,
  current: index === 3,
}));

const meta = {
  title: 'Agent/Jobs/PagePicker',
  component: LivePicker,
  parameters: { layout: 'centered' },
  args: { locale: 'en' },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [jobsFrame],
} satisfies Meta<typeof LivePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark' } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;

/** The page open now is checked; Select all checks every page. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const words = jobsLabels('en').form;
    await expect(canvas.getByText(words.selected(1, 5))).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: words.selectAll }));
    await expect(canvas.getByText(words.selected(5, 5))).toBeVisible();
    await userEvent.click(canvas.getByRole('checkbox', { name: /Menu/u }));
    await expect(canvas.getByText(words.selected(4, 5))).toBeVisible();
  },
};

export const Dark: Story = { parameters: DARK };

/** Arabic: the checkbox at the inline start (right), addresses still left to right. */
export const RightToLeft: Story = { args: { locale: 'ar' }, ...RTL };
export const DarkRightToLeft: Story = { args: { locale: 'ar' }, parameters: DARK, ...RTL };

/** Nothing chosen, after Submit: the list's border turns Alarm. */
export const Invalid: Story = { args: { initial: [], invalid: true } };

/** A large site: the list scrolls on its own; long titles end in an ellipsis. */
export const ManyPages: Story = { args: { pages: MANY, initial: ['page-3'] } };

/** A narrow panel. */
export const Narrow: Story = { parameters: { panel: { width: 300 } } };
