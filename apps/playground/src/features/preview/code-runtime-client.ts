import type { ArtifactFile, BuilderSite, JsonRecord } from '@craftkit/builder';
import { projectPreviewUrl } from '@craftkit/builder/code-runtime';
import type {
  PreviewArtifact,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder/code-runtime';

export interface CompiledCodePage {
  readonly previewUrl?: string;
  readonly artifact: PreviewArtifact;
  readonly sourceElements: readonly SourceElement[];
}

export interface ExportedCodePage {
  readonly files: readonly ArtifactFile[];
  readonly artifactIds: readonly string[];
}

export interface CodeRuntimeClient {
  compile(snapshot: RuntimeSnapshot, signal?: AbortSignal): Promise<CompiledCodePage>;
  exportPage(
    page: RuntimeSnapshot & {
      readonly title: string;
      readonly description: string;
      readonly canonicalUrl?: string;
      readonly language?: string;
      readonly direction?: 'ltr' | 'rtl';
    },
    artifactId: string,
    signal?: AbortSignal,
  ): Promise<ExportedCodePage>;
}

export interface CodeRuntimeClientOptions {
  readonly endpoint: string;
  readonly token?: string | undefined;
  readonly fetcher?: typeof fetch;
  readonly previewUrlTemplate?: string;
}

export function createCodeRuntimeClient(options: CodeRuntimeClientOptions): CodeRuntimeClient {
  const endpoint = options.endpoint.replace(/\/$/u, '');
  if (endpoint.length === 0) throw new Error('The code runtime endpoint is empty.');
  const origin = new URL(endpoint);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local)) ||
    origin.username !== '' ||
    origin.password !== ''
  )
    throw new Error('The code runtime requires HTTPS or a local development endpoint.');
  const fetcher = options.fetcher ?? fetch;
  const request = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> => {
    const response = await fetcher(`${endpoint}${path}`, {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: {
        'content-type': 'application/json',
        ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
      },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
    const payload: unknown = await readBoundedJson(response);
    if (!response.ok) {
      throw new Error(
        errorMessage(payload, `Code runtime request failed (${String(response.status)}).`),
      );
    }
    return payload as T;
  };

  return {
    compile: async (snapshot, signal) => {
      const payload = await request<unknown>('/v1/code/compile', { snapshot }, signal);
      const compiled = parseCompileResponse(payload);
      if (
        compiled.artifact.projectId !== snapshot.projectId ||
        compiled.artifact.pageId !== snapshot.pageId ||
        compiled.artifact.sourceRevision !== snapshot.project.revision
      )
        throw new Error('The compiler returned a different source revision.');
      const previewUrl = await projectPreviewUrl(snapshot.projectId, options.previewUrlTemplate);
      const resolveArtifactUrl = (path: string) => {
        const url = new URL(path, previewUrl);
        if (
          url.origin !== new URL(previewUrl).origin ||
          !url.pathname.startsWith(`/artifacts/${compiled.artifact.artifactId}/`)
        )
          throw new Error('Artifact URL escapes this preview project.');
        return url.href;
      };
      return {
        ...compiled,
        previewUrl,
        artifact: {
          ...compiled.artifact,
          scriptUrls: compiled.artifact.scriptUrls.map(resolveArtifactUrl),
          stylesheetUrls: compiled.artifact.stylesheetUrls.map(resolveArtifactUrl),
        },
      };
    },
    exportPage: async (page, artifactId, signal) => {
      const payload = await request<unknown>(
        '/v1/code/export',
        { pages: [page], artifactIds: [artifactId] },
        signal,
      );
      return parseExportResponse(payload);
    },
  };
}

/** Reads the source-backed page without inventing a second document model. */
export function runtimeSnapshotFromSite(
  site: Readonly<BuilderSite>,
  pageId: string,
): RuntimeSnapshot | undefined {
  const page = site.pages.find((candidate) => candidate.id === pageId);
  if (page === undefined) return undefined;
  const root = page.document.nodes[page.document.rootId];
  if (root?.type !== 'codePage') return undefined;
  const projectId = root.props['projectId'];
  const entry = root.props['entry'];
  const inputs = root.props['inputs'];
  if (typeof projectId !== 'string' || typeof entry !== 'string' || !isJsonRecord(inputs)) {
    return undefined;
  }
  const project = site.codeProjects?.[projectId];
  if (project === undefined) return undefined;
  return { projectId, pageId, address: page.address, entry, project, inputs };
}

function parseCompileResponse(value: unknown): CompiledCodePage {
  if (!isRecord(value) || value['ok'] !== true) {
    throw new Error(errorMessage(value, 'The code page did not compile.'));
  }
  const artifact = value['artifact'];
  const sourceElements = value['sourceElements'];
  if (
    !isRecord(artifact) ||
    typeof artifact['artifactId'] !== 'string' ||
    typeof artifact['projectId'] !== 'string' ||
    typeof artifact['pageId'] !== 'string' ||
    typeof artifact['sourceRevision'] !== 'string' ||
    !isStringArray(artifact['scriptUrls']) ||
    !isStringArray(artifact['stylesheetUrls']) ||
    !isStringArray(artifact['targetIds']) ||
    !Array.isArray(sourceElements) ||
    !sourceElements.every(isSourceElement)
  ) {
    throw new Error('The code runtime returned a malformed compile result.');
  }
  const targets = new Set(artifact['targetIds']);
  if (
    targets.size !== artifact['targetIds'].length ||
    sourceElements.some(
      (element) =>
        element.handle.projectId !== artifact['projectId'] ||
        element.handle.sourceRevision !== artifact['sourceRevision'] ||
        !targets.has(element.handle.astNodeId),
    )
  )
    throw new Error('The compiler returned mismatched source targets.');
  return {
    artifact: artifact as unknown as PreviewArtifact,
    sourceElements,
  };
}

function parseExportResponse(value: unknown): ExportedCodePage {
  if (!isRecord(value) || value['ok'] !== true) {
    throw new Error(errorMessage(value, 'The selected revision could not be exported.'));
  }
  if (
    !Array.isArray(value['files']) ||
    !value['files'].every(isArtifactFile) ||
    !isStringArray(value['artifactIds'])
  ) {
    throw new Error('The code runtime returned a malformed export result.');
  }
  return {
    files: value['files'],
    artifactIds: value['artifactIds'],
  };
}

function isSourceElement(value: unknown): value is SourceElement {
  if (!isRecord(value) || !isRecord(value['handle'])) return false;
  const handle = value['handle'];
  const span = value['staticText'];
  return (
    ['projectId', 'modulePath', 'sourceRevision', 'astNodeId'].every(
      (key) => typeof handle[key] === 'string' && handle[key].length > 0,
    ) &&
    (handle['instanceKey'] === undefined || typeof handle['instanceKey'] === 'string') &&
    typeof value['tag'] === 'string' &&
    typeof value['dynamic'] === 'boolean' &&
    isOffset(value['start']) &&
    isOffset(value['end']) &&
    value['end'] >= value['start'] &&
    (span === undefined ||
      (isRecord(span) &&
        isOffset(span['start']) &&
        isOffset(span['end']) &&
        span['start'] >= value['start'] &&
        span['end'] <= value['end'] &&
        span['end'] >= span['start'] &&
        typeof span['source'] === 'string'))
  );
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isArtifactFile(value: unknown): value is ArtifactFile {
  return (
    isRecord(value) &&
    typeof value['path'] === 'string' &&
    typeof value['content'] === 'string' &&
    (value['integrity'] === undefined || typeof value['integrity'] === 'string')
  );
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (response.body === null) throw new Error('The runtime returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 32 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('The runtime response exceeds the supported size.');
      }
      content += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(content + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('The runtime returned invalid JSON.');
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function errorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  if (typeof value['error'] === 'string') return value['error'];
  const diagnostics = value['diagnostics'];
  if (Array.isArray(diagnostics)) {
    const first = diagnostics.find(
      (entry): entry is Record<string, unknown> =>
        isRecord(entry) && typeof entry['message'] === 'string',
    );
    if (first !== undefined) return first['message'] as string;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return isRecord(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
