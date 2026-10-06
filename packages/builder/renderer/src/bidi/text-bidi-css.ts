/**
 * Text direction for every text element on a page (block-parts DESIGN §2.11).
 *
 * A page carries ONE direction on its root (`<html dir="rtl">` on the canvas
 * frame and in the export). Without this rule every paragraph inherits that
 * base direction, so an English sentence on an Arabic page is laid out
 * right-to-left and its trailing full stop lands at the visual START
 * (".site grows", ".blocks"). `unicode-bidi: plaintext` makes each text
 * element take its base direction from its own first strong character, the
 * way `dir="auto"` would, without touching a single block renderer.
 *
 * `:where()` keeps the specificity at zero, so any author or utility rule
 * that sets `unicode-bidi` still wins.
 *
 * Alignment stays the SECTION's (fix pass 2026-10-06, DESIGN §6.2): left to
 * the rule above, an English eyebrow and heading in an RTL section aligned to
 * their own start (the left) while an Arabic paragraph under them sat on the
 * right — one header split across both edges. `text-align: match-parent`
 * keeps the inherited alignment but resolves `start`/`end` against the
 * PARENT's direction, so the punctuation follows the text and the edge
 * follows the page. A utility (`text-left`, `text-center`) still wins. The
 * same holds for every element carrying `dir="auto"` (parts, authored
 * mixed-language spans), which the published HTML keeps.
 *
 * A per-part `dir` override fixes a misfire such as an Arabic sentence that
 * opens with a Latin brand name.
 */
const TEXT_ELEMENTS = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,figcaption,caption,td,th,summary,label,legend,button,a,[data-ck-part]';

export const TEXT_BIDI_CSS =
  `:where(${TEXT_ELEMENTS}){unicode-bidi:plaintext}` +
  `:where(${TEXT_ELEMENTS},[dir=auto]){text-align:match-parent}`;

/**
 * The canvas copy, in the BASE cascade layer like the export's
 * (`STATIC_BASE_CSS`). Unlayered, the zero-specificity rule would still beat
 * every layered Tailwind utility — `text-center` on a heading would lose to
 * `match-parent`.
 */
export const TEXT_BIDI_CANVAS_CSS = `@layer base{${TEXT_BIDI_CSS}}`;

/** The id of the managed style element the canvas frame injects once. */
export const TEXT_BIDI_STYLE_ID = 'ck-text-bidi';
