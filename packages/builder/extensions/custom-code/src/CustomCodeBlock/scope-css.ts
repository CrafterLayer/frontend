/**
 * Region-scoped CSS.
 *
 * Two jobs, and they are separate on purpose:
 *
 *   1. REFUSE what must never reach a stylesheet — the short list of
 *      constructs that fetch, execute, or escape the element. That half now
 *      lives in `@craftkit/builder-schema` (see ./custom-code/custom-css),
 *      because the AI plan door needs it too; it is re-exported below.
 *   2. SCOPE what remains, by prefixing every selector with the host node's
 *      attribute, so a rule cannot reach a sibling region or the page.
 *
 * The refusal list is short by design. This is the one place in the feature
 * where the user asked for maximum freedom, and a long allowlist of properties
 * would deliver the opposite — it would mean every gradient, filter, and
 * animation the assistant invents has to have been anticipated here. So the
 * policy is: everything is allowed except the handful of constructs that are
 * dangerous rather than merely unusual.
 *
 * `AiCompositionPolicy.cssPolicy` is where a stricter mode will attach when a
 * deployment wants one; the shape below takes the mode so that arrives as a
 * branch rather than a rewrite.
 */

import { canvasViewportHeightUnits } from '@craftkit/builder-renderer';
import {
  CUSTOM_CSS_FONT_IMPORT,
  findCssRejection,
  normalizeCssForInspection,
  type CssRejection,
} from '@craftkit/builder-schema';

export type CustomCodeCssPolicy = 'permissive' | 'strict' | 'off';

/*
  The refusal half of this file now lives in `@craftkit/builder-schema`, beside
  the `customCss()` declaration it polices: the AI plan validator needs the very
  same list, and a headless plan layer must not depend on a React extension
  package. Re-exported here so every existing import site — the block, the
  Inspector field, the editor's public API — keeps reading it from where it
  always did.
*/
export { findCssRejection, normalizeCssForInspection, type CssRejection };

/**
 * Prefix every selector in a rule list with `scope`.
 *
 * Written as a small state machine over the source rather than a regex,
 * because selectors legitimately contain braces-adjacent syntax (`:has(…)`,
 * attribute values) and a regex over `{` would mis-split them. At-rules that
 * WRAP other rules (`@media`, `@supports`, `@container`) recurse into their
 * body; at-rules that do not (`@keyframes`, `@font-face`) pass through
 * untouched — a scoped `@keyframes` selector is not a selector at all, and
 * prefixing one silently breaks the animation.
 */
function scopeRules(css: string, scope: string, depth: number): string {
  if (depth > 8) return '';
  const out: string[] = [];
  let index = 0;

  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;

    const prelude = css.slice(index, open).trim();
    const close = matchingBrace(css, open);
    if (close === -1) break;
    const body = css.slice(open + 1, close);
    index = close + 1;
    if (prelude === '') continue;

    if (prelude.startsWith('@')) {
      const name = /^@([a-z-]+)/iu.exec(prelude)?.[1]?.toLowerCase() ?? '';
      if (name === 'media' || name === 'supports' || name === 'container' || name === 'layer') {
        out.push(`${prelude}{${scopeRules(body, scope, depth + 1)}}`);
      } else {
        // @keyframes, @font-face, @property: their "selectors" are not selectors.
        out.push(`${prelude}{${body}}`);
      }
      continue;
    }

    const selectors = splitSelectors(prelude)
      .map((selector) => `${scope} ${selector}`.trim())
      .join(',');
    out.push(`${selectors}{${body}}`);
  }
  return out.join('');
}

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let at = open; at < css.length; at += 1) {
    const character = css[at];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

/** Split a selector list on top-level commas only — `:is(a, b)` stays one selector. */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of prelude) {
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/**
 * Scope a region's CSS to its host node, or return undefined when it must not
 * be rendered at all.
 *
 * Returning undefined rather than an empty string keeps the caller honest: a
 * refused stylesheet is a decision to surface, not a silently absent one.
 */
export function scopeCustomCodeCss(
  css: string,
  hostId: string,
  policy: CustomCodeCssPolicy = 'permissive',
): string | undefined {
  if (policy === 'off') return undefined;
  const trimmed = css.trim();
  if (trimmed === '') return undefined;
  if (findCssRejection(trimmed) !== undefined) return undefined;
  if (policy === 'strict') {
    // Reserved: a property allowlist attaches here. Until it is written, the
    // strict mode must not silently behave like the permissive one.
    throw new Error('The strict custom-code CSS policy is not implemented yet.');
  }
  /*
    Font imports are lifted out before scoping and put back in front of it:
    an `@import` is not a rule block, so the block parser would otherwise fold
    it into the next selector's prelude; and CSS requires imports to precede
    every rule, which scoping the rest and prepending honours.
  */
  const imports = trimmed.match(CUSTOM_CSS_FONT_IMPORT) ?? [];
  /*
    preview-fix (2026-10-12): viewport heights read through `--ck-vh`, which only the editor canvas
    sets (to its zoom-1 viewport), so `min-height: 70vh` is the same on the canvas at any zoom as in
    Preview and on the published page, where the fallback is the real `vh`.
  */
  const body = canvasViewportHeightUnits(trimmed.replace(CUSTOM_CSS_FONT_IMPORT, '').trim());
  const scoped = scopeRules(body, `[data-ck="${cssAttributeValue(hostId)}"]`, 0);
  const output = `${imports.join('')}${scoped}`;
  return output === '' ? undefined : output;
}

/** Escape a node id for safe use inside an attribute selector's quoted value. */
function cssAttributeValue(hostId: string): string {
  return hostId.replace(/["\\]/gu, '\\$&');
}
