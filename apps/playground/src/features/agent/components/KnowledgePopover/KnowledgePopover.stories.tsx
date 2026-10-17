import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import { knowledgeLabels, type KnowledgeTab } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { Locale } from '../../model/view-types';
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
import { AgentHeader } from '../AgentHeader';
// The phone sheet's density (44px targets, 16px input) is set on `.ck-agent-sheet`.
import '../AgentSheet/AgentSheet.css';
import { AgentTooltipProvider } from '../IconButton';

import { KnowledgePopover } from './KnowledgePopover';

/* ── The panel the modal opens from ───────────────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  /** 360 (a docked panel), or 390 (the phone sheet). */
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: a region named أبو غضب
 * with the theme, the story's language and direction, and the `agent` inline-size
 * container. The popover mounts inside it (it reads its portal scope off the header's
 * button), so it takes the panel's theme, direction and width. The phone frame is the
 * sheet's full face: positioned, so the sheet's page covers it.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const sheet = args['presentation'] === 'sheet';
  const { theme = 'light', width = sheet ? 390 : 360 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className={sheet ? 'ck-agent ck-agent-sheet' : 'ck-agent'}
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        inlineSize: width,
        blockSize: sheet ? 640 : 600,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </section>
  );
};

interface KnowledgeProps {
  readonly locale: Locale;
  readonly presentation?: 'modal' | 'sheet';
  readonly initialTab?: KnowledgeTab;
  /** `false`: the host keeps no pages, so there is no Checkpoints tab. */
  readonly withCheckpoints?: boolean;
  readonly clipboard: (text: string) => Promise<void>;
}

/**
 * The header and the modal, wired as AgentPanel wires them: the header's Skills & memory
 * button opens the modal and takes the focus back, over the real stores (`useAgentKnowledge`,
 * seeded) and an in-memory checkpoint port.
 */
function Knowledge({
  locale,
  presentation = 'modal',
  initialTab,
  withCheckpoints = true,
  clipboard,
}: KnowledgeProps) {
  const arabic = locale === 'ar';
  const [storage] = useState(() =>
    seededStorage(
      arabic ? SAMPLE_SKILLS_AR : SAMPLE_SKILLS,
      arabic ? SAMPLE_NOTES_AR : SAMPLE_NOTES,
    ),
  );
  const [port] = useState(() =>
    withCheckpoints
      ? createFakeCheckpoints(arabic ? SAMPLE_CHECKPOINTS_AR : SAMPLE_CHECKPOINTS)
      : undefined,
  );
  const { view } = useAgentKnowledge({ storage, checkpoints: port });
  const [open, setOpen] = useState(true);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const popoverId = useId();
  const sheet = presentation === 'sheet';
  return (
    <>
      <AgentHeader
        locale={locale}
        face={{ mood: 'idle' }}
        scrolled={false}
        running={false}
        conversationsOpen={false}
        onConversations={fn()}
        onNewConversation={fn()}
        knowledge={{
          label: knowledgeLabels(locale).title,
          open,
          onToggle: () => {
            setOpen((was) => !was);
          },
          controls: popoverId,
        }}
        knowledgeRef={anchor}
        {...(sheet ? { onClose: fn(), onShowPage: fn() } : {})}
      />
      <KnowledgePopover
        id={popoverId}
        locale={locale}
        knowledge={view}
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchor}
        presentation={presentation}
        initialTab={initialTab}
        clipboard={clipboard}
      />
    </>
  );
}

/* ── What every opening must be ───────────────────────────────────────────── */

async function placeOf(canvasElement: HTMLElement, locale: Locale): Promise<HTMLElement> {
  const canvas = within(canvasElement);
  const sheet = canvasElement.querySelector('[data-presentation="sheet"]') !== null;
  return waitFor(() =>
    canvas.getByRole(sheet ? 'region' : 'dialog', { name: knowledgeLabels(locale).title }),
  );
}

async function expectSelected(place: HTMLElement, name: string): Promise<HTMLElement> {
  const tab = within(place).getByRole('tab', { name });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  return tab;
}

const meta = {
  title: 'Agent/Knowledge/KnowledgePopover',
  component: Knowledge,
  parameters: { layout: 'centered' },
  args: { locale: 'en', clipboard: fn(() => Promise.resolve()) },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inPanel],
} satisfies Meta<typeof Knowledge>;

export default meta;
type Story = StoryObj<typeof meta>;

const DARK = { panel: { theme: 'dark' } } as const;
const RTL = { globals: { direction: 'rtl' } } as const;

function opening(locale: Locale, tab: KnowledgeTab = 'skills'): NonNullable<Story['play']> {
  const words = knowledgeLabels(locale);
  return async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, locale);
    // Mounted inside the panel, so it takes the panel's theme and direction.
    await expect(place.closest('.ck-agent')).not.toBeNull();
    await expect(place).toBeVisible();
    const selected = await expectSelected(place, words.tabs[tab]);
    await waitFor(() => expect(selected).toHaveFocus());
  };
}

/* ── The settings modal ───────────────────────────────────────────────────── */

/** Opened from the header: the Skills tab, focus on it. */
export const Skills: Story = { play: opening('en') };
export const SkillsDark: Story = { parameters: DARK, play: opening('en') };
export const SkillsRightToLeft: Story = { args: { locale: 'ar' }, ...RTL, play: opening('ar') };
export const SkillsDarkRightToLeft: Story = {
  args: { locale: 'ar' },
  parameters: DARK,
  ...RTL,
  play: opening('ar'),
};

/** The Memory tab. */
export const Memory: Story = { args: { initialTab: 'memory' }, play: opening('en', 'memory') };
export const MemoryRightToLeft: Story = {
  args: { locale: 'ar', initialTab: 'memory' },
  ...RTL,
  play: opening('ar', 'memory'),
};

/** The Checkpoints tab. */
export const Checkpoints: Story = {
  args: { initialTab: 'checkpoints' },
  play: opening('en', 'checkpoints'),
};
export const CheckpointsDark: Story = {
  args: { initialTab: 'checkpoints' },
  parameters: DARK,
  play: opening('en', 'checkpoints'),
};

/** The host keeps no pages: two tabs only. */
export const NoCheckpoints: Story = {
  args: { withCheckpoints: false },
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'en');
    await expect(within(place).getAllByRole('tab')).toHaveLength(2);
    await expect(within(place).queryByRole('tab', { name: 'Checkpoints' })).toBeNull();
  },
};

/** → moves to the next tab, End to the last, Home to the first; Esc closes to the button. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'en');
    await waitFor(() => expect(within(place).getByRole('tab', { name: 'Skills' })).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}');
    await expect(await expectSelected(place, 'Memory')).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(await expectSelected(place, 'Checkpoints')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(await expectSelected(place, 'Skills')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    const button = within(canvasElement).getByRole('button', { name: 'Skills & memory' });
    await waitFor(() => expect(button).toHaveFocus());
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  },
};

/** In Arabic the arrows mirror: ← moves on to Memory. */
export const KeyboardRightToLeft: Story = {
  args: { locale: 'ar' },
  ...RTL,
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'ar');
    await waitFor(() => expect(within(place).getByRole('tab', { name: 'المهارات' })).toHaveFocus());
    await userEvent.keyboard('{ArrowLeft}');
    await expect(await expectSelected(place, 'الذاكرة')).toHaveFocus();
  },
};

/* ── The phone sheet: a page of its own ───────────────────────────────────── */

export const Sheet: Story = {
  args: { presentation: 'sheet' },
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'en');
    await expect(place).toHaveAttribute('data-presentation', 'sheet');
    await expectSelected(place, 'Skills');
  },
};

export const SheetRightToLeft: Story = {
  args: { locale: 'ar', presentation: 'sheet', initialTab: 'memory' },
  ...RTL,
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'ar');
    await expectSelected(place, 'الذاكرة');
  },
};

export const SheetDark: Story = {
  args: { presentation: 'sheet', initialTab: 'checkpoints' },
  parameters: DARK,
  play: async ({ canvasElement }) => {
    const place = await placeOf(canvasElement, 'en');
    await expect(await within(place).findAllByRole('listitem')).toHaveLength(3);
  },
};
