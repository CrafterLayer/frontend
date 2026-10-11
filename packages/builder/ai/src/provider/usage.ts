import type { AiProviderUsage } from '../types';

const MAX_MEASURED_TOKENS = 1_000_000_000_000;

/** An untrusted transport cannot turn missing, negative or fractional counts into zero. */
function count(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_MEASURED_TOKENS
    ? value
    : null;
}

export function readProviderUsage(value: unknown): AiProviderUsage | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const wire = value as Record<string, unknown>;
  const cost = wire['costUsd'];
  return {
    inputTokens: count(wire['inputTokens']),
    outputTokens: count(wire['outputTokens']),
    cacheReadTokens: count(wire['cacheReadTokens']),
    cacheWriteTokens: count(wire['cacheWriteTokens']),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null,
    ...(wire['cached'] === true ? { cached: true } : {}),
  };
}

export function notifyProviderUsage(
  observer: ((usage: AiProviderUsage) => void) | undefined,
  value: unknown,
): void {
  const usage = readProviderUsage(value);
  if (usage === undefined) return;
  try {
    observer?.(usage);
  } catch {
    /* Telemetry cannot replace a provider outcome. */
  }
}

export const CACHED_PROVIDER_USAGE: AiProviderUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
  cached: true,
});
