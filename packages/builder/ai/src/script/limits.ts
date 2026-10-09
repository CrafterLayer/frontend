import type { ScriptLimits } from './types';

/**
 * The sandbox's budgets (DESIGN §A.3 and §A.8). Every value is enforced where
 * it can be seen: source length, CPU, memory, stack, call, target, step, find,
 * note and result caps inside the sandbox; the hard wall clock by the runner.
 */
export const DEFAULT_SCRIPT_LIMITS: ScriptLimits = Object.freeze({
  maxSourceChars: 6000,
  cpuMs: 1000,
  hardMs: 3000,
  memoryBytes: 16 * 1024 * 1024,
  // 512 KiB blew the HOST wasm stack in the research bench (code-mode.md §3);
  // 64–384 KiB all fail cleanly inside the sandbox with "stack overflow".
  stackBytes: 256 * 1024,
  maxCalls: 500,
  maxTargets: 2000,
  maxSteps: 300,
  maxFind: 500,
  maxResultChars: 2000,
  maxNotes: 5,
  maxNoteChars: 200,
  maxOutputChars: 262_144,
  maxErrorChars: 600,
});

/** Fill any missing budget from the defaults (a caller may tighten one value for a test). */
export function resolveScriptLimits(limits?: Partial<ScriptLimits>): ScriptLimits {
  if (limits === undefined) return DEFAULT_SCRIPT_LIMITS;
  const merged: Record<string, number> = { ...DEFAULT_SCRIPT_LIMITS };
  for (const [key, value] of Object.entries(limits)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) merged[key] = value;
  }
  return Object.freeze(merged) as unknown as ScriptLimits;
}
