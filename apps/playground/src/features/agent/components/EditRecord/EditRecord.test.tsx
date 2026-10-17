/**
 * EditRecord (SPEC §4.9, §3.6, §3.8): one edit run.
 *
 * Held here: the title names the target in the state's words ("Editing Hero", "Hero updated",
 * "No change to Hero", "Applied: FAQ"), and the page when there is no target; a running edit
 * shows one live line with the mapped stage phrase and no clock; done, it shows what changed,
 * "Show on page" and Undo; Undo and Redo are one button, so focus stays on it; an Undo that
 * cannot run stays in place, `aria-disabled` and described; a direct edit, born done in under
 * a second, shows no stages and no "0:00".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { EditRecordView, Locale } from '../../model/view-types';
import {
  editApplied,
  editChangedSince,
  editDone,
  editDoneMany,
  editInstant,
  editNoChange,
  editPageWide,
  editRevived,
  editRunning,
  editStopped,
  editUndone,
  editUnlisted,
} from '../../testing/wp-12-records-fixtures';

import { EditRecord, type EditRecordActions } from './EditRecord';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'EditRecord', 'EditRecord.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function actionsSpy() {
  return {
    undoEdit: vi.fn(),
    redoEdit: vi.fn(),
    reveal: vi.fn(),
    openPageHistory: vi.fn(),
  } satisfies EditRecordActions;
}

function renderEdit(view: EditRecordView, locale: Locale = 'en') {
  const actions = actionsSpy();
  const utils = render(
    <EditRecord locale={locale} view={view} actions={actions} onMenuSelect={vi.fn()} />,
  );
  const rerender = (next: EditRecordView) => {
    utils.rerender(
      <EditRecord locale={locale} view={next} actions={actions} onMenuSelect={vi.fn()} />,
    );
  };
  return { ...utils, actions, rerender };
}

function glyphOf(container: HTMLElement): string | null {
  return (
    container.querySelector('.ck-agent-record__head .ck-agent-glyph')?.getAttribute('data-state') ??
    null
  );
}

describe('EditRecord: titles', () => {
  it('discloses dropped steps even when accepted steps leave the page unchanged', () => {
    renderEdit({ ...editNoChange('en'), partial: { kept: 1, total: 2 } });
    expect(screen.getByText(t('en', 'edit.partial', { kept: 1, total: 2 }))).toBeInTheDocument();
    expect(screen.queryByText(t('en', 'edit.noChange'))).toBeNull();
    expect(screen.getByText(t('en', 'edit.pageUnchanged'))).toBeInTheDocument();
  });

  it.each(['en', 'ar'] as const)(
    'discloses partial Auto application in %s and keeps Undo',
    (locale) => {
      const view = { ...editPageWide(locale, 'done'), partial: { kept: 2, total: 3 } };
      renderEdit(view, locale);
      expect(
        screen.getByRole('heading', { name: t(locale, 'edit.title.partialPage') }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(t(locale, 'edit.partial', { kept: 2, total: 3 })),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t(locale, 'edit.undo') })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: t(locale, 'edit.title.donePage') })).toBeNull();
    },
  );

  it.each([
    ['running', editRunning('en'), 'Editing Hero', 'working'],
    ['done', editDone('en'), 'Hero updated', 'landed'],
    ['noChange', editNoChange('en'), 'No change to Hero', 'absent'],
    ['stopped', editStopped('en'), 'Change stopped', 'absent'],
    ['undone', editUndone('en'), 'This change was undone', 'absent'],
    ['applied', editApplied('en'), 'Applied: FAQ', 'landed'],
  ] as const)(
    '%s: says the state in words, glyph by what reached the page',
    (_, view, title, glyph) => {
      const { container } = renderEdit(view);
      expect(screen.getByRole('article', { name: title })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: title })).toHaveAttribute(
        'tabindex',
        '-1',
      );
      expect(glyphOf(container)).toBe(glyph);
    },
  );

  it('names the page when there is no target', () => {
    const running = renderEdit(editPageWide('en', 'running'));
    expect(screen.getByRole('heading', { name: 'Editing the page' })).toBeInTheDocument();
    running.unmount();
    renderEdit(editPageWide('en', 'done'));
    expect(
      screen.getByRole('heading', { name: t('en', 'edit.title.donePage') }),
    ).toBeInTheDocument();
  });

  it('isolates the target in <bdi>, in the locale’s quotes', () => {
    renderEdit(editDone('ar'), 'ar');
    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toHaveTextContent('عُدِّل «الواجهة»');
    expect(title.querySelector('bdi')).toHaveTextContent('الواجهة');
  });
});

describe('EditRecord: running', () => {
  it('shows one live line with the mapped stage phrase, no clock and no footer', () => {
    const { container } = renderEdit(editRunning('en', 'edit.checking'));
    const live = screen.getByText('Checking the change…');
    expect(live).toHaveClass('ck-agent-lead__live');
    expect(container.querySelector('.ck-agent-record__meta')).toBeNull();
    expect(container.querySelector('.ck-agent-record__footer')).toBeNull();
    expect(container.querySelector('.ck-agent-lead > .ck-agent-segment')).toHaveAttribute(
      'data-state',
      'indeterminate',
    );
  });
});

describe('EditRecord: done', () => {
  it('shows what changed, the final time, Show on page and Undo', async () => {
    const user = userEvent.setup();
    const view = editDone('en');
    const { container, actions } = renderEdit(view);
    expect(screen.getByText('Background: from “light” to “deep navy”')).toBeInTheDocument();
    expect(container.querySelector('.ck-agent-record__meta')).toHaveTextContent('0:16');
    await user.click(screen.getByRole('button', { name: 'Show on page' }));
    expect(actions.reveal).toHaveBeenCalledExactlyOnceWith('sec-2');
    // Label in Name: the visible "Undo" opens the name, which says what it undoes.
    const undo = screen.getByRole('button', { name: 'Undo Hero' });
    expect(undo).toHaveTextContent('Undo');
    await user.click(undo);
    expect(actions.undoEdit).toHaveBeenCalledExactlyOnceWith(view.turnId);
  });

  it('keeps focus on the same button when Undo lands and it becomes Redo', async () => {
    const user = userEvent.setup();
    const { actions, rerender } = renderEdit(editDone('en'));
    const undo = screen.getByRole('button', { name: 'Undo Hero' });
    await user.click(undo);
    rerender(editUndone('en'));
    const redo = screen.getByRole('button', { name: 'Redo Hero' });
    expect(redo).toBe(undo);
    expect(redo).toHaveFocus();
    await user.click(redo);
    expect(actions.redoEdit).toHaveBeenCalledOnce();
  });

  it('shows three changes, then Show all changes', () => {
    renderEdit(editDoneMany('en'));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Show all changes (5)' })).toBeInTheDocument();
  });

  it('says a landed change with no summary, and keeps its Undo', () => {
    renderEdit(editUnlisted('en'));
    expect(screen.getByText(t('en', 'edit.unlisted'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toBeInTheDocument();
  });

  it('lands a direct edit at once: no stages, no live line, no "0:00"', () => {
    const { container } = renderEdit(editInstant('en'));
    expect(screen.getByRole('heading', { name: 'FAQ updated' })).toBeInTheDocument();
    expect(container.querySelector('.ck-agent-lead__live')).toBeNull();
    expect(container.querySelector('.ck-agent-record__meta')).toBeNull();
    expect(container.textContent).not.toContain('0:00');
    expect(screen.getByText('Heading: from “FAQ” to “Questions”')).toBeInTheDocument();
  });
});

describe('EditRecord: honest endings', () => {
  it('says the page already matched, and offers nothing to undo', () => {
    renderEdit(editNoChange('en'));
    expect(screen.getByText(t('en', 'edit.noChange'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Undo/u })).toBeNull();
  });

  it('says a stopped edit left the page unchanged', () => {
    renderEdit(editStopped('en'));
    expect(screen.getByText(t('en', 'edit.pageUnchanged'))).toBeInTheDocument();
  });

  it('keeps an Undo that cannot run after a reload aria-disabled, described, with page history', async () => {
    const user = userEvent.setup();
    const { actions } = renderEdit(editRevived('en'));
    const undo = screen.getByRole('button', { name: 'Undo Hero' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAccessibleDescription(t('en', 'build.caption.revived'));
    await user.click(undo);
    expect(actions.undoEdit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t('en', 'build.pageHistory') }));
    expect(actions.openPageHistory).toHaveBeenCalledOnce();
  });

  it('says why an Undo cannot run once the page moved on', () => {
    renderEdit(editChangedSince('en'));
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toHaveAccessibleDescription(
      t('en', 'revert.changedSince'),
    );
    expect(screen.queryByRole('button', { name: t('en', 'build.pageHistory') })).toBeNull();
  });
});

describe('EditRecord.css', () => {
  it('writes the explaining caption in Meta, Slate', () => {
    expect(CSS).toMatch(
      /\.ck-agent-edit__caption \{\s*color: var\(--bldr-panel-muted\);\s*font-size: var\(--bldr-font-size-meta\);/,
    );
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
