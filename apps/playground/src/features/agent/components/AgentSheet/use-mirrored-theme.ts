/**
 * Stamps the theme the sheet already inherits onto the sheet's own root, as
 * `data-bldr-theme` (`light` or `dark`), and keeps it current.
 *
 * Nothing changes on screen: the stamp restates the tokens the root inherited. What it
 * changes is where floating layers mount. Every tooltip, menu and popover in the panel
 * mounts inside the nearest `.ck-agent` or `[data-bldr-theme]` above its trigger (IconButton's
 * `use-portal-scope`), and at the full detent the sheet is a modal dialog (`aria-modal`):
 * a menu mounted outside it would be outside the dialog, where a screen reader stops
 * looking. Stamped, the sheet's root is the nearest scope, so every layer opened in the
 * sheet mounts inside it.
 *
 * The theme is read from `origin`, where the sheet sits in the page (its parent, or a
 * marker left in place when it is portalled), as the resolved `color-scheme`, so a system
 * theme with nothing stamped anywhere still reads right. It follows a theme stamped on an
 * ancestor changing, and the system scheme changing.
 *
 * The attribute is written straight to the element: React does not render it, so React
 * never overwrites it, and no state or re-render is involved.
 */
import { useLayoutEffect, type RefObject } from 'react';

const ATTRIBUTE = 'data-bldr-theme';

function schemeOf(element: Element): 'light' | 'dark' | null {
  const scheme = getComputedStyle(element).colorScheme;
  if (/\bdark\b/u.test(scheme)) return 'dark';
  if (/\blight\b/u.test(scheme)) return 'light';
  return null;
}

export function useMirroredTheme(
  target: RefObject<HTMLElement | null>,
  origin: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const element = target.current;
    const source = origin.current ?? element?.parentElement ?? null;
    if (element === null || source === null) return undefined;

    const apply = (): void => {
      const theme = schemeOf(source);
      if (theme === null) element.removeAttribute(ATTRIBUTE);
      else element.setAttribute(ATTRIBUTE, theme);
    };
    apply();

    const themed = source.closest(`[${ATTRIBUTE}]`);
    let observer: MutationObserver | null = null;
    if (themed !== null && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(apply);
      observer.observe(themed, { attributes: true, attributeFilter: [ATTRIBUTE] });
    }
    const scheme =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    scheme?.addEventListener('change', apply);
    return () => {
      observer?.disconnect();
      scheme?.removeEventListener('change', apply);
    };
  }, [target, origin]);
}
