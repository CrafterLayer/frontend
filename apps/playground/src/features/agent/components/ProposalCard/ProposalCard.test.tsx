/**
 * ProposalCard (SPEC §4.13, frame §3.8): Ask mode's proposed edit.
 *
 * What is ours to prove: the honesty line appears ONLY while it is true (SPEC §6.5), a
 * partial salvage says how many changes survived, Preview is a real toggle, no token or
 * cost estimate is ever on screen (SPEC §7.4; the owner saw «تقدير: ~11.3k توكن» on a
 * one-step plan), and each answer names where focus goes (SPEC §6.3): Apply → the resulting
 * record's Undo; Discard → the composer. Focus is asserted by name, never as "left X".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Locale, ProposalView, RecordMenuItem } from '../../model/view-types';
import { editApplied } from '../../testing/wp-12-records-fixtures';
import {
  proposalDrafting,
  proposalPageWide,
  proposalPartial,
  proposalPending,
  proposalPreviewing,
  proposalWrote,
} from '../../testing/wp-13-decisions-fixtures';
import { EditRecord } from '../EditRecord';
import { EndNote } from '../EndNote';

import { ProposalCard, type ProposalCardActions } from './ProposalCard';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'ProposalCard', 'ProposalCard.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function fakeActions(overrides: Partial<ProposalCardActions> = {}): ProposalCardActions {
  return {
    apply: vi.fn<(turnId: string) => void>(),
    discard: vi.fn<(turnId: string) => void>(),
    togglePreview: vi.fn<(turnId: string) => void>(),
    ...overrides,
  };
}

function Card({
  view,
  locale = 'en',
  actions = fakeActions(),
  onMenuSelect = vi.fn<(item: RecordMenuItem) => void>(),
}: {
  readonly view: ProposalView;
  readonly locale?: Locale;
  readonly actions?: ProposalCardActions;
  readonly onMenuSelect?: (item: RecordMenuItem) => void;
}) {
  return <ProposalCard locale={locale} view={view} actions={actions} onMenuSelect={onMenuSelect} />;
}

/** The panel as far as an answer needs it: the turn's `<li>` and the composer. */
function Thread() {
  const [answer, setAnswer] = useState<'none' | 'applied' | 'discarded'>('none');
  return (
    <div className="ck-agent">
      <ol>
        <li>
          {answer === 'applied' ? (
            <EditRecord
              locale="en"
              view={editApplied('en')}
              actions={{
                undoEdit: () => undefined,
                redoEdit: () => undefined,
                reveal: () => undefined,
                openPageHistory: () => undefined,
              }}
              onMenuSelect={() => undefined}
            />
          ) : answer === 'discarded' ? (
            <EndNote locale="en" view={{ turnId: 'turn-proposal', key: 'proposalDiscarded' }} />
          ) : (
            <Card
              view={proposalPending('en')}
              actions={fakeActions({
                apply: () => {
                  setAnswer('applied');
                },
                discard: () => {
                  setAnswer('discarded');
                },
              })}
            />
          )}
        </li>
      </ol>
      <textarea aria-label="Message" />
    </div>
  );
}

describe('ProposalCard', () => {
  it('names the change by its target, and shows it as before → after lines', () => {
    render(<Card view={proposalPending('en')} />);
    const card = screen.getByRole('article', { name: 'Proposed change: FAQ' });
    expect(card).toHaveTextContent('Heading');
    expect(card).toHaveTextContent('Questions patients ask');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('names a page-wide proposal by the page', () => {
    render(<Card view={proposalPageWide('en')} />);
    expect(
      screen.getByRole('article', { name: 'Proposed change to the page' }),
    ).toBeInTheDocument();
  });

  it('speaks Arabic in Arabic, the target in «»', () => {
    render(<Card locale="ar" view={proposalPending('ar')} />);
    expect(screen.getByRole('article', { name: 'اقتراح: «الأسئلة الشائعة»' })).toBeInTheDocument();
    expect(screen.getByText('لم تتغيّر الصفحة بعد.')).toBeInTheDocument();
  });

  describe('the honesty line', () => {
    it('says the page has not changed while that is true', () => {
      render(<Card view={proposalPending('en')} />);
      expect(screen.getByText("The page hasn't changed yet.")).toBeInTheDocument();
    });

    it('is gone the moment it stops being true', () => {
      const { rerender } = render(<Card view={proposalPending('en')} />);
      expect(screen.getByText("The page hasn't changed yet.")).toBeInTheDocument();
      rerender(<Card view={proposalWrote('en')} />);
      expect(screen.queryByText("The page hasn't changed yet.")).toBeNull();
    });
  });

  it('says how many changes survived validation, in Amber', () => {
    render(<Card view={proposalPartial('en')} />);
    const line = screen.getByText('Only 2 of 3 changes can be applied');
    expect(line).toHaveAttribute('data-tone', 'warning');
  });

  it('refuses Apply when validation kept nothing', async () => {
    const user = userEvent.setup();
    const apply = vi.fn<(turnId: string) => void>();
    render(
      <Card
        view={proposalPending('en', { partial: { kept: 0, total: 2 } })}
        actions={fakeActions({ apply })}
      />,
    );
    const button = screen.getByRole('button', { name: 'Apply' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(apply).not.toHaveBeenCalled();
  });

  it('never shows a token or cost estimate', () => {
    for (const locale of ['en', 'ar'] as const) {
      const { container, unmount } = render(
        <Card locale={locale} view={proposalPartial(locale)} />,
      );
      expect(container.textContent).not.toMatch(
        /token|توكن|تقدير|estimate|~\s*\d|\d+(?:\.\d+)?k\b/iu,
      );
      unmount();
    }
  });

  describe('Preview', () => {
    it('is a toggle that asks the controller to show the proposal on the canvas', async () => {
      const user = userEvent.setup();
      const togglePreview = vi.fn<(turnId: string) => void>();
      render(<Card view={proposalPending('en')} actions={fakeActions({ togglePreview })} />);
      const toggle = screen.getByRole('button', { name: 'Preview' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await user.click(toggle);
      expect(togglePreview).toHaveBeenCalledWith('turn-proposal');
    });

    it('is pressed while previewing, and says how to end it', () => {
      render(<Card view={proposalPreviewing('en')} />);
      const toggle = screen.getByRole('button', { name: 'Preview' });
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveAccessibleDescription('End preview');
    });

    it('ends on Esc inside the card, with focus on the toggle', async () => {
      const user = userEvent.setup();
      const togglePreview = vi.fn<(turnId: string) => void>();
      render(<Card view={proposalPreviewing('en')} actions={fakeActions({ togglePreview })} />);
      screen.getByRole('button', { name: 'Apply' }).focus();
      await user.keyboard('{Escape}');
      expect(togglePreview).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus();
    });
  });

  it('offers View as code in its [⋯] menu', async () => {
    const user = userEvent.setup();
    const onMenuSelect = vi.fn<(item: RecordMenuItem) => void>();
    render(<Card view={proposalPending('en')} onMenuSelect={onMenuSelect} />);
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'View as code' }));
    expect(onMenuSelect).toHaveBeenCalledWith('viewAsCode');
  });

  it('applies and sends focus to the resulting record’s Undo', async () => {
    const user = userEvent.setup();
    render(<Thread />);
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo FAQ' })).toHaveFocus();
    });
    expect(screen.getByRole('article', { name: 'Applied: FAQ' })).toBeInTheDocument();
  });

  it('discards and sends focus to the composer', async () => {
    const user = userEvent.setup();
    render(<Thread />);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();
    });
    expect(screen.getByRole('article', { name: 'Proposal discarded' })).toBeInTheDocument();
  });

  it('is a working record while the proposal is being prepared', () => {
    render(<Card view={proposalDrafting('en')} />);
    const record = screen.getByRole('article', { name: 'Proposed change: FAQ' });
    expect(record).toHaveClass('ck-agent-record');
    expect(record).toHaveTextContent('Preparing the proposal…');
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
