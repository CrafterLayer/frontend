import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { ContextChipView, Locale } from '../../model/view-types';
import { blockChip, LONG_LABEL, SCOPE_CHIP } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { ContextChip } from './ContextChip';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root, and the composer's Sheet the chips sit on (its context row). */
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 'var(--bldr-space-md)',
            padding: 7,
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
          }}
        >
          <AgentTooltipProvider>
            <Story />
          </AgentTooltipProvider>
        </div>
      </div>
    </div>
  );
};

function Row({
  locale,
  chips,
  removable = true,
}: {
  readonly locale: Locale;
  readonly chips: readonly ContextChipView[];
  readonly removable?: boolean;
}) {
  return (
    <>
      {chips.map((chip) => (
        <ContextChip
          key={chip.id}
          locale={locale}
          chip={chip}
          onRemove={removable ? fn() : undefined}
        />
      ))}
    </>
  );
}

const meta = {
  title: 'Agent/Composer/ContextChip',
  component: ContextChip,
  parameters: { layout: 'centered' },
  args: { locale: 'en', chip: SCOPE_CHIP, onRemove: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof ContextChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Whole page": the request's visible scope (FR-024). No `×`: it is not a choice. */
export const WholePage: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};

/** The canvas selection, removable: the `×` is a 32px target overhanging a 28px chip. */
export const Selection: Story = {
  args: { chip: blockChip('en', 'hero') },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Remove Hero from the request' }),
    ).toBeInTheDocument();
  },
};

/** A chip that only shows what a paused request is about: no `×`. */
export const ReadOnly: Story = {
  args: { chip: blockChip('en', 'services'), onRemove: undefined },
};

/** The block is gone: struck through, and the line under it says so. */
export const Stale: Story = {
  args: { chip: blockChip('en', 'faq', { stale: true }) },
  play: async ({ canvasElement }) => {
    const remove = within(canvasElement).getByRole('button', {
      name: 'Remove FAQ from the request',
    });
    await expect(remove).toHaveAccessibleDescription('No longer on the page');
  },
};

/** A long name cuts with an ellipsis at 16 characters. */
export const LongLabel: Story = {
  args: { chip: blockChip('en', 'hero', { label: LONG_LABEL.en }) },
};

/** The context row: selection first, then mentions (SPEC §3.2). */
export const ContextRow: Story = {
  render: () => (
    <Row
      locale="en"
      chips={[
        blockChip('en', 'hero'),
        blockChip('en', 'services', { kind: 'mention' }),
        blockChip('en', 'faq', { kind: 'mention', stale: true }),
      ]}
    />
  ),
};

export const ContextRowDark: Story = {
  render: () => (
    <Row
      locale="en"
      chips={[blockChip('en', 'hero'), blockChip('en', 'faq', { kind: 'mention', stale: true })]}
    />
  ),
  parameters: { panel: { theme: 'dark' } },
};

export const WholePageDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: glyph at the right, `×` at the left, the name in `<bdi>`. */
export const ContextRowRightToLeft: Story = {
  render: () => (
    <Row
      locale="ar"
      chips={[
        blockChip('ar', 'hero'),
        blockChip('ar', 'services', { kind: 'mention', label: LONG_LABEL.ar }),
        blockChip('ar', 'faq', { kind: 'mention', stale: true }),
      ]}
    />
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const WholePageRightToLeftDark: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};
