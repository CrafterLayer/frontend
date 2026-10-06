/**
 * The `embed-facade` behaviour pack (media-motion DESIGN §A.1, §A.2, §E): a
 * link `a[data-ck-behavior="embed-facade"][href]` to a YouTube video
 * (`youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`), a Vimeo
 * video (`vimeo.com/N`) or a Google Maps place, showing a poster image.
 *
 * - Without the script it is a plain link to the video or the map, and the
 *   page makes no request to the player until the reader asks.
 * - On activation (click, or Enter on the link) in an interactive page it
 *   derives the embed address — `https://www.youtube-nocookie.com/embed/ID?autoplay=1`,
 *   `https://player.vimeo.com/video/N?autoplay=1` or
 *   `https://www.google.com/maps?q=…&output=embed` — re-tests it against
 *   INLINE copies of the schema's iframe allowlist, and swaps the link's
 *   content for an iframe with the sandbox, permissions and referrer policy
 *   the renderer forces on every iframe. Focus moves into the iframe.
 *   `embed-facade-parity.test.ts` holds the inline copies equal to
 *   `CUSTOM_CODE_IFRAME_*` in @craftkit/builder-schema.
 * - A modified click (new tab, new window) keeps the link's own behaviour.
 * - On the editing canvas (`interactive: false`) nothing is wired: a click
 *   selects.
 * - Dispose removes the iframe and restores the link's children and
 *   attributes.
 *
 * Self-contained and serialised like every pack: no imports, no module scope.
 */
export function mountEmbedFacade(
  root: ParentNode,
  options?: { readonly interactive?: boolean },
): () => void {
  const doc: Document | null =
    (root as Node).nodeType === 9 ? (root as Document) : (root as Node).ownerDocument;
  const win = doc === null ? null : doc.defaultView;
  if (doc === null || win === null)
    return function noop() {
      // ignore
    };
  const page: Document = doc;
  const interactive = options?.interactive !== false;
  const MARK = 'data-ck-facade';
  const cleanups: (() => void)[] = [];
  const ALLOWED = [
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]+(?:[?][^\s"'<>\\`]*)?$/u,
    /^https:\/\/player\.vimeo\.com\/video\/\d+(?:[?][^\s"'<>\\`]*)?$/u,
    /^https:\/\/www\.google\.com\/maps[?]q=[^\s"'<>&]+&output=embed$/u,
  ];
  const SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';
  const ALLOW =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  const REFERRER = 'strict-origin-when-cross-origin';

  const saved: { el: Element; name: string; original: string | null; applied: string | null }[] = [];
  function setAttr(el: Element, name: string, value: string | null): void {
    let entry = null as (typeof saved)[number] | null;
    for (const item of saved) if (item.el === el && item.name === name) entry = item;
    if (entry === null) {
      entry = { el, name, original: el.getAttribute(name), applied: null };
      saved.push(entry);
    }
    entry.applied = value;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }

  function embedOf(href: string): { src: string; map: boolean } | null {
    let url: URL;
    try {
      url = new URL(href, page.baseURI);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./u, '');
    const path = url.pathname;
    let id: string | null = null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id =
        path === '/watch'
          ? url.searchParams.get('v')
          : (/^\/(?:shorts|embed|live)\/([\w-]+)/u.exec(path)?.[1] ?? null);
    } else if (host === 'youtu.be') {
      id = /^\/([\w-]+)/u.exec(path)?.[1] ?? null;
    }
    if (id !== null) {
      return /^[\w-]{6,20}$/u.test(id)
        ? { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, map: false }
        : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const number = /^\/(?:video\/)?(\d+)/u.exec(path)?.[1];
      return number === undefined
        ? null
        : { src: `https://player.vimeo.com/video/${number}?autoplay=1`, map: false };
    }
    if ((host === 'google.com' && path.startsWith('/maps')) || host === 'maps.google.com') {
      let query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';
      const place = /^\/maps\/(?:place|search)\/([^/@]+)/u.exec(path)?.[1];
      if (query === '' && place !== undefined) {
        try {
          query = decodeURIComponent(place.replace(/\+/gu, ' '));
        } catch {
          query = '';
        }
      }
      const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/u.exec(path);
      if (query === '' && at !== null) query = `${at[1] ?? ''},${at[2] ?? ''}`;
      query = query.trim();
      return query === '' || query.length > 300
        ? null
        : { src: `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`, map: true };
    }
    return null;
  }

  function facade(link: HTMLAnchorElement): void {
    const target = embedOf(link.getAttribute('href') ?? '');
    if (target === null || !ALLOWED.some((pattern) => pattern.test(target.src))) return;
    const embed = target;
    setAttr(link, MARK, interactive ? '' : 'still');
    if (!interactive) return;
    let frame: HTMLIFrameElement | null = null;
    const removed: { node: Node; before: Node | null }[] = [];
    function activate(event: Event): void {
      const click = event as MouseEvent;
      if (click.button > 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return;
      event.preventDefault();
      if (frame !== null) return;
      const owner = link.closest('[lang]');
      const lang = owner === null ? page.documentElement.lang : (owner.getAttribute('lang') ?? '');
      const ar = /^ar/iu.test(lang);
      const image = link.querySelector('img');
      const named = (link.getAttribute('aria-label') ?? '').trim();
      const alt = image === null ? '' : image.alt.trim();
      const title =
        named !== '' ? named : alt !== '' ? alt : embed.map ? (ar ? 'خريطة' : 'Map') : ar ? 'فيديو' : 'Video';
      const made = page.createElement('iframe');
      made.className = 'ck-embed-frame';
      made.src = embed.src;
      made.title = title;
      made.setAttribute('sandbox', SANDBOX);
      made.setAttribute('allow', ALLOW);
      made.setAttribute('referrerpolicy', REFERRER);
      made.setAttribute('allowfullscreen', '');
      made.setAttribute('loading', 'eager');
      for (const child of Array.from(link.childNodes)) {
        if (child.nodeType === 1) setAttr(child as Element, 'hidden', '');
        else {
          removed.push({ node: child, before: child.nextSibling });
          child.remove();
        }
      }
      setAttr(link, 'tabindex', '-1');
      setAttr(link, 'data-ck-playing', '');
      link.appendChild(made);
      frame = made;
      made.focus();
    }
    link.addEventListener('click', activate);
    cleanups.push(function unfacade() {
      link.removeEventListener('click', activate);
      if (frame !== null) frame.remove();
      frame = null;
      for (let at = removed.length - 1; at >= 0; at -= 1) {
        const item = removed[at];
        if (item === undefined) continue;
        if (item.before !== null && item.before.parentNode === link) link.insertBefore(item.node, item.before);
        else link.appendChild(item.node);
      }
      removed.length = 0;
    });
  }

  const SELECTOR = 'a[data-ck-behavior="embed-facade"][href]';
  const found: Element[] = [];
  if ((root as Node).nodeType === 1 && (root as Element).matches(SELECTOR)) found.push(root as Element);
  found.push(...Array.from(root.querySelectorAll(SELECTOR)));
  for (const el of found) if (!el.hasAttribute(MARK)) facade(el as HTMLAnchorElement);

  let disposed = false;
  return function dispose() {
    if (disposed) return;
    disposed = true;
    for (let at = cleanups.length - 1; at >= 0; at -= 1) {
      try {
        cleanups[at]?.();
      } catch {
        // ignore
      }
    }
    cleanups.length = 0;
    for (let at = saved.length - 1; at >= 0; at -= 1) {
      const item = saved[at];
      if (item === undefined || item.el.getAttribute(item.name) !== item.applied) continue;
      if (item.original === null) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.original);
    }
    saved.length = 0;
  };
}
