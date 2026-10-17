import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { Locale, StepPlanView } from '../../model/view-types';
import { stepsDrafting, stepsPageWide, stepsReady } from '../../testing/wp-13-decisions-fixtures';

import { StepPlanCard, type StepPlanCardActions } from './StepPlanCard';

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

function actions(): StepPlanCardActions {
  return { runSteps: fn(), discard: fn() };
}

const meta = {
  title: 'Agent/Decisions/StepPlanCard',
  component: StepPlanCard,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: stepsReady('en'), actions: actions() },
  decorators: [inPanel],
} satisfies Meta<typeof StepPlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(view: (locale: Locale) => StepPlanView, frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <StepPlanCard locale={locale} view={view(locale)} actions={actions()} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** Plan mode for an edit: three steps, each naming its block, and "Run this plan". */
export const Ready: Story = {
  ...story(stepsReady),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    await expect(canvas.getByText('Nothing changes until the plan runs.')).toBeInTheDocument();
  },
};
export const ReadyDark: Story = story(stepsReady, { theme: 'dark' });
export const ReadyRightToLeft: Story = story(stepsReady, { locale: 'ar' });
export const ReadyRightToLeftDark: Story = story(stepsReady, { locale: 'ar', theme: 'dark' });
export const ReadyAt420: Story = story(stepsReady, { width: 420 });

/** A page-wide step names no block. */
export const PageWide: Story = story(stepsPageWide);
export const PageWideRightToLeft: Story = story(stepsPageWide, { locale: 'ar' });

/** While the steps are drafted: a working record. */
export const Drafting: Story = story(() => stepsDrafting());
export const DraftingRightToLeft: Story = story(() => stepsDrafting(), { locale: 'ar' });
