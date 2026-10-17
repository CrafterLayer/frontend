import { useCallback, useState } from 'react';

/**
 * The element a portal must render into so it stays inside the editor's theme.
 *
 * `BuilderTheme` stamps `data-bldr-theme` on a wrapper `div`, and every chrome
 * token is defined under that attribute — so anything portalled to
 * `document.body` lands OUTSIDE the scope and silently resolves the light
 * palette. Measured, not guessed: with the editor stamped dark
 * (`--bldr-surface: #171b24`), a Radix popover portalled to the body still
 * painted `rgb(255, 255, 255)`.
 *
 * This is already the convention elsewhere — `EditorCanvas` portals its text
 * bubble and action bar into nodes it owns inside the canvas, never the body —
 * so this hook only makes the rule reusable.
 *
 * Returns a callback ref to put on any element inside the scope, plus the
 * scope element once it is known. `undefined` while unmounted, and `undefined`
 * if nothing above is themed — both of which a portal treats as "use the
 * default", which is the correct fallback for a host that never themed
 * anything.
 */
export function useThemeScope(): {
  /** Put this on any element inside the scope. */
  readonly attach: (node: HTMLElement | null) => void;
  /** The themed element, once known. */
  readonly scope: HTMLElement | undefined;
} {
  const [container, setContainer] = useState<HTMLElement | undefined>();

  const attach = useCallback((node: HTMLElement | null) => {
    if (node === null) {
      setContainer(undefined);
      return;
    }
    /*
      `closest` rather than a context: the theme is expressed in the DOM as an
      attribute, and a host is free to stamp it without going through this
      package's provider. Reading the DOM is therefore reading the source of
      truth, not working around a missing one.
    */
    setContainer(node.closest<HTMLElement>('[data-bldr-theme]') ?? undefined);
  }, []);

  return { attach, scope: container };
}
