/*
  The picker shows each family in its own face, so the face has to be loaded
  in the EDITOR document. One <link> per stylesheet URL, added once and kept:
  the browser caches the faces, and removing a link would make a sample snap
  back to the fallback while a person is comparing two families.

  Only the two font hosts the CSS door admits are ever linked.
*/
const HOSTS = ['https://fonts.googleapis.com/', 'https://fonts.bunny.net/'] as const;
const MARK = 'data-bldr-font-preview';

export function ensurePreviewStylesheet(url: string, target: Document = document): void {
  if (!HOSTS.some((host) => url.startsWith(host))) return;
  const existing = Array.from(target.head.querySelectorAll(`link[${MARK}]`)).some(
    (link) => link.getAttribute('href') === url,
  );
  if (existing) return;
  const link = target.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.setAttribute(MARK, '');
  target.head.append(link);
}
