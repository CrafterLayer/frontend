import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { AddSectionRow } from './AddSectionRow';

/* ── The panel's root, as AgentPanel draws it, inside a plan card's Sheet ───── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** One panel frame per story, the row on a card's Sheet, 12px in, where it lives. */
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
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <div
          style={{
            padding: 'var(--bldr-space-xl)',
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
            borderRadius: 'var(--bldr-radius-lg)',
            background: 'var(--bldr-surface)',
          }}
        >
          <Story />
        </div>
      </div>
    </div>
  );
};

/** A plan with room for `room` more sections; the names added are listed above it. */
function Live({ locale, room }: { readonly locale: Locale; readonly room: number }) {
  const [added, setAdded] = useState<readonly string[]>([]);
  return (
    <>
      {added.length === 0 ? null : (
        <p style={{ margin: 0, color: 'var(--bldr-panel-muted)' }}>{added.join(', ')}</p>
      )}
      <AddSectionRow
        locale={locale}
        canAdd={added.length < room}
        onAdd={(title) => {
          setAdded((names) => [...names, title]);
        }}
      />
    </>
  );
}

const meta = {
  title: 'Agent/Decisions/AddSectionRow',
  component: AddSectionRow,
  parameters: { layout: 'centered' },
  args: { locale: 'en', canAdd: true, onAdd: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof AddSectionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(frame: Frame = {}, room = 4): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} room={room} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** Closed: Indigo words, the + on the glyph column. */
export const Closed: Story = story();
export const ClosedDark: Story = story({ theme: 'dark' });
export const ClosedRightToLeft: Story = story({ locale: 'ar' });

/** Open: the 32px field, its text where the words were; Enter adds and stays open. */
export const Open: Story = {
  ...story(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add section' }));
    await expect(canvas.getByRole('textbox', { name: 'Add section' })).toHaveFocus();
  },
};
export const OpenRightToLeftDark: Story = {
  ...story({ locale: 'ar', theme: 'dark' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('ar', 'plan.add') }));
  },
};

/** Twelve sections: refused, reachable, and the reason is written under it. */
export const AtMaximum: Story = story({}, 0);
export const AtMaximumRightToLeft: Story = story({ locale: 'ar' }, 0);
