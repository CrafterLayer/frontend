import type { AiSkillScript } from './types';

/**
 * Whether the request carries any character of the given writing system.
 *
 * ANY character, deliberately: a mostly-English request with one Arabic word
 * is a request whose page may carry Arabic, and the RTL expertise costs
 * ~400 tokens against a page laid out backwards. The Arabic block covers the
 * base range plus the supplement, extended ranges and presentation forms, so
 * Persian/Urdu letters and the shaped forms some editors paste all count.
 */
const SCRIPT_PATTERNS: Readonly<Record<AiSkillScript, RegExp>> = {
  arabic: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u,
  latin: /[A-Za-zÀ-ɏ]/u,
};

export function requestUsesScript(request: string, script: AiSkillScript): boolean {
  return SCRIPT_PATTERNS[script].test(request);
}
