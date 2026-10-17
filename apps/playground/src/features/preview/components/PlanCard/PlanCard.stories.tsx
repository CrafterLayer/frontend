import type { AiValidatedProposal } from '@craftkit/builder';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import type { PlanTurn } from '../AssistantPanel/AssistantPanel.turns';
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

const turn = (overrides: Partial<PlanTurn> = {}): PlanTurn => ({
  id: 'turn-1',
  from: 'assistant',
  kind: 'plan',
  plan: {
    rationale: 'أضيف قسم أسعار بثلاث خطط، وأربطه بزر البطل.',
    commands: [
      { command: 'insertNode', args: { type: 'pricing-table' } },
      { command: 'setProp', args: { id: 'hero-cta', key: 'href', value: '#pricing' } },
    ],
  },
  impact: {
    added: ['pricing'],
    changed: ['hero-cta'],
    removed: [],
    addedTypes: ['pricing-table'],
    meta: [],
    empty: false,
  },
  costTokens: 4237,
  applied: false,
  proposal,
  ...overrides,
});

/** As persistence leaves it: everything but the runtime authority. */
const revivedTurn = (): PlanTurn => {
  const withAuthority: Record<string, unknown> = { ...turn() };
  delete withAuthority['proposal'];
  return withAuthority as unknown as PlanTurn;
};

const meta = {
  title: 'Playground/PlanCard',
  component: PlanCard,
  parameters: { layout: 'centered' },
  args: {
    turn: turn(),
    locale: 'ar',
    mode: 'ask',
    canWrite: true,
    onApply: () => undefined,
    onPreview: () => undefined,
    onDiscard: () => undefined,
    onUndo: () => undefined,
  },
} satisfies Meta<typeof PlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A fresh proposal in Ask: the whole decision, with Apply at the front. */
export const Proposal: Story = {};

/** Proposed in Plan mode. Preview is offered; Apply never appears. */
export const PlannedOnly: Story = { args: { turn: turn({ mode: 'plan' }) } };

/**
 * An Ask proposal seen after the person switched to Plan. Apply is withdrawn —
 * `accept` would refuse it, and offering what would be refused is the lie.
 */
export const AskProposalInPlanMode: Story = { args: { mode: 'plan' } };

/** Applied. One entry in history, one undo. */
export const Applied: Story = { args: { turn: turn({ applied: true }) } };

/** Applied, but the panel may no longer write. Undo is a write. */
export const AppliedPlanOnly: Story = {
  args: { turn: turn({ applied: true }), canWrite: false },
};

/** Revived after a reload: readable, and honestly inert. */
export const Revived: Story = { args: { turn: revivedTurn() } };

/** The Skills the request activated, pinned by version and fingerprint. */
export const WithSkills: Story = {
  args: {
    turn: turn({
      skills: [
        {
          id: 'craftkit.landing-page',
          version: '1.2.0',
          contentFingerprint: 'sha256-abcdef0123456789',
          reason: 'auto',
        },
      ],
    }),
  },
};

/**
 * A SALVAGED plan: the recovery ladder kept what the door accepted and left two
 * steps behind. The count is visible without opening anything; the reasons are
 * one click away.
 */
export const Salvaged: Story = {
  args: {
    turn: turn({
      salvaged: {
        kept: 2,
        dropped: [
          { step: 2, command: 'insertNode', reason: 'unregistered block "carousel"' },
          { step: 5, command: 'setProp', reason: 'prop "colour" is not on this block' },
        ],
      },
    }),
  },
};

/** A plan that validated, applied cleanly — and moves nothing. */
export const ChangesNothing: Story = {
  args: {
    turn: turn({
      impact: {
        added: [],
        changed: [],
        removed: [],
        addedTypes: [],
        meta: [],
        empty: true,
      },
    }),
  },
};
