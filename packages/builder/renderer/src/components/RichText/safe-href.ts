/**
 * Href sanitization (008 contract §2 r2). Allowlist, never blocklist: http(s),
 * mailto, tel, and clearly relative paths pass; EVERYTHING else — javascript:,
 * data:, vbscript:, control-character/whitespace smuggling, protocol-relative
 * "//evil" — is neutralized (undefined ⇒ the link renders as plain text).
 */
export function safeHref(href: string): string | undefined {
  // Whitespace, control characters, and zero-width/directional characters
  // ANYWHERE are the classic smuggling vector ("java\tscript:") — judge the
  // raw value and refuse rather than repair.
  if (
    /[\u0000-\u0020\u007f-\u00a0\u1680\u2000-\u200f\u2028\u2029\u202e\u205f\u3000\ufeff]/.test(href)
  ) {
    return undefined;
  }
  // A BACKSLASH is protocol-relative smuggling: browsers implement the WHATWG
  // "relative slash state", so "/\\evil.com" resolves to https://evil.com —
  // it would slip past the "//" guard below as a "clearly relative" path.
  // Legitimate http(s)/mailto/relative hrefs never contain a literal "\\"
  // (percent-encoded %5C still works).
  if (href.includes('\\')) {
    return undefined;
  }
  if (href === '') {
    return undefined;
  }
  /*
    `tel:` joined the allowlist with the free-composition work: a CV or a
    contact section links a phone number, and the scheme carries no script
    surface — the whitespace/control-character refusal above already keeps
    it to a plain number.
  */
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) {
    return href;
  }
  if (href.startsWith('//')) {
    return undefined; // protocol-relative inherits the page scheme — refuse
  }
  if (/^[/.#?]/.test(href)) {
    return href; // clearly relative: /path, ./path, ../path, #hash, ?query
  }
  // Any other scheme-like or bare token is refused (allowlist discipline).
  return undefined;
}
