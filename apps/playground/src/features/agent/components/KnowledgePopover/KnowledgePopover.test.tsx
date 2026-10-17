/**
 * KnowledgePopover (2026-10-12): "Skills & memory", the settings modal the header's button
 * opens, over the real stores (`useAgentKnowledge`, seeded) and an in-memory checkpoint port.
 *
 * Asserted by role and name: a dialog named by its title, mounted inside the panel in its
 * language and direction; three tabs (two when the host keeps no pages) whose arrows move
 * as tabs do, mirrored in Arabic, with Home and End; Close and Esc close and return focus
 * to the button by name. The phone sheet's page is a region of its own.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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

import { KnowledgePopover } from './KnowledgePopover';

beforeAll(() => {
  // Radix measures the popover and its tooltips; jsdom has no ResizeObserver. These tests
  // read names, roles and focus, never positions.
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

function stylesOf(...path: readonly string[]): string {
  return readFileSync(
    join(process.cwd(), 'src', 'features', 'agent', 'components', ...path),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//gu, '');
}

const STYLES = {
  'KnowledgePopover.css': stylesOf('KnowledgePopover', 'KnowledgePopover.css'),
  'knowledge-form.css': stylesOf('knowledge-form.css'),
};

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

interface HarnessProps {
  readonly locale?: Locale;
  readonly withCheckpoints?: boolean;
  readonly presentation?: 'modal' | 'sheet';
  readonly initialTab?: KnowledgeTab;
  readonly clipboard?: (text: string) => Promise<void>;
}

/**
 * The header's Skills & memory button and the popover, wired as AgentPanel wires them: the
 * button toggles it and anchors it; the panel root gives it its language and direction.
 */
function Harness({
  locale = 'en',
  withCheckpoints = true,
  presentation = 'modal',
  initialTab,
  clipboard,
}: HarnessProps) {
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
  return (
    <div className="ck-agent" lang={locale} dir={arabic ? 'rtl' : 'ltr'}>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {knowledgeLabels(locale).title}
      </button>
      <KnowledgePopover
        locale={locale}
        knowledge={view}
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchor}
        presentation={presentation}
        initialTab={initialTab}
        clipboard={clipboard}
      />
    </div>
  );
}

function anchorButton(locale: Locale = 'en'): HTMLElement {
  return screen.getByRole('button', { name: knowledgeLabels(locale).title });
}

async function thePopover(locale: Locale = 'en'): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('dialog', { name: knowledgeLabels(locale).title }));
}

function tabNamed(place: HTMLElement, name: string): HTMLElement {
  return within(place).getByRole('tab', { name });
}

function selectedTab(place: HTMLElement): HTMLElement | undefined {
  return within(place)
    .getAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true');
}

describe('KnowledgePopover', () => {
  it('opens as a dialog named Skills & memory, on the Skills tab', async () => {
    render(<Harness />);
    const popover = await thePopover();
    expect(popover).toHaveAttribute('data-presentation', 'modal');
    expect(within(popover).getByRole('heading', { name: 'Skills & memory' })).toBeInTheDocument();
    expect(within(popover).getByRole('tablist', { name: 'Skills & memory' })).toBeInTheDocument();
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Skills', 'Memory', 'Checkpoints']);
    const skills = tabNamed(popover, 'Skills');
    expect(skills).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(skills).toHaveFocus());
    const panel = within(popover).getByRole('tabpanel', { name: 'Skills' });
    expect(within(panel).getByRole('switch', { name: 'Use Brand voice' })).toBeInTheDocument();
  });

  it('mounts inside the panel, in its language and direction', async () => {
    render(<Harness />);
    const popover = await thePopover();
    expect(popover.closest('.ck-agent')).not.toBeNull();
    expect(popover).toHaveAttribute('lang', 'en');
    expect(popover).toHaveAttribute('dir', 'ltr');
  });

  it('gives the tabs one tab stop, and the arrows, Home and End move it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const popover = await thePopover();
    const [skills, memory, checkpoints] = within(popover).getAllByRole('tab');
    await waitFor(() => expect(skills).toHaveFocus());
    expect(
      within(popover)
        .getAllByRole('tab')
        .filter((tab) => tab.tabIndex === 0),
    ).toEqual([skills]);
    await user.keyboard('{ArrowRight}');
    expect(memory).toHaveFocus();
    expect(memory).toHaveAttribute('aria-selected', 'true');
    expect(memory).toHaveAttribute('tabindex', '0');
    expect(skills).toHaveAttribute('tabindex', '-1');
    expect(
      within(within(popover).getByRole('tabpanel', { name: 'Memory' })).getByRole('textbox', {
        name: 'Something to remember',
      }),
    ).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(checkpoints).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(skills).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(checkpoints).toHaveFocus();
    await user.keyboard('{Home}');
    expect(skills).toHaveFocus();
    expect(selectedTab(popover)).toBe(skills);
    await user.keyboard('{End}');
    expect(checkpoints).toHaveFocus();
    expect(
      await within(popover).findByRole('button', {
        name: 'Restore the page to “Before the new menu”',
      }),
    ).toBeInTheDocument();
  });

  it('mirrors the arrows in Arabic: Left moves on, Right moves back', async () => {
    const user = userEvent.setup();
    render(<Harness locale="ar" />);
    const popover = await thePopover('ar');
    expect(popover).toHaveAttribute('dir', 'rtl');
    expect(popover).toHaveAttribute('lang', 'ar');
    const skills = tabNamed(popover, AR.tabs.skills);
    await waitFor(() => expect(skills).toHaveFocus());
    await user.keyboard('{ArrowLeft}');
    expect(tabNamed(popover, 'الذاكرة')).toHaveFocus();
    expect(selectedTab(popover)).toBe(tabNamed(popover, 'الذاكرة'));
    await user.keyboard('{ArrowRight}');
    expect(skills).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabNamed(popover, 'نقاط الحفظ')).toHaveFocus();
    expect(within(popover).getByRole('button', { name: 'إغلاق' })).toBeInTheDocument();
  });

  it('draws no Checkpoints tab when the host keeps no pages', async () => {
    const user = userEvent.setup();
    render(<Harness withCheckpoints={false} />);
    const popover = await thePopover();
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Skills', 'Memory']);
    expect(within(popover).queryByRole('tab', { name: 'Checkpoints' })).toBeNull();
    await waitFor(() => expect(tabNamed(popover, 'Skills')).toHaveFocus());
    await user.keyboard('{End}');
    expect(tabNamed(popover, 'Memory')).toHaveFocus();
  });

  it('opens on Skills when asked for Checkpoints the host does not keep', async () => {
    render(<Harness withCheckpoints={false} initialTab="checkpoints" />);
    const popover = await thePopover();
    expect(selectedTab(popover)).toBe(tabNamed(popover, 'Skills'));
  });

  it('opens on the tab it is given', async () => {
    render(<Harness initialTab="memory" />);
    const popover = await thePopover();
    const memory = tabNamed(popover, 'Memory');
    expect(memory).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(memory).toHaveFocus());
    expect(within(popover).getByRole('tabpanel', { name: 'Memory' })).toHaveTextContent(
      EN.memory.intro,
    );
  });

  it('shows a tab when it is pressed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const popover = await thePopover();
    await user.click(tabNamed(popover, 'Checkpoints'));
    const panel = within(popover).getByRole('tabpanel', { name: 'Checkpoints' });
    expect(await within(panel).findAllByRole('listitem')).toHaveLength(3);
    expect(panel).toHaveTextContent(EN.checkpoints.intro);
  });

  it('Close closes and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const popover = await thePopover();
    await user.click(within(popover).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => expect(anchorButton()).toHaveFocus());
    expect(anchorButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc closes and returns focus to the button', async () => {
    const user = userEvent.setup();
    render(<Harness initialTab="memory" />);
    const popover = await thePopover();
    await waitFor(() => expect(tabNamed(popover, 'Memory')).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => expect(anchorButton()).toHaveFocus());
  });

  it('is modal: the scrim covers the editor, and pressing it closes and returns focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await thePopover();
    const scrim = container.querySelector('.ck-agent-knowledge__scrim');
    expect(scrim).not.toBeNull();
    if (scrim !== null) await user.click(scrim);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => expect(anchorButton()).toHaveFocus());
    expect(anchorButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('finds a section by its words, in English and Arabic, and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const popover = await thePopover();
    const search = within(popover).getByRole('searchbox', { name: 'Search' });
    await user.type(search, 'notes');
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Memory']);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(within(popover).queryAllByRole('tab')).toEqual([]);
    expect(within(popover).getByText(EN.noMatch)).toHaveAttribute('role', 'status');
  });

  it('folds Arabic letters as people type them: «الذاكره» finds الذاكرة', async () => {
    const user = userEvent.setup();
    render(<Harness locale="ar" />);
    const popover = await thePopover('ar');
    await user.type(within(popover).getByRole('searchbox', { name: AR.search }), 'الذاكره');
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual([AR.tabs.memory]);
  });

  it('heads the section it shows, and lists the sections vertically', async () => {
    render(<Harness initialTab="memory" />);
    const popover = await thePopover();
    expect(within(popover).getByRole('heading', { name: 'Memory', level: 3 })).toBeInTheDocument();
    expect(within(popover).getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('copies a skill through the clipboard it is given', async () => {
    const user = userEvent.setup();
    const clipboard = vi.fn(() => Promise.resolve());
    render(<Harness clipboard={clipboard} />);
    const popover = await thePopover();
    await user.click(within(popover).getByRole('button', { name: 'Copy House style as SKILL.md' }));
    expect(clipboard).toHaveBeenCalledWith(expect.stringContaining('mode: always'));
  });

  it('in the phone sheet, is a region of its own that Esc closes', async () => {
    const user = userEvent.setup();
    render(<Harness presentation="sheet" />);
    const page = screen.getByRole('region', { name: 'Skills & memory' });
    expect(page.tagName).toBe('SECTION');
    expect(page).toHaveAttribute('data-presentation', 'sheet');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(tabNamed(page, 'Memory'));
    expect(tabNamed(page, 'Memory')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Skills & memory' })).toBeNull();
    expect(anchorButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('in the phone sheet, closes with Close', async () => {
    const user = userEvent.setup();
    render(<Harness presentation="sheet" locale="ar" />);
    const page = screen.getByRole('region', { name: AR.title });
    await user.click(within(page).getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByRole('region', { name: AR.title })).toBeNull();
  });

  it.each(Object.entries(STYLES))(
    'styles %s with logical properties and theme tokens only',
    (_, css) => {
      expect(css).not.toMatch(
        /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
      );
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
    },
  );
});
