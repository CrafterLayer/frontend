import { describe, expect, it } from 'vitest';

import { rebalanceClosers, salvageJson } from './json-salvage';

/*
  The defects below are the ones measured on 2026-09-27: 6 of 8 section plans
  from the CLI's Sonnet failed to parse, every one of them inside the run of
  closers that ends a deeply nested custom-code tree (`]}]}]}]}]}}]`).
*/

const tree = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'py-24',
      children: [
        {
          kind: 'element',
          tag: 'div',
          children: [
            { kind: 'element', tag: 'h2', text: 'قائمة [المشروبات] {جديد}' },
            {
              kind: 'element',
              tag: 'ul',
              children: [{ kind: 'element', tag: 'li', text: 'إسبريسو' }],
            },
          ],
        },
      ],
    },
  ],
};

const plan = {
  rationale: 'Fill the drinks section.',
  commands: [
    {
      command: 'setProp',
      args: { id: 'pg-0006', key: 'tree', value: tree },
      title: 'Drinks',
    },
  ],
  followUp: 'Prices are placeholders.',
};

const valid = JSON.stringify(plan);

/** The run of closers that ends the tree, just before `,"title"`. */
const TREE_END = ']}]}]}]}}';

function withTreeEnd(replacement: string): string {
  const at = valid.indexOf(`${TREE_END},"title"`);
  expect(at).toBeGreaterThan(0);
  return `${valid.slice(0, at)}${replacement}${valid.slice(at + TREE_END.length)}`;
}

/** The shape a plan must have, as claude.ts will judge it. */
function isPlanShaped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => ['rationale', 'commands', 'followUp'].includes(key))) {
    return false;
  }
  const commands = record['commands'];
  return (
    Array.isArray(commands) &&
    commands.every(
      (command: unknown) =>
        typeof command === 'object' &&
        command !== null &&
        Object.keys(command).every((key) => ['command', 'args', 'title'].includes(key)),
    )
  );
}

describe('salvageJson', () => {
  it('leaves an answer that already parses untouched', () => {
    expect(salvageJson(valid)).toBe(valid);
  });

  it('still unwraps a fenced answer', () => {
    expect(salvageJson(`\`\`\`json\n${valid}\n\`\`\``)).toBe(valid);
  });

  it('repairs one closer too many at the end of a tree', () => {
    const broken = withTreeEnd(`${TREE_END}}`);
    expect(() => JSON.parse(broken) as unknown).toThrow();
    expect(JSON.parse(salvageJson(broken, isPlanShaped))).toEqual(plan);
  });

  it('repairs one closer too few in the middle of the run', () => {
    const broken = withTreeEnd(']}]}]}}}');
    expect(() => JSON.parse(broken) as unknown).toThrow();
    expect(JSON.parse(salvageJson(broken, isPlanShaped))).toEqual(plan);
  });

  it('repairs closers of the wrong kind in the right number', () => {
    const broken = withTreeEnd(']}]}]]}}}');
    expect(() => JSON.parse(broken) as unknown).toThrow();
    expect(JSON.parse(salvageJson(broken, isPlanShaped))).toEqual(plan);
  });

  it('repairs a run that closes the whole plan before its title', () => {
    const broken = withTreeEnd(`${TREE_END}}]}`);
    expect(() => JSON.parse(broken) as unknown).toThrow();
    expect(JSON.parse(salvageJson(broken, isPlanShaped))).toEqual(plan);
  });

  it('closes an answer that was cut off after a complete value', () => {
    const cut = valid.slice(0, valid.indexOf(',"followUp"'));
    const repaired = JSON.parse(salvageJson(cut, isPlanShaped)) as typeof plan;
    expect(repaired.commands).toEqual(plan.commands);
  });

  it('never rewrites brackets that live inside strings', () => {
    const broken = withTreeEnd(`${TREE_END}}`);
    const repaired = JSON.parse(salvageJson(broken, isPlanShaped)) as typeof plan;
    expect(JSON.stringify(repaired)).toContain('قائمة [المشروبات] {جديد}');
  });

  it('repairs a key that lost its opening quote, keeping the shape the plan needs', () => {
    // Measured 2026-09-27: `…"text-amber-900",children":[{…` — a typo no closer count explains.
    const broken = valid.replace(
      '"children":[{"kind":"element","tag":"div"',
      'children":[{"kind":"element","tag":"div"',
    );
    expect(() => JSON.parse(broken) as unknown).toThrow();
    expect(JSON.parse(salvageJson(broken, isPlanShaped))).toEqual(plan);
  });

  it('returns the answer unchanged when no repair makes it parse', () => {
    const hopeless = '{ "a": "b" : : }';
    expect(salvageJson(hopeless)).toBe(hopeless);
  });

  it('hands a bare-word value to the validator as data rather than failing the parse', () => {
    // The validator then names the real problem ("needs command arguments").
    const bare = '{"rationale": "x", "commands": [ {"command": "setProp", "args": oops }]}';
    expect(JSON.parse(salvageJson(bare))).toEqual({
      rationale: 'x',
      commands: [{ command: 'setProp', args: 'oops' }],
    });
  });
});

describe('rebalanceClosers', () => {
  it('prefers a candidate the caller accepts over one that merely parses', () => {
    // Eight closers where nine belong: rewritten as eight, `title` parses but lands in `args`.
    const broken = withTreeEnd(']}]}]}}}');
    const repaired = rebalanceClosers(broken, isPlanShaped);
    expect(repaired).toBeDefined();
    expect(isPlanShaped(JSON.parse(repaired ?? ''))).toBe(true);
  });

  it('gives up rather than searching forever', () => {
    const deep = `${'['.repeat(40)}1${']}'.repeat(40)}`;
    const started = Date.now();
    rebalanceClosers(deep, () => false);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
