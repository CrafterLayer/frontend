import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** What a panel that never arrived renders: nothing, so the rest of the editor stays usable. */
function MissingPanel(): null {
  return null;
}

/**
 * `React.lazy` for a panel kept out of the entry chunk (performance pass, 2026-10-12).
 *
 * The playground has no error boundary, so a chunk that fails to download would take the whole
 * editor down with it. The import is tried `attempts` times, `delayMs` apart; if it still fails,
 * the failure is logged and the panel renders nothing, the way it renders while hidden. A reload
 * brings it back.
 */
export function lazyPanel<P extends object>(
  load: () => Promise<ComponentType<P>>,
  attempts = 3,
  delayMs = 400,
): LazyExoticComponent<ComponentType<P>> {
  const attempt = (left: number): Promise<{ default: ComponentType<P> }> =>
    load().then(
      (component) => ({ default: component }),
      (error: unknown) => {
        if (left > 1) {
          return new Promise<void>((resolve) => {
            setTimeout(resolve, delayMs);
          }).then(() => attempt(left - 1));
        }
        console.error('[playground] a panel chunk did not load', error);
        return { default: MissingPanel as ComponentType<P> };
      },
    );
  return lazy(() => attempt(attempts));
}
