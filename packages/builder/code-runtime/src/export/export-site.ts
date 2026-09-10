import type { ArtifactFile, CompileDiagnostic } from '@craftkit/builder-schema';
import type { ExportOptions, ExportPage, ExportResult } from '../contracts';
import { fingerprint, projectFingerprints } from '../fingerprint';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

function routePath(address: string): string {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/u.test(address))
    throw new Error(`Route cannot be exported: ${address}`);
  return address === '/'
    ? 'index.html'
    : `${address.replace(/^\//u, '').replace(/\/$/u, '')}/index.html`;
}

/** Assemble an immutable website; authored execution belongs exclusively to the prerender port. */
export async function exportSite(
  pages: readonly ExportPage[],
  options: ExportOptions,
): Promise<ExportResult> {
  options.signal?.throwIfAborted();
  const files: ArtifactFile[] = [];
  const artifactIds: string[] = [];
  try {
    pages = structuredClone(pages);
    options = {
      ...options,
      catalog: structuredClone(options.catalog),
      artifacts: structuredClone(options.artifacts),
    };
    const routes = new Set<string>();
    for (const page of pages) {
      const path = routePath(page.address);
      if (routes.has(path)) throw new Error(`Duplicate exported route: ${page.address}`);
      routes.add(path);
      const artifact = options.artifacts.get(page.pageId);
      const expected = await projectFingerprints(page, options.catalog);
      options.signal?.throwIfAborted();
      if (
        artifact?.artifactId !== expected.artifactId ||
        artifact.sourceRevision !== page.project.revision ||
        artifact.projectId !== page.projectId ||
        artifact.pageId !== page.pageId
      )
        throw new Error(`Page ${page.pageId} has no revision-matching artifact.`);
      if (
        artifact.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
        artifact.js.length === 0
      )
        throw new Error(`Page ${page.pageId} has no valid hydration entry.`);
      const canonical = page.canonicalUrl === undefined ? undefined : new URL(page.canonicalUrl);
      if (
        canonical !== undefined &&
        (canonical.protocol !== 'https:' || canonical.username !== '' || canonical.password !== '')
      )
        throw new Error(`Page ${page.pageId} needs a valid HTTPS canonical URL.`);
      if (page.title.trim() === '' || page.description.trim() === '')
        throw new Error(`Page ${page.pageId} needs title and description metadata.`);
      const base = `assets/${artifact.artifactId}`;
      for (const file of [...artifact.js, ...artifact.css]) {
        if (!/^[a-zA-Z0-9_.-]+$/u.test(file.path) || file.path === '..')
          throw new Error('Artifact output path is unsafe.');
        if (file.integrity === undefined || (await fingerprint(file.content)) !== file.integrity)
          throw new Error('Artifact output integrity does not match.');
        files.push({ ...file, path: `${base}/${file.path}` });
      }
      // Validate before delegating execution, and keep the export snapshot private to this call.
      const rendered = await options.prerender(
        structuredClone(page),
        structuredClone(artifact),
        options.signal,
      );
      options.signal?.throwIfAborted();
      if (!page.noIndex && (!rendered.hasPrimaryContent || rendered.html.trim() === ''))
        throw new Error(`Page ${page.pageId} has no indexable primary content.`);
      const relativeBase = '../'.repeat(path.split('/').length - 1) + base;
      const styles = artifact.css
        .map((file) => `<link rel="stylesheet" href="${relativeBase}/${file.path}">`)
        .join('');
      const scripts = artifact.js
        .map((file) => `<script type="module" src="${relativeBase}/${file.path}"></script>`)
        .join('');
      const language = page.language ?? 'en';
      if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(language))
        throw new Error(`Page ${page.pageId} needs a valid language tag.`);
      const direction: unknown = page.direction ?? 'ltr';
      if (direction !== 'ltr' && direction !== 'rtl')
        throw new Error('Unsupported page direction.');
      const canonicalTag =
        canonical === undefined
          ? ''
          : `<link rel="canonical" href="${escapeHtml(canonical.href)}">`;
      const html = `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title><meta name="description" content="${escapeHtml(page.description)}">${canonicalTag}${page.noIndex ? '<meta name="robots" content="noindex">' : ''}${styles}</head><body><div id="root">${rendered.html}</div>${scripts}</body></html>`;
      files.push({ path, content: html, integrity: await fingerprint(html) });
      artifactIds.push(artifact.artifactId);
    }
    if (pages.length === 0) throw new Error('Export requires at least one page.');
    options.signal?.throwIfAborted();
    return { ok: true, files, artifactIds };
  } catch (cause) {
    options.signal?.throwIfAborted();
    const diagnostics: CompileDiagnostic[] = [
      {
        code: 'export-refused',
        severity: 'error',
        message: cause instanceof Error ? cause.message : 'Export failed.',
      },
    ];
    return { ok: false, diagnostics };
  }
}
