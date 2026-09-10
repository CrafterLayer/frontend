import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { CompiledPageArtifact, PreviewArtifact } from '@craftkit/builder/code-runtime';

export const DEFAULT_ARTIFACT_LIMIT = 64;
export const DEFAULT_ARTIFACT_BYTES = 64 * 1024 * 1024;

interface StoredArtifact {
  readonly artifact: CompiledPageArtifact;
  readonly accessToken: string;
  readonly bytes: number;
  touchedAt: number;
}

export interface ArtifactStoreOptions {
  readonly maxArtifacts?: number;
  readonly maxBytes?: number;
  readonly artifactPath?: string;
  readonly now?: () => number;
  readonly token?: () => string;
}

export interface ArtifactStore {
  put(artifact: CompiledPageArtifact): PreviewArtifact;
  find(artifactId: string): CompiledPageArtifact | undefined;
  serve(url: URL): Response;
  metrics(): { readonly artifacts: number; readonly bytes: number; readonly evictions: number };
}

function artifactBytes(artifact: CompiledPageArtifact): number {
  return [...artifact.js, ...artifact.css].reduce(
    (total, file) => total + new TextEncoder().encode(file.content).byteLength,
    0,
  );
}

function contentType(path: string): string {
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.json') || path.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function secretMatches(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'Artifact not found.' }), {
    status: 404,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Bounded process cache. Source stays outside it; every entry is safe to rebuild and evict. */
export function createArtifactStore(options: ArtifactStoreOptions = {}): ArtifactStore {
  const maxArtifacts = options.maxArtifacts ?? DEFAULT_ARTIFACT_LIMIT;
  const maxBytes = options.maxBytes ?? DEFAULT_ARTIFACT_BYTES;
  const artifactPath = options.artifactPath ?? '/artifacts';
  if (!Number.isSafeInteger(maxArtifacts) || maxArtifacts < 1) {
    throw new Error('maxArtifacts must be positive.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error('maxBytes must be positive.');
  if (!/^\/[a-z0-9/-]+$/u.test(artifactPath)) throw new Error('artifactPath is invalid.');
  const now = options.now ?? Date.now;
  const makeToken = options.token ?? (() => randomBytes(24).toString('base64url'));
  const entries = new Map<string, StoredArtifact>();
  let totalBytes = 0;
  let evictions = 0;

  const touch = (entry: StoredArtifact): void => {
    entry.touchedAt = now();
    entries.delete(entry.artifact.artifactId);
    entries.set(entry.artifact.artifactId, entry);
  };
  const evict = (): void => {
    while (entries.size > maxArtifacts || totalBytes > maxBytes) {
      const oldest = entries.values().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest.artifact.artifactId);
      totalBytes -= oldest.bytes;
      evictions += 1;
    }
  };
  const previewOf = (entry: StoredArtifact): PreviewArtifact => ({
    artifactId: entry.artifact.artifactId,
    projectId: entry.artifact.projectId,
    pageId: entry.artifact.pageId,
    sourceRevision: entry.artifact.sourceRevision,
    scriptUrls: entry.artifact.js.map(
      (file) =>
        `${artifactPath}/${encodeURIComponent(entry.artifact.artifactId)}/${encodeURIComponent(file.path)}?access=${encodeURIComponent(entry.accessToken)}`,
    ),
    stylesheetUrls: entry.artifact.css.map(
      (file) =>
        `${artifactPath}/${encodeURIComponent(entry.artifact.artifactId)}/${encodeURIComponent(file.path)}?access=${encodeURIComponent(entry.accessToken)}`,
    ),
    targetIds: entry.artifact.sourceElements.map((element) => element.handle.astNodeId),
  });

  return {
    put: (artifact) => {
      const bytes = artifactBytes(artifact);
      if (bytes > maxBytes) throw new Error('Compiled artifact exceeds server storage limit.');
      const existing = entries.get(artifact.artifactId);
      if (existing !== undefined) {
        if (JSON.stringify(existing.artifact) !== JSON.stringify(artifact)) {
          throw new Error('Artifact identity collision refused.');
        }
        touch(existing);
        return previewOf(existing);
      }
      const stored: StoredArtifact = {
        artifact: structuredClone(artifact),
        accessToken: makeToken(),
        bytes,
        touchedAt: now(),
      };
      entries.set(artifact.artifactId, stored);
      totalBytes += bytes;
      evict();
      if (!entries.has(artifact.artifactId)) throw new Error('Artifact store has no capacity.');
      return previewOf(stored);
    },
    find: (artifactId) => {
      const entry = entries.get(artifactId);
      if (entry === undefined) return undefined;
      touch(entry);
      return structuredClone(entry.artifact);
    },
    serve: (url) => {
      const match = new RegExp(
        `^${artifactPath.replaceAll('/', '\\/')}\/([^/]+)\/([^/]+)$`,
        'u',
      ).exec(url.pathname);
      if (match === null) return notFound();
      let artifactId: string;
      let path: string;
      try {
        artifactId = decodeURIComponent(match[1] ?? '');
        path = decodeURIComponent(match[2] ?? '');
      } catch {
        return notFound();
      }
      if (!/^[a-zA-Z0-9_.-]+$/u.test(path) || path === '..') return notFound();
      const entry = entries.get(artifactId);
      const access = url.searchParams.get('access') ?? '';
      if (entry === undefined || !secretMatches(access, entry.accessToken)) return notFound();
      const file = [...entry.artifact.js, ...entry.artifact.css].find(
        (candidate) => candidate.path === path,
      );
      if (file === undefined) return notFound();
      touch(entry);
      return new Response(file.content, {
        headers: {
          'content-type': contentType(path),
          'cache-control': 'public, max-age=31536000, immutable',
          etag: `"${file.integrity ?? entry.artifact.artifactId}"`,
          'cross-origin-resource-policy': 'same-origin',
          'origin-agent-cluster': '?1',
          'x-content-type-options': 'nosniff',
        },
      });
    },
    metrics: () => ({ artifacts: entries.size, bytes: totalBytes, evictions }),
  };
}
