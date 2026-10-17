/**
 * MemoryTab (2026-10-12): the project memory over the real store (`useAgentKnowledge` seeded
 * from storage). A note is remembered as a preference or a fact about the site; an empty,
 * repeated or twenty-first note is refused in one alert line; Forget lets one go, and
 * "Forget everything" asks once more in place.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { MemoryNote } from '../../model/project-memory';
import type { Locale } from '../../model/view-types';
import { SAMPLE_NOTES, SAMPLE_NOTES_AR, seededStorage } from '../../testing/knowledge-fixtures';

import { MemoryTab } from './MemoryTab';

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'MemoryTab', 'MemoryTab.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

/** Twenty notes: the memory is full. */
const FULL: readonly MemoryNote[] = Array.from({ length: 20 }, (_, index) => ({
  id: `note-${String(index + 1)}`,
  kind: 'preference',
  text: `Standing preference number ${String(index + 1)}.`,
}));

interface LiveMemoryProps {
  readonly locale?: Locale;
  readonly notes?: readonly MemoryNote[];
}

/** The tab over the real memory store, seeded as the browser would hold it. */
function LiveMemory({ locale = 'en', notes = SAMPLE_NOTES }: LiveMemoryProps) {
  const [storage] = useState(() => seededStorage([], notes));
  const { view } = useAgentKnowledge({ storage });
  return <MemoryTab memory={view.memory} labels={knowledgeLabels(locale)} />;
}

function setup(props: LiveMemoryProps = {}) {
  render(<LiveMemory {...props} />);
  return userEvent.setup();
}

function notes(): HTMLElement[] {
  return screen.queryAllByRole('listitem');
}

function remember(): HTMLElement {
  return screen.getByRole('button', { name: EN.memory.add });
}

describe('MemoryTab', () => {
  it('lists every note with its kind and Forget, and counts them', () => {
    setup();
    expect(notes()).toHaveLength(3);
    expect(notes()[0]).toHaveTextContent('Preference');
    expect(notes()[1]).toHaveTextContent('Fact about the site');
    expect(
      screen.getByRole('button', { name: 'Forget “The café is closed on Fridays.”' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 of 20')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('remembers a preference, and clears the field', async () => {
    const user = setup();
    const field = screen.getByRole('textbox', { name: 'Something to remember' });
    await user.type(field, 'Headlines are in sentence case.');
    await user.click(remember());
    expect(notes()).toHaveLength(4);
    expect(notes()[3]).toHaveTextContent('PreferenceHeadlines are in sentence case.');
    expect(field).toHaveValue('');
    expect(screen.getByText('4 of 20')).toBeInTheDocument();
  });

  it('remembers a fact about the site', async () => {
    const user = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: /^Kind/u }), 'site-fact');
    await user.type(
      screen.getByRole('textbox', { name: 'Something to remember' }),
      'We open at eight.',
    );
    await user.click(remember());
    expect(notes()[3]).toHaveTextContent('Fact about the siteWe open at eight.');
  });

  it('refuses an empty note', async () => {
    const user = setup();
    await user.click(remember());
    expect(screen.getByRole('alert')).toHaveTextContent(EN.memory.refusals.empty);
    expect(notes()).toHaveLength(3);
  });

  it('refuses a note already remembered, whatever its case', async () => {
    const user = setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Something to remember' }),
      'the café is closed on fridays.',
    );
    await user.click(remember());
    expect(screen.getByRole('alert')).toHaveTextContent(EN.memory.refusals.duplicate);
    expect(notes()).toHaveLength(3);
  });

  it('refuses a twenty-first note, then takes it once one is forgotten', async () => {
    const user = setup({ notes: FULL });
    const field = screen.getByRole('textbox', { name: 'Something to remember' });
    await user.type(field, 'One more thing.');
    await user.click(remember());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Memory is full (20). Forget something first.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Forget “Standing preference number 1.”' }),
    );
    await user.click(remember());
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(notes()).toHaveLength(20);
  });

  it('forgets one note', async () => {
    const user = setup();
    await user.click(
      screen.getByRole('button', { name: 'Forget “The café is closed on Fridays.”' }),
    );
    expect(notes()).toHaveLength(2);
    expect(screen.queryByText('The café is closed on Fridays.')).toBeNull();
    expect(screen.getByText('2 of 20')).toBeInTheDocument();
  });

  it('forgets everything only on the second press', async () => {
    const user = setup();
    const clear = screen.getByRole('button', { name: 'Forget everything' });
    await user.click(clear);
    expect(clear).toHaveAttribute('data-confirming');
    expect(clear).toHaveAccessibleName('Forget everything?');
    expect(notes()).toHaveLength(3);
    await user.click(clear);
    expect(notes()).toHaveLength(0);
    expect(screen.getByText(EN.memory.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Forget everything/u })).toBeNull();
  });

  it('leaving an armed "Forget everything" disarms it', async () => {
    const user = setup();
    const clear = screen.getByRole('button', { name: 'Forget everything' });
    await user.click(clear);
    await user.tab();
    expect(clear).not.toHaveAttribute('data-confirming');
    expect(clear).toHaveAccessibleName('Forget everything');
    expect(notes()).toHaveLength(3);
  });

  it('says so when nothing is remembered', () => {
    setup({ notes: [] });
    expect(screen.getByText(EN.memory.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Forget everything/u })).toBeNull();
    expect(screen.getByText('0 of 20')).toBeInTheDocument();
  });

  it('speaks Arabic: its field, kinds, Forget and refusal', async () => {
    const user = setup({ locale: 'ar', notes: SAMPLE_NOTES_AR });
    expect(screen.getByRole('textbox', { name: 'شيء ليتذكره' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'تفضيل' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'حقيقة عن الموقع' })).toBeInTheDocument();
    expect(notes()[1]).toHaveTextContent('حقيقة عن الموقع');
    expect(screen.getByText('2 من 20')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'تذكّر' }));
    expect(screen.getByRole('alert')).toHaveTextContent(AR.memory.refusals.empty);
    await user.click(screen.getByRole('button', { name: 'انسَ «المقهى مغلق يوم الجمعة.»' }));
    expect(notes()).toHaveLength(1);
    const clear = screen.getByRole('button', { name: 'انسَ كل شيء' });
    await user.click(clear);
    expect(clear).toHaveAccessibleName('انسَ كل شيء؟');
    expect(clear).toHaveAttribute('data-confirming');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
