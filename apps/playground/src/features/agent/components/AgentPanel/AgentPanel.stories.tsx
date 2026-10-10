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
import type { Locale } from '../../model/view-types';
import {
  fakeViewState,
  useFakeController,
  type FakeCall,
  type FakeScenario,
} from '../../testing/fake-controller';

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

/* ── §3.2 Composing ────────────────────────────────────────────────────────── */

export const Composing: Story = story('composing');
export const Mention: Story = story('mention');

/* ── §3.3 to §3.5 A page build ─────────────────────────────────────────────── */

export const Skeleton: Story = story('skeleton');
export const Building: Story = story('building');
/** SPEC §3.15: the same build in Arabic, mirrored by logical properties. */
export const BuildingArabic: Story = story('building', 'ar');
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
