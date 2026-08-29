import type { JsonValue } from '../json/json-value';
import type { NodeId } from '../document/types';
import { MOTION_PROP, motionSpecSchema, type MotionSpec } from './types';

export interface MotionValidationIssue {
  code: 'invalid-motion-spec';
  message: string;
  nodeId: NodeId;
  path: readonly (string | number)[];
}

export type MotionValidationResult =
  { ok: true; spec: MotionSpec } | { ok: false; issues: readonly MotionValidationIssue[] };

/** A single node's motion prop, checked against the closed vocabulary. */
export function validateMotionSpec(value: unknown, nodeId: NodeId = ''): MotionValidationResult {
  const parsed = motionSpecSchema.safeParse(value);
  if (parsed.success) {
    return { ok: true, spec: parsed.data };
  }

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      code: 'invalid-motion-spec',
      message: `Motion is not part of the vocabulary: ${issue.message}`,
      nodeId,
      /*
        zod types a path segment as PropertyKey, which admits `symbol`. Motion
        lives inside a JSON prop, and JSON has no symbol keys, so narrowing here
        keeps `symbol` out of this package's public issue type.
      */
      path: issue.path.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number',
      ),
    })),
  };
}

interface MotionBearingNode {
  props: Record<string, JsonValue>;
  responsive?: Partial<Record<string, Record<string, JsonValue>>> | undefined;
}

/**
 * Every motion prop across a flat node map, base and per-breakpoint.
 *
 * Breakpoints are included deliberately: a page may reasonably animate on a
 * wide screen and stay still on a phone, so motion is a legitimate responsive
 * override — and an override the validator skipped would be an unchecked door.
 */
export function validateDocumentMotion(
  nodes: Readonly<Record<NodeId, MotionBearingNode>>,
): readonly MotionValidationIssue[] {
  const issues: MotionValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (Object.hasOwn(node.props, MOTION_PROP)) {
      const result = validateMotionSpec(node.props[MOTION_PROP], nodeId);
      if (!result.ok) {
        issues.push(...result.issues);
      }
    }

    for (const [breakpoint, override] of Object.entries(node.responsive ?? {})) {
      if (override === undefined || !Object.hasOwn(override, MOTION_PROP)) {
        continue;
      }
      const result = validateMotionSpec(override[MOTION_PROP], nodeId);
      if (!result.ok) {
        issues.push(
          ...result.issues.map((issue) => ({
            ...issue,
            path: ['responsive', breakpoint, MOTION_PROP, ...issue.path],
          })),
        );
      }
    }
  }

  return issues;
}
