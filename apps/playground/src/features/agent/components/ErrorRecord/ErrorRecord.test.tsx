/**
 * ErrorRecord (SPEC §4.14, §3.11): a run that failed as a whole.
 *
 * Every failure class is titled in its own words and says, always, one sentence about the
 * page. Try again appears only when the class can be retried, calls the controller (never a
 * message), and sends focus to the record's head. The technical details (codes, run ids,
 * validator text) never reach the screen: they are the clipboard's.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ERROR_CAUSE_KEY, t } from '../../copy';
import type { ErrorView, Locale } from '../../model/view-types';
import { ERROR_CLASSES, errorView } from '../../testing/wp-12-records-fixtures';

import { ErrorRecord, type ErrorRecordActions } from './ErrorRecord';

function renderError(view: ErrorView, locale: Locale = 'en') {
  const actions = { tryAgain: vi.fn(), removeEmpty: vi.fn() } satisfies ErrorRecordActions;
  const onMenuSelect = vi.fn();
  const utils = render(
    <ErrorRecord locale={locale} view={view} actions={actions} onMenuSelect={onMenuSelect} />,
  );
  return { ...utils, actions, onMenuSelect };
}

describe('ErrorRecord', () => {
  it.each(ERROR_CLASSES)('%s: title, cause and page state, in words', (failure) => {
    const view = errorView(failure);
    const { container } = renderError(view);
    const title = t('en', `error.${failure}.title`);
    expect(screen.getByRole('article', { name: title })).toBeInTheDocument();
    expect(container.querySelector('.ck-agent-glyph')).toHaveAttribute('data-state', 'failed');
    const cause = ERROR_CAUSE_KEY[failure];
    if (cause === null) {
      // "Something unexpected went wrong" has no cause line (SPEC §4.14).
      expect(container.querySelectorAll('.ck-agent-error-line')).toHaveLength(1);
    } else {
      expect(screen.getByText(t('en', cause))).toBeInTheDocument();
    }
    expect(screen.getByText(t('en', 'error.page.unchanged'))).toBeInTheDocument();
  });

  it.each(ERROR_CLASSES)('%s: offers Try again only when the class can be retried', (failure) => {
    renderError(errorView(failure));
    const retry = screen.queryByRole('button', { name: 'Try again' });
    if (failure === 'declined') expect(retry).toBeNull();
    else expect(retry).toBeInTheDocument();
  });

  it('tries again through the controller, then sends focus to its head', async () => {
    const user = userEvent.setup();
    const view = errorView('unreachable');
    const { actions } = renderError(view);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(actions.tryAgain).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(actions.removeEmpty).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 3, name: "Couldn't reach the model" })).toHaveFocus();
  });

  it('says what landed before the error, counted', () => {
    renderError(errorView('timeout', { kind: 'kept', landed: 3 }));
    expect(screen.getByText('What landed before the error stays on the page (3).')).toBeInTheDocument();
  });

  it('offers to remove an empty layout it left behind', async () => {
    const user = userEvent.setup();
    const view = errorView('busy', { kind: 'skeleton' });
    const { actions } = renderError(view);
    expect(screen.getByText(t('en', 'error.page.skeleton'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove the empty layout' }));
    expect(actions.removeEmpty).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(screen.getByRole('heading', { level: 3 })).toHaveFocus();
  });

  it('says so when what landed first was never recorded', () => {
    renderError(errorView('unknown', { kind: 'unknown' }));
    expect(screen.getByText(t('en', 'error.page.unknown'))).toBeInTheDocument();
  });

  it('never shows the technical details', () => {
    const view = errorView('invalid');
    const { container } = renderError(view);
    const text = container.textContent ?? '';
    expect(text).not.toContain('fill-3');
    expect(text).not.toContain('setProp');
    expect(text).not.toContain('tokens');
    expect(text).not.toContain(view.details);
  });

  it('speaks Arabic in Arabic', () => {
    renderError(errorView('offline'), 'ar');
    expect(screen.getByRole('article', { name: 'لا يوجد اتصال' })).toBeInTheDocument();
    expect(screen.getByText('لم يُرسل الطلب.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });

  it('hands Copy error details to its caller', async () => {
    const user = userEvent.setup();
    globalThis.ResizeObserver ??= class {
      observe = (): void => undefined;
      unobserve = (): void => undefined;
      disconnect = (): void => undefined;
    };
    const { onMenuSelect } = renderError(errorView('unreachable'));
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy error details' }));
    expect(onMenuSelect).toHaveBeenCalledExactlyOnceWith('copyError');
  });
});
