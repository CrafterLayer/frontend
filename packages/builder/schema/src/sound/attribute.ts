/*
  `data-ck-sound` (pixi-studio DESIGN §C.1, §C.2): sound attached to an
  element as DATA, never as code.

    data-ck-sound="click:pop hover:hover-tick@0.4 ambient:lib:rain-loop"

  One to four tokens separated by spaces, each `<trigger>:<ref>[@volume]`:
  - trigger: click, hover, enter (fires once when it scrolls in), leave, ambient
  - ref: a bank id (`pop`), `lib:<project sound id>`, `asset:<asset id>`,
    or `zzfx(n,n,…)` (at most 21 numbers, empty slots allowed, no spaces)
  - volume: 0..1 (default: the sound's own)

  The door validates with `soundAttributeProblem`; the `ck-sound.js` binder
  reads with `parseSoundAttribute`, so both apply one grammar.
*/

import { isSoundBankId } from './sound-bank';
import { parseZzfxCall } from './zzfx-params';

export const SOUND_TRIGGERS = ['click', 'hover', 'enter', 'leave', 'ambient'] as const;
export type SoundTrigger = (typeof SOUND_TRIGGERS)[number];

export const SOUND_ATTRIBUTE_MAX_TOKENS = 4;

/**
 * A project library id: the site library's kebab pattern (`LIBRARY_ID_PATTERN`
 * in site/library.ts; a test holds the two equal). Copied, not imported, so
 * the sound engine bundle does not pull in the library's zod schemas.
 */
const LIBRARY_ID = /^[a-z][a-z0-9-]{0,47}$/u;
/** An asset id as a tree can carry it: URL-safe characters only. */
const ASSET_ID = /^[A-Za-z0-9._~%-]{1,128}$/u;
const VOLUME = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|\.\d{1,3})$/u;

export type SoundRefSpec =
  | { kind: 'bank'; id: string }
  | { kind: 'lib'; id: string }
  | { kind: 'asset'; id: string }
  | { kind: 'zzfx'; params: (number | undefined)[] };

export interface SoundToken {
  trigger: SoundTrigger;
  ref: SoundRefSpec;
  /** 0..1 when the token sets `@volume`. */
  volume?: number | undefined;
}

/** Read one ref (`pop`, `lib:x`, `asset:x`, `zzfx(…)`); a string is the reason it is refused. */
export function parseSoundRef(text: string): SoundRefSpec | string {
  if (text.startsWith('lib:')) {
    const id = text.slice(4);
    return LIBRARY_ID.test(id)
      ? { kind: 'lib', id }
      : `lib:${id} is not a project sound id (lowercase letters, digits and dashes, at most 48)`;
  }
  if (text.startsWith('asset:')) {
    const id = text.slice(6);
    return ASSET_ID.test(id) ? { kind: 'asset', id } : `asset:${id} is not an asset id`;
  }
  if (text.startsWith('zzfx(')) {
    const params = parseZzfxCall(text);
    return typeof params === 'string' ? params : { kind: 'zzfx', params };
  }
  if (isSoundBankId(text)) return { kind: 'bank', id: text };
  return `'${text}' is not a sound: name a bank sound (pop, tap, wind, …), lib:<id>, asset:<id> or zzfx(…)`;
}

/** Read the whole attribute; `{ problem }` when any token is refused. */
export function parseSoundAttribute(
  value: string,
): { tokens: SoundToken[] } | { problem: string } {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { problem: "data-ck-sound needs at least one 'trigger:sound' token, e.g. 'click:pop'" };
  }
  const raw = trimmed.split(/\s+/u);
  if (raw.length > SOUND_ATTRIBUTE_MAX_TOKENS) {
    return {
      problem: `data-ck-sound holds at most ${String(SOUND_ATTRIBUTE_MAX_TOKENS)} tokens, not ${String(raw.length)}`,
    };
  }
  const tokens: SoundToken[] = [];
  for (const text of raw) {
    const colon = text.indexOf(':');
    const trigger = colon < 0 ? '' : text.slice(0, colon);
    if (!(SOUND_TRIGGERS as readonly string[]).includes(trigger)) {
      return {
        problem: `data-ck-sound token '${text}' starts with a trigger: ${SOUND_TRIGGERS.join(', ')} (e.g. 'click:pop')`,
      };
    }
    let rest = text.slice(colon + 1);
    let volume: number | undefined;
    const at = rest.lastIndexOf('@');
    if (at >= 0) {
      const level = rest.slice(at + 1);
      if (!VOLUME.test(level)) {
        return { problem: `data-ck-sound volume '@${level}' is a number from 0 to 1, e.g. @0.5` };
      }
      volume = Number(level);
      rest = rest.slice(0, at);
    }
    const ref = parseSoundRef(rest);
    if (typeof ref === 'string') return { problem: `data-ck-sound: ${ref}` };
    tokens.push({ trigger: trigger as SoundTrigger, ref, volume });
  }
  if (tokens.filter((token) => token.trigger === 'ambient').length > 1) {
    return { problem: 'data-ck-sound carries at most one ambient bed per element' };
  }
  return { tokens };
}

/** What is wrong with a `data-ck-sound` value, or undefined when it may stand. */
export function soundAttributeProblem(value: string): string | undefined {
  const parsed = parseSoundAttribute(value);
  return 'problem' in parsed ? parsed.problem : undefined;
}
