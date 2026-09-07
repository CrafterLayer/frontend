/**
 * Navigation, DERIVED from the page set (FR-005).
 *
 * ## Why this is a function beside the block and not inside it
 *
 * A block renderer receives `node`, `props` and `slots` — it has no site, and
 * giving it one would mean a layer-4 extension reaching into the kernel, which
 * the boundary check refuses and should. So the derivation lives here, where
 * whoever composes a header can call it: the site pipeline when it assembles a
 * shared region, a host that builds its own.
 *
 * ## Why derived at all
 *
 * Because a stored navigation model is a second answer to "what pages does this
 * site have", and the two drift the first time someone renames a page. There is
 * no navigation model in a `BuilderSite` — the entries a site has ARE its
 * pages — and this function is the one place that fact turns into props.
 */

export interface NavPage {
  readonly address: string;
  readonly title: string;
}

export interface NavLink {
  readonly label: string;
  readonly href: string;
}

/** The block's own bound. A header with eleven links is a header nobody reads. */
export const NAV_LINK_LIMIT = 10;

/** A title short enough for the schema, cut on a word where one is available. */
function label(title: string, max = 24): string {
  const clean = title.replace(/\s+/gu, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return space > max / 2 ? cut.slice(0, space) : cut;
}

/**
 * The pages a site publishes, as links, in the site's own page order.
 *
 * Pages are NOT sorted or filtered by importance. The order a site's pages are
 * in is a decision someone made — `reorderPage` exists for exactly that — and a
 * navigation that re-sorted them would silently overrule it.
 */
export function navLinksFromPages(pages: readonly NavPage[]): readonly NavLink[] {
  const seen = new Set<string>();
  const links: NavLink[] = [];

  for (const page of pages) {
    if (links.length >= NAV_LINK_LIMIT) break;
    const title = page.title.trim();
    /*
      A page with no title is skipped rather than given one. "Untitled" in a
      header is worse than a missing entry: it looks like a page someone meant
      to name and shipped anyway, and it is indistinguishable from one that
      really is called that.
    */
    if (title === '' || seen.has(page.address)) continue;
    seen.add(page.address);
    links.push({ label: label(title), href: page.address });
  }

  return links;
}
