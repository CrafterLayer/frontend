import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type LazyWithRetryOptions<TModule, TProps extends object> = {
  baseDelayMs?: number;
  maxRetries?: number;
  resolveComponent?: (module: TModule) => ComponentType<TProps>;
};

export type PreloadableLazyComponent<TProps extends object> = LazyExoticComponent<
  ComponentType<TProps>
> & {
  preload: () => Promise<void>;
};

type LazyModule<TProps extends object> = {
  default: ComponentType<TProps>;
};

type LazyImportRuntime = {
  random: () => number;
  reloadChunkOnce: (cause: unknown) => boolean;
  sleep: (milliseconds: number) => Promise<void>;
  waitUntilOnline: () => Promise<void>;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const RELOAD_COOLDOWN_MS = 10_000;
const RELOAD_TIMESTAMP_KEY = '__craftkit_lazy_reload_timestamp';

export function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ChunkLoadError' ||
      /loading (css )?chunk|failed to fetch|dynamically imported module/i.test(error.message))
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitUntilOnline(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    navigator.onLine
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.addEventListener('online', () => resolve(), { once: true });
  });
}

function reloadChunkOnce(cause: unknown): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const previousTimestamp = window.sessionStorage.getItem(RELOAD_TIMESTAMP_KEY);
    const previousReload = previousTimestamp ? Number(previousTimestamp) : 0;

    if (Number.isFinite(previousReload) && Date.now() - previousReload <= RELOAD_COOLDOWN_MS) {
      return false;
    }

    window.sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    // Reloading without a durable guard can create an infinite deployment loop.
    return false;
  }
}

const browserRuntime: LazyImportRuntime = {
  random: Math.random,
  reloadChunkOnce,
  sleep,
  waitUntilOnline,
};

function backoffDelay(baseDelayMs: number, attempt: number, random: number): number {
  const jitterMultiplier = 0.8 + random * 0.4;
  return baseDelayMs * 2 ** attempt * jitterMultiplier;
}

/** @internal Exported only for focused package tests. */
export async function loadWithRetry<
  TModule extends Record<string, unknown>,
  TProps extends object = Record<string, unknown>,
>(
  importModule: () => Promise<TModule>,
  options: LazyWithRetryOptions<TModule, TProps> = {},
  runtime: LazyImportRuntime = browserRuntime,
): Promise<LazyModule<TProps>> {
  const {
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    resolveComponent,
  } = options;

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('maxRetries must be a non-negative integer');
  }

  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError('baseDelayMs must be a non-negative finite number');
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const module = await importModule();
      const component = resolveComponent
        ? resolveComponent(module)
        : (module as unknown as LazyModule<TProps>).default;

      if (!component) {
        throw new TypeError('Lazy module must expose a default component or resolveComponent');
      }

      return { default: component };
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        await runtime.waitUntilOnline();
        await runtime.sleep(backoffDelay(baseDelayMs, attempt, runtime.random()));
      }
    }
  }

  if (isChunkLoadError(lastError)) {
    runtime.reloadChunkOnce(lastError);
  }

  throw lastError;
}

export function lazyWithRetry<
  TModule extends Record<string, unknown>,
  TProps extends object = Record<string, unknown>,
>(
  importModule: () => Promise<TModule>,
  options: LazyWithRetryOptions<TModule, TProps> = {},
): PreloadableLazyComponent<TProps> {
  let modulePromise: Promise<LazyModule<TProps>> | undefined;

  const load = (): Promise<LazyModule<TProps>> => {
    modulePromise ??= loadWithRetry(importModule, options).catch((error: unknown) => {
      modulePromise = undefined;
      throw error;
    });

    return modulePromise;
  };

  return Object.assign(lazy(load), {
    preload: async () => {
      await load();
    },
  });
}
