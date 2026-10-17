import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BuildProgress, BuildTask } from '../AssistantPanel/AssistantPanel.build';
import type { BuiltTurn } from '../AssistantPanel/AssistantPanel.turns';
import { BuildReportCard } from './BuildReportCard';
import { BuildCardSeamContext, type BuildCardSeam } from './build-card-seam';

const task = (position: number, title: string, status: BuildTask['status']): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status,
  attempts: 1,
});

function report(overrides: Partial<BuiltTurn> = {}, tasks?: readonly BuildTask[]): BuiltTurn {
  const rows = tasks ?? [
    task(1, 'Hero', 'applied'),
    task(2, 'Proof', 'applied'),
    task(3, 'Contact', 'applied'),
  ];
  const progress: BuildProgress = {
    runId: 'run',
    phase: 'completed',
    direction: 'A calm clinic page.',
    tasks: rows,
    startedAt: 0,
    applied: rows.filter((row) => row.status === 'applied').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    run: null,
  };
  return {
    id: 'turn-1',
    from: 'assistant',
    kind: 'built',
    progress,
    undoable: true,
    ...overrides,
  };
}

function renderCard(
  turn = report(),
  props: Partial<Parameters<typeof BuildReportCard>[0]> = {},
  seam?: Partial<BuildCardSeam>,
) {
  const onUndoTask = vi.fn();
  const onRetrySkipped = vi.fn();
  const onRemoveUnfilled = vi.fn();
  const card = (
    <BuildReportCard
      report={turn}
      turnId={turn.id}
      busy={false}
      canUndo
      onUndoTask={onUndoTask}
      onRetrySkipped={onRetrySkipped}
      {...props}
    />
  );
  render(
    seam === undefined ? (
      card
    ) : (
      <BuildCardSeamContext.Provider
        value={{ locale: 'en', noticesOf: () => [], onRemoveUnfilled, ...seam }}
      >
        {card}
      </BuildCardSeamContext.Provider>
    ),
  );
  return { onUndoTask, onRetrySkipped, onRemoveUnfilled, user: userEvent.setup() };
}

describe('BuildReportCard', () => {
  it('says how many sections landed', () => {
    renderCard();
    expect(screen.getByText('3/3')).toBeVisible();
  });

  it('undoes ONE section, naming which — not the whole build', () => {
    /*
      Each section landed as its own transaction, which is the fact that made
      pressing Build safe. The report is where that promise is kept.
    */
    const { onUndoTask, user } = renderCard();

    return user.click(screen.getByRole('button', { name: 'Undo Proof' })).then(() => {
      expect(onUndoTask).toHaveBeenCalledWith(2, 3, 'Proof', 0);
    });
  });

  it('withholds every Undo when the panel may not write', () => {
    /*
      Plan mode is a promise about this panel, and this button loops
      `kernel.undo()` — it writes MORE than the others, not less.
    */
    renderCard(report(), { canUndo: false });
    expect(screen.queryByRole('button', { name: /^Undo / })).not.toBeInTheDocument();
  });

  it('offers to retry ONLY the sections that were skipped', async () => {
    // `request` is what a retry re-sends, so a report without one offers none.
    const skipped = report({ request: 'build a clinic page' }, [
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'skipped'),
      task(3, 'Contact', 'skipped'),
    ]);
    const { onRetrySkipped, user } = renderCard(skipped);

    await user.click(screen.getByRole('button', { name: 'Retry skipped' }));

    expect(onRetrySkipped).toHaveBeenCalledExactlyOnceWith(['Proof', 'Contact']);
  });

  it('does not offer a retry when nothing was skipped', () => {
    renderCard(report({ request: 'build a clinic page' }));
    expect(screen.queryByRole('button', { name: 'Retry skipped' })).not.toBeInTheDocument();
  });

  it('does not offer a retry it could not send — a revived report has no request', () => {
    /*
      Persistence keeps the report as readable history and drops the request
      that produced it. A Retry button with nothing to re-send would be a
      button that does nothing.
    */
    const revived = report({}, [task(1, 'Hero', 'applied'), task(2, 'Proof', 'skipped')]);
    renderCard(revived);

    expect(screen.queryByRole('button', { name: 'Retry skipped' })).not.toBeInTheDocument();
  });

  it('does not start a retry while the assistant is already working', () => {
    const skipped = report({ request: 'build a clinic page' }, [
      task(1, 'Hero', 'applied'),
      task(2, 'Proof', 'skipped'),
    ]);
    renderCard(skipped, { busy: true });

    expect(screen.getByRole('button', { name: 'Retry skipped' })).toBeDisabled();
  });

  it('reads as STOPPED when the build was cut short, not as built', () => {
    renderCard(report({ stopped: true }));

    expect(screen.getByText('Stopped')).toBeVisible();
    expect(screen.queryByText('Built')).not.toBeInTheDocument();
  });

  /*
    FORWARD revert (2026-09-28, agent-audit P1-9). A section is put back as its
    own new transaction, so putting one back never takes another with it — the
    old card disabled every LATER section too, because it looped kernel.undo().
  */
  it('disables the Undo of a section it put back, and ONLY that one', () => {
    renderCard(report({ reverted: [2] }));

    expect(screen.getByRole('button', { name: 'Undo Proof' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Undo Contact' })).toBeEnabled();
  });

  it('says honestly why a section was NOT put back, and keeps the ones that may still be', () => {
    renderCard(
      report({
        revertRefused: [
          { position: 1, code: 'changed-since' },
          { position: 3, code: 'region-missing' },
        ],
      }),
    );

    // Changed since: the person's edit was kept. Undoing that edit makes the revert possible again.
    expect(screen.getByText(/You changed this section after it was built/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toBeEnabled();
    // Gone: there is nothing to put back, and a button that can only refuse again is a lie.
    expect(screen.getByText(/no longer on the page/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo Contact' })).toBeDisabled();
  });

  it('says a section that never landed has nothing to put back', () => {
    renderCard(report({ revertRefused: [{ position: 2, code: 'not-landed' }] }));
    expect(screen.getByText(/never landed/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Undo Proof' })).toBeDisabled();
  });

  /*
    A PagePlan build writes some regions IN FULL with its skeleton — the header
    from the nav, the footer from the facts — and reports them applied with 0
    attempts and nothing recorded from before (wave-2 verifier,
    pageplan-revert.mjs, 2026-09-28). Offering "Undo Footer" there bought a
    refusal that then claimed the footer "never landed" while it sat on the page.
  */
  it('offers no Undo for a section the skeleton wrote in full: there is no earlier version of it', () => {
    renderCard(
      report({}, [
        task(1, 'Hero', 'applied'),
        task(2, 'Menu', 'applied'),
        { ...task(3, 'Footer', 'applied'), attempts: 0 },
      ]),
    );

    expect(screen.queryByRole('button', { name: 'Undo Footer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo Hero' })).toBeEnabled();
    // Still reported as landed — it is on the page.
    expect(screen.getAllByRole('listitem')[2]).toHaveTextContent(/Footer\s*Done/u);
  });

  it('says a landed section with nothing recorded before it was written with the layout — never that it did not land', () => {
    renderCard(report({ revertRefused: [{ position: 2, code: 'no-earlier-version' }] }));

    expect(screen.getByText(/Written with the page’s layout/)).toBeVisible();
    expect(screen.queryByText(/never landed/)).toBeNull();
    // Pressing again can only refuse again.
    expect(screen.getByRole('button', { name: 'Undo Proof' })).toBeDisabled();
  });

  it('says that in Arabic too', () => {
    renderCard(
      report({ revertRefused: [{ position: 2, code: 'no-earlier-version' }] }),
      {},
      { locale: 'ar' },
    );
    expect(screen.getByText(/كُتب مع تخطيط الصفحة/)).toBeVisible();
  });

  it('says the refusal in Arabic when the panel does', () => {
    renderCard(
      report({ revertRefused: [{ position: 1, code: 'changed-since' }] }),
      {},
      {
        locale: 'ar',
      },
    );
    expect(screen.getByText(/عدّلت هذا القسم بعد بنائه/)).toBeVisible();
  });

  it('says where the build landed when it is not where the words asked', () => {
    renderCard(report({ notices: ['new-page-appended', 'site-as-one-page'] }));
    expect(screen.getByText(/built below what is already here/)).toBeVisible();
    expect(screen.getByText(/one page at a time/)).toBeVisible();
  });

  describe('the empty sections a build left', () => {
    const stopped = (overrides: Partial<BuiltTurn> = {}) =>
      report({ stopped: true, unfilled: 2, ...overrides }, [
        task(1, 'Hero', 'applied'),
        task(2, 'Proof', 'waiting'),
        task(3, 'Contact', 'waiting'),
      ]);

    it('offers to remove them, naming how many, and asks the panel once', async () => {
      const { onRemoveUnfilled, user } = renderCard(stopped(), {}, {});

      await user.click(screen.getByRole('button', { name: 'Remove the 2 empty sections' }));

      expect(onRemoveUnfilled).toHaveBeenCalledExactlyOnceWith('turn-1');
    });

    it('does not offer it when nothing is empty', () => {
      renderCard(report({ unfilled: 0 }), {}, {});
      expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();
    });

    it('does not offer it while the panel may not write', () => {
      renderCard(stopped(), { canUndo: false }, {});
      expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();
    });

    it('does not offer it from a revived report, which holds no record of the placeholders', () => {
      renderCard(stopped({ undoable: false }), {}, {});
      expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();
    });

    it('does not offer it when no panel wired the removal', () => {
      renderCard(stopped());
      expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();
    });

    it('does not start it while the assistant is working', () => {
      renderCard(stopped(), { busy: true }, {});
      expect(screen.getByRole('button', { name: 'Remove the 2 empty sections' })).toBeDisabled();
    });

    it('says what the removal did, and offers it no more', () => {
      renderCard(stopped({ unfilledRemoval: { removed: 1, kept: 1 } }), {}, {});

      expect(
        screen.getByText(/Removed 1 empty section in one change — one Undo brings it back/),
      ).toBeVisible();
      expect(screen.getByText(/Kept 1 that was written into or is gone/)).toBeVisible();
      expect(screen.queryByRole('button', { name: /empty section/ })).toBeNull();
    });

    /*
      The removal is one transaction, so a door refusal removes nothing. It used
      to be swallowed: the button stayed and pressing it did nothing visible.
    */
    it('says the page refused the removal, and keeps the offer — the page is unchanged', () => {
      renderCard(stopped({ unfilledRemovalRefused: true }), {}, {});

      expect(screen.getByRole('status')).toHaveTextContent(
        'The page refused the removal; nothing was removed.',
      );
      expect(screen.getByRole('button', { name: 'Remove the 2 empty sections' })).toBeEnabled();
    });

    it('says the refusal in Arabic when the panel does', () => {
      renderCard(stopped({ unfilledRemovalRefused: true }), {}, { locale: 'ar' });
      expect(screen.getByRole('status')).toHaveTextContent('رفضت الصفحة الحذف، فلم يُحذف شيء.');
    });

    it('says so when there was nothing left to remove', () => {
      renderCard(stopped({ unfilledRemoval: { removed: 0, kept: 2 } }), {}, {});
      expect(screen.getByText(/Nothing was removed/)).toBeVisible();
    });
  });
});
