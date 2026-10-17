import { useState } from 'react';

import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PART_QUICK_BAR_LABELS_AR, PART_QUICK_BAR_LABELS_EN } from './ElementQuickBar.labels';
import { PartLinkPopover, type PartLinkPage } from './PartLinkPopover';

interface DemoProps {
  readonly dir: 'ltr' | 'rtl';
  readonly arabic?: boolean;
  readonly pages?: readonly PartLinkPage[];
  readonly initiallyOpen?: boolean;
}

/** A stored link the popover edits; Apply shows what ONE transaction would write. */
function Demo({ dir, arabic = false, pages, initiallyOpen = false }: DemoProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [stored, setStored] = useState({ text: arabic ? 'ابدأ الآن' : 'Get started', href: '/start' });
  return (
    <div dir={dir} style={{ padding: 24, minHeight: 320 }}>
      <PartLinkPopover
        text={stored.text}
        href={stored.href}
        pages={pages}
        labels={arabic ? PART_QUICK_BAR_LABELS_AR : PART_QUICK_BAR_LABELS_EN}
        dir={dir}
        open={open}
        onOpenChange={setOpen}
        onApply={(value) => {
          setStored({ text: value.text, href: value.href });
          return { ok: true };
        }}
      >
        <button type="button">{arabic ? 'الرابط' : 'Link'}</button>
      </PartLinkPopover>
      <p data-testid="stored">
        <bdi>{stored.text}</bdi> → <bdi>{stored.href}</bdi>
      </p>
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/ElementQuickBar/PartLinkPopover',
  component: Demo,
  args: { dir: 'ltr' },
} satisfies Meta<typeof Demo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Link' }));
    const body = within(canvasElement.ownerDocument.body);
    const text = body.getByLabelText('Link text');
    await userEvent.clear(text);
    await userEvent.type(text, 'Start now');
    await userEvent.click(body.getByRole('button', { name: 'Apply' }));
    await expect(canvas.getByTestId('stored')).toHaveTextContent('Start now');
  },
};

export const WithSitePages: Story = {
  args: {
    initiallyOpen: true,
    pages: [
      { title: 'Home', href: '/' },
      { title: 'About', href: '/about' },
      { title: 'Pricing', href: '/pricing' },
    ],
  },
};

export const RefusesAnUnsafeAddress: Story = {
  args: { initiallyOpen: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const href = body.getByLabelText('Link address');
    await userEvent.clear(href);
    await userEvent.type(href, 'javascript:alert(1)');
    await userEvent.click(body.getByRole('button', { name: 'Apply' }));
    await expect(body.getByRole('alert')).toHaveTextContent('not allowed');
  },
};

export const ArabicRtl: Story = { args: { dir: 'rtl', arabic: true, initiallyOpen: true } };
