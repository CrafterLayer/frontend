import type { EvalPlanShape, EvalPlanStep } from '../harness/output';

/**
 * Reading a plan without executing it.
 *
 * Every grader that is NOT the validator needs the same five facts about a
 * plan — which commands, which block types, which node ids, which class lists,
 * which literal colours — and each one of them is a small pile of `unknown`
 * narrowing. Collected here once so a grader reads as the rule it enforces
 * instead of as ten lines of type guards.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function args(step: EvalPlanStep): Record<string, unknown> {
  return isRecord(step.args) ? step.args : {};
}

/** Command names in plan order, duplicates kept — a count is sometimes the point. */
export function commandNames(plan: EvalPlanShape): readonly string[] {
  return plan.commands.map((step) => step.command);
}

/** Block types this plan inserts. Compositions are not block types and are excluded. */
export function insertedBlockTypes(plan: EvalPlanShape): readonly string[] {
  const types: string[] = [];
  for (const step of plan.commands) {
    if (step.command !== 'insertNode') continue;
    const type = args(step)['type'];
    if (typeof type === 'string') types.push(type);
  }
  return types;
}

/**
 * Keys whose value names an EXISTING node.
 *
 * Only the core command vocabulary appears here, and only at the top level of
 * a command's arguments, because that is the whole of it: no core command
 * addresses a node from inside a nested prop. A key list is far easier to audit
 * than a recursive walk that guesses which strings look like ids.
 */
const NODE_REFERENCE_KEYS = ['id', 'parentId', 'toParentId'] as const;

/** Every existing-node id this plan claims to address, deduplicated. */
export function referencedNodeIds(plan: EvalPlanShape): readonly string[] {
  const ids = new Set<string>();
  for (const step of plan.commands) {
    const record = args(step);
    for (const key of NODE_REFERENCE_KEYS) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) ids.add(value);
    }
    // `groupNodes` takes a list rather than a single id.
    const list = record['ids'];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item === 'string' && item.length > 0) ids.add(item);
      }
    }
  }
  return [...ids];
}

/**
 * Props whose contents are NOT policed for raw colour.
 *
 * The workspace made a deliberate product decision that colour is free inside
 * an assistant's own custom code and custom CSS: a gradient headline or a
 * keyframe cannot be written in token utilities, and refusing hex there made
 * the feature unusable. Colour policy therefore applies to BLOCK props, which
 * do have a token vocabulary behind them, and stops at these keys.
 */
const FREE_COLOUR_PROPS: ReadonlySet<string> = new Set([
  'css',
  'pageCss',
  'code',
  'customCode',
  'tree',
  'html',
  'content',
]);

/** Class lists a plan stores on a BLOCK — the ones the utility door polices. */
export function blockClassNames(plan: EvalPlanShape): readonly string[] {
  const found: string[] = [];
  for (const step of plan.commands) {
    const record = args(step);
    if (step.command === 'insertNode') {
      const props = record['props'];
      if (isRecord(props)) {
        const className = props['className'];
        if (typeof className === 'string') found.push(className);
      }
      continue;
    }
    if (step.command === 'setProp' || step.command === 'setResponsive') {
      if (record['key'] !== 'className') continue;
      const value = record['value'];
      if (typeof value === 'string') found.push(value);
    }
  }
  return found;
}

/** Every string a plan writes into a colour-policed block prop. */
export function blockPropStrings(plan: EvalPlanShape): readonly { key: string; value: string }[] {
  const found: { key: string; value: string }[] = [];
  const take = (key: string, value: unknown): void => {
    if (FREE_COLOUR_PROPS.has(key)) return;
    if (typeof value === 'string') found.push({ key, value });
  };
  for (const step of plan.commands) {
    const record = args(step);
    if (step.command === 'insertNode') {
      const props = record['props'];
      if (isRecord(props)) {
        for (const [key, value] of Object.entries(props)) take(key, value);
      }
      continue;
    }
    if (step.command === 'setProp' || step.command === 'setResponsive') {
      const key = record['key'];
      if (typeof key === 'string') take(key, record['value']);
    }
  }
  return found;
}

/*
  Tailwind's own colour families, listed rather than pattern-matched.
  `grid-cols-3`, `gap-4` and `z-10` all have the shape "word-number" and every
  one of them is fine, so only a named family counts.

  This mirrors `packages/builder/schema/src/blocks/utility-classes.ts`. It is a
  second copy on purpose and the ONLY duplicated rule in this package: that
  module is not reachable through the preset's public doors, and the
  authoritative check still runs — `grade-validator.ts` executes the real
  validator, which enforces the real list. This grader exists to say WHICH
  colour was hard-coded, which a pass/fail from the validator cannot.
*/
const DEFAULT_PALETTE_FAMILIES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
] as const;

const DEFAULT_PALETTE = new RegExp(
  `(?:^|:)-?[a-z-]+-(?:${DEFAULT_PALETTE_FAMILIES.join('|')})-\\d{2,3}(?:/\\d{1,3})?$`,
  'u',
);

const ARBITRARY_VALUE = /\[[^\]]*\]/u;

/** A literal colour written where a token belongs: `#0b0b0c`, `rgb(...)`, `hsl(...)`. */
const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/iu;

export interface ColourFinding {
  /** The class or prop key the literal was found on. */
  where: string;
  /** The offending fragment, as written. */
  value: string;
  reason: 'arbitrary-value' | 'default-palette' | 'raw-colour';
}

/** Every place this plan hard-codes a colour a theme cannot reach. */
export function hardCodedColours(plan: EvalPlanShape): readonly ColourFinding[] {
  const findings: ColourFinding[] = [];
  for (const className of blockClassNames(plan)) {
    for (const utility of className.split(/\s+/u).filter((name) => name !== '')) {
      if (ARBITRARY_VALUE.test(utility)) {
        findings.push({ where: 'className', value: utility, reason: 'arbitrary-value' });
        continue;
      }
      if (DEFAULT_PALETTE.test(utility)) {
        findings.push({ where: 'className', value: utility, reason: 'default-palette' });
      }
    }
  }
  for (const { key, value } of blockPropStrings(plan)) {
    if (key === 'className') continue;
    const match = RAW_COLOUR.exec(value);
    if (match !== null) {
      findings.push({ where: key, value: match[0], reason: 'raw-colour' });
    }
  }
  return findings;
}
