import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale, RestoreResult } from '../../model/view-types';
import { restoreAnswering, restorePending } from '../../testing/wp-13-decisions-fixtures';
import { IconButton } from '../IconButton';

import { RestoreDialog } from './RestoreDialog';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root. The panel is a size
 * container, so the dialog's fixed overlay veils the panel and the dialog centres in it.
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
        blockSize: 480,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/** A record's [⋯], where "Restore page to before this request" is chosen. */
function FromRecord({
  locale,
  onRestore,
  startOpen = true,
}: {
  readonly locale: Locale;
  readonly onRestore: () => Promise<RestoreResult>;
  readonly startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        ref={trigger}
        icon="more"
        label={t(locale, 'menu.label')}
        onClick={() => {
          setOpen(true);
        }}
      />
      <RestoreDialog
        locale={locale}
        open={open}
        onOpenChange={setOpen}
        onRestore={onRestore}
        returnFocusRef={trigger}
      />
    </>
  );
}

const meta = {
  title: 'Agent/Decisions/RestoreDialog',
  component: RestoreDialog,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    open: true,
    onOpenChange: fn(),
    onRestore: restoreAnswering('restored'),
  },
  decorators: [inPanel],
} satisfies Meta<typeof RestoreDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(onRestore: () => Promise<RestoreResult>, frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <FromRecord locale={locale} onRestore={onRestore} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** Open: focus on Cancel, the answer that changes nothing; Restore is an Alarm outline. */
export const Open: Story = {
  ...story(restoreAnswering('restored', 600)),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  },
};
export const OpenDark: Story = story(restoreAnswering('restored', 600), { theme: 'dark' });
export const OpenRightToLeft: Story = story(restoreAnswering('restored', 600), { locale: 'ar' });
export const OpenRightToLeftDark: Story = story(restoreAnswering('restored', 600), {
  locale: 'ar',
  theme: 'dark',
});

/** While the restore runs: Restore is unavailable and the dialog holds. */
export const Working: Story = {
  ...story(restorePending()),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'Restore page' }));
    await expect(body.getByRole('button', { name: 'Restore page' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/** The same parts changed after this request: it refuses in place, and Close takes focus. */
export const Conflict: Story = {
  ...story(restoreAnswering('conflict')),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'Restore page' }));
    const close = await body.findByRole('button', { name: 'Close' });
    await waitFor(() => expect(close).toHaveFocus());
    await expect(
      body.getByText("Can't restore automatically: the same parts changed after this request."),
    ).toBeInTheDocument();
  },
};
export const ConflictRightToLeft: Story = {
  ...story(restoreAnswering('conflict'), { locale: 'ar' }),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: t('ar', 'restore.confirm') }));
    await body.findByRole('button', { name: t('ar', 'restore.close') });
  },
};
export const ConflictRightToLeftDark: Story = {
  ...story(restoreAnswering('conflict'), { locale: 'ar', theme: 'dark' }),
  play: ConflictRightToLeft.play,
};

/** Esc closes it and focus returns to the record's [⋯] (SPEC §6.3). */
export const EscapeReturnsFocus: Story = {
  ...story(restoreAnswering('restored')),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(within(canvasElement).getByRole('button', { name: 'More options' })).toHaveFocus(),
    );
  },
};
