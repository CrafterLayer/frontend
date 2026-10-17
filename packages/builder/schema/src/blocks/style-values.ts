import type { JsonValue } from '../json/json-value';

/**
 * Intent-only styling law: style-bearing values are named intents; raw color codes
 * and raw pixel lengths are rejected. Patterns are token-tight to keep false
 * positives rare in free text.
 */
const HEX_COLOR =
  /(?:^|[\s"'`(:,;])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])/;
const PX_LENGTH = /(?:^|[\s"'`(:,;])-?\d+(?:\.\d+)?px(?![a-zA-Z0-9])/;

export type RawStyleLiteralKind = 'hex-color' | 'px-length';

export interface RawStyleLiteral {
  path: (string | number)[];
  value: string;
  kind: RawStyleLiteralKind;
}

/** Depth-first scan of every string inside a JSON value. */
export function findRawStyleLiterals(value: JsonValue): RawStyleLiteral[] {
  const hits: RawStyleLiteral[] = [];
  walk(value, []);
  return hits;

  function walk(current: JsonValue, path: (string | number)[]): void {
    if (typeof current === 'string') {
      if (HEX_COLOR.test(current)) {
        hits.push({ path, value: current, kind: 'hex-color' });
      } else if (PX_LENGTH.test(current)) {
        hits.push({ path, value: current, kind: 'px-length' });
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((entry, index) => {
        walk(entry, [...path, index]);
      });
      return;
    }
    if (current !== null && typeof current === 'object') {
      for (const [key, entry] of Object.entries(current)) {
        walk(entry, [...path, key]);
      }
    }
  }
}
