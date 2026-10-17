import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { fontPairById, fontsLabel } from '../../model/page-plan-draft';
import type { Locale } from '../../model/view-types';

import { FontPairMenu } from './FontPairMenu';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root, tall enough for the menu,
 * the trigger at the inline end of a card's line, where it lives.
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
        minBlockSize: 420,
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
            display: 'flex',
            justifyContent: 'flex-end',
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

const START = 'reem-kufi--ibm-plex-sans-arabic';

/** The pair really changes, so the checked item follows. */
function Live({ locale }: { readonly locale: Locale }) {
  const [selected, setSelected] = useState(START);
  const pair = fontPairById(selected);
  return (
    <FontPairMenu
      locale={locale}
      selectedId={selected}
      fonts={pair === undefined ? undefined : fontsLabel(pair)}
      onSelect={setSelected}
    />
  );
}

const meta = {
  title: 'Agent/Decisions/FontPairMenu',
  component: FontPairMenu,
  parameters: { layout: 'centered' },
  args: { locale: 'en', selectedId: START, onSelect: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof FontPairMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /^(Fonts|الخطوط):/u }));
  await expect(within(canvasElement.ownerDocument.body).getByRole('menu')).toBeInTheDocument();
};

/** Closed, narrow: the heading face alone, then ▾; the name says the whole pair. */
export const Closed: Story = story();
/** From 400px: the specimen and both faces. */
export const ClosedAt420: Story = story({ width: 420 });
export const ClosedAt420RightToLeft: Story = story({ locale: 'ar', width: 420 });

/** Open: the curated, engine-verified pairs, the plan's pair checked on Mist. */
export const Open: Story = { ...story(), play: open };
export const OpenDark: Story = { ...story({ theme: 'dark' }), play: open };
export const OpenRightToLeft: Story = { ...story({ locale: 'ar' }), play: open };
export const OpenRightToLeftDark: Story = { ...story({ locale: 'ar', theme: 'dark' }), play: open };

/** Faces that are not one of the curated pairs: named on the trigger, nothing checked. */
export const UncuratedFaces: Story = {
  render: () => <FontPairMenu locale="en" fonts="Cairo / Tajawal" onSelect={fn()} />,
};
