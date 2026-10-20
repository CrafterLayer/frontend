import { canonicalJsonStringify } from '../internal/canonical-json';
import type { BuilderDocument } from '@craftkit/builder-schema';
import {
  DEFAULT_AI_MAX_OPERATIONS,
  type AiEffectiveCommandPolicy,
  type AiSkillActivationPin,
} from '../skills';
import { sha256Hex } from '../skills/sha256';
import type { AiPlan, AssembledAiContext } from '../types';
import {
  captureCreativeSource,
  creativeSourceConflict,
  type CreativeSourceGuard,
} from './creative-source-guard';

const authenticatedProposals = new WeakMap<object, CreativeSourceGuard>();

export type AiValidatedProposalErrorCode =
  | 'ambiguous-authority'
  | 'invalid-policy'
  | 'missing-authority'
  | 'proposal-integrity-mismatch'
  | 'stale-source'
  | 'unauthenticated-proposal';

export class AiValidatedProposalError extends Error {
  readonly code: AiValidatedProposalErrorCode;

  constructor(code: AiValidatedProposalErrorCode, message: string) {
    super(message);
    this.name = 'AiValidatedProposalError';
    this.code = code;
  }
}

export interface AiPinnedCommandPolicy {
  readonly allowedCommands: readonly string[];
  readonly maxCommands: number;
  readonly maxOperations: number;
}

/**
 * Runtime-authenticated authority produced only after a plan passed generation
 * validation. The detached JSON data is safe to expose to observers; the
 * module-private authentication record prevents a spread/clone from silently
 * replacing its plan or authority before preview/application.
 */
export interface AiValidatedProposal {
  readonly schemaVersion: 1;
  readonly plan: AiPlan;
  readonly policy: AiPinnedCommandPolicy;
  readonly skillActivations: readonly AiSkillActivationPin[];
  readonly contextFingerprint: string;
  readonly proposalFingerprint: string;
}

export interface CreateAiValidatedProposalOptions {
  plan: AiPlan;
  policy: AiEffectiveCommandPolicy;
  skillActivations?: readonly AiSkillActivationPin[];
  context: AssembledAiContext;
}

interface AiProposalFingerprintPayload {
  schemaVersion: 1;
  plan: AiPlan;
  policy: AiPinnedCommandPolicy;
  skillActivations: readonly AiSkillActivationPin[];
  contextFingerprint: string;
}

export interface AiProposalAuthorityInput {
  proposal?: AiValidatedProposal;
  plan?: AiPlan;
  policy?: AiEffectiveCommandPolicy;
}

export interface AiResolvedProposalAuthority {
  readonly plan: AiPlan;
  readonly policy: AiEffectiveCommandPolicy;
  readonly proposal?: AiValidatedProposal;
}

function fail(code: AiValidatedProposalErrorCode, message: string): never {
  throw new AiValidatedProposalError(code, message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function cloneCanonicalJson<T>(value: T): T {
  const parsed: unknown = JSON.parse(canonicalJsonStringify(value));
  return parsed as T;
}

function boundedPositiveSafeInteger(value: number, field: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    return fail(
      'invalid-policy',
      `${field} must be a positive safe integer no greater than ${String(maximum)}.`,
    );
  }
  return value;
}

function pinnedPolicy(policy: AiEffectiveCommandPolicy): AiPinnedCommandPolicy {
  if (!Array.isArray(policy.allowedCommands)) {
    return fail('invalid-policy', 'policy.allowedCommands must be an array.');
  }
  const allowedCommands = policy.allowedCommands.map((command, index) => {
    if (typeof command !== 'string' || command.trim().length === 0) {
      return fail(
        'invalid-policy',
        `policy.allowedCommands[${String(index)}] must be a non-empty command name.`,
      );
    }
    return command;
  });
  if (new Set(allowedCommands).size !== allowedCommands.length) {
    return fail('invalid-policy', 'policy.allowedCommands must not contain duplicates.');
  }
  return deepFreeze({
    allowedCommands,
    maxCommands: boundedPositiveSafeInteger(policy.maxCommands, 'policy.maxCommands', 10_000),
    maxOperations: boundedPositiveSafeInteger(
      policy.maxOperations ?? DEFAULT_AI_MAX_OPERATIONS,
      'policy.maxOperations',
      100_000,
    ),
  });
}

function contextFingerprint(context: AssembledAiContext): string {
  return `ai-context-v1-sha256-${sha256Hex(canonicalJsonStringify(context))}`;
}

function fingerprintPayload(
  proposal: Pick<
    AiValidatedProposal,
    'contextFingerprint' | 'plan' | 'policy' | 'schemaVersion' | 'skillActivations'
  >,
): AiProposalFingerprintPayload {
  return {
    schemaVersion: proposal.schemaVersion,
    plan: proposal.plan,
    policy: proposal.policy,
    skillActivations: proposal.skillActivations,
    contextFingerprint: proposal.contextFingerprint,
  };
}

function proposalFingerprint(payload: AiProposalFingerprintPayload): string {
  return `ai-proposal-v1-sha256-${sha256Hex(canonicalJsonStringify(payload))}`;
}

export function createAiValidatedProposal(
  options: CreateAiValidatedProposalOptions,
): AiValidatedProposal {
  const plan = deepFreeze(cloneCanonicalJson(options.plan));
  const policy = pinnedPolicy(options.policy);
  const skillActivations = deepFreeze(
    cloneCanonicalJson(options.skillActivations ?? ([] as readonly AiSkillActivationPin[])),
  );
  const fingerprint = contextFingerprint(options.context);
  const payload: AiProposalFingerprintPayload = {
    schemaVersion: 1,
    plan,
    policy,
    skillActivations,
    contextFingerprint: fingerprint,
  };
  const proposal = deepFreeze({
    ...payload,
    proposalFingerprint: proposalFingerprint(payload),
  });
  authenticatedProposals.set(proposal, captureCreativeSource(plan, options.context));
  return proposal;
}

export function assertAuthenticatedAiValidatedProposal(
  value: unknown,
): asserts value is AiValidatedProposal {
  if (typeof value !== 'object' || value === null || !authenticatedProposals.has(value)) {
    return fail(
      'unauthenticated-proposal',
      'An authenticated AI validated proposal is required; cloned or substituted values are rejected.',
    );
  }
  const proposal = value as AiValidatedProposal;
  const expected = proposalFingerprint(fingerprintPayload(proposal));
  if (proposal.proposalFingerprint !== expected) {
    return fail(
      'proposal-integrity-mismatch',
      'The AI validated proposal no longer matches its authenticated fingerprint.',
    );
  }
}

/** @internal Check the original writer source immediately before the live mutation. */
export function assertAiProposalSourceCurrent(
  proposal: AiValidatedProposal,
  document: BuilderDocument,
): void {
  assertAuthenticatedAiValidatedProposal(proposal);
  const conflict = creativeSourceConflict(authenticatedProposals.get(proposal) ?? [], document);
  if (conflict !== undefined) {
    fail(
      'stale-source',
      `The existing content in "${conflict.id}" changed after this edit was prepared. Your newer changes were kept; retry against the current content.`,
    );
  }
}

function owns(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** @internal Shared by preview/apply so both doors have identical fail-closed semantics. */
export function resolveAiProposalAuthority(
  input: AiProposalAuthorityInput,
): AiResolvedProposalAuthority {
  const proposal = input.proposal;
  if (proposal !== undefined) {
    if (owns(input, 'plan') || owns(input, 'policy')) {
      return fail(
        'ambiguous-authority',
        'A validated proposal cannot be combined with a substituted plan or policy.',
      );
    }
    assertAuthenticatedAiValidatedProposal(proposal);
    return {
      proposal,
      plan: proposal.plan,
      policy: proposal.policy,
    };
  }
  if (input.plan === undefined || input.policy === undefined) {
    return fail(
      'missing-authority',
      'Provide an authenticated validated proposal, or an explicit plan and effective policy.',
    );
  }
  return { plan: input.plan, policy: pinnedPolicy(input.policy) };
}
