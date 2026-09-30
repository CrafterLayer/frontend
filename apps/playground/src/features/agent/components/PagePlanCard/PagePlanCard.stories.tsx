import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale, PlanView } from '../../model/view-types';
import {
  dentalDraft,
  planApproval,
  planAtMaximum,
  planAtMinimum,
  planDrafting,
  planDuplicateTitle,
  planEdited,
  planLowContrast,
  planReadOnly,
  planReady,
  useLivePlan,
  type PlanFrame,
} from '../../testing/wp-13-decisions-fixtures';

import { PagePlanCard, type PagePlanCardActions, type PagePlanCardProps } from './PagePlanCard';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. The card sits in the thread's 16px gutter.
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

function actions(): PagePlanCardActions {
  return { build: fn(), discard: fn(), editPlan: fn() };
}

/** A plan the story can really edit: every op through the model, as the controller does. */
function LivePlan({ locale, frame = {} }: { readonly locale: Locale; readonly frame?: PlanFrame }) {
  const plan = useLivePlan(locale, dentalDraft(locale), frame);
  return (
    <PagePlanCard
      locale={locale}
      view={plan.view}
      actions={{ build: fn(), discard: fn(), editPlan: plan.edit }}
      accepts={plan.accepts}
    />
  );
}

const meta = {
  title: 'Agent/Decisions/PagePlanCard',
  component: PagePlanCard,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: planReady('en'), actions: actions() },
  decorators: [inPanel],
} satisfies Meta<typeof PagePlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function live(frame: Frame = {}, plan: PlanFrame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <LivePlan locale={locale} frame={plan} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

function still(
  view: (locale: Locale) => PlanView,
  frame: Frame = {},
  extra: Partial<PagePlanCardProps> = {},
): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => (
      <PagePlanCard locale={locale} view={view(locale)} actions={actions()} {...extra} />
    ),
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** SPEC §3.7: the plan as it arrives in Plan mode. Edit it: rename, reorder, add, recolour. */
export const Ready: Story = live();
export const ReadyDark: Story = live({ theme: 'dark' });
/** Arabic, the default: the pencil runs down the right edge, the handles sit at the left. */
export const ReadyRightToLeft: Story = live({ locale: 'ar' });
export const ReadyRightToLeftDark: Story = live({ locale: 'ar', theme: 'dark' });
/** At 420px each section's purpose sits inline in Slate, and the pair shows both faces. */
export const ReadyAt420: Story = live({ width: 420 });
export const ReadyAt420RightToLeft: Story = live({ locale: 'ar', width: 420 });
/** The narrowest dock (288px): titles end in an ellipsis; nothing wraps under the handles. */
export const ReadyAt288: Story = live({ width: 288 });

/** After a rename (“Patient stories”) and a move: the “Edited” tag. */
export const Edited: Story = still(planEdited);
export const EditedRightToLeft: Story = still(planEdited, { locale: 'ar' });

/** A text colour that cannot be read: Build waits, and the Amber reason says why. */
export const InvalidContrast: Story = {
  ...still(planLowContrast),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const build = canvas.getByRole('button', { name: 'Build this page' });
    await expect(build).toHaveAttribute('aria-disabled', 'true');
    await expect(build).toHaveAccessibleDescription("Text and background don't contrast enough");
  },
};
export const InvalidContrastDark: Story = still(planLowContrast, { theme: 'dark' });
/** Two sections share a name, so one link could not tell them apart. */
export const InvalidDuplicateNames: Story = still(planDuplicateTitle);
export const InvalidDuplicateNamesRightToLeft: Story = still(planDuplicateTitle, { locale: 'ar' });

/** Ask mode: the same card is the approval; nothing touches the page before Build. */
export const AskApproval: Story = live({}, { approval: true });
export const AskApprovalRightToLeft: Story = still(planApproval, { locale: 'ar' });
export const AskApprovalRightToLeftDark: Story = still(planApproval, {
  locale: 'ar',
  theme: 'dark',
});
/** SPEC §7.6 E0c: the empty layout was written before approval, and the card says so. */
export const AskApprovalLayoutPrepared: Story = still(
  planApproval,
  { locale: 'ar' },
  {
    layoutPrepared: true,
  },
);

/**
 * SPEC §7.6 E6/E7 absent (`capabilities.editablePlan = false`): titles and the direction
 * as prose, nothing to drag or rename. In Ask, Build answers the held question, so the
 * listed sections are exactly what lands.
 */
export const ReadOnlyFallback: Story = still((locale) => planReadOnly(locale, 'exact'));
export const ReadOnlyFallbackRightToLeft: Story = still((locale) => planReadOnly(locale, 'exact'), {
  locale: 'ar',
});
/** Plan mode without a structured plan: Build re-plans, and the note says so. */
export const MayDifferNote: Story = still((locale) => planReadOnly(locale, 'mayDiffer'));
export const MayDifferNoteRightToLeftDark: Story = still(
  (locale) => planReadOnly(locale, 'mayDiffer'),
  { locale: 'ar', theme: 'dark' },
);

/** Two sections, the engine’s floor: Remove is refused, with the reason under it. */
export const AtMinimum: Story = {
  ...still(planAtMinimum),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Options for Hero' }));
    const menu = within(canvasElement.ownerDocument.body).getByRole('menu');
    // The menu opens with a fade: its reason is visible once the entrance has run.
    await waitFor(() => expect(within(menu).getByText(t('en', 'plan.min'))).toBeVisible());
  },
};
/** Twelve sections, the engine’s ceiling: Add section is refused, with the reason shown. */
export const AtMaximum: Story = still(planAtMaximum);
export const AtMaximumRightToLeft: Story = still(planAtMaximum, { locale: 'ar' });

/** While the planner writes: a working record, not yet a card. */
export const Drafting: Story = still(planDrafting);
export const DraftingRightToLeft: Story = still(planDrafting, { locale: 'ar' });

/** Alt+↓ moves a section; focus stays on its handle (SPEC §4.11, §6.3). */
export const ReorderWithKeyboard: Story = {
  ...live(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Reorder Services' });
    handle.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    const rows = canvas.getAllByRole('listitem');
    await expect(rows[3]).toHaveTextContent('Services');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Reorder Services' })).toHaveFocus(),
    );
  },
};
