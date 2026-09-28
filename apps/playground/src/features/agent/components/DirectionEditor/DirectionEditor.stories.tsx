import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { applyPlanOp, type PagePlanDraft } from '../../model/page-plan-draft';
import type { Locale, PlanDirectionView } from '../../model/view-types';
import { dentalDraft, planLowContrast } from '../../testing/wp-13-decisions-fixtures';

import { DirectionEditor } from './DirectionEditor';

/* ── The panel's root, as AgentPanel draws it, inside a plan card's Sheet ───── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story: theme, language, direction and the `agent` container. The
 * editor lives inside a decision card, so the story draws it on the card's Sheet with the
 * card's 12px padding: the mood and the first swatch hang into it by their own inner space.
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

/** The editor over a real plan: each op through the model, as the controller applies it. */
function Live({
  locale,
  start,
}: {
  readonly locale: Locale;
  readonly start?: PagePlanDraft | undefined;
}) {
  const [draft, setDraft] = useState(() => start ?? dentalDraft(locale));
  const direction = draft.direction as PlanDirectionView;
  return (
    <DirectionEditor
      locale={locale}
      direction={direction}
      onEdit={(op) => {
        setDraft((current) => applyPlanOp(current, op));
      }}
    />
  );
}

const direction = (locale: Locale): PlanDirectionView =>
  dentalDraft(locale).direction as PlanDirectionView;

const meta = {
  title: 'Agent/Decisions/DirectionEditor',
  component: DirectionEditor,
  parameters: { layout: 'centered' },
  args: { locale: 'en', direction: direction('en'), onEdit: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof DirectionEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(frame: Frame = {}, start?: (locale: Locale) => PagePlanDraft): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} start={start?.(locale)} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** The mood reads as a line; five swatches in 32px targets; the pair at the inline end. */
export const Default: Story = story();
export const Dark: Story = story({ theme: 'dark' });
export const RightToLeft: Story = story({ locale: 'ar' });
export const RightToLeftDark: Story = story({ locale: 'ar', theme: 'dark' });
/** From 400px the pair shows its specimen and both faces. */
export const At420: Story = story({ width: 420 });
export const At420RightToLeft: Story = story({ locale: 'ar', width: 420 });

/** A held text colour that fails on the background: its swatch carries the Amber flag. */
export const UnreadableText: Story = {
  render: () => (
    <DirectionEditor
      locale="en"
      direction={planLowContrast('en').direction as PlanDirectionView}
      onEdit={fn()}
    />
  ),
};

/** Editing the mood: the Sheet with a Rule border; Esc puts the plan's mood back. */
export const EditingMood: Story = {
  ...story(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Style' });
    await userEvent.click(field);
    await userEvent.type(field, ', and warm');
    await expect(field).toHaveValue('Calm, clinical, teal, and warm');
  },
};
