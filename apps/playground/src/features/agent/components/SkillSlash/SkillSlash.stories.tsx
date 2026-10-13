import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import { useKnowledgeUi } from '../../hooks/use-knowledge-ui';
import type { Locale } from '../../model/view-types';
import {
  SAMPLE_NOTES,
  SAMPLE_NOTES_AR,
  SAMPLE_SKILLS,
  SAMPLE_SKILLS_AR,
  createFakeCheckpoints,
  seededStorage,
} from '../../testing/knowledge-fixtures';

import { SkillSlash } from './SkillSlash';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The panel's dock, drawn as AgentPanel draws its root: theme, the story's language and
 * direction, the `agent` inline-size container, and room above the composer for the list,
 * which floats up from it.
 */
const inDock: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 360 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        inlineSize: width,
        blockSize: 480,
        boxSizing: 'border-box',
        padding: 'var(--bldr-space-md)',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <Story />
    </div>
  );
};

interface SlashProps {
  readonly locale: Locale;
  readonly onManage: () => void;
  /** Offer the commands, run as the panel runs them (`useKnowledgeUi`, a fake page keeper). */
  readonly commands?: boolean;
}

/**
 * The list over the real knowledge hook (`useAgentKnowledge`, seeded), above a textarea
 * wired as the Composer wires its own: the `@` list's combobox, which SkillSlash also uses.
 */
function Slash({ locale, onManage, commands = false }: SlashProps) {
  const arabic = locale === 'ar';
  const [storage] = useState(() =>
    seededStorage(
      arabic ? SAMPLE_SKILLS_AR : SAMPLE_SKILLS,
      arabic ? SAMPLE_NOTES_AR : SAMPLE_NOTES,
    ),
  );
  const [checkpoints] = useState(() => createFakeCheckpoints([]));
  const { view } = useAgentKnowledge({ storage, checkpoints });
  const ui = useKnowledgeUi(view, locale);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement | null>(null);
  return (
    <>
      <SkillSlash
        locale={locale}
        skills={view.skills}
        draft={draft}
        onDraftChange={setDraft}
        inputRef={input}
        onManage={onManage}
        commands={commands ? ui.commands : undefined}
        onCommand={commands ? ui.onCommand : undefined}
      />
      <textarea
        ref={input}
        role="combobox"
        aria-label={t(locale, 'input.aria')}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={false}
        dir="auto"
        rows={2}
        value={draft}
        placeholder={t(locale, 'input.aria')}
        style={{
          boxSizing: 'border-box',
          inlineSize: '100%',
          padding: 'var(--bldr-space-sm)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
          borderRadius: 'var(--bldr-radius-lg)',
          background: 'var(--bldr-surface)',
          color: 'var(--bldr-panel-text)',
          font: 'inherit',
          resize: 'none',
        }}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </>
  );
}

const EN = knowledgeLabels('en').slash;
const AR = knowledgeLabels('ar').slash;

const meta = {
  title: 'Agent/Knowledge/SkillSlash',
  component: Slash,
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          {
            // The stand-in textarea is the Composer's ARIA 1.2 combobox (SPEC §4.17), which
            // axe flags wherever the Composer renders; every other role here is checked.
            id: 'aria-allowed-role',
            selector: '[role]:not(textarea)',
          },
        ],
      },
    },
  },
  args: { locale: 'en', onManage: fn() },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inDock],
} satisfies Meta<typeof Slash>;

export default meta;
type Story = StoryObj<typeof meta>;

const RTL = { args: { locale: 'ar' }, globals: { direction: 'rtl' } } as const;

/** Types into the stand-in composer. */
async function typeInto(
  canvasElement: HTMLElement,
  locale: Locale,
  text: string,
): Promise<HTMLElement> {
  const field = within(canvasElement).getByRole('combobox', { name: t(locale, 'input.aria') });
  await userEvent.type(field, text);
  return field;
}

function listOf(canvasElement: HTMLElement, locale: Locale): HTMLElement {
  return within(canvasElement).getByRole('listbox', {
    name: locale === 'ar' ? AR.label : EN.label,
  });
}

function opened(locale: Locale): NonNullable<Story['play']> {
  return async ({ canvasElement }) => {
    const field = await typeInto(canvasElement, locale, '/');
    const list = listOf(canvasElement, locale);
    await expect(list).toBeVisible();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await expect(field).toHaveAttribute('aria-controls', list.id);
  };
}

/** "/" at the start: the person's skills, the built-ins, and Manage last. */
export const Open: Story = { play: opened('en') };

export const Dark: Story = { parameters: { panel: { theme: 'dark' } }, play: opened('en') };

export const RightToLeft: Story = { ...RTL, play: opened('ar') };

export const DarkRightToLeft: Story = {
  ...RTL,
  parameters: { panel: { theme: 'dark' } },
  play: opened('ar'),
};

/** "/brand": the words narrow the list; Brand voice first and active. */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    await typeInto(canvasElement, 'en', 'Rewrite the hero /brand');
    const [first] = within(listOf(canvasElement, 'en')).getAllByRole('option');
    await expect(first).toHaveTextContent('Brand voice');
    await expect(first).toHaveAttribute('aria-selected', 'true');
  },
};

/** Nothing by that name: one quiet line, and Manage. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    await typeInto(canvasElement, 'en', '/zzzz');
    await expect(within(canvasElement).getByText(EN.empty)).toBeVisible();
  },
};

/** Choices remain inline, alongside the words that will be sent. */
export const InlineSelections: Story = {
  play: async ({ canvasElement }) => {
    const field = await typeInto(canvasElement, 'en', '/');
    await userEvent.keyboard('{Enter}');
    await userEvent.type(field, 'Write the menu page /');
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('/house-style /brand-voice Write the menu page ');
    await expect(within(canvasElement).queryByRole('group')).toBeNull();
  },
};

/** The UI permits more than three choices; the engine still enforces its skill budget. */
export const FourSelections: Story = {
  play: async ({ canvasElement }) => {
    const field = await typeInto(canvasElement, 'en', '/');
    await userEvent.keyboard('{Enter}');
    for (let pick = 0; pick < 3; pick += 1) {
      await userEvent.type(field, '/');
      await userEvent.keyboard('{Enter}');
    }
    await expect((field as HTMLTextAreaElement).value.match(/\/[^\s]+/gu)).toHaveLength(4);
  },
};

export const InlineRightToLeft: Story = {
  ...RTL,
  play: async ({ canvasElement }) => {
    const field = await typeInto(canvasElement, 'ar', '/اسلوب');
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('/أسلوب-المنزل ');
    await expect(within(canvasElement).queryByRole('group')).toBeNull();
  },
};

/** The commands: Remember, Save a checkpoint and New skill head the list. */
export const Commands: Story = {
  args: { commands: true },
  play: async ({ canvasElement }) => {
    await typeInto(canvasElement, 'en', '/');
    const options = within(listOf(canvasElement, 'en')).getAllByRole('option');
    await expect(options[0]).toHaveTextContent(EN.commands.remember.name);
    await expect(options[1]).toHaveTextContent(EN.commands.checkpoint.name);
    await expect(options[2]).toHaveTextContent(EN.commands.skill.name);
  },
};

/** "/remember" after words: they go to the project memory, and the status line says so. */
export const Remembered: Story = {
  args: { commands: true },
  play: async ({ canvasElement }) => {
    const field = await typeInto(canvasElement, 'en', 'Our colour is forest green /rem');
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('');
    await expect(await within(canvasElement).findByRole('status')).toHaveTextContent(EN.remembered);
  },
};

export const CommandsRightToLeft: Story = {
  ...RTL,
  args: { locale: 'ar', commands: true },
  play: async ({ canvasElement }) => {
    await typeInto(canvasElement, 'ar', 'لوننا أخضر /تذك');
    const [first] = within(listOf(canvasElement, 'ar')).getAllByRole('option');
    await expect(first).toHaveTextContent(AR.commands.remember.name);
  },
};
