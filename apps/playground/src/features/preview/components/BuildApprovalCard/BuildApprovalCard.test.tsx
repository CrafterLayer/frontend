import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BuildTask } from '../AssistantPanel/AssistantPanel.build';
import { BuildCardSeamContext } from '../BuildReportCard';
import { BuildApprovalCard } from './BuildApprovalCard';

const TASKS: readonly BuildTask[] = [
  { id: 'a', position: 1, title: 'Hero', status: 'waiting', attempts: 0 },
  { id: 'b', position: 2, title: 'Pricing', status: 'waiting', attempts: 0 },
  { id: 'c', position: 3, title: 'Contact', status: 'waiting', attempts: 0 },
];

const DIRECTION = 'A calm clinic page: one promise, six services, a booking line.';

function renderCard(
  extra: { readonly costTokens?: number; readonly locale?: 'ar' | 'en' } = {},
  onAnswer = vi.fn(),
) {
  render(
    <BuildApprovalCard
      direction={DIRECTION}
      tasks={TASKS}
      turnId="turn-1"
      onAnswer={onAnswer}
      {...extra}
    />,
  );
  return { onAnswer, user: userEvent.setup() };
}

describe('BuildApprovalCard', () => {
  it('is one named group, so a screen reader can find the question', () => {
    renderCard();
    expect(screen.getByRole('group', { name: 'Build this page' })).toBeInTheDocument();
  });

  it('shows the direction and every section it would write, in page order', () => {
    renderCard();

    expect(screen.getByText(DIRECTION)).toBeVisible();
    const titles = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(titles.map((item) => item.textContent)).toEqual(['Hero', 'Pricing', 'Contact']);
    expect(screen.getByText('3 sections')).toBeVisible();
  });

  it('says WHY pressing Build is safe — each section undoes on its own', () => {
    /*
      Not reassurance. It is the fact that makes the decision reversible, and a
      person deciding to spend minutes of model time is entitled to it.
    */
    renderCard();
    expect(screen.getByText(/writes each one as its own change/)).toBeVisible();
  });

  it('never claims the skeleton is already on the page — nothing is, until Build', () => {
    /*
      It said "The skeleton is already on the page" until 2026-09-28. The engine
      now asks BEFORE the first write (P0-4), so that sentence became false the
      moment the fix landed, and it is the sentence a person reads while deciding.
    */
    renderCard();
    expect(screen.queryByText(/already on the page/)).toBeNull();
    expect(screen.getByText(/Nothing is on the page yet/)).toBeVisible();
  });

  it('says it in Arabic when the panel does', () => {
    renderCard({ locale: 'ar' });
    expect(screen.getByText(/لم يُكتب شيء على الصفحة بعد/)).toBeVisible();
  });

  it('shows what each section is FOR when the plan says', () => {
    const withPurpose: readonly BuildTask[] = TASKS.map((task) =>
      task.position === 1 ? { ...task, purpose: 'One promise, one booking line.' } : task,
    );
    render(
      <BuildApprovalCard
        direction={DIRECTION}
        tasks={withPurpose}
        turnId="turn-3"
        onAnswer={vi.fn()}
      />,
    );
    const purpose = screen.getByText('One promise, one booking line.');
    expect(purpose).toBeVisible();
    expect(purpose.closest('li')).toHaveTextContent(/^Hero/);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent(/^Pricing$/);
  });

  it('says where the page will land when it is not where the words asked', () => {
    render(
      <BuildCardSeamContext.Provider
        value={{
          locale: 'en',
          noticesOf: (turnId) => (turnId === 'turn-4' ? ['new-page-appended'] : []),
        }}
      >
        <BuildApprovalCard direction={DIRECTION} tasks={TASKS} turnId="turn-4" onAnswer={vi.fn()} />
      </BuildCardSeamContext.Provider>,
    );
    expect(screen.getByText(/built below what is already here/)).toBeVisible();
  });

  it('says nothing about placement when there is nothing to say', () => {
    renderCard();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('answers build, once, when Build is pressed', async () => {
    const { onAnswer, user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Build' }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('build');
  });

  it('answers stop when the build is refused', async () => {
    const { onAnswer, user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Stop build' }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('stop');
  });

  it('lets the direction take the language it was written in', () => {
    /*
      The scaffold answers in the requester's language, which is not the
      panel's — `dir="auto"` is what keeps an Arabic direction reading right.
    */
    render(
      <BuildApprovalCard
        direction="صفحة عيادة هادئة"
        tasks={TASKS}
        turnId="turn-2"
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByText('صفحة عيادة هادئة')).toHaveAttribute('dir', 'auto');
  });

  describe('the cost estimate', () => {
    it('says what the rest of this build would cost to send', () => {
      renderCard({ costTokens: 4237 });
      expect(screen.getByText('Estimate: ~4.2k tokens')).toBeInTheDocument();
    });

    it('says it in Arabic when the panel does', () => {
      renderCard({ costTokens: 4237, locale: 'ar' });
      expect(screen.getByText('تقدير: ~4.2k توكن')).toBeInTheDocument();
    });

    it('shows NOTHING rather than a zero when it cannot be estimated', () => {
      renderCard();
      /*
        A zero is a claim — "this is free" — and an absence is not. The card
        appears in stories and over revived runs where the context is long gone.
      */
      expect(screen.queryByText(/Estimate/u)).toBeNull();
    });

    it('is honest that it is an ESTIMATE, and of the request', () => {
      renderCard({ costTokens: 900 });
      expect(screen.getByText('Estimate: ~900 tokens')).toBeInTheDocument();
    });
  });
});
