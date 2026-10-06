import { useEffect, useState } from 'react';

import { modelsEndpointFromEnv, readOfferedModels, sameModels } from './offered-models';

type Env = Readonly<Record<string, unknown>>;

/** How often the picker asks while the page is visible. The server answers from its cache. */
export const OFFERED_MODELS_POLL_MS = 60_000;

/**
 * The models to offer: `fallback` until the server answers, then the server's own list,
 * asked again every minute while the tab is visible and the moment it becomes visible
 * again. A failed ask keeps the last list; nothing here ever empties the picker.
 */
export function useOfferedModels(env: Env, fallback: readonly string[]): readonly string[] {
  const [models, setModels] = useState<readonly string[]>(fallback);

  useEffect(() => {
    const url = modelsEndpointFromEnv(env);
    if (url === undefined) return undefined;
    const rawToken = env['VITE_AI_PLAN_TOKEN'];
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';
    let pending: AbortController | undefined;
    let stopped = false;

    const refresh = async (): Promise<void> => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
          },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const ids = readOfferedModels(await response.json());
        if (ids !== undefined && !stopped) {
          setModels((current) => (sameModels(current, ids) ? current : ids));
        }
      } catch {
        // Offline, or the server is down: the list the picker has is still the best one.
      }
    };
    const refreshIfVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    const timer = setInterval(refreshIfVisible, OFFERED_MODELS_POLL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      stopped = true;
      pending?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [env]);

  return models;
}
