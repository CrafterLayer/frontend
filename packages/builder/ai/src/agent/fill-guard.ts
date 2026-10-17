import type { AiPlan } from '../types';
import type { AiBuildSectionKey, AiBuildOutOfScopeStep, AiBuildTask } from './types';

/** The only props a section writer may set, and only on its own region. */
const FILL_KEYS: readonly AiBuildSectionKey[] = Object.freeze(['tree', 'css']);
/** With free code mode on a writer may also give its region a scene: its own `js`. */
const FILL_KEYS_WITH_CODE: readonly AiBuildSectionKey[] = Object.freeze([
  'tree',
  'css',
  'js',
  'jsMeta',
  'jsParams',
]);

export interface GuardedFill {
  /** The steps that stay inside the region, in the order the writer wrote them. */
  readonly commands: AiPlan['commands'];
  /** Set when code changed a step (`SectionJob.tidy`): the run's own proposal no longer matches. */
  readonly tidied?: true;
  /** The props those steps write — what the landing records and a revert restores. */
  readonly keys: readonly AiBuildSectionKey[];
  readonly outOfScope: readonly AiBuildOutOfScopeStep[];
}

export function stringArg(args: unknown, name: 'id' | 'key'): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined;
  const value: unknown = (args as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function isFillKey(
  key: string | undefined,
  allowed: readonly AiBuildSectionKey[],
): key is AiBuildSectionKey {
  return key !== undefined && (allowed as readonly string[]).includes(key);
}

/**
 * The target guard keeps markup and, with Free code on, scene data in the captured region.
 *
 * The command policy only ever checked NAMES. `setProp` was allowed, so a
 * writer could set any prop on any node, and the comment that promised "each
 * fill writes only its own region's tree" was a hope. Measured 2026-09-28
 * (agent-audit.md P0-2): one writer replaced the page CSS — the skeleton's
 * font import went with it — and another overwrote the hero, and both
 * reported `applied`. Page-level skills tell writers to do exactly that
 * ("load fonts in pageCss", "KEYFRAMES live in pageCss"), so it is not rare.
 *
 * Outside steps are dropped and reported on the section.
 */
export function guardFill(plan: AiPlan, task: AiBuildTask, freeCode = false): GuardedFill {
  const allowed = freeCode ? FILL_KEYS_WITH_CODE : FILL_KEYS;
  const commands: AiPlan['commands'][number][] = [];
  const keys = new Set<AiBuildSectionKey>();
  const outOfScope: AiBuildOutOfScopeStep[] = [];
  for (const step of plan.commands) {
    const id = stringArg(step.args, 'id');
    const key = stringArg(step.args, 'key');
    if (step.command === 'setProp' && id === task.id && isFillKey(key, allowed)) {
      commands.push(step);
      keys.add(key);
      continue;
    }
    outOfScope.push(
      Object.freeze({
        command: step.command,
        ...(id === undefined ? {} : { id }),
        ...(key === undefined ? {} : { key }),
        reason: `A section writer may set only its own region's ${freeCode ? 'tree, css, js and scene settings' : 'tree and css'} (region ${task.id}); this ${step.command}${key === undefined ? '' : ` of "${key}"`}${id === undefined ? '' : ` on ${id}`} reached outside it and was dropped.`,
      }),
    );
  }
  return {
    commands: Object.freeze(commands),
    keys: allowed.filter((key) => keys.has(key)),
    outOfScope: Object.freeze(outOfScope),
  };
}
