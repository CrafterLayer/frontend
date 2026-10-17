/**
 * The ✨ glyph of Improve my request, as static JSX.
 *
 * AgentIcon's set (WP-09) has no sparkle, and this is the one glyph only the Improve
 * feature draws, so it lives beside it. It is built exactly as AgentIcon builds its own:
 * a module-level element, created once, so React never rewrites the paths under a pointer
 * (the first-click bug, `icon-paths.tsx`); a 16px grid, a 1.5px stroke, round caps and
 * joins, `currentColor`, `aria-hidden`.
 *
 * A four-point star with concave sides, and a small cross beside it: the shape people
 * already read as "make this better" in writing tools. It never mirrors: light has no
 * reading direction.
 */
export const SPARKLE = (
  <svg
    className="ck-agent-icon ck-agent-sparkle"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    data-icon="sparkle"
  >
    <path d="M6.5 5Q6.95 8.8 10.75 9.25 6.95 9.7 6.5 13.5 6.05 9.7 2.25 9.25 6.05 8.8 6.5 5z" />
    <path d="M11.75 3v3M10.25 4.5h3" />
  </svg>
);
