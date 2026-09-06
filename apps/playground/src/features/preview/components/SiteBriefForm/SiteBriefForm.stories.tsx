import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { SiteBriefForm } from './SiteBriefForm';

const CARD = { inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' } as const;

/** Releases the held run in `Submitting`, so the next story starts on a clean root. */
let release: (reason: string | undefined) => void = () => undefined;

const meta = {
  title: 'Playground/SiteBriefForm',
  component: SiteBriefForm,
  parameters: { layout: 'centered' },
  args: { locale: 'en', onSubmit: fn<(brief: string) => Promise<string | undefined>>(() => Promise.resolve(undefined)) },
  argTypes: { onSubmit: { control: false } },
  decorators: [
    (Story) => (
      <div style={CARD}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SiteBriefForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing typed yet: the hint says what one sentence buys. */
export const Empty: Story = {};

/** A brief in the field, ready to go. */
export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText('Describe the site you want'),
      'a ceramics studio in Amman: home, work, contact',
    );
    await expect(canvas.getByRole('button', { name: /Build the site/u })).toBeEnabled();
  },
};

/**
 * Submitting: the field closes and the live region says so.
 *
 * The run is HELD open for the length of the assertion and then released.
 *
 * An earlier version returned a promise that never settled — "what a minute of
 * waiting looks like" — and it broke the two stories declared after it. Every
 * story in a file shares one page and one React root, and a transition that
 * never finishes starves the transitions that come next: `Refused` and
 * `Errored` sat pending forever, reporting a missing message that was simply
 * never allowed to render. A story may leave nothing running behind it.
 */
export const Submitting: Story = {
  args: {
    onSubmit: fn<(brief: string) => Promise<string | undefined>>(
      () =>
        new Promise<string | undefined>((resolve) => {
          release = resolve;
        }),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText('Describe the site you want'),
      'a ceramics studio in Amman',
    );
    await userEvent.click(canvas.getByRole('button', { name: /Build the site/u }));
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Building the site…');
    });
    await expect(canvas.getByLabelText('Describe the site you want')).toBeDisabled();
    release(undefined);
  },
};

/** REFUSED: the form declines to start. No spinner, nothing to undo. */
export const Refused: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Build the site/u }));
    /*
      Awaited, not read. `useActionState` settles across a transition, so the
      first paint after a click still shows the pending form — a synchronous
      read here caught the field mid-flight and reported the message missing.
    */
    await expect(
      await canvas.findByText(/Write a sentence about the site first/u),
    ).toBeVisible();
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await waitFor(async () => {
      await expect(canvas.getByLabelText('Describe the site you want')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
  },
};

/** ERROR: the host would not admit the run, and says why. The brief is kept. */
export const Errored: Story = {
  args: {
    onSubmit: fn<(brief: string) => Promise<string | undefined>>(() =>
      Promise.resolve('A run is already going. Stop it before starting another.'),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Describe the site you want');
    await userEvent.type(field, 'a ceramics studio in Amman');
    await userEvent.click(canvas.getByRole('button', { name: /Build the site/u }));
    await waitFor(async () => {
      await expect(canvas.getByText(/A run is already going/u)).toBeVisible();
    });
    await expect(field).toHaveValue('a ceramics studio in Amman');
  },
};

/** Another run owns the panel: this one may not start a second. */
export const Busy: Story = {
  args: { busy: true, defaultValue: 'a ceramics studio in Amman' },
};

/** Arabic, right to left — the product's own default. */
export const Arabic: Story = {
  args: { locale: 'ar' },
  decorators: [
    (Story) => (
      <div dir="rtl" style={CARD}>
        <Story />
      </div>
    ),
  ],
};
