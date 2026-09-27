import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { planShapeCheck } from './plan-shape';

const request = {
  version: 1,
  request: 'Fill the drinks section',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    templates: [],
    document: { schemaVersion: 1, rootId: 'root', nodes: [] },
    selection: [],
    commands: [
      {
        name: 'setProp',
        argsSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, key: { type: 'string' }, value: {} },
        },
      },
    ],
    outputContract: {
      version: 1,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rationale: { type: 'string' },
          commands: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { command: { type: 'string' }, args: {}, title: { type: 'string' } },
            },
          },
          followUp: { type: 'string' },
        },
      },
    },
    omissions: [],
  },
} as unknown as AiPlanWireRequest;

const tree = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h2', text: 'Drinks' }],
};

function planWith(command: Record<string, unknown>): unknown {
  return { rationale: 'r', commands: [command], followUp: 'f' };
}

describe('planShapeCheck', () => {
  const check = planShapeCheck(request);

  it('accepts a plan whose keys sit where the contract puts them', () => {
    expect(
      check(
        planWith({
          command: 'setProp',
          args: { id: 'a', key: 'tree', value: tree },
          title: 't',
        }),
      ),
    ).toBe(true);
  });

  it('refuses a command title that slid into its arguments', () => {
    expect(
      check(
        planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: tree, title: 't' } }),
      ),
    ).toBe(false);
  });

  it('refuses a plan-level key that slid into a command', () => {
    expect(
      check({
        rationale: 'r',
        commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 }, followUp: 'f' }],
      }),
    ).toBe(false);
  });

  it('refuses a tree node carrying a key from the plan above it', () => {
    const slid = { kind: 'root', children: [{ kind: 'element', tag: 'h2', title: 't' }] };
    expect(
      check(planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: slid } })),
    ).toBe(false);
  });

  it('refuses a node whose children hold a bare string', () => {
    const loose = { kind: 'root', children: ['title'] };
    expect(
      check(planWith({ command: 'setProp', args: { id: 'a', key: 'tree', value: loose } })),
    ).toBe(false);
  });

  it('refuses answers that are not plans at all', () => {
    expect(check([])).toBe(false);
    expect(check({ rationale: 'r' })).toBe(false);
    expect(check({ rationale: 'r', commands: [{ args: {} }] })).toBe(false);
  });

  it('admits any arguments for a command whose schema is open', () => {
    const open = planShapeCheck({
      ...request,
      context: { ...request.context, commands: [] },
    });
    expect(open(planWith({ command: 'insertNode', args: { anything: 1 } }))).toBe(true);
  });
});
