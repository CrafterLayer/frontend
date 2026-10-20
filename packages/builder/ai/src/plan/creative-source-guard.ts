import type { BuilderDocument } from '@craftkit/builder-schema';

import { canonicalJsonStringify } from '../internal/canonical-json';
import { isTreeCommand } from '../style-tools/tree-steps';
import type { AiPlan, AssembledAiContext } from '../types';
import { serializeTreeMarkup } from './tree-markup';

interface SourceProperty {
  readonly id: string;
  readonly path: readonly string[];
  readonly expected: string;
}

export type CreativeSourceGuard = readonly SourceProperty[];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function read(value: unknown, path: readonly string[]): unknown {
  for (const key of path) {
    if (!record(value) || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

/** Context serializes a region's tree as markup; compare both sides in that same form. */
function fingerprint(node: unknown, path: readonly string[]): string {
  let value = read(node, path);
  if (path[0] === 'props') {
    if (path.length === 1 && record(value)) {
      value = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          key === 'tree' ? (serializeTreeMarkup(item) ?? item) : item,
        ]),
      );
    } else if (path[1] === 'tree') {
      value = serializeTreeMarkup(value) ?? value;
    }
  }
  return canonicalJsonStringify({ value });
}

/**
 * The original writer context, limited to the existing region properties the expanded plan
 * writes. Private proposal evidence uses strings so later context mutations cannot change it.
 */
export function captureCreativeSource(
  plan: AiPlan,
  context: AssembledAiContext,
): CreativeSourceGuard {
  const nodes = new Map(context.document.nodes.map((node) => [node.id, node]));
  const captured = new Map<string, SourceProperty>();
  const add = (id: unknown, path: readonly string[]): void => {
    if (typeof id !== 'string') return;
    const node = nodes.get(id);
    if (node?.type !== 'customCode') return;
    const key = canonicalJsonStringify([id, path]);
    captured.set(key, { id, path: [...path], expected: fingerprint(node, path) });
  };
  const allProps = (roots: readonly string[]): void => {
    const seen = new Set<string>();
    const pending = [...roots];
    while (pending.length > 0) {
      const id = pending.pop();
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      const node = nodes.get(id);
      if (node === undefined) continue;
      add(id, ['props']);
      pending.push(...Object.values(node.slots).flat());
    }
  };
  for (const { command, args } of plan.commands) {
    if (!record(args)) continue;
    const id = args['id'];
    if (command === 'setProp' && typeof args['key'] === 'string') {
      add(id, ['props', args['key']]);
    } else if (isTreeCommand(command)) {
      add(id, ['props', 'tree']);
      if (command === 'moveTreeNode' && record(args['to']))
        add(args['to']['id'], ['props', 'tree']);
    } else if (command === 'removeNode' && typeof id === 'string') {
      allProps([id]);
    } else if (
      (command === 'setResponsive' || command === 'setBinding') &&
      typeof args['key'] === 'string'
    ) {
      if (command === 'setBinding') add(id, ['bindings', args['key']]);
      else if (typeof args['breakpoint'] === 'string')
        add(id, ['responsive', args['breakpoint'], args['key']]);
    } else if (command === 'applyPatches' && Array.isArray(args['patches'])) {
      for (const patch of args['patches']) {
        if (!record(patch) || !Array.isArray(patch['path'])) continue;
        const path = patch['path'];
        if (path.length === 0 || (path[0] === 'nodes' && path.length === 1))
          allProps([...nodes.keys()]);
        else if (path[0] === 'nodes' && typeof path[1] === 'string') {
          if (path.length === 2) allProps([path[1]]);
          else if (path[2] === 'props')
            add(path[1], typeof path[3] === 'string' ? ['props', path[3]] : ['props']);
        }
      }
    }
  }
  return [...captured.values()];
}

export function creativeSourceConflict(
  guard: CreativeSourceGuard,
  document: BuilderDocument,
): SourceProperty | undefined {
  return guard.find(({ id, path, expected }) => {
    const node = Object.hasOwn(document.nodes, id) ? document.nodes[id] : undefined;
    return node?.type !== 'customCode' || fingerprint(node, path) !== expected;
  });
}
