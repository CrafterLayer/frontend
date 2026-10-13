import type { BuilderKernel } from '@craftkit/builder-core';
import {
  CUSTOM_CODE_REGION_CSS_MAX,
  CUSTOM_CODE_REGION_JS_MAX,
  customCodeTree,
  findCssRejection,
  type JsonValue,
} from '@craftkit/builder-schema';

import type { AiPlan } from '../../types';
import { checkScene } from './check-scene';
import { checkSection, tokeniseColourClasses } from './check-section';
import { SCENE_FIXERS } from './tidy-scene';
import { isRecord, type TidyFixer } from './tidy-shared';
import { TREE_FIXERS } from './tidy-tree';
import type {
  LandedSection,
  PagePlan,
  SectionCheckCode,
  SectionCheckIssue,
  SectionContract,
} from './types';

/*
  Code repairs on what a writer wrote, BEFORE the check (2026-10-13, ready
  scripts): what code can fix never costs a repair round. Until now `tidy`
  moved palette classes onto the page's tokens and nothing else, so an h1 in
  a band, a missing anchor id, a button where the action's link belongs, an
  rgba() shadow in the css, a library used and not listed, a ticker loop with
  no reduced-motion guard — each sent the whole section back to its writer:
  the brief re-sent, the section written again, 20-60 s while the sections
  below waited to land.

  The repairs are driven by the check itself: the section is checked, each
  repair that answers one of the codes found makes ONLY the fix the
  instruction names where it has one reading (tidy-tree.ts, tidy-scene.ts),
  and the result is kept only when the region's own schema takes it and the
  check then finds strictly less, no code more often. So a repair can never
  cost a section, never hide a defect behind another, and never change what
  the writer said — words, photos, layout and where things go stay the
  writer's, for the one repair round the check still sends.
*/

/** What the region block's schema takes for a prop: tidy writes nothing it would refuse. */
export type TidyAccepts = (key: 'tree' | 'css' | 'js', value: unknown) => boolean;

export interface TidySectionOptions {
  readonly plan: PagePlan;
  /** The section's contract; absent, only the palette classes are tidied. */
  readonly contract?: SectionContract | undefined;
  /** The person's words, for the check's image rule (as the build checks). */
  readonly request?: string | undefined;
  /** The region block's own schema (`regionPropAccepts`); absent, the schema package's ceilings. */
  readonly accepts?: TidyAccepts | undefined;
}

export interface TidyReport {
  /** The same array when nothing changed, so a caller can tell by identity. */
  readonly commands: AiPlan['commands'];
  /** The repairs made, in order (`palette-classes`, `heading-level`, …). */
  readonly fixed: readonly string[];
}

const FIXERS: readonly TidyFixer[] = [...TREE_FIXERS, ...SCENE_FIXERS];
type Key = 'tree' | 'css' | 'js';
const KEYS: readonly Key[] = ['tree', 'css', 'js'];

function defaultAccepts(key: Key, value: unknown): boolean {
  if (key === 'tree') return customCodeTree().safeParse(value).success;
  if (typeof value !== 'string') return false;
  return value.length <= (key === 'css' ? CUSTOM_CODE_REGION_CSS_MAX : CUSTOM_CODE_REGION_JS_MAX);
}

/** What a customCode block of this type takes for each prop, read from its registered schema. */
export function regionPropAccepts(kernel: BuilderKernel, type: string): TidyAccepts {
  const props: unknown = kernel.context.registry.block(type)?.schema.props;
  const shape: unknown = isRecord(props) ? props['shape'] : undefined;
  return (key, value) => {
    const field: unknown = isRecord(shape) ? shape[key] : undefined;
    const safeParse: unknown = isRecord(field) ? field['safeParse'] : undefined;
    if (typeof safeParse !== 'function') return false;
    const result: unknown = (safeParse as (input: unknown) => unknown).call(field, value);
    return isRecord(result) && result['success'] === true;
  };
}

/** `tokenisePaletteClasses` over every step's arguments: the tidy since 2026-10-05. */
function paletteTidied(commands: AiPlan['commands'], plan: PagePlan): AiPlan['commands'] {
  try {
    const next = commands.map((step) => {
      const args = tokeniseColourClasses(step.args, plan.tokens);
      return args === step.args ? step : { ...step, args };
    });
    return next.some((step, index) => step !== commands[index]) ? next : commands;
  } catch {
    // A repair that throws repairs nothing: the check judges what was written.
    return commands;
  }
}

/** The index of the last setProp of each written key, and the section they leave. */
function written(commands: AiPlan['commands']): {
  readonly at: Partial<Record<Key, number>>;
  readonly section: LandedSection | undefined;
} {
  const at: Partial<Record<Key, number>> = {};
  const values: Partial<Record<Key | 'jsParams', unknown>> = {};
  commands.forEach((step, index) => {
    if (!isRecord(step.args)) return;
    const { key, value } = step.args;
    if (key === 'tree' || ((key === 'css' || key === 'js') && typeof value === 'string')) {
      at[key] = index;
      values[key] = value;
    } else if (key === 'jsParams') values.jsParams = value;
  });
  if (at.tree === undefined) return { at, section: undefined };
  const { css, js, jsParams } = values;
  return {
    at,
    section: {
      tree: (values.tree ?? null) as JsonValue,
      ...(typeof css === 'string' ? { css } : {}),
      ...(typeof js === 'string' ? { js } : {}),
      ...(jsParams === undefined ? {} : { jsParams: jsParams as JsonValue }),
    },
  };
}

function staticIssues(
  options: TidySectionOptions,
  contract: SectionContract,
  section: LandedSection,
): readonly SectionCheckIssue[] {
  const pageIds = options.plan.sections.map(({ anchorId }) => anchorId);
  const request = options.request === undefined ? {} : { request: options.request };
  try {
    return [
      ...checkSection(options.plan, contract, section, request),
      ...checkScene(section, { pageIds }),
    ];
  } catch {
    return [];
  }
}

function counts(issues: readonly SectionCheckIssue[]): ReadonlyMap<SectionCheckCode, number> {
  const found = new Map<SectionCheckCode, number>();
  for (const { code } of issues) found.set(code, (found.get(code) ?? 0) + 1);
  return found;
}

/** Strictly fewer findings, and no code found more often than before. */
function better(
  after: readonly SectionCheckIssue[],
  before: readonly SectionCheckIssue[],
): boolean {
  if (after.length >= before.length) return false;
  const was = counts(before);
  return [...counts(after)].every(([code, count]) => count <= (was.get(code) ?? 0));
}

function acceptable(before: LandedSection, after: LandedSection, accepts: TidyAccepts): boolean {
  return KEYS.every((key) => {
    const value = after[key];
    if (value === before[key]) return true;
    if (key === 'css' && (typeof value !== 'string' || findCssRejection(value) !== undefined))
      return false;
    return accepts(key, value) && defaultAccepts(key, value);
  });
}

/** The commands with each changed prop written back where the writer wrote it (a new css step after the tree's). */
function rewritten(
  commands: AiPlan['commands'],
  at: Partial<Record<Key, number>>,
  before: LandedSection,
  after: LandedSection,
): AiPlan['commands'] {
  const next = [...commands];
  for (const key of KEYS) {
    const value = after[key];
    if (value === before[key] || value === undefined) continue;
    const index = at[key];
    const step = index === undefined ? undefined : next[index];
    if (index !== undefined && step !== undefined && isRecord(step.args)) {
      next[index] = { ...step, args: { ...step.args, value } };
      continue;
    }
    const tree = next[at.tree ?? -1];
    const id = tree !== undefined && isRecord(tree.args) ? tree.args['id'] : undefined;
    if (tree === undefined || typeof id !== 'string') continue;
    next.splice((at.tree ?? 0) + 1, 0, { command: tree.command, args: { id, key, value } });
  }
  return next;
}

/**
 * A writer's steps with what code can repair repaired, and the repairs named.
 * Never throws; the same `commands` array comes back when nothing changed.
 */
export function tidySection(commands: AiPlan['commands'], options: TidySectionOptions): TidyReport {
  const tokenised = paletteTidied(commands, options.plan);
  const fixed: string[] = tokenised === commands ? [] : ['palette-classes'];
  const { contract } = options;
  const { at, section } = written(tokenised);
  if (contract === undefined || section === undefined) return { commands: tokenised, fixed };
  const accepts = options.accepts ?? defaultAccepts;
  let current = section;
  let issues = staticIssues(options, contract, current);
  for (const fixer of FIXERS) {
    if (issues.length === 0) break;
    if (!issues.some(({ code }) => fixer.codes.includes(code))) continue;
    let next: LandedSection | undefined;
    try {
      next = fixer.fix({ plan: options.plan, contract, section: current, issues });
    } catch {
      next = undefined;
    }
    if (next === undefined || !acceptable(current, next, accepts)) continue;
    const after = staticIssues(options, contract, next);
    if (!better(after, issues)) continue;
    current = next;
    issues = after;
    fixed.push(fixer.name);
  }
  if (current === section) return { commands: tokenised, fixed };
  return { commands: Object.freeze(rewritten(tokenised, at, section, current)), fixed };
}
