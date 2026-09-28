import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { duplicateSectionKeys } from '../../model/page-plan-draft';
import type { Locale } from '../../model/view-types';
import {
  dentalDraft,
  planDuplicateTitle,
  planReadOnly,
  planReady,
  useLivePlan,
} from '../../testing/wp-13-decisions-fixtures';

import { PlanSectionList } from './PlanSectionList';

/* ── The panel's root, as AgentPanel draws it, inside a plan card's Sheet ───── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story. The list lives inside a decision card, so the story draws it
 * on the card's Sheet, 12px in, with the card's ground for the nodes' rings.
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
          style={
            {
              '--ck-agent-ground': 'var(--bldr-surface)',
              padding: 'var(--bldr-space-xl)',
              border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
              borderRadius: 'var(--bldr-radius-lg)',
              background: 'var(--bldr-surface)',
            } as CSSProperties
          }
        >
          <Story />
        </div>
      </div>
    </div>
  );
};

/** A list over a real plan: every op through the model, as the controller applies it. */
function Live({ locale }: { readonly locale: Locale }) {
  const plan = useLivePlan(locale, dentalDraft(locale));
  return (
    <PlanSectionList
      locale={locale}
      sections={plan.view.sections}
      editable
      accepts={plan.accepts}
      onEdit={(op) => {
        plan.edit(plan.view.turnId, op);
      }}
    />
  );
}

const meta = {
  title: 'Agent/Decisions/PlanSectionList',
  component: PlanSectionList,
  parameters: { layout: 'centered' },
  args: { locale: 'en', sections: planReady('en').sections, editable: true, onEdit: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof PlanSectionList>;

export default meta;
type Story = StoryObj<typeof meta>;

function live(frame: Frame = {}): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** The pencil: open rings on a dashed line; the handle and [⋯] at the inline end. */
export const Editable: Story = live();
export const EditableDark: Story = live({ theme: 'dark' });
export const EditableRightToLeft: Story = live({ locale: 'ar' });
export const EditableRightToLeftDark: Story = live({ locale: 'ar', theme: 'dark' });
/** From 400px each purpose takes its own column, so purposes line up. */
export const EditableAt420: Story = live({ width: 420 });
export const EditableAt420RightToLeft: Story = live({ locale: 'ar', width: 420 });

/** The SPEC §7.6 E6 fallback: nodes, numbers and titles, nothing to move. */
export const ReadOnly: Story = {
  render: () => (
    <PlanSectionList
      locale="en"
      sections={planReadOnly('en', 'exact').sections}
      editable={false}
      onEdit={fn()}
    />
  ),
};
export const ReadOnlyRightToLeft: Story = {
  render: () => (
    <PlanSectionList
      locale="ar"
      sections={planReadOnly('ar', 'exact').sections}
      editable={false}
      onEdit={fn()}
    />
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** Two sections named alike: both titles wear the Amber wavy underline. */
export const DuplicateNames: Story = {
  render: () => {
    const view = planDuplicateTitle('en');
    return (
      <PlanSectionList
        locale="en"
        sections={view.sections}
        editable
        duplicates={duplicateSectionKeys({ subject: view.subject, sections: view.sections })}
        onEdit={fn()}
      />
    );
  },
};

/** Alt+↓ twice: the row moves down two places and its handle keeps focus. */
export const ReorderWithKeyboard: Story = {
  ...live(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'Reorder Why us' }).focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}{Alt>}{ArrowDown}{/Alt}');
    await expect(canvas.getAllByRole('listitem')[5]).toHaveTextContent('Why us');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Reorder Why us' })).toHaveFocus(),
    );
  },
};

/** A drag of the handle: the lifted row follows the pointer; the rows it passes make way. */
export const DragToReorder: Story = {
  ...live(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole('button', { name: 'Reorder Services' });
    const box = handle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { x, y } },
      { coords: { x, y: y + 40 } },
      { coords: { x, y: y + 70 } },
      { keys: '[/MouseLeft]', coords: { x, y: y + 70 } },
    ]);
    await expect(canvas.getAllByRole('listitem')[4]).toHaveTextContent('Services');
  },
};
