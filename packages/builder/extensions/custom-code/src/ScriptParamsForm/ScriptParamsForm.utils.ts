import type {
  Bilingual,
  ScriptParamGroup,
  ScriptParamSpec,
  ScriptParamValue,
} from '@craftkit/builder-schema';

/** Pure helpers of the form: no JSX, no state. */

export function pick(text: Bilingual, arabic: boolean): string {
  return arabic ? text.ar : text.en;
}

export function same(a: ScriptParamValue | undefined, b: ScriptParamValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

export function hex6(value: string): string {
  // <input type=color> takes #rrggbb only.
  const clean = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/u.test(clean)) return clean;
  if (/^#[0-9a-f]{3,4}$/u.test(clean)) {
    return `#${clean.charAt(1).repeat(2)}${clean.charAt(2).repeat(2)}${clean.charAt(3).repeat(2)}`;
  }
  if (/^#[0-9a-f]{8}$/u.test(clean)) return clean.slice(0, 7);
  return '#000000';
}

export function formatNumber(value: number, step: number | undefined): string {
  if (step === undefined || step >= 1) return String(Math.round(value * 1e6) / 1e6);
  const digits = Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
  return String(Number(value.toFixed(digits)));
}

export interface ParamRun {
  readonly group: ScriptParamGroup;
  readonly params: readonly ScriptParamSpec[];
}

/**
 * The params in SPEC order — the author's order is the order a person reads —
 * cut into runs of one group (no group reads as Look). Consecutive params of a
 * group share a fieldset; a group that comes back later opens a new one.
 */
export function paramRuns(spec: readonly ScriptParamSpec[]): readonly ParamRun[] {
  const runs: { group: ScriptParamGroup; params: ScriptParamSpec[] }[] = [];
  for (const entry of spec) {
    const group = entry.group ?? 'look';
    const last = runs.at(-1);
    if (last?.group === group) last.params.push(entry);
    else runs.push({ group, params: [entry] });
  }
  return runs;
}
