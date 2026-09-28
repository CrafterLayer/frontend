import { ChromeButton } from '@craftkit/builder';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { IconButton } from '../IconButton';

import { InlineConfirm } from './InlineConfirm';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. A story picks its frame with
 * `parameters.panel`; a story-level decorator would nest a second frame inside this one.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div
        style={{
          minBlockSize: 180,
          padding: 'var(--bldr-space-3xl)',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

/** A record footer, the row InlineConfirm lives in (SPEC §4.6): 24px in, wrapping. */
function Footer({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--bldr-space-md)',
        paddingInlineStart: 'var(--bldr-space-5xl)',
      }}
    >
      {children}
    </div>
  );
}

function UndoBuild({ locale }: { locale: Locale }) {
  return (
    <Footer>
      <InlineConfirm
        message={t(locale, 'confirm.undoBuild')}
        confirmLabel={t(locale, 'confirm.undo')}
        cancelLabel={t(locale, 'confirm.cancel')}
        onConfirm={() => undefined}
        renderOpener={({ open }) => (
          <ChromeButton size="sm" onClick={open}>
            {t(locale, 'footer.undoBuild')}
          </ChromeButton>
        )}
      />
    </Footer>
  );
}

function DeleteConversation({ locale }: { locale: Locale }) {
  return (
    <Footer>
      <InlineConfirm
        tone="danger"
        message={t(locale, 'history.confirm')}
        confirmLabel={t(locale, 'history.confirm.yes')}
        cancelLabel={t(locale, 'history.confirm.no')}
        onConfirm={() => undefined}
        renderOpener={({ open }) => (
          <IconButton icon="trash" label={t(locale, 'history.delete')} onClick={open} />
        )}
      />
    </Footer>
  );
}

/** Opens the confirm and checks the SPEC §6.3 destinations: Cancel, then back to the opener. */
async function openAndCancel(canvasElement: HTMLElement, opener: string, cancel: string) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: opener }));
  await expect(canvas.getByRole('button', { name: cancel })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect(canvas.getByRole('button', { name: opener })).toHaveFocus();
}

async function open(canvasElement: HTMLElement, opener: string, cancel: string) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: opener }));
  await expect(canvas.getByRole('button', { name: cancel })).toHaveFocus();
}

const meta = {
  title: 'Agent/Primitives/InlineConfirm',
  component: InlineConfirm,
  parameters: { layout: 'centered' },
  args: {
    message: t('en', 'confirm.undoBuild'),
    confirmLabel: t('en', 'confirm.undo'),
    cancelLabel: t('en', 'confirm.cancel'),
    onConfirm: () => undefined,
    renderOpener: ({ open: openConfirm }) => (
      <ChromeButton size="sm" onClick={openConfirm}>
        {t('en', 'footer.undoBuild')}
      </ChromeButton>
    ),
  },
  decorators: [inPanel],
} satisfies Meta<typeof InlineConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: only the opener, in the footer where the confirm will appear. */
export const Closed: Story = {
  render: () => <UndoBuild locale="en" />,
};

/** Open: the consequence, then Undo and Cancel; focus is on Cancel, the safe answer. */
export const Open: Story = {
  render: () => <UndoBuild locale="en" />,
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'Undo build', 'Cancel');
  },
};

/** Esc cancels and focus returns to the opener. */
export const EscapeReturnsFocus: Story = {
  render: () => <UndoBuild locale="en" />,
  play: async ({ canvasElement }) => {
    await openAndCancel(canvasElement, 'Undo build', 'Cancel');
  },
};

export const OpenDark: Story = {
  render: () => <UndoBuild locale="en" />,
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'Undo build', 'Cancel');
  },
};

export const OpenRightToLeft: Story = {
  render: () => <UndoBuild locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, t('ar', 'footer.undoBuild'), t('ar', 'confirm.cancel'));
  },
};

export const OpenRightToLeftDark: Story = {
  render: () => <UndoBuild locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, t('ar', 'footer.undoBuild'), t('ar', 'confirm.cancel'));
  },
};

/** What cannot be undone confirms in an Alarm outline: deleting a conversation. */
export const Destructive: Story = {
  render: () => <DeleteConversation locale="en" />,
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'Delete conversation', 'Cancel');
    await expect(within(canvasElement).getByRole('group')).toHaveAttribute('data-tone', 'danger');
  },
};

export const DestructiveRightToLeftDark: Story = {
  render: () => <DeleteConversation locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await openAndCancel(canvasElement, t('ar', 'history.delete'), t('ar', 'history.confirm.no'));
  },
};
