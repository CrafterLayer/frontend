import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { SCRIPT_CARD, SCRIPT_CARD_MAX_CHARS, scriptCardExamples } from './api-card';
import { SCRIPT_ELEMENT_KINDS, SCRIPT_TOOL_NAME } from './types';

describe('SCRIPT_CARD', () => {
  it('fits its 1,000-character budget', () => {
    expect(SCRIPT_CARD.length).toBeLessThanOrEqual(SCRIPT_CARD_MAX_CHARS);
    expect(SCRIPT_CARD_MAX_CHARS).toBe(1000);
  });

  it('names the step, every kind, every ck function and says it is not page code', () => {
    expect(SCRIPT_CARD).toContain(`{"command":"tool","args":{"name":"${SCRIPT_TOOL_NAME}","input":{"code":"..."}}}`);
    for (const kind of SCRIPT_ELEMENT_KINDS.filter((entry) => entry !== 'video')) expect(SCRIPT_CARD).toContain(kind);
    for (const name of ['ck.find', 'ck.set', 'ck.style', 'ck.tool', 'ck.pages', 'ck.photos', 'ck.fmt.num', 'ck.fmt.money', 'ck.note']) {
      expect(SCRIPT_CARD).toContain(name);
    }
    expect(SCRIPT_CARD).toContain('Not page code');
  });

  it('has two examples that parse as plain JavaScript, with no TypeScript syntax', () => {
    const examples = scriptCardExamples();
    expect(examples).toHaveLength(2);
    for (const example of examples) {
      // Compiled, never run: the body of a function of `ck`, as the sandbox wraps it.
      expect(() => new Script(`(function (ck) {\n${example}\n})`)).not.toThrow();
      expect(example).not.toMatch(/:\s*(?:string|number|boolean|any|unknown)\b/u);
      expect(example).not.toMatch(/\b(?:interface|import|export|await|as const)\b/u);
      expect(example).not.toContain('"');
    }
  });
});
