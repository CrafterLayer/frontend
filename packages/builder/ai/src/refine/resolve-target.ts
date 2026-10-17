import {
  isTokenName,
  type BuilderSite,
  type NodeId,
  type PageId,
  type TokenName,
} from '@craftkit/builder-schema';

/**
 * What a follow-up request is ABOUT, resolved against the site that exists.
 *
 * ## Why resolution comes first, and alone
 *
 * A refinement's whole promise is that it changes its target and nothing else
 * (FR-036). A request naming a page the site does not have cannot keep that
 * promise — there is nothing to change — so the honest answer is to refuse
 * before a model is asked anything at all. Proposing first and discovering the
 * target afterwards spends a call to arrive at the same refusal, and worse,
 * gives the model a chance to "helpfully" change something adjacent.
 *
 * That is why this is a separate module from `refineSite`: resolution has no
 * provider, no kernel, and no way to write. It is a pure question about a site.
 */

export type RefineTarget =
  /** The whole site: page set, order, direction. */
  | { readonly kind: 'site' }
  /** The palette. Reached by name because a colour request never names a page. */
  | { readonly kind: 'design-system'; readonly token?: TokenName | undefined }
  | { readonly kind: 'page'; readonly pageId: PageId }
  | { readonly kind: 'node'; readonly pageId: PageId; readonly nodeId: NodeId };

export type ResolveTargetResult =
  | { readonly ok: true; readonly target: RefineTarget }
  | { readonly ok: false; readonly reason: string };

const SITE_WORDS = [/\bwhole site\b/iu, /\bevery page\b/iu, /موقع كامل/u, /كل الصفحات/u];
const DESIGN_WORDS = [
  /\bpalette\b/iu,
  /\bcolou?rs?\b/iu,
  /\bdesign system\b/iu,
  /لوحة الألوان/u,
  /الألوان/u,
];

const normalise = (text: string): string => text.toLowerCase().replace(/\s+/gu, ' ').trim();

/**
 * Resolve a request against a site.
 *
 * The order is deliberate: the most SPECIFIC target wins. A request that names
 * both a page and a colour ("make the contact page's accent darker") is about a
 * page, because that is the narrower promise — and a refinement that widened
 * itself to the whole palette would change four pages a person did not mention.
 */
export function resolveRefineTarget(site: BuilderSite, request: string): ResolveTargetResult {
  const text = normalise(request);
  if (text === '') {
    return { ok: false, reason: 'The request says nothing to change.' };
  }

  /*
    A page named by title, address or id — matched by the LONGEST needle, never
    by the first hit.

    The home page's address is `/`, which is a substring of every other address
    in the site, so a first-match scan resolved "tighten /work" to the home
    page. Longest-match is the rule that gets both right, and it is the rule a
    person is applying when they read their own sentence: the more specific name
    is the one they meant.
  */
  const needles = site.pages.flatMap((candidate) =>
    [candidate.title, candidate.address, candidate.id]
      .map((value) => normalise(value))
      /* Two characters at minimum: "/" matches everything and means nothing. */
      .filter((value) => value.length >= 2 && text.includes(value))
      .map((value) => ({ page: candidate, length: value.length })),
  );
  const page = needles.sort((left, right) => right.length - left.length)[0]?.page;
  if (page !== undefined) {
    const node = Object.keys(page.document.nodes).find(
      (id) => id !== page.document.rootId && text.includes(normalise(id)),
    );
    return node === undefined
      ? { ok: true, target: { kind: 'page', pageId: page.id } }
      : { ok: true, target: { kind: 'node', pageId: page.id, nodeId: node } };
  }

  /*
    A request that NAMES a token is about that token, whether or not it also
    says the word "colour". "Make the accent darker" is the commonest colour
    follow-up there is, and it contains neither "palette" nor "colour".
  */
  const token = Object.keys(site.designSystem.tokens)
    .filter((name) => isTokenName(name) && text.includes(normalise(name)))
    /* Longest again: "accent" is a substring of "accentText". */
    .sort((left, right) => right.length - left.length)[0];
  if (token !== undefined && isTokenName(token)) {
    return { ok: true, target: { kind: 'design-system', token } };
  }

  if (DESIGN_WORDS.some((pattern) => pattern.test(request))) {
    return { ok: true, target: { kind: 'design-system' } };
  }

  if (SITE_WORDS.some((pattern) => pattern.test(request))) {
    return { ok: true, target: { kind: 'site' } };
  }

  /*
    Refused, not guessed. "Make the pricing page warmer" against a site with no
    pricing page is a request about something that does not exist, and the
    useful answer names what the site DOES have rather than quietly picking the
    nearest page and changing it.
  */
  return {
    ok: false,
    reason: `Nothing in this site matches that request. It has ${site.pages
      .map((entry) => `"${entry.title}"`)
      .join(', ')}.`,
  };
}
