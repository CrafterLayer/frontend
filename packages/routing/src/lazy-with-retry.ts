import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface LazyWithRetryOptions<TModule, TProps extends object> {
  baseDelayMs?: number;
  maxRetries?: number;
  resolveComponent?: (module: TModule) => ComponentType<TProps>;
}

export interface PreloadableLazyComponent<TProps extends object> extends LazyExoticComponent<
  ComponentType<TProps>
> {
  preload: () => Promise<void>;
}

interface LazyModule<TProps extends object> {
  default: ComponentType<TProps>;
}

interface LazyImportRuntime {
  random: () => number;
  reloadChunkOnce: (cause: unknown) => boolean;
  sleep: (milliseconds: number) => Promise<void>;
  waitUntilOnline: () => Promise<void>;
}

interface ChunkReloadEnvironment {
  now: () => number;
  reload: () => void;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
}

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

/** @internal Exported only for focused package tests. */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/** @internal Exported only for focused package tests. */
export async function waitUntilOnline(): Promise<void> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || navigator.onLine) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.addEventListener(
      'online',
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

function getBrowserReloadEnvironment(): ChunkReloadEnvironment | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return {
    now: Date.now,
    reload: window.location.reload.bind(window.location),
    storage: window.sessionStorage,
  };
}

/** @internal Exported only for focused package tests. */
export function reloadChunkOnce(
  _cause: unknown,
  environment: ChunkReloadEnvironment | undefined = getBrowserReloadEnvironment(),
): boolean {
  if (!environment) {
    return false;
  }

  try {
    const previousTimestamp = environment.storage.getItem(RELOAD_TIMESTAMP_KEY);
    const previousReload = previousTimestamp ? Number(previousTimestamp) : 0;
    const now = environment.now();

    if (Number.isFinite(previousReload) && now - previousReload <= RELOAD_COOLDOWN_MS) {
      return false;
    }

    environment.storage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
    environment.reload();
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
      const component: unknown = resolveComponent
        ? resolveComponent(module)
        : (module as unknown as LazyModule<TProps>).default;

      if (typeof component !== 'function') {
        throw new TypeError('Lazy module must expose a default component or resolveComponent');
      }

      return { default: component as ComponentType<TProps> };
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
