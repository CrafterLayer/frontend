import { scriptCodeIssues } from '@craftkit/builder-schema';

import type { AiPlanValidationIssue } from '../types';

/**
 * What the door holds one customCode `js` string to once free code mode allows
 * it (validate-plan.ts `customCodeJsIssues`): its size, the one literal that
 * would close the page's own script element, and — creative-power Phase 1 B
 * (2026-10-12) — that it parses, said with its line and column, so a
 * single-run edit gets its syntax error back in the repair round instead of
 * landing a scene that throws on the canvas. Everything else about a scene is
 * the section check's (agent/page-plan/check-scene.ts), which reads the code
 * against its section.
 *
 * The parse is the Studio lint's (`scriptCodeIssues`): it compiles the code as
 * the body of `async (ck) => {…}` — the runtime's own wrapper — and never
 * calls it. Where a CSP forbids compiling, it says nothing.
 */
export function customCodeJsSourceIssue(
  source: string,
  step: number,
  on: string,
  maxLength: number,
): AiPlanValidationIssue | undefined {
  const writes = `Step ${String(step)} writes "js"${on}`;
  if (source.length > maxLength) {
    return {
      code: 'invalid-args',
      message: `${writes} of ${String(source.length)} characters; a region holds at most ${String(maxLength)}. Split the scene across regions or write less code.`,
      step,
    };
  }
  if (/<\/script/iu.test(source)) {
    return {
      code: 'invalid-args',
      message: `${writes} containing "</script": the code is stored as a string and never wrapped in a script tag, so remove it (write the string as "<\\/script" if you truly need the text).`,
      step,
    };
  }
  const syntax = scriptCodeIssues(source, { switchOn: true }).find(({ code }) => code === 'syntax');
  if (syntax === undefined) return undefined;
  const place =
    syntax.line === undefined
      ? ''
      : ` at line ${String(syntax.line)}${syntax.column === undefined ? '' : `, column ${String(syntax.column)}`}`;
  const detail = syntax.message.en.replace(/^Syntax error(?: \([^)]*\))?: /u, '');
  return {
    code: 'invalid-args',
    message: `${writes} with a syntax error${place}: ${detail}. The js is the body of async (ck)=>{…} and must parse on its own: fix that line, keep brackets and quotes balanced, and write no import or export.`,
    step,
  };
}
