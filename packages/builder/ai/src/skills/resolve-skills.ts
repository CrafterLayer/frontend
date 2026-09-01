import { AiSkillResolutionError } from './errors';
import { compareSkillText } from './compare';
import type {
  AiActiveSkillContext,
  AiDefinedSkillV1,
  AiPreparedSkillContext,
  AiSkillActivationPin,
  AiSkillActivationReason,
  AiSkillManifestV1,
  AiSkillOmission,
  AiSkillPrepareOptions,
  AiSkillScript,
} from './types';

export const DEFAULT_AI_SKILL_MAX_ACTIVE = 16;
export const DEFAULT_AI_SKILL_TOKEN_BUDGET = 16_000;

interface Candidate {
  skill: AiDefinedSkillV1;
  reason: AiSkillActivationReason;
  mandatory: boolean;
}

function resolutionError(code: string, message: string): never {
  throw new AiSkillResolutionError(code, message);
}

function sourceRank(manifest: AiSkillManifestV1): number {
  return manifest.source === 'builtin' ? 0 : 1;
}

function compareAuto(left: AiDefinedSkillV1, right: AiDefinedSkillV1): number {
  return (
    right.manifest.priority - left.manifest.priority ||
    sourceRank(left.manifest) - sourceRank(right.manifest) ||
    compareSkillText(left.manifest.id, right.manifest.id)
  );
}

function matchesAuto(
  skill: AiDefinedSkillV1,
  request: string,
  selectedBlockTypes: ReadonlySet<string>,
): boolean {
  const activation = skill.manifest.activation;
  if (activation.mode !== 'auto') return false;
  const normalizedRequest = request.toLowerCase();
  const keywordMatch =
    activation.keywords?.some((keyword) => normalizedRequest.includes(keyword)) ?? false;
  const blockMatch =
    activation.selectedBlockTypes?.some((type) => selectedBlockTypes.has(type)) ?? false;
  const scriptMatch = activation.scripts?.some((script) => requestUsesScript(request, script)) ?? false;
  return keywordMatch || blockMatch || scriptMatch;
}

/**
 * Whether the request carries any character of the given writing system.
 *
 * ANY character, deliberately: a mostly-English request with one Arabic word
 * is a request whose page may carry Arabic, and the RTL expertise costs
 * ~400 tokens against a page laid out backwards. The Arabic block covers the
 * base range plus the supplement, extended ranges and presentation forms, so
 * Persian/Urdu letters and the shaped forms some editors paste all count.
 */
const SCRIPT_PATTERNS: Readonly<Record<AiSkillScript, RegExp>> = {
  arabic: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u,
  latin: /[A-Za-zÀ-ɏ]/u,
};

function requestUsesScript(request: string, script: AiSkillScript): boolean {
  return SCRIPT_PATTERNS[script].test(request);
}

function skillsConflict(left: AiDefinedSkillV1, right: AiDefinedSkillV1): boolean {
  return (
    left.manifest.conflicts.includes(right.manifest.id) ||
    right.manifest.conflicts.includes(left.manifest.id)
  );
}

function activeContext(candidate: Candidate): AiActiveSkillContext {
  const { manifest, instructions, references } = candidate.skill;
  const base = {
    id: manifest.id,
    version: manifest.version,
    contentFingerprint: manifest.contentFingerprint,
    reason: candidate.reason,
    name: manifest.name,
    description: manifest.description,
    instructions,
    references: Object.freeze(
      Object.entries(references).map(([path, content]) => Object.freeze({ path, content })),
    ),
  };
  return Object.freeze(
    manifest.restrictToCommands === undefined
      ? base
      : { ...base, restrictToCommands: manifest.restrictToCommands },
  );
}

function estimateTokens(candidate: Candidate): number {
  // Budget the exact canonical active fragment, including identity, reason,
  // description, command restriction, instructions, and reference metadata.
  return Math.max(1, Math.ceil(JSON.stringify(activeContext(candidate)).length / 4));
}

function effectiveRestriction(candidates: readonly Candidate[]): readonly string[] | undefined {
  const restrictions = candidates
    .map(({ skill }) => skill.manifest.restrictToCommands)
    .filter((commands): commands is readonly string[] => commands !== undefined);
  if (restrictions.length === 0) return undefined;

  const first = restrictions[0];
  if (first === undefined) return undefined;
  const rest = restrictions.slice(1);
  const intersection = first.filter((command) =>
    rest.every((commands) => commands.includes(command)),
  );
  return Object.freeze(intersection.sort(compareSkillText));
}

function positiveInteger(value: number | undefined, fallback: number, field: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0) {
    return resolutionError('invalid-limit', `${field} must be a positive safe integer.`);
  }
  return result;
}

function addDependencies(
  entries: ReadonlyMap<string, AiDefinedSkillV1>,
  roots: readonly Candidate[],
  candidates: Map<string, Candidate>,
): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (candidate: Candidate, chain: readonly string[]): void => {
    const id = candidate.skill.manifest.id;
    if (visiting.has(id)) {
      return resolutionError(
        'dependency-cycle',
        `Skill dependency cycle: ${[...chain, id].join(' -> ')}`,
      );
    }
    if (visited.has(id)) return;
    visiting.add(id);

    for (const dependencyId of candidate.skill.manifest.dependencies) {
      const dependency = entries.get(dependencyId);
      if (dependency === undefined) {
        return resolutionError(
          'unknown-dependency',
          `Skill ${id} depends on unknown skill ${dependencyId}.`,
        );
      }
      const existing = candidates.get(dependencyId);
      if (existing === undefined) {
        candidates.set(dependencyId, { skill: dependency, reason: 'dependency', mandatory: true });
      }
      visit(existing ?? { skill: dependency, reason: 'dependency', mandatory: true }, [
        ...chain,
        id,
      ]);
    }

    visiting.delete(id);
    visited.add(id);
  };

  for (const root of roots) visit(root, []);
}

export function resolveAiSkills(
  entries: ReadonlyMap<string, AiDefinedSkillV1>,
  catalog: readonly AiSkillManifestV1[],
  options: AiSkillPrepareOptions,
): AiPreparedSkillContext {
  if (typeof options.request !== 'string') {
    return resolutionError('invalid-request', 'request must be a string.');
  }
  const maxActiveSkills = positiveInteger(
    options.maxActiveSkills,
    DEFAULT_AI_SKILL_MAX_ACTIVE,
    'maxActiveSkills',
  );
  const maxSkillTokens = positiveInteger(
    options.maxSkillTokens,
    DEFAULT_AI_SKILL_TOKEN_BUDGET,
    'maxSkillTokens',
  );
  const allowUntrusted = options.allowUntrusted === true;
  const candidates = new Map<string, Candidate>();

  const explicitIds = [...new Set(options.selectedSkillIds ?? [])].sort(compareSkillText);
  for (const id of explicitIds) {
    const skill = entries.get(id);
    if (skill === undefined) {
      return resolutionError('unknown-explicit-skill', `Unknown explicitly selected skill ${id}.`);
    }
    candidates.set(id, { skill, reason: 'explicit', mandatory: true });
  }

  const always = [...entries.values()]
    .filter(({ manifest }) => manifest.activation.mode === 'always')
    .sort((left, right) => compareSkillText(left.manifest.id, right.manifest.id));
  for (const skill of always) {
    if (!candidates.has(skill.manifest.id)) {
      candidates.set(skill.manifest.id, { skill, reason: 'always', mandatory: true });
    }
  }

  const mandatoryRoots = [...candidates.values()];
  addDependencies(entries, mandatoryRoots, candidates);

  for (const candidate of candidates.values()) {
    if (candidate.skill.manifest.trust === 'untrusted' && !allowUntrusted) {
      return resolutionError(
        'untrusted-mandatory-skill',
        `Skill ${candidate.skill.manifest.id} is untrusted and requires explicit host opt-in.`,
      );
    }
  }

  const explicit = [...candidates.values()]
    .filter(({ reason }) => reason === 'explicit')
    .sort((left, right) => compareSkillText(left.skill.manifest.id, right.skill.manifest.id));
  const alwaysCandidates = [...candidates.values()]
    .filter(({ reason }) => reason === 'always')
    .sort((left, right) => compareSkillText(left.skill.manifest.id, right.skill.manifest.id));
  const dependencies = [...candidates.values()]
    .filter(({ reason }) => reason === 'dependency')
    .sort((left, right) => compareSkillText(left.skill.manifest.id, right.skill.manifest.id));
  const accepted: Candidate[] = [...explicit, ...alwaysCandidates, ...dependencies];

  for (const [leftIndex, left] of accepted.entries()) {
    for (const right of accepted.slice(leftIndex + 1)) {
      if (skillsConflict(left.skill, right.skill)) {
        return resolutionError(
          'mandatory-conflict',
          `Mandatory skills ${left.skill.manifest.id} and ${right.skill.manifest.id} conflict.`,
        );
      }
    }
  }

  let totalTokens = accepted.reduce((total, candidate) => total + estimateTokens(candidate), 0);
  if (accepted.length > maxActiveSkills) {
    return resolutionError('active-limit', 'Mandatory skills exceed the active skill limit.');
  }
  if (totalTokens > maxSkillTokens) {
    return resolutionError(
      'token-budget',
      'Mandatory skill content exceeds the skill token budget.',
    );
  }

  const omitted: AiSkillOmission[] = [];
  if (options.auto !== false) {
    const selectedBlockTypes = new Set(
      (options.selectedBlockTypes ?? []).map((type) => type.trim().toLowerCase()),
    );
    const autoMatches = [...entries.values()]
      .filter(
        (skill) =>
          !candidates.has(skill.manifest.id) &&
          matchesAuto(skill, options.request, selectedBlockTypes),
      )
      .sort(compareAuto);

    for (const skill of autoMatches) {
      const id = skill.manifest.id;
      // A higher-priority auto skill may already have activated this matching
      // skill through its dependency closure. The snapshot still contains it,
      // so re-check live membership before accounting or exposing it again.
      if (candidates.has(id)) continue;
      const root: Candidate = { skill, reason: 'auto', mandatory: false };
      const closure = new Map<string, Candidate>([[id, root]]);
      addDependencies(entries, [root], closure);
      const optionalGroup = [
        ...[...closure.values()]
          .filter(
            (candidate) =>
              candidate.reason === 'dependency' && !candidates.has(candidate.skill.manifest.id),
          )
          .map((candidate) => ({ ...candidate, mandatory: false }))
          .sort((left, right) => compareSkillText(left.skill.manifest.id, right.skill.manifest.id)),
        root,
      ];

      const untrusted = optionalGroup.find(
        (candidate) => candidate.skill.manifest.trust === 'untrusted',
      );
      if (untrusted !== undefined && !allowUntrusted) {
        omitted.push({
          id,
          code: 'untrusted',
          message: `Auto-matched skill ${id} requires untrusted skill ${untrusted.skill.manifest.id}.`,
        });
        continue;
      }
      const conflict = optionalGroup.find((candidate) =>
        accepted.some((active) => skillsConflict(active.skill, candidate.skill)),
      );
      if (conflict !== undefined) {
        omitted.push({
          id,
          code: 'conflict',
          message: `Skill ${id} or one of its dependencies conflicts with an active skill.`,
        });
        continue;
      }
      const internalConflict = optionalGroup.some((left, index) =>
        optionalGroup.slice(index + 1).some((right) => skillsConflict(left.skill, right.skill)),
      );
      if (internalConflict) {
        omitted.push({
          id,
          code: 'conflict',
          message: `Skill ${id} conflicts with one of its dependencies.`,
        });
        continue;
      }
      if (accepted.length + optionalGroup.length > maxActiveSkills) {
        omitted.push({
          id,
          code: 'active-limit',
          message: `Skill ${id} exceeds the active skill limit.`,
        });
        continue;
      }
      const tokens = optionalGroup.reduce(
        (total, candidate) => total + estimateTokens(candidate),
        0,
      );
      if (totalTokens + tokens > maxSkillTokens) {
        omitted.push({
          id,
          code: 'token-budget',
          message: `Skill ${id} exceeds the skill token budget.`,
        });
        continue;
      }
      for (const candidate of optionalGroup) {
        accepted.push(candidate);
        candidates.set(candidate.skill.manifest.id, candidate);
      }
      totalTokens += tokens;
    }
  }

  const active = Object.freeze(accepted.map(activeContext));
  const activations: readonly AiSkillActivationPin[] = Object.freeze(
    active.map(({ id, version, contentFingerprint, reason }) =>
      Object.freeze({ id, version, contentFingerprint, reason }),
    ),
  );
  const resultBase = {
    catalog,
    active,
    activations,
    omitted: Object.freeze(omitted.map((item) => Object.freeze(item))),
    totalTokens,
  };
  const restriction = effectiveRestriction(accepted);
  return Object.freeze(
    restriction === undefined
      ? resultBase
      : { ...resultBase, effectiveCommandRestriction: restriction },
  );
}
