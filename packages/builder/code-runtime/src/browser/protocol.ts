import type { PreviewArtifact, PreviewEnvelope, PreviewHostCommand } from '../contracts';
import { canonicalJson } from '../fingerprint';

const ENVELOPE_KEYS = [
  'version',
  'channel',
  'projectId',
  'pageId',
  'artifactId',
  'sourceRevision',
  'type',
  'payload',
];
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).every((key) => keys.includes(key)) &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/** Shared by the host and preview bootstrap. Transport identity is checked by the receiver. */
export function validatePreviewEnvelope(
  value: unknown,
  artifact: Pick<
    PreviewArtifact,
    'projectId' | 'pageId' | 'artifactId' | 'sourceRevision' | 'targetIds'
  >,
  channel: string,
):
  | { readonly ok: true; readonly message: PreviewEnvelope }
  | { readonly ok: false; readonly reason: string } {
  const refused = (reason: string) => ({ ok: false as const, reason });
  try {
    if (canonicalJson(value).length > 32_768)
      return refused('Preview message exceeds its size limit.');
  } catch {
    return refused('Preview message is not JSON.');
  }
  if (
    !record(value) ||
    !exactKeys(value, ENVELOPE_KEYS) ||
    value['version'] !== 1 ||
    value['channel'] !== channel ||
    value['projectId'] !== artifact.projectId ||
    value['pageId'] !== artifact.pageId ||
    value['artifactId'] !== artifact.artifactId ||
    value['sourceRevision'] !== artifact.sourceRevision
  )
    return refused('Preview identity or revision does not match.');
  const payload = value['payload'];
  if (!record(payload)) return refused('Preview payload is not an object.');
  const type = value['type'];
  if (type === 'ready' || type === 'heartbeat') {
    if (!exactKeys(payload, [])) return refused('Unexpected heartbeat payload.');
  } else if (type === 'focus' || type === 'geometry') {
    const expected = type === 'focus' ? ['astNodeId'] : ['astNodeId', 'x', 'y', 'width', 'height'];
    if (
      !exactKeys(payload, expected) ||
      typeof payload['astNodeId'] !== 'string' ||
      !artifact.targetIds.includes(payload['astNodeId'])
    )
      return refused('Preview target is not in the compiled source map.');
    if (type === 'geometry') {
      for (const key of ['x', 'y', 'width', 'height']) {
        const number = payload[key];
        if (
          typeof number !== 'number' ||
          !Number.isFinite(number) ||
          Math.abs(number) > 10_000_000 ||
          ((key === 'width' || key === 'height') && number < 0)
        )
          return refused('Invalid preview geometry.');
      }
    }
  } else if (type === 'diagnostic') {
    if (
      !exactKeys(payload, ['message', 'severity']) ||
      typeof payload['message'] !== 'string' ||
      payload['message'].length > 2000 ||
      !['error', 'warning'].includes(String(payload['severity']))
    )
      return refused('Invalid preview diagnostic.');
  } else if (type === 'navigate') {
    if (
      !exactKeys(payload, ['pageId']) ||
      typeof payload['pageId'] !== 'string' ||
      payload['pageId'].length === 0 ||
      payload['pageId'].length > 200
    )
      return refused('Invalid navigation request.');
  } else return refused('Unknown preview message type.');
  return { ok: true, message: value as unknown as PreviewEnvelope };
}

export const PREVIEW_PROTOCOL_VERSION = 1;

/** The bootstrap must additionally check event.source and its configured parent origin. */
export function validatePreviewHostCommand(
  value: unknown,
  options: {
    readonly artifactOrigin: string;
    readonly current?: { readonly artifact: PreviewArtifact; readonly channel: string };
  },
):
  | { readonly ok: true; readonly command: PreviewHostCommand }
  | { readonly ok: false; readonly reason: string } {
  const refused = (reason: string) => ({ ok: false as const, reason });
  try {
    if (canonicalJson(value).length > 262_144)
      return refused('Host message exceeds its size limit.');
  } catch {
    return refused('Host message is not JSON.');
  }
  if (!record(value) || !exactKeys(value, ENVELOPE_KEYS) || value['version'] !== 1)
    return refused('Invalid host command envelope.');
  for (const field of ['channel', 'projectId', 'pageId', 'artifactId', 'sourceRevision']) {
    if (typeof value[field] !== 'string' || value[field].length === 0 || value[field].length > 512)
      return refused('Invalid host command identity.');
  }
  const payload = value['payload'];
  if (!record(payload)) return refused('Invalid host command payload.');
  if (value['type'] === 'focus') {
    if (options.current === undefined) return refused('Preview session has not initialized.');
    const result = validatePreviewEnvelope(
      value,
      options.current.artifact,
      options.current.channel,
    );
    return result.ok ? { ok: true, command: value as unknown as PreviewHostCommand } : result;
  }
  if (
    value['type'] !== 'init' ||
    !exactKeys(payload, ['artifact', 'publicData']) ||
    !record(payload['publicData'])
  )
    return refused('Unknown host command.');
  const artifact = payload['artifact'];
  if (
    !record(artifact) ||
    !exactKeys(artifact, [
      'artifactId',
      'projectId',
      'pageId',
      'sourceRevision',
      'scriptUrls',
      'stylesheetUrls',
      'targetIds',
    ])
  )
    return refused('Invalid preview artifact.');
  for (const field of ['projectId', 'pageId', 'artifactId', 'sourceRevision'])
    if (artifact[field] !== value[field])
      return refused('Artifact identity does not match host command.');
  for (const field of ['scriptUrls', 'stylesheetUrls', 'targetIds'])
    if (
      !Array.isArray(artifact[field]) ||
      !(artifact[field] as unknown[]).every((item) => typeof item === 'string')
    )
      return refused('Invalid artifact references.');
  if ((artifact['scriptUrls'] as string[]).length === 0)
    return refused('Artifact has no script entry.');
  if (
    new Set(artifact['targetIds'] as string[]).size !== (artifact['targetIds'] as string[]).length
  )
    return refused('Duplicate source target identity.');
  for (const urlString of [
    ...(artifact['scriptUrls'] as string[]),
    ...(artifact['stylesheetUrls'] as string[]),
  ]) {
    try {
      const url = new URL(urlString);
      if (
        url.origin !== options.artifactOrigin ||
        url.username !== '' ||
        url.password !== '' ||
        !['https:', 'http:'].includes(url.protocol)
      )
        return refused('Artifact URL escapes the configured preview origin.');
    } catch {
      return refused('Artifact URL is not absolute.');
    }
  }
  if (
    options.current !== undefined &&
    (value['channel'] !== options.current.channel ||
      ['projectId', 'pageId', 'artifactId', 'sourceRevision'].some(
        (field) => value[field] !== options.current?.artifact[field as keyof PreviewArtifact],
      ))
  )
    return refused('A mounted preview cannot switch artifact identity.');
  return { ok: true, command: value as unknown as PreviewHostCommand };
}
