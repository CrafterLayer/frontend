/**
 * MentionMenu (SPEC §4.17, §3.2): the `@` list, drawn for the textarea that owns the keys.
 * Ours to prove: a named listbox of options by human name, sections with their place ("3
 * of 8"), the active option marked for `aria-activedescendant`, the pointer moving the
 * active option and picking with a click without taking focus from the textarea, and no
 * empty listbox when nothing matches (a line says so instead).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { MENTION, MENTION_EMPTY } from '../../testing/wp-14-composer-fixtures';

import { MentionMenu } from './MentionMenu';

const optionId = (index: number) => `mention-option-${String(index)}`;

describe('MentionMenu', () => {
  it('is a named listbox of the page’s blocks, sections with their place', () => {
    render(
      <MentionMenu
        locale="en"
        id="mentions"
        mention={MENTION.en}
        activeIndex={0}
        optionId={optionId}
        onActiveChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    const list = screen.getByRole('listbox', { name: t('en', 'mention.label') });
    expect(list).toHaveAttribute('id', 'mentions');
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Services');
    expect(options[0]).toHaveTextContent('3 of 8');
    expect(options[2]).toHaveTextContent('Session prices');
    expect(options[2]).not.toHaveTextContent(/of/u);
  });

  it('marks the active option, and gives each option the id the textarea points at', () => {
    render(
      <MentionMenu
        locale="en"
        id="mentions"
        mention={MENTION.en}
        activeIndex={1}
        optionId={optionId}
        onActiveChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(options[1]).toHaveAttribute('id', optionId(1));
  });

  it('writes the place in Arabic with Latin digits, and the name in <bdi>', () => {
    render(
      <MentionMenu
        locale="ar"
        id="mentions"
        mention={MENTION.ar}
        activeIndex={0}
        optionId={optionId}
        onActiveChange={vi.fn()}
        onPick={vi.fn()}
      />,
    );
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveTextContent(t('ar', 'mention.position', { i: 2, n: 8 }));
    expect(first?.querySelector('bdi')).toHaveTextContent('الواجهة');
  });

  it('moves the active option with the pointer and picks with a click', async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    const onPick = vi.fn();
    render(
      <MentionMenu
        locale="en"
        id="mentions"
        mention={MENTION.en}
        activeIndex={0}
        optionId={optionId}
        onActiveChange={onActiveChange}
        onPick={onPick}
      />,
    );
    const second = screen.getAllByRole('option')[1];
    if (second === undefined) throw new Error('no second option');
    await user.pointer({ target: second });
    expect(onActiveChange).toHaveBeenCalledWith(1);
    await user.click(second);
    expect(onPick).toHaveBeenCalledWith(MENTION.en.candidates[1]);
  });

  it('never takes focus from the textarea: a press on an option is not a focus move', () => {
    render(
      <>
        <textarea aria-label="Your request" />
        <MentionMenu
          locale="en"
          id="mentions"
          mention={MENTION.en}
          activeIndex={0}
          optionId={optionId}
          onActiveChange={vi.fn()}
          onPick={vi.fn()}
        />
      </>,
    );
    const field = screen.getByRole('textbox', { name: 'Your request' });
    field.focus();
    const option = screen.getAllByRole('option')[0];
    if (option === undefined) throw new Error('no option');
    const pressed = fireEvent.mouseDown(option);
    expect(pressed).toBe(false);
    expect(field).toHaveFocus();
    expect(option).not.toHaveAttribute('tabindex');
  });

  it('draws a line, not an empty listbox, when nothing matches', () => {
    render(
      <MentionMenu
        locale="en"
        id="mentions"
        mention={MENTION_EMPTY.en}
        activeIndex={-1}
        optionId={optionId}
        onActiveChange={vi.fn()}
        onPick={vi.fn()}
        emptyId="mention-empty"
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.getElementById('mention-empty')).toHaveTextContent(t('en', 'mention.empty'));
  });
});
