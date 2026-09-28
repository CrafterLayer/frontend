/**
 * Where a floating layer (tooltip, menu, popover) mounts, so it keeps the panel's theme,
 * language and direction.
 *
 * Radix portals to `document.body` by default, which lands outside every scope that
 * matters here:
 * - the theme: `BuilderTheme` stamps `data-bldr-theme` on a wrapper, and every chrome token
 *   is defined under it, so a body portal resolves the light palette inside a dark editor
 *   (measured by the shell: a popover painted `rgb(255, 255, 255)`; see its
 *   `use-theme-scope.ts`);
 * - the language: the `:lang(ar)` block that re-points `--bldr-font` and the reading sizes
 *   only reaches elements inside `lang="ar"`, so an Arabic tooltip on the body would set in
 *   the Latin face at the Latin size;
 * - the direction: text and alignment follow `dir`.
 *
 * So a layer mounts inside the nearest `.ck-agent` panel root, else the nearest themed
 * element, else the body, and it always carries the trigger's `lang` and `dir` itself, for
 * the body case. The scope is read from the DOM when the trigger is first entered or
 * focused, before the layer opens: the attribute in the DOM is the source of truth, and a
 * host may stamp it without going through any provider.
 */
import { useCallback, useState } from 'react';

/** The panel root first, then any themed ancestor. */
export const PORTAL_SCOPE_SELECTOR = '.ck-agent, [data-bldr-theme]';

export interface PortalScope {
  /** The element to portal into; `undefined` portals to the body. */
  readonly container: HTMLElement | undefined;
  readonly lang: string | undefined;
  readonly dir: 'ltr' | 'rtl' | undefined;
}

const UNKNOWN: PortalScope = { container: undefined, lang: undefined, dir: undefined };

/** The scope a layer opened from `trigger` belongs in. */
export function portalScopeOf(trigger: Element): PortalScope {
  const dir = trigger.closest('[dir]')?.getAttribute('dir');
  return {
    container: trigger.closest<HTMLElement>(PORTAL_SCOPE_SELECTOR) ?? undefined,
    lang: trigger.closest('[lang]')?.getAttribute('lang') ?? undefined,
    dir: dir === 'rtl' || dir === 'ltr' ? dir : undefined,
  };
}

function sameScope(a: PortalScope, b: PortalScope): boolean {
  return a.container === b.container && a.lang === b.lang && a.dir === b.dir;
}

/**
 * The scope of a trigger, read by `capture(element)` from the trigger's own
 * pointerenter, pointerdown, focus or keydown handler, before its layer opens. An
 * unchanged scope does not re-render.
 */
export function usePortalScope(): {
  readonly scope: PortalScope;
  readonly capture: (trigger: Element) => void;
} {
  const [scope, setScope] = useState<PortalScope>(UNKNOWN);
  const capture = useCallback((trigger: Element) => {
    const next = portalScopeOf(trigger);
    setScope((current) => (sameScope(current, next) ? current : next));
  }, []);
  return { scope, capture };
}
