/**
 * Page addresses → exported file paths. Unicode letters and digits are
 * first-class (an Arabic page lives at `/قائمة-الطعام`): the FILE path keeps
 * UTF-8 (the archive writes UTF-8 names), and every URL a crawler reads —
 * canonical, og:url, hreflang, sitemap — is percent-encoded by `encodeRoute`.
 */
export const EXPORT_ROUTE = /^\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]*$/u;

/** Top-level names the exporter writes itself; a page there would be overwritten. */
const RESERVED = new Set(['assets', '404.html', 'sitemap.xml', 'robots.txt', 'index.html']);

export function routeFile(address: string): string {
  if (!EXPORT_ROUTE.test(address)) {
    throw new Error(
      `Route cannot be exported: "${address}". Use "/" or "/segment" with letters, digits, "-" or "_".`,
    );
  }
  const trimmed = address.replace(/^\//u, '').replace(/\/$/u, '');
  if (trimmed === '') return 'index.html';
  const first = trimmed.split('/')[0] ?? '';
  if (RESERVED.has(first.toLowerCase()))
    throw new Error(`Route cannot be exported: "${address}" collides with the exported "${first}".`);
  return `${trimmed}/index.html`;
}

/** `../` repeated once per directory the file sits in. */
export function relativeRoot(file: string): string {
  return '../'.repeat(file.split('/').length - 1);
}

/** The route in its canonical form: a leading slash, no trailing one (except home). */
export function normalRoute(address: string): string {
  const trimmed = address.replace(/\/$/u, '');
  return trimmed === '' ? '/' : trimmed;
}
