import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { Locale, ProposalView } from '../../model/view-types';
import {
  proposalDrafting,
  proposalPageWide,
  proposalPartial,
  proposalPending,
  proposalPreviewing,
  proposalWrote,
} from '../../testing/wp-13-decisions-fixtures';

import { ProposalCard, type ProposalCardActions } from './ProposalCard';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container, the card in the thread's 16px gutter.
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
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

function actions(): ProposalCardActions {
  return { apply: fn(), discard: fn(), togglePreview: fn() };
}

/** Preview really toggles, so the pressed state can be tried. */
function Live({ locale, view }: { readonly locale: Locale; readonly view: ProposalView }) {
  const [previewing, setPreviewing] = useState(view.previewing);
  return (
    <ProposalCard
      locale={locale}
      view={{ ...view, previewing }}
      actions={{
        apply: fn(),
        discard: fn(),
        togglePreview: () => {
          setPreviewing((on) => !on);
        },
      }}
      onMenuSelect={fn()}
    />
  );
}

const meta = {
  title: 'Agent/Decisions/ProposalCard',
  component: ProposalCard,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: proposalPending('en'), actions: actions(), onMenuSelect: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof ProposalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(view: (locale: Locale) => ProposalView, frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} view={view(locale)} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** SPEC §3.8: boxed until answered; the honesty line says the page has not changed. */
export const Pending: Story = {
  ...story(proposalPending),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("The page hasn't changed yet.")).toBeInTheDocument();
    // SPEC §7.4: no token or cost estimate, ever (the owner saw «~11.3k توكن» here).
    await expect(canvasElement.textContent).not.toMatch(/token|توكن|~\s*\d/iu);
  },
};
export const PendingDark: Story = story(proposalPending, { theme: 'dark' });
export const PendingRightToLeft: Story = story(proposalPending, { locale: 'ar' });
export const PendingRightToLeftDark: Story = story(proposalPending, {
  locale: 'ar',
  theme: 'dark',
});
/** From 400px the change's label takes a column and the values line up. */
export const PendingAt420: Story = story(proposalPending, { width: 420 });

/** Validation dropped one of three changes: an Amber line says how many survived. */
export const PartialSalvage: Story = story(proposalPartial);
export const PartialSalvageRightToLeft: Story = story(proposalPartial, { locale: 'ar' });
export const PartialSalvageDark: Story = story(proposalPartial, { theme: 'dark' });

/** Shown on the canvas; the toggle is pressed and Esc in the card ends it. */
export const Previewing: Story = story(proposalPreviewing);
export const PreviewingRightToLeftDark: Story = story(proposalPreviewing, {
  locale: 'ar',
  theme: 'dark',
});

/** The run wrote to the page: the honesty line is no longer true, so it is gone. */
export const PageAlreadyChanged: Story = {
  ...story(proposalWrote),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText("The page hasn't changed yet."),
    ).not.toBeInTheDocument();
  },
};

/** A page-wide change: no target to name. */
export const PageWide: Story = story(proposalPageWide);
export const PageWideRightToLeft: Story = story(proposalPageWide, { locale: 'ar' });

/** While the proposal is prepared: a working record. */
export const Drafting: Story = story(proposalDrafting);
export const DraftingRightToLeft: Story = story(proposalDrafting, { locale: 'ar' });
