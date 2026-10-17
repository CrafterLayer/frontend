import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import { jobsLabels } from '../../copy/jobs-labels';
import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { Locale } from '../../model/view-types';
import { fakeJobsView, SAMPLE_JOBS_AR, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';
import {
  fakeViewState,
  useFakeController,
  type FakeCall,
  type FakeScenario,
} from '../../testing/fake-controller';
import {
  createFakeCheckpoints,
  SAMPLE_CHECKPOINTS,
  SAMPLE_CHECKPOINTS_AR,
  SAMPLE_NOTES,
  SAMPLE_NOTES_AR,
  SAMPLE_SKILLS,
  SAMPLE_SKILLS_AR,
  seededStorage,
} from '../../testing/knowledge-fixtures';

import { AgentPanel, type AgentPanelPresentation } from './AgentPanel';

/* ── The editor column the panel sits in, and the status bar under it ─────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
}

/** The editor's chrome around the panel: its theme and ground, an English (LTR) editor. */
const inEditor: Decorator = (Story, { parameters }) => {
  const { theme = 'light' } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="bldr-root"
      data-bldr-theme={theme}
      style={{ padding: 'var(--bldr-space-3xl)', background: 'var(--bldr-ground)' }}
    >
      <Story />
    </div>
  );
};

interface PanelStoryProps {
  /** The SPEC §3 state the fake controller starts in. */
  readonly scenario: FakeScenario;
  readonly locale: Locale;
  /** The panel's width: 320 by default, 420 for the wide frames (SPEC §3.14). */
  readonly width?: number;
  /** Start hidden: the status bar's pill speaks for the panel. */
  readonly hidden?: boolean;
  readonly presentation?: AgentPanelPresentation;
  /** Short editor windows must keep the conversation and composer reachable. */
  readonly height?: number;
}

/** The story's action log: every controller call, by name and arguments. */
const logCall = fn<(call: FakeCall) => void>().mockName('controller');

/**
 * The panel over the live fake controller, in a 720px editor column with a status bar
 * under it. Typing, the menus, Build, Apply, Stop, Improve and the questions move the
 * state as the real controller would; the separator resizes the column; hiding the panel
 * puts its pill in the bar, and the pill opens it again.
 */
function PanelStory({
  scenario,
  locale,
  width = 320,
  hidden = false,
  presentation = 'dock',
  height = 720,
}: PanelStoryProps) {
  // Measured to now, so a live run's clock reads its elapsed time rather than days.
  const [initial] = useState(() => fakeViewState(scenario, locale, { now: Date.now() }));
  const controller = useFakeController(initial, { locale, onCall: logCall });
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(!hidden);
  const [panelWidth, setPanelWidth] = useState(width);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        blockSize: height,
        inlineSize: 'max-content',
        minInlineSize: 480,
        border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
        background: 'var(--bldr-surface-tint)',
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'start', minBlockSize: 0 }}>
        <AgentPanel
          controller={controller}
          visible={visible}
          width={panelWidth}
          onWidthChange={setPanelWidth}
          presentation={presentation}
          pillContainer={bar}
          onOpen={() => {
            setVisible(true);
          }}
          onClose={() => {
            setVisible(false);
          }}
        />
      </div>
      <div
        role="region"
        aria-label="Editor status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--bldr-space-md)',
          blockSize: 'var(--bldr-statusbar-height)',
          paddingInline: 'var(--bldr-space-md)',
          borderBlockStart: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
          background: 'var(--bldr-surface)',
          color: 'var(--bldr-panel-muted)',
          fontSize: 'var(--bldr-font-size-caption)',
        }}
      >
        <span ref={setBar} style={{ display: 'contents' }} />
        {visible ? null : (
          <button
            type="button"
            onClick={() => {
              setVisible(true);
            }}
          >
            Show the panel
          </button>
        )}
      </div>
    </div>
  );
}

const meta = {
  title: 'Agent/Panel/AgentPanel',
  component: PanelStory,
  parameters: { layout: 'centered' },
  args: { scenario: 'empty', locale: 'en' },
  decorators: [inEditor],
} satisfies Meta<typeof PanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── What every frame must be (SPEC §4.1, §4.2, §6.1) ─────────────────────── */

function panelOf(canvasElement: HTMLElement, locale: Locale): HTMLElement {
  return within(canvasElement).getByRole('region', { name: t(locale, 'header.name') });
}

/** One region named by the header, in the UI language, and exactly one live region. */
async function expectShell(canvasElement: HTMLElement, locale: Locale): Promise<HTMLElement> {
  const panel = panelOf(canvasElement, locale);
  await expect(panel).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  await expect(panel).toHaveAttribute('lang', locale);
  await expect(
    panel.querySelectorAll('[aria-live], [role="status"], [role="log"], [role="alert"]'),
  ).toHaveLength(1);
  // The header is one line of 44px; the composer sits at the bottom of the column.
  const header = panel.querySelector('.ck-agent-header');
  await expect(header?.getBoundingClientRect().height).toBe(44);
  return panel;
}

function story(
  scenario: FakeScenario,
  locale: Locale = 'en',
  extra: Partial<Pick<Story, 'parameters'>> & { readonly width?: number } = {},
): Story {
  return {
    args: { scenario, locale, ...(extra.width === undefined ? {} : { width: extra.width }) },
    ...(extra.parameters === undefined ? {} : { parameters: extra.parameters }),
    play: async ({ canvasElement }) => {
      await expectShell(canvasElement, locale);
    },
  };
}

const DARK = { panel: { theme: 'dark' } } as const;

/* ── §3.1 Empty ────────────────────────────────────────────────────────────── */

export const Empty: Story = story('empty');
export const EmptyArabic: Story = story('empty', 'ar');
export const EmptyArabicDark: Story = story('empty', 'ar', { parameters: DARK });
export const EmptyHasContent: Story = story('emptyHasContent');
/** creative agent (2026-10-12): the creative starters under the page starters, free code on. */
export const EmptyCreative: Story = story('emptyCreative', 'en', { width: 420 });
export const EmptyCreativeArabic: Story = story('emptyCreative', 'ar', { width: 420 });

/* ── §3.2 Composing ────────────────────────────────────────────────────────── */

export const Composing: Story = story('composing');
export const Mention: Story = story('mention');

/* ── §3.3 to §3.5 A page build ─────────────────────────────────────────────── */

export const Skeleton: Story = story('skeleton');
export const Building: Story = story('building');
/** SPEC §3.15: the same build in Arabic, mirrored by logical properties. */
export const BuildingArabic: Story = story('building', 'ar');
/** creative agent (2026-10-12): a platformer build carries its creative brief. */
export const BuildingCreative: Story = story('buildingCreative', 'en', { width: 420 });
export const BuildingCreativeArabic: Story = story('buildingCreative', 'ar', { width: 420 });
export const BuildingCreativeArabicDark: Story = story('buildingCreative', 'ar', {
  width: 420,
  parameters: DARK,
});
export const BuildingArabicDark: Story = story('building', 'ar', { parameters: DARK });
/** SPEC §3.14: the panel at 420, where rows gain their state words. */
export const BuildingAt420: Story = story('building', 'en', { width: 420 });
export const Blocked: Story = story('blocked');
export const Built: Story = story('built');
export const BuiltArabic: Story = story('built', 'ar');
export const BuiltPartial: Story = story('builtPartial');

/* ── §3.6 Edits ────────────────────────────────────────────────────────────── */

export const EditRunning: Story = story('editRunning');
export const EditDone: Story = story('editDone');
export const EditDoneArabic: Story = story('editDone', 'ar');

/* ── §3.7 Plan, §3.8 Ask ───────────────────────────────────────────────────── */

export const PlanReady: Story = story('planReady');
export const PlanReadyArabic: Story = story('planReady', 'ar');
export const PlanApproval: Story = story('planApproval');
export const Proposal: Story = story('proposal');
export const ProposalArabicDark: Story = story('proposal', 'ar', { parameters: DARK });

/* ── §3.9 Queue, §3.10 Stop, §3.11 Error ───────────────────────────────────── */

export const Queued: Story = story('queued');
export const Stopping: Story = story('stopping');
export const Stopped: Story = story('stopped');
export const Failed: Story = story('error');
export const FailedArabic: Story = story('error', 'ar');

/* ── §3.12 Long, §3.13 Conversations ───────────────────────────────────────── */

export const Long: Story = story('long');

export const ShortViewport: Story = {
  args: { scenario: 'long', height: 400, width: 288 },
  play: async ({ canvasElement }) => {
    const panel = await expectShell(canvasElement, 'en');
    const input = within(panel).getByRole('combobox', { name: t('en', 'input.aria') });
    await waitFor(async () => {
      const thread = panel.querySelector('.ck-agent-thread__scroller');
      if (!(thread instanceof HTMLElement)) throw new Error('No conversation viewport');
      await expect(thread.getBoundingClientRect().height).toBeGreaterThan(80);
      await expect(input.getBoundingClientRect().height).toBeLessThanOrEqual(48);
      await expect(input.getBoundingClientRect().bottom).toBeLessThan(
        panel.getBoundingClientRect().bottom,
      );
    });
  },
};

export const ShortViewportClarifyingArabic: Story = {
  args: { scenario: 'clarifyAsking', locale: 'ar', height: 400, width: 288 },
  parameters: DARK,
  play: async ({ canvasElement }) => {
    const panel = await expectShell(canvasElement, 'ar');
    await waitFor(async () => {
      const auxiliary = panel.querySelector('.ck-agent-composer__auxiliary');
      const toolbar = panel.querySelector('.ck-agent-toolbar');
      if (!(auxiliary instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) {
        throw new Error('No auxiliary scroller or toolbar');
      }
      await expect(auxiliary.clientHeight).toBeLessThanOrEqual(panel.clientHeight * 0.25 + 1);
      await expect(toolbar.getBoundingClientRect().bottom).toBeLessThan(
        panel.getBoundingClientRect().bottom,
      );
    });
  },
};

export const Conversations: Story = {
  args: { scenario: 'conversations', locale: 'en' },
  play: async ({ canvasElement }) => {
    const panel = await expectShell(canvasElement, 'en');
    const button = within(panel).getByRole('button', { name: t('en', 'header.conversations') });
    await userEvent.click(button);
    await waitFor(async () => {
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  },
};

/* ── Improve my request, and asking before guessing (owner request) ────────── */

export const Enhancing: Story = story('enhancing');
export const Enhanced: Story = story('enhanced');
export const EnhancedArabic: Story = story('enhanced', 'ar');
export const ClarifyAsking: Story = story('clarifyAsking');
export const ClarifyAskingArabic: Story = story('clarifyAsking', 'ar');
export const ClarifyRewriting: Story = story('clarifyRewriting');

/* ── Hidden: the pill in the status bar (SPEC §4.20) ───────────────────────── */

export const HiddenBuilding: Story = {
  args: { scenario: 'building', locale: 'ar', hidden: true },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('region', { name: 'Editor status' });
    const pill = within(bar).getByRole('button', { name: /أبو غضب يبني الصفحة/u });
    await expect(pill).toBeVisible();
    await expect(within(bar).getByRole('button', { name: t('ar', 'stop') })).toBeVisible();
    await userEvent.click(pill);
    await expectShell(canvasElement, 'ar');
    await expect(bar.querySelector('.ck-agent-pill')).toBeNull();
  },
};

/* ── The resize separator (SPEC §4.1) ──────────────────────────────────────── */

export const Resize: Story = {
  args: { scenario: 'built', locale: 'en' },
  play: async ({ canvasElement }) => {
    const panel = await expectShell(canvasElement, 'en');
    const separator = within(canvasElement).getByRole('separator', {
      name: t('en', 'panel.resize'),
    });
    separator.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(async () => {
      await expect(separator).toHaveAttribute('aria-valuenow', '336');
    });
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await waitFor(async () => {
      await expect(panel.getBoundingClientRect().width).toBe(384);
    });
  },
};

/* ── §3.16 The phone sheet ─────────────────────────────────────────────────── */

export const PhoneSheet: Story = {
  args: { scenario: 'building', locale: 'ar', presentation: 'sheet' },
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const sheet = await page.findByRole('dialog', { name: t('ar', 'header.name') });
    await expect(
      within(sheet).getByRole('button', { name: t('ar', 'sheet.showPage') }),
    ).toBeVisible();
  },
};

/* ── Skills & memory (2026-10-12) ──────────────────────────────────────────── */

interface KnowledgePanelStoryProps {
  readonly scenario: FakeScenario;
  readonly locale: Locale;
  /** Give the panel background jobs too (a hand-built view over the sample jobs). */
  readonly withJobs?: boolean;
}

/**
 * The panel given its knowledge, as LiveAgentPanel gives it: the person's skills and the
 * project memory over the real stores (seeded), and an in-memory checkpoint port. The
 * header then draws Skills & memory, which opens KnowledgePopover inside the panel.
 */
function KnowledgePanelStory({ scenario, locale, withJobs = false }: KnowledgePanelStoryProps) {
  const arabic = locale === 'ar';
  const [initial] = useState(() => fakeViewState(scenario, locale, { now: Date.now() }));
  const controller = useFakeController(initial, { locale, onCall: logCall });
  const [storage] = useState(() =>
    seededStorage(
      arabic ? SAMPLE_SKILLS_AR : SAMPLE_SKILLS,
      arabic ? SAMPLE_NOTES_AR : SAMPLE_NOTES,
    ),
  );
  const [checkpoints] = useState(() =>
    createFakeCheckpoints(arabic ? SAMPLE_CHECKPOINTS_AR : SAMPLE_CHECKPOINTS),
  );
  const { view } = useAgentKnowledge({ storage, checkpoints });
  const [jobs] = useState(() =>
    withJobs
      ? fakeJobsView(arabic ? { jobs: SAMPLE_JOBS_AR, pages: SAMPLE_PAGES_AR } : {})
      : undefined,
  );
  const [panelWidth, setPanelWidth] = useState(320);
  return (
    <div style={{ display: 'grid', justifyItems: 'start', blockSize: 720, minInlineSize: 480 }}>
      <AgentPanel
        controller={controller}
        knowledge={view}
        jobs={jobs}
        width={panelWidth}
        onWidthChange={setPanelWidth}
      />
    </div>
  );
}

function withKnowledge(locale: Locale, extra: Partial<Pick<Story, 'parameters'>> = {}): Story {
  return {
    args: { scenario: 'built', locale },
    ...extra,
    render: (args) => <KnowledgePanelStory scenario={args.scenario} locale={args.locale} />,
    play: async ({ canvasElement }) => {
      const panel = await expectShell(canvasElement, locale);
      const title = knowledgeLabels(locale).title;
      const button = within(panel).getByRole('button', { name: title });
      await userEvent.click(button);
      const popover = await within(panel).findByRole('dialog', { name: title });
      await expect(popover).toBeVisible();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(within(popover).getAllByRole('tab')).toHaveLength(3);
    },
  };
}

/** The header's Skills & memory opens the popover inside the panel, on the Skills tab. */
export const WithKnowledge: Story = withKnowledge('en');
export const WithKnowledgeRightToLeft: Story = withKnowledge('ar');
export const WithKnowledgeDark: Story = withKnowledge('en', { parameters: DARK });

function withJobs(locale: Locale, extra: Partial<Pick<Story, 'parameters'>> = {}): Story {
  return {
    args: { scenario: 'built', locale },
    ...extra,
    render: (args) => (
      <KnowledgePanelStory scenario={args.scenario} locale={args.locale} withJobs />
    ),
    play: async ({ canvasElement }) => {
      const panel = await expectShell(canvasElement, locale);
      const title = jobsLabels(locale).title;
      await userEvent.click(within(panel).getByRole('button', { name: title }));
      const dialog = await within(panel).findByRole('dialog', { name: title });
      // It fades in: visible once its enter animation has run.
      await waitFor(() => expect(dialog).toBeVisible());
      await expect(within(dialog).getAllByRole('article')).toHaveLength(4);
    },
  };
}

/** Background jobs (2026-10-12): the header's button opens the jobs list inside the panel. */
export const WithBackgroundJobs: Story = withJobs('en');
export const WithBackgroundJobsRightToLeft: Story = withJobs('ar');
export const WithBackgroundJobsDark: Story = withJobs('en', { parameters: DARK });

/** "/" in the real composer opens the skills list above it; "/brand" + Enter inserts that skill inline
    (a bare "/" lists the commands — Remember, Checkpoint… — first). */
export const SlashMenu: Story = {
  args: { scenario: 'empty', locale: 'en' },
  render: (args) => <KnowledgePanelStory scenario={args.scenario} locale={args.locale} />,
  play: async ({ canvasElement }) => {
    const panel = await expectShell(canvasElement, 'en');
    const slash = knowledgeLabels('en').slash;
    const input = within(panel).getByRole('combobox', { name: t('en', 'input.aria') });
    await userEvent.type(input, '/brand');
    const list = await within(panel).findByRole('listbox', { name: slash.label });
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute('aria-controls', list.id);
    await userEvent.keyboard('{Enter}');
    await expect(
      within(panel).queryByRole('group', { name: 'Skills for the next message' }),
    ).toBeNull();
    await expect(input).toHaveValue('/brand-voice ');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  },
};
