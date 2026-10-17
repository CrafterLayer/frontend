/**
 * QueueHeader (SPEC §4.17, §3.9, §3.10; FR-025, FR-026, FR-054): the header of the one
 * queued request. Ours to prove: it is a group named "Up next" and described by its
 * caption, the caption follows the revalidation (waiting, target changed, target gone,
 * paused), `×` removes, a paused request carries its own text, scope and Continue, and a
 * live one carries neither (the composer's text is the request: no second field).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { QUEUE_CAPTION_KEY, t } from '../../copy';
import type { Locale, QueueStatus } from '../../model/view-types';
import {
  blockChip,
  DRAFT,
  LATIN_DRAFT,
  queued,
  SCOPE_CHIP,
} from '../../testing/wp-14-composer-fixtures';

import { QueueHeader } from './QueueHeader';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const STATUSES = ['editable', 'stale', 'missing', 'paused'] as const satisfies readonly QueueStatus[];
const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

describe('QueueHeader', () => {
  it.each(LOCALES.flatMap((locale) => STATUSES.map((status) => [locale, status] as const)))(
    '%s, %s: a group named “Up next”, described by its caption',
    (locale, status) => {
      render(
        <QueueHeader
          locale={locale}
          queue={queued(locale, status)}
          onRemove={vi.fn()}
          onContinue={vi.fn()}
        />,
      );
      const group = screen.getByRole('group', { name: t(locale, 'queue.label') });
      expect(group).toHaveAccessibleDescription(t(locale, QUEUE_CAPTION_KEY[status]));
      expect(group).toHaveAttribute('data-status', status);
    },
  );

  it('carries no text and no Continue while the run is live: the composer’s text is the request', () => {
    render(
      <QueueHeader locale="en" queue={queued('en')} onRemove={vi.fn()} onContinue={vi.fn()} />,
    );
    const group = screen.getByRole('group', { name: 'Up next' });
    expect(group).not.toHaveTextContent(DRAFT.en);
    expect(within(group).queryByRole('button', { name: t('en', 'queue.continue') })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('removes the request with ×', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<QueueHeader locale="en" queue={queued('en')} onRemove={onRemove} onContinue={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: t('en', 'queue.remove') }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('after Stop: the request’s own text and scope, and Continue', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <QueueHeader
        locale="en"
        queue={queued('en', 'paused')}
        onRemove={vi.fn()}
        onContinue={onContinue}
      />,
    );
    const group = screen.getByRole('group', { name: 'Up next' });
    expect(group).toHaveTextContent(DRAFT.en);
    expect(within(group).getByText('Hero')).toBeInTheDocument();
    // The scope only shows what the paused request is about: it has no remove.
    expect(within(group).queryByRole('button', { name: /Remove Hero/u })).toBeNull();
    await user.click(within(group).getByRole('button', { name: t('en', 'queue.continue') }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('after Stop: draws no second «Whole page» chip, the composer already shows the scope', () => {
    render(
      <QueueHeader
        locale="ar"
        queue={{ ...queued('ar', 'paused'), chips: [SCOPE_CHIP] }}
        dockChips={[SCOPE_CHIP]}
        onRemove={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    const group = screen.getByRole('group', { name: t('ar', 'queue.label') });
    expect(group).toHaveTextContent(DRAFT.ar);
    expect(within(group).queryByText(t('ar', 'scope.page'))).toBeNull();
  });

  it('after Stop: draws no chip the composer below already shows', () => {
    const { container } = render(
      <QueueHeader
        locale="en"
        queue={queued('en', 'paused')}
        dockChips={[blockChip('en', 'hero')]}
        onRemove={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(container.querySelector('.ck-agent-queue .ck-agent-chip')).toBeNull();
  });

  it('after Stop: keeps a block scope the composer does not show', () => {
    render(
      <QueueHeader
        locale="en"
        queue={queued('en', 'paused')}
        dockChips={[SCOPE_CHIP]}
        onRemove={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    const group = screen.getByRole('group', { name: 'Up next' });
    expect(within(group).getByText('Hero')).toBeInTheDocument();
  });

  it('sets a paused request’s direction and language from its words', () => {
    const { container } = render(
      <QueueHeader
        locale="ar"
        queue={{ ...queued('ar', 'paused'), text: LATIN_DRAFT }}
        onRemove={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    const text = container.querySelector('.ck-agent-queue__text');
    expect(text).toHaveAttribute('dir', 'ltr');
    expect(text).toHaveAttribute('lang', 'en');
  });

  it('uses the ids the Composer passes, so the textarea can be described by them', () => {
    render(
      <QueueHeader
        locale="en"
        queue={queued('en')}
        labelId="queue-label"
        captionId="queue-caption"
        onRemove={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(document.getElementById('queue-label')).toHaveTextContent('Up next');
    expect(document.getElementById('queue-caption')).toHaveTextContent(t('en', 'queue.caption'));
  });
});
