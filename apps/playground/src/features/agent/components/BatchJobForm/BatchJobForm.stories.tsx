import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { jobsLabels } from '../../copy/jobs-labels';
import { SAMPLE_PAGES, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';
import { jobsFrame } from '../../testing/jobs-story-frame';

import { BatchJobForm } from './BatchJobForm';

const EN = jobsLabels('en');
const NOT_CONFIGURED =
  'Background batches are not configured on this server: they need the Anthropic Messages API (ANTHROPIC_API_KEY).';

const meta = {
  title: 'Agent/Jobs/BatchJobForm',
  component: BatchJobForm,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    pages: SAMPLE_PAGES,
    connected: true,
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [jobsFrame],
} satisfies Meta<typeof BatchJobForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark' } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;
const AR = { locale: 'ar', pages: SAMPLE_PAGES_AR } as const;

/** Empty, on every page: Submit says what is missing and puts focus on the request. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: EN.form.submit }));
    await expect(canvas.getByText(EN.form.needsRequest)).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: EN.form.request })).toHaveFocus();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/** Prefilled from the composer's draft, which the field says. */
export const FromDraft: Story = {
  args: { initialRequest: 'Translate every page into French', fromDraft: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EN.form.fromDraft)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: EN.form.submit }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      'Translate every page into French',
      SAMPLE_PAGES.map((page) => page.id),
    );
  },
};

/** Choose pages: the checklist starts on the page open now. */
export const ChoosePages: Story = {
  args: { initialRequest: 'Add a short FAQ section' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: EN.form.choosePages }));
    await userEvent.click(canvas.getByRole('checkbox', { name: /Menu/u }));
    await userEvent.click(canvas.getByRole('button', { name: EN.form.submit }));
    await expect(args.onSubmit).toHaveBeenCalledWith('Add a short FAQ section', ['home', 'menu']);
  },
};

/** No assistant server at all: the sentence why, and Submit waits. */
export const NoServer: Story = {
  args: { connected: false, initialRequest: 'Translate every page into French' },
  play: async ({ canvasElement }) => {
    const submit = within(canvasElement).getByRole('button', { name: EN.form.submit });
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await expect(submit).toHaveAccessibleDescription(EN.noServer);
  },
};

/** The server cannot batch (501): its own sentence, plainly, and Submit waits. */
export const Unavailable: Story = {
  args: { unavailable: NOT_CONFIGURED, initialRequest: 'Translate every page into French' },
};

export const Submitting: Story = {
  args: { submitting: true, initialRequest: 'Translate every page into French' },
};

/** A send that failed for another reason: the server's sentence under the form. */
export const Failed: Story = {
  args: {
    error: 'The assistant server answered with status 502.',
    initialRequest: 'Translate every page into French',
  },
};

export const Dark: Story = {
  args: { initialRequest: 'Translate every page into French', fromDraft: true },
  parameters: DARK,
};

export const RightToLeft: Story = {
  args: { ...AR, initialRequest: 'ترجم كل الصفحات إلى الفرنسية', fromDraft: true },
  ...RTL,
};

export const UnavailableRightToLeft: Story = {
  args: { ...AR, unavailable: NOT_CONFIGURED },
  parameters: DARK,
  ...RTL,
};

/** A narrow panel. */
export const Narrow: Story = {
  args: { initialRequest: 'Translate every page into French' },
  parameters: { panel: { width: 320 } },
};
