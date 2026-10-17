import type { AiPlanStep } from '@craftkit/builder';

function argText(args: unknown, key: string): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function shortSkillFingerprint(fingerprint: string): string {
  const hash = fingerprint.startsWith('skill-v1-sha256-')
    ? fingerprint.slice('skill-v1-sha256-'.length)
    : fingerprint;
  return hash.slice(0, 8);
}

/** Human-readable fallback for a provider step whose optional title is absent. */
export function describeStep(step: AiPlanStep): string {
  if (step.title !== undefined) return step.title;
  const type = argText(step.args, 'type');
  const id = argText(step.args, 'id');
  const key = argText(step.args, 'key');
  switch (step.command) {
    case 'insertNode':
      return `Add ${type ?? 'a block'}`;
    case 'setProp':
      return `Change ${key ?? 'a property'} of ${id ?? 'a block'}`;
    case 'removeNode':
      return `Remove ${id ?? 'a block'}`;
    case 'moveNode':
      return `Move ${id ?? 'a block'}`;
    case 'duplicateNode':
      return `Duplicate ${id ?? 'a block'}`;
    case 'wrapNode':
      return `Wrap ${id ?? 'a block'} in ${argText(step.args, 'wrapperType') ?? 'a container'}`;
    case 'groupNodes':
      return `Group blocks into ${argText(step.args, 'groupType') ?? 'a group'}`;
    case 'setBinding':
      return `Bind ${key ?? 'a property'} of ${id ?? 'a block'}`;
    case 'setResponsive':
      return `Adjust ${key ?? 'a property'} per breakpoint on ${id ?? 'a block'}`;
    default:
      return step.command;
  }
}
