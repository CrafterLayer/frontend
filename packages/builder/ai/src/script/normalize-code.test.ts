import { describe, expect, it } from 'vitest';

import { normalizeScriptCode, normalizeScriptSource } from './normalize-code';

const BODY = "const b = ck.find({kind:'button'});\nck.style(b, {borderRadius:'full'});";

describe('normalizeScriptCode', () => {
  it('leaves a plain body alone (except trailing whitespace)', () => {
    expect(normalizeScriptCode(`${BODY}\n\n`)).toBe(BODY);
  });

  it('strips markdown fences with or without a language', () => {
    expect(normalizeScriptCode(`\`\`\`js\n${BODY}\n\`\`\``)).toBe(BODY);
    expect(normalizeScriptCode(`\`\`\`javascript\n${BODY}\n\`\`\`\n`)).toBe(BODY);
    expect(normalizeScriptCode(`\`\`\`\n${BODY}\n\`\`\``)).toBe(BODY);
  });

  it('strips a leading js / javascript line', () => {
    expect(normalizeScriptCode(`js\n${BODY}`)).toBe(BODY);
    expect(normalizeScriptCode(`JavaScript\n${BODY}`)).toBe(BODY);
  });

  it('strips export default and a wrapping async arrow', () => {
    expect(normalizeScriptCode(`export default async () => {\n${BODY}\n}`)).toBe(BODY);
    expect(normalizeScriptCode(`async (ck) => {\n${BODY}\n};`)).toBe(BODY);
    expect(normalizeScriptCode(`ck => {\n${BODY}\n}`)).toBe(BODY);
  });

  it('unwraps function declarations and IIFEs', () => {
    expect(normalizeScriptCode(`async function main(ck) {\n${BODY}\n}`)).toBe(BODY);
    expect(normalizeScriptCode(`(async () => {\n${BODY}\n})()`)).toBe(BODY);
    expect(normalizeScriptCode(`(function () {\n${BODY}\n})();`)).toBe(BODY);
  });

  it('turns an expression arrow into a return', () => {
    expect(normalizeScriptCode("() => ck.find({kind:'button'}).length")).toBe(
      "return ck.find({kind:'button'}).length;",
    );
  });

  it('does not unwrap a helper that is followed by more code', () => {
    const code = 'function round(b) {\n  ck.style(b, {borderRadius:"full"});\n}\nround(ck.find());';
    expect(normalizeScriptCode(code)).toBe(code);
  });

  it('matches braces past strings, template literals and comments', () => {
    const body = "const t = '}';\nconst u = `{${1}}`;\n// }\nck.note(t + u);";
    expect(normalizeScriptCode(`async () => {\n${body}\n}`)).toBe(body);
  });

  it('reports the lines removed above the body', () => {
    expect(normalizeScriptSource(BODY).lineOffset).toBe(0);
    expect(normalizeScriptSource(`\`\`\`js\n${BODY}\n\`\`\``).lineOffset).toBe(1);
    expect(
      normalizeScriptSource(`\`\`\`js\nexport default async () => {\n${BODY}\n}\n\`\`\``)
        .lineOffset,
    ).toBe(2);
    expect(normalizeScriptSource(`\n\n${BODY}`).lineOffset).toBe(2);
  });

  it('normalizes CRLF line endings', () => {
    expect(normalizeScriptCode(BODY.replace('\n', '\r\n'))).toBe(BODY);
  });
});
