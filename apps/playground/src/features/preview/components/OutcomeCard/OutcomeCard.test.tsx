import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { OutcomeCardProps } from './OutcomeCard';
import { OutcomeCard } from './OutcomeCard';

type RefusedCard = Extract<OutcomeCardProps['turn'], { kind: 'refused' }>;

/**
 * A refusal with one optional field OMITTED, never set to `undefined`.
 *
 * Under `exactOptionalPropertyTypes` those are different types, and the one
 * persistence and a bare failure actually produce is the absent one.
 */
function without(turn: RefusedCard, key: 'receipt' | 'request'): RefusedCard {
  return Object.fromEntries(
    Object.entries(turn).filter(([name]) => name !== key),
  ) as unknown as RefusedCard;
}

function renderCard(turn: OutcomeCardProps['turn'], busy = false) {
  const onRetry = vi.fn();
  render(<OutcomeCard turn={turn} busy={busy} onRetry={onRetry} />);
  return onRetry;
}

const stopped: OutcomeCardProps['turn'] = {
  id: 'turn-1',
  from: 'assistant',
  kind: 'stopped',
  receipt: { elapsed: '00:04.210', stage: 'structure', stageLabel: 'Structure' },
};

const refused: RefusedCard = {
  id: 'turn-2',
  from: 'assistant',
  kind: 'refused',
  text: 'تعذّر إكمال الطلب.',
  failure: {
    code: 'timeout',
    message: 'upstream timed out',
    source: 'provider',
    retryable: true,
    status: 504,
  },
  request: 'أضف قسم أسعار',
  receipt: { elapsed: '00:30.000', stage: 'content', stageLabel: 'Content' },
};

describe('OutcomeCard', () => {
  describe('stopped', () => {
    it('says so, and how long it ran — a stop is an outcome, not a void', () => {
      renderCard(stopped);
      expect(screen.getByText('Stopped.')).toBeInTheDocument();
      expect(screen.getByText(/Stopped after 00:04.210 at Structure/)).toBeInTheDocument();
    });

    it('offers nothing to press: the person already decided', () => {
      renderCard(stopped);
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('discarded', () => {
    const discarded: OutcomeCardProps['turn'] = {
      id: 'turn-3',
      from: 'assistant',
      kind: 'discarded',
    };

    it('says so and nothing else — it was never a run, so there is no duration', () => {
      renderCard(discarded);
      expect(screen.getByText('Discarded.')).toBeInTheDocument();
      expect(document.querySelector('.pg-chat__receipt')).toBeNull();
    });
  });

  describe('refused', () => {
    it("shows the refusal in the provider's own direction", () => {
      renderCard(refused);
      expect(screen.getByText('تعذّر إكمال الطلب.')).toHaveAttribute('dir', 'auto');
    });

    it('names the code, the source and the HTTP status', () => {
      renderCard(refused);
      const meta = document.querySelector('.pg-chat__failure-meta');
      expect(meta).toHaveTextContent('timeout');
      expect(meta).toHaveTextContent('provider');
      expect(meta).toHaveTextContent('HTTP 504');
    });

    it('does not repeat the row when the receipt already names it', () => {
      renderCard({ ...refused, failedAt: 'content' });
      const meta = document.querySelector('.pg-chat__failure-meta');
      expect(meta?.textContent).not.toContain('at Content');
      expect(screen.getByText(/Failed after 00:30.000 at Content/)).toBeInTheDocument();
    });

    it('names the row itself when there is no receipt to do it', () => {
      renderCard({ ...without(refused, 'receipt'), failedAt: 'content' });
      expect(document.querySelector('.pg-chat__failure-meta')?.textContent).toContain('at Content');
    });

    it('offers Retry for a retryable failure that kept its request', async () => {
      const onRetry = renderCard(refused);
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(onRetry).toHaveBeenCalledExactlyOnceWith('أضف قسم أسعار');
    });

    it('never offers Retry for a permanent failure', () => {
      renderCard({
        ...refused,
        failure: {
          code: 'plan-rejected',
          message: 'command not allowed',
          source: 'plan',
          retryable: false,
        },
      });
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    it('never offers Retry when the request is gone — it would re-send nothing', () => {
      renderCard(without(refused, 'request'));
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    it('closes Retry while another run owns the panel', () => {
      renderCard(refused, true);
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    });

    it('shows no metadata line at all when the refusal carried no failure', () => {
      renderCard({ id: 'turn-4', from: 'assistant', kind: 'refused', text: 'لا.' });
      expect(document.querySelector('.pg-chat__failure-meta')).toBeNull();
    });
  });
});
