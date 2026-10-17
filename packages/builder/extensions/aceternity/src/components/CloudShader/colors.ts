/**
 * Token names → shader uniforms.
 *
 * The whole reason this file exists: a shader takes floats, and this project's
 * colours are named intents that only become values at paint time. Upstream's
 * Cloud Shader takes `cloudColor="#fbf8f2"` and `skyTopColor="#3876ba"` —
 * literals, in props, which would sit in a document as a sky the design system
 * can never move. The block stores ROLE NAMES and resolves them here, against
 * the element, so re-pointing `--t-accent` re-colours the sky.
 */

/** The colour roles a cloud field may be painted from. */
export const CLOUD_ROLES = [
  'surface',
  'surfaceInverse',
  'accent',
  'success',
  'text',
  'textMuted',
  'textInverse',
] as const;

export type CloudRole = (typeof CLOUD_ROLES)[number];

const ROLE_CSS_NAME: Record<CloudRole, string> = {
  surface: '--t-surface',
  surfaceInverse: '--t-surface-inverse',
  accent: '--t-accent',
  success: '--t-success',
  text: '--t-text',
  textMuted: '--t-text-muted',
  textInverse: '--t-text-inverse',
};

type Rgb = readonly [number, number, number];

/**
 * Parse whatever a token currently resolves to into linear-ish 0–1 floats.
 *
 * Hex and `rgb()` only, and that is a deliberate floor rather than an
 * oversight: those are the two forms `themes.ts` produces. A theme that starts
 * emitting `oklch()` will fall back to the neutral below and look wrong in a
 * visible way, which is the failure mode worth having — a silent black sky
 * would read as a bug in the shader.
 */
export function parseColor(value: string, fallback: Rgb): Rgb {
  const text = value.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex?.[1] !== undefined) {
    /*
      `.replace` per matched character rather than spreading the string. The
      pattern already guarantees ASCII hex digits, so a code-point iteration
      cannot bite here — but the workspace refuses string spreads everywhere
      for the surrogate-pair reason, and an exception granted where it is safe
      is an exception someone copies to where it is not.
    */
    const digits =
      hex[1].length === 3 ? hex[1].replace(/./g, (character) => character.repeat(2)) : hex[1];
    const int = Number.parseInt(digits, 16);
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (rgb?.[1] !== undefined) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .map((part) => Number.parseFloat(part))
      .filter((part) => !Number.isNaN(part));
    const [r, g, b] = parts;
    /*
      `parts.length` rather than per-element undefined checks: the array is
      typed `number[]`, so TypeScript already believes the elements exist and
      the comparison is dead code it can prove.
    */
    if (parts.length >= 3 && r !== undefined && g !== undefined && b !== undefined) {
      return [r / 255, g / 255, b / 255];
    }
  }

  return fallback;
}

/**
 * Read a role off an element.
 *
 * Off the ELEMENT, not the document root: `StaticDocument` publishes a theme
 * as inline custom properties on a wrapper, so a page can carry a design
 * system that `:root` has never heard of.
 */
export function readRole(element: Element, role: CloudRole, fallback: Rgb): Rgb {
  const value = getComputedStyle(element).getPropertyValue(ROLE_CSS_NAME[role]);
  return parseColor(value, fallback);
}
