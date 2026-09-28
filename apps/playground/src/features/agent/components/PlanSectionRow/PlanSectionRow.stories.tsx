import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale, PlanSectionView } from '../../model/view-types';
import { planReady } from '../../testing/wp-13-decisions-fixtures';
import '../PlanSectionList/PlanSectionList.css';

import { PlanSectionRow, type PlanSectionRowProps } from './PlanSectionRow';

/* ── The panel's root, as AgentPanel draws it, inside a plan card's Sheet ───── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, the row on a card's Sheet inside the list it takes its
 * columns from (subgrid), with a row above and below so the pencil runs through its node.
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
        minBlockSize: 240,
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

function sectionsOf(locale: Locale): readonly PlanSectionView[] {
  return planReady(locale).sections;
}

/** Rows 4 to 6 of the dental plan, the middle one the row under study. */
function Rows({
  locale,
  editable = true,
  row = {},
}: {
  readonly locale: Locale;
  readonly editable?: boolean;
  readonly row?: Partial<PlanSectionRowProps>;
}) {
  const sections = sectionsOf(locale).slice(3, 6);
  return (
    <ol
      role="list"
      className="ck-agent-plan-list"
      aria-label={t(locale, 'plan.sections', { n: 8 })}
    >
      {sections.map((section, index) => (
        <PlanSectionRow
          key={section.key}
          locale={locale}
          section={section}
          position={index + 4}
          editable={editable}
          canMoveUp
          canMoveDown
          canRemove
          onRename={fn()}
          onMove={fn()}
          onRemove={fn()}
          {...(index === 1 ? row : {})}
        />
      ))}
    </ol>
  );
}

const meta = {
  title: 'Agent/Decisions/PlanSectionRow',
  component: PlanSectionRow,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    section: sectionsOf('en')[4] as PlanSectionView,
    position: 5,
    editable: true,
    canMoveUp: true,
    canMoveDown: true,
    canRemove: true,
    onRename: fn(),
    onMove: fn(),
    onRemove: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof PlanSectionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(frame: Frame = {}, row: Partial<PlanSectionRowProps> = {}, editable = true): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Rows locale={locale} row={row} editable={editable} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

/** At rest: node, number, title; the handle and [⋯] quiet in Slate at the inline end. */
export const Default: Story = story();
export const Dark: Story = story({ theme: 'dark' });
export const RightToLeft: Story = story({ locale: 'ar' });
export const RightToLeftDark: Story = story({ locale: 'ar', theme: 'dark' });
/** From 400px the purpose sits inline in Slate. */
export const WithPurposeAt420: Story = story({ width: 420 });
export const WithPurposeAt420RightToLeft: Story = story({ locale: 'ar', width: 420 });

/** Rename in place: the field's text starts exactly where the title's did. */
export const Renaming: Story = {
  ...story(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.dblClick(canvas.getByText('Doctors'));
    await expect(canvas.getByRole('textbox', { name: 'Rename Doctors' })).toHaveFocus();
  },
};
export const RenamingRightToLeft: Story = {
  ...story({ locale: 'ar' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.dblClick(canvas.getByText('الأطباء'));
  },
};

/** The row menu: Rename, Move up, Move down, then Remove section. */
export const MenuOpen: Story = {
  ...story(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Options for Doctors' }),
    );
  },
};

/** At two sections Remove stays reachable, refused, with its reason under it. */
export const RemoveRefusedAtFloor: Story = {
  ...story({}, { canRemove: false, removeReason: t('en', 'plan.min') }),
  play: MenuOpen.play,
};

/** A name another section shares: the Amber wavy underline, and words on the handle. */
export const DuplicateName: Story = story({}, { duplicate: true });

/** Lifted under the pointer mid-drag: the Sheet and e2's shadow. */
export const Lifted: Story = story({}, { drag: { offset: -8, lifted: true } });

/** The SPEC §7.6 E6 fallback: nothing to move or rename. */
export const ReadOnly: Story = story({}, {}, false);
export const ReadOnlyRightToLeft: Story = story({ locale: 'ar' }, {}, false);
