/**
 * The composer's `/` commands (2026-10-12), over the real knowledge hook and the panel's real
 * command runner (`useKnowledgeUi`): Remember keeps the words before the slash in the project
 * memory, Save a checkpoint keeps the page under their name, New skill opens the Skills tab
 * on a draft holding them. Each says what happened once, in a status line, and the words leave
 * the composer with the slash.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import { useKnowledgeUi } from '../../hooks/use-knowledge-ui';
import type { AgentCheckpointPort } from '../../model/checkpoints';
import type { Locale } from '../../model/view-types';
import { createFakeCheckpoints, seededStorage } from '../../testing/knowledge-fixtures';

import { SkillSlash } from './SkillSlash';

interface HostProps {
  readonly locale?: Locale;
  readonly checkpoints?: AgentCheckpointPort | undefined;
}

/** What the test reads back: the knowledge view and the panel's popover state. */
const seen: { notes: readonly string[]; tab: string; open: boolean; newSkill: string | undefined } =
  { notes: [], tab: '', open: false, newSkill: undefined };

function Host({ locale = 'en', checkpoints }: HostProps) {
  const [storage] = useState(() => seededStorage([], []));
  const { view } = useAgentKnowledge({ storage, checkpoints });
  const ui = useKnowledgeUi(view, locale);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    seen.notes = view.memory.notes.map((note) => note.text);
    seen.tab = ui.tab;
    seen.open = ui.open;
    seen.newSkill = ui.newSkill?.instructions;
  });
  return (
    <div className="ck-agent" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <SkillSlash
        locale={locale}
        skills={view.skills}
        draft={draft}
        onDraftChange={setDraft}
        inputRef={input}
        onManage={() => {
          ui.show('skills');
        }}
        commands={ui.commands}
        onCommand={ui.onCommand}
      />
      <textarea
        ref={input}
        aria-label="Message"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </div>
  );
}

function setup(props: HostProps = {}) {
  render(<Host {...props} />);
  return { user: userEvent.setup(), field: screen.getByRole('textbox', { name: 'Message' }) };
}

describe('SkillSlash commands', () => {
  it('lists the commands first, under their heading, when the host can run them', async () => {
    const { user, field } = setup({ checkpoints: createFakeCheckpoints([]) });
    await user.type(field, '/');
    const names = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names[0]).toContain('Remember');
    expect(names[1]).toContain('Save a checkpoint');
    expect(names[2]).toContain('New skill');
    expect(screen.getByText('Commands')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves Save a checkpoint out when the host keeps no pages', async () => {
    const { user, field } = setup();
    await user.type(field, '/');
    const names = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names.join(' ')).not.toContain('Save a checkpoint');
  });

  it('remembers the words before the slash and says so', async () => {
    const { user, field } = setup();
    await user.type(field, 'Our colour is forest green /rem');
    await user.keyboard('{Enter}');
    expect(field).toHaveValue('');
    expect(seen.notes).toEqual(['Our colour is forest green']);
    expect(await screen.findByRole('status')).toHaveTextContent(
      knowledgeLabels('en').slash.remembered,
    );
  });

  it('opens Memory when there is nothing to remember, and refuses a repeat', async () => {
    const { user, field } = setup();
    await user.type(field, '/remember');
    await user.keyboard('{Enter}');
    expect(seen.open).toBe(true);
    expect(seen.tab).toBe('memory');
    await user.type(field, 'Green /rem');
    await user.keyboard('{Enter}');
    await user.type(field, 'green /rem');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('That is already remembered.')).toBeInTheDocument();
  });

  it('saves a checkpoint named by the words, or by the default name', async () => {
    const checkpoints = createFakeCheckpoints([]);
    const { user, field } = setup({ checkpoints });
    await user.type(field, 'Before the hero /check');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Checkpoint saved: Before the hero.')).toBeInTheDocument();
    await user.type(field, '/checkpoint');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Checkpoint saved: Saved checkpoint.')).toBeInTheDocument();
    expect((await checkpoints.list()).map(({ label }) => label)).toEqual([
      'Saved checkpoint',
      'Before the hero',
    ]);
  });

  it('says so when a checkpoint is not saved', async () => {
    const { user, field } = setup({ checkpoints: createFakeCheckpoints([], { saves: false }) });
    await user.type(field, '/checkpoint');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('The checkpoint was not saved.')).toBeInTheDocument();
  });

  it('starts a skill from the words, on the Skills tab', async () => {
    const { user, field } = setup();
    await user.type(field, 'End every page with the booking band /skill');
    await user.keyboard('{Enter}');
    expect(seen).toMatchObject({
      open: true,
      tab: 'skills',
      newSkill: 'End every page with the booking band',
    });
    expect(field).toHaveValue('');
  });

  it('speaks Arabic and answers to Arabic command words', async () => {
    const { user, field } = setup({ locale: 'ar' });
    await user.type(field, 'لوننا أخضر /تذك');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent(
      'تذكّر',
    );
    await user.keyboard('{Enter}');
    expect(seen.notes).toEqual(['لوننا أخضر']);
    expect(screen.getByText(knowledgeLabels('ar').slash.remembered)).toBeInTheDocument();
  });

  it('lets the confirmation go after a few seconds', async () => {
    const { user, field } = setup();
    await user.type(field, 'Warm tone /rem');
    await user.keyboard('{Enter}');
    expect(screen.getByText(knowledgeLabels('en').slash.remembered)).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4_100));
    });
    expect(screen.queryByText(knowledgeLabels('en').slash.remembered)).not.toBeInTheDocument();
  }, 10_000);
});
