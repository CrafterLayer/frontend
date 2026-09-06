import type { AiValidatedProposal } from '@craftkit/builder';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PlanTurn } from '../AssistantPanel/AssistantPanel.turns';
import type { PlanCardProps } from './PlanCard';
import { PlanCard } from './PlanCard';

/**
 * A proposal-shaped stand-in for the runtime authority.
 *
 * Written out in full rather than cast, because its ABSENCE is what these
 * stories and tests are about: `proposal` is dropped by persistence, so a card
 * without one is a revived card. A stub that is structurally a proposal keeps
 * that distinction honest without minting real authority, which only
 * `createAiValidatedProposal` may do.
 */
const proposal: AiValidatedProposal = {
  schemaVersion: 1,
  plan: { rationale: '', commands: [] },
  policy: { allowedCommands: [], maxCommands: 0, maxOperations: 0 },
  skillActivations: [],
  contextFingerprint: 'sha256-context',
  proposalFingerprint: 'sha256-proposal',
};

/**
 * A revived turn is built by OMITTING `proposal`, never by passing `undefined`
 * for it: under `exactOptionalPropertyTypes` those are different types, and the
 * one the panel actually revives is the absent one.
 */
function revivedTurn(overrides: Partial<PlanTurn> = {}): PlanTurn {
  const withAuthority: Record<string, unknown> = { ...planTurn(overrides) };
  delete withAuthority['proposal'];
  return withAuthority as unknown as PlanTurn;
}

function planTurn(overrides: Partial<PlanTurn> = {}): PlanTurn {
  return {
    id: 'turn-1',
    from: 'assistant',
    kind: 'plan',
    plan: {
      rationale: 'أضيف قسم أسعار بثلاث خطط.',
      commands: [
        { command: 'insertNode', args: { type: 'pricing-table' } },
        { command: 'setProp', args: { id: 'hero', key: 'title', value: 'ابدأ' } },
      ],
    },
    applied: false,
    proposal,
    ...overrides,
  };
}

function propsFor(overrides: Partial<PlanCardProps> = {}): PlanCardProps {
  return {
    turn: planTurn(),
    locale: 'ar',
    mode: 'ask',
    canWrite: true,
    onApply: vi.fn(),
    onPreview: vi.fn(),
    onDiscard: vi.fn(),
    onUndo: vi.fn(),
    onReviewAsCode: undefined,
    ...overrides,
  };
}

function renderCard(overrides: Partial<PlanCardProps> = {}) {
  const props = propsFor(overrides);
  render(<PlanCard {...props} />);
  return props;
}

describe('PlanCard', () => {
  it('says why, and how many steps', () => {
    renderCard();
    expect(screen.getByText('أضيف قسم أسعار بثلاث خطط.')).toBeInTheDocument();
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('counts one step in the singular', () => {
    renderCard({
      turn: planTurn({
        plan: { rationale: 'x', commands: [{ command: 'insertNode', args: {} }] },
      }),
    });
    expect(screen.getByText('1 step')).toBeInTheDocument();
  });

  it('reveals steps on demand while keeping the proposal readable', async () => {
    renderCard();
    expect(screen.getByText('insertNode')).not.toBeVisible();
    await userEvent.click(screen.getByText('تفاصيل التغييرات'));
    expect(screen.getByText('insertNode')).toBeVisible();
    const steps = screen.getAllByRole('listitem');
    expect(steps.at(0)).toHaveTextContent('insertNode');
    expect(steps.at(1)).toHaveTextContent('setProp');
  });

  it('lets the rationale declare its own direction', () => {
    renderCard();
    expect(screen.getByText('أضيف قسم أسعار بثلاث خطط.')).toHaveAttribute('dir', 'auto');
  });

  it('names the Skills the request activated, when it activated any', async () => {
    renderCard({
      turn: planTurn({
        skills: [
          {
            id: 'craftkit.landing-page',
            version: '1.2.0',
            contentFingerprint: 'sha256-abcdef0123456789',
            reason: 'auto',
          },
        ],
      }),
    });
    await userEvent.click(screen.getByText('تفاصيل التغييرات'));
    expect(screen.getByRole('list', { name: 'Activated Skills' })).toHaveTextContent(
      'craftkit.landing-page',
    );
  });

  describe('a salvaged plan', () => {
    const salvaged = planTurn({
      salvaged: {
        kept: 3,
        dropped: [
          { step: 2, command: 'insertNode', reason: 'unregistered block "carousel"' },
          { step: 5, command: 'setProp', reason: 'prop "colour" is not on this block' },
        ],
      },
    });

    it('says how many steps were dropped, without being opened', () => {
      renderCard({ turn: salvaged });
      expect(screen.getByText('أُسقطت 2 من خطوات الخطة')).toBeInTheDocument();
    });

    it('counts one dropped step in the singular, in English', () => {
      renderCard({
        turn: planTurn({
          salvaged: { kept: 1, dropped: [{ step: 2, command: 'insertNode', reason: 'no' }] },
        }),
        locale: 'en',
      });
      expect(screen.getByText('1 step dropped from this plan')).toBeInTheDocument();
    });

    it('keeps the reasons folded away until asked for', () => {
      const { container } = render(<PlanCard {...propsFor({ turn: salvaged })} />);
      expect(container.querySelector('details')?.open).toBe(false);
    });

    it('gives the door’s own reason for each step, with its position', () => {
      renderCard({ turn: salvaged });
      const steps = [...document.querySelectorAll('.pg-chat__salvage li')];
      expect(steps.at(0)).toHaveTextContent('الخطوة 2 · insertNode');
      expect(steps.at(0)).toHaveTextContent('unregistered block "carousel"');
      expect(steps.at(1)).toHaveTextContent('الخطوة 5 · setProp');
    });

    it('says nothing at all when the plan lost nothing', () => {
      renderCard({ turn: planTurn({ salvaged: { kept: 3, dropped: [] } }) });
      expect(document.querySelector('.pg-chat__salvage')).toBeNull();
    });

    it('says nothing at all when no salvage ran', () => {
      renderCard();
      expect(document.querySelector('.pg-chat__salvage')).toBeNull();
    });

    it('still lists the steps that survived — the plan is a smaller success', () => {
      renderCard({ turn: salvaged });
      expect(screen.getByText('2 steps')).toBeInTheDocument();
    });
  });

  describe('the decision', () => {
    it('offers Apply, Preview and Discard on a fresh proposal in Ask', async () => {
      const props = renderCard();
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
      expect(props.onApply).toHaveBeenCalledOnce();
      expect(props.onPreview).toHaveBeenCalledOnce();
      expect(props.onDiscard).toHaveBeenCalledOnce();
    });

    it('never offers Apply for a plan PROPOSED in Plan mode', () => {
      renderCard({ turn: planTurn({ mode: 'plan' }) });
      expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    });

    it('withdraws Apply from an Ask proposal once the panel is in Plan mode', () => {
      renderCard({ turn: planTurn({ mode: 'ask' }), mode: 'plan' });
      expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    });

    it('shows Review as code only when the host has one', async () => {
      renderCard();
      expect(screen.queryByRole('button', { name: 'Review as code' })).toBeNull();
      const onReviewAsCode = vi.fn();
      renderCard({ onReviewAsCode });
      await userEvent.click(screen.getAllByRole('button', { name: 'Review as code' })[0]!);
      expect(onReviewAsCode).toHaveBeenCalledOnce();
    });
  });

  describe('a card revived from storage', () => {
    const revived = revivedTurn();

    it('offers no button that would act on authority it no longer holds', () => {
      renderCard({ turn: revived });
      expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    });

    it('says why, so the card is not merely inert', () => {
      renderCard({ turn: revived });
      expect(
        screen.getByText('This saved proposal expired after reload. Ask again to revalidate it.'),
      ).toBeInTheDocument();
    });

    it('can still be discarded — dismissing is not acting on the document', () => {
      renderCard({ turn: revived });
      expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    });

    it('offers no Undo once applied, because the transaction belongs to another session', () => {
      renderCard({ turn: revivedTurn({ applied: true }) });
      expect(screen.getByText(/Applied as one change/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    });
  });

  describe('once applied', () => {
    it('offers Undo while the panel may write', async () => {
      const props = renderCard({ turn: planTurn({ applied: true }) });
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(props.onUndo).toHaveBeenCalledOnce();
    });

    it('withdraws Undo — a write — when the panel may not write', () => {
      renderCard({ turn: planTurn({ applied: true }), canWrite: false });
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
      expect(screen.getByText('Planning only — switch mode to undo.')).toBeInTheDocument();
    });

    it('shows no decision row at all', () => {
      renderCard({ turn: planTurn({ applied: true }) });
      expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    });
  });
});
