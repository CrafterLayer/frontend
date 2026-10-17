/**
 * BuiltInSkillsList (2026-10-14): the built-ins the Agent picks by itself, by group, each with a
 * switch on until switched off; the engine's own read "Always on"; a filter and "Reset to
 * defaults"; both languages; logical properties and theme tokens only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createCraftkitAiSkillRegistry } from '@craftkit/builder';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { builtInSkillViews } from '../../model/builtin-skills';
import type { Locale } from '../../model/view-types';

import { BuiltInSkillsList } from './BuiltInSkillsList';

const CSS = readFileSync(
  join(process.cwd(), 'src/features/agent/components/BuiltInSkillsList/BuiltInSkillsList.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

const SKILLS = createCraftkitAiSkillRegistry().list();
const EN = knowledgeLabels('en').builtInSkills;
const AR = knowledgeLabels('ar').builtInSkills;

interface LiveProps {
  readonly locale: Locale;
  readonly off: readonly string[];
  readonly onToggle: (id: string, enabled: boolean) => void;
  readonly onReset: () => void;
}

/** The list over live switches, as the knowledge hook keeps them. */
function Live({ locale, off, onToggle, onReset }: LiveProps) {
  const [disabled, setDisabled] = useState(off);
  return (
    <BuiltInSkillsList
      skills={builtInSkillViews(SKILLS, locale, disabled)}
      labels={knowledgeLabels(locale).builtInSkills}
      defaultOpen
      onToggle={(id, enabled) => {
        onToggle(id, enabled);
        setDisabled((current) =>
          enabled ? current.filter((entry) => entry !== id) : [...current, id],
        );
      }}
      onReset={() => {
        onReset();
        setDisabled([]);
      }}
    />
  );
}

function setup(locale: Locale = 'en', off: readonly string[] = []) {
  const onToggle = vi.fn();
  const onReset = vi.fn();
  render(<Live locale={locale} off={off} onToggle={onToggle} onReset={onReset} />);
  return { user: userEvent.setup(), onToggle, onReset };
}

const SWITCHABLE = builtInSkillViews(SKILLS, 'en', []).filter((skill) => !skill.locked).length;

describe('BuiltInSkillsList', () => {
  it('groups the built-ins, every switch on, the engine’s own read-only', () => {
    setup();
    for (const group of ['design', 'content', 'data', 'images', 'creative', 'language'] as const) {
      expect(screen.getByRole('region', { name: EN.groups[group] })).toBeInTheDocument();
    }
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(SWITCHABLE);
    expect(switches.every((element) => (element as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(EN.count(SWITCHABLE, SWITCHABLE))).toBeInTheDocument();

    const images = screen.getByRole('region', { name: EN.groups.images });
    for (const name of ['Use Art by name', 'Use Original logo', 'Use Photo direction']) {
      expect(within(images).getByRole('switch', { name })).toBeInTheDocument();
    }
    const language = screen.getByRole('region', { name: EN.groups.language });
    expect(
      within(language).getByRole('switch', {
        name: EN.use('Arabic and right-to-left composition'),
      }),
    ).toBeInTheDocument();

    const always = screen.getByRole('region', { name: EN.groups.always });
    expect(within(always).queryAllByRole('switch')).toHaveLength(0);
    expect(within(always).getAllByText(EN.always)).toHaveLength(4);
    expect(within(always).getByText('Craft manual')).toBeInTheDocument();
    // Engine-only explicit skills are not listed at all.
    expect(screen.queryByText('Plan without building')).not.toBeInTheDocument();
  });

  it('switches one off and on, and the count follows', async () => {
    const { user, onToggle } = setup();
    const charts = screen.getByRole('switch', { name: EN.use('Charts and tables') });
    await user.click(charts);
    expect(onToggle).toHaveBeenLastCalledWith('craftkit.data-viz', false);
    expect(charts).not.toBeChecked();
    expect(screen.getByText(EN.count(SWITCHABLE - 1, SWITCHABLE))).toBeInTheDocument();
    await user.click(charts);
    expect(onToggle).toHaveBeenLastCalledWith('craftkit.data-viz', true);
    expect(charts).toBeChecked();
  });

  it('works from the keyboard', async () => {
    const { user, onToggle } = setup();
    screen.getByRole('switch', { name: EN.use('Original logo') }).focus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenLastCalledWith('craftkit.logo-design', false);
  });

  it('filters by name or description, and says when nothing matches', async () => {
    const { user } = setup();
    const filter = screen.getByRole('searchbox', { name: EN.filter });
    await user.type(filter, 'logo');
    expect(screen.getByRole('switch', { name: EN.use('Original logo') })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: EN.groups.creative })).not.toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, 'zzz-nothing');
    expect(screen.getByText(EN.noMatch)).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('resets every built-in back on, and does nothing when all are on', async () => {
    const { user, onReset } = setup('en', ['craftkit.data-viz', 'craftkit.pixi-games']);
    expect(screen.getByText(EN.count(SWITCHABLE - 2, SWITCHABLE))).toBeInTheDocument();
    const reset = screen.getByRole('button', { name: EN.reset });
    expect(reset).toHaveAttribute('aria-disabled', 'false');
    await user.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('switch', { name: EN.use('Charts and tables') })).toBeChecked();
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    expect(reset).toHaveFocus();
    await user.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic', () => {
    setup('ar');
    expect(screen.getByText(AR.title(SWITCHABLE + 4))).toBeInTheDocument();
    expect(screen.getByText(AR.count(SWITCHABLE, SWITCHABLE))).toBeInTheDocument();
    const data = screen.getByRole('region', { name: AR.groups.data });
    expect(
      within(data).getByRole('switch', { name: AR.use('المخططات والجداول') }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: AR.reset })).toBeInTheDocument();
    expect(screen.getAllByText(AR.always).length).toBeGreaterThan(1);
  });

  it('draws nothing without built-ins', () => {
    const { container } = render(
      <BuiltInSkillsList
        skills={[]}
        labels={EN}
        onToggle={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(/(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/(?<![-\w])(?:left|right|width|height)\s*:/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
