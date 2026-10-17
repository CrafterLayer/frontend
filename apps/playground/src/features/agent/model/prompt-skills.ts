import type { AiSkillRegistry } from '@craftkit/builder';

/** Explicit choices belong to this request, alongside any choices the host supplied. */
export interface PromptSkillSource {
  readonly selectedSkillIds?: readonly string[] | undefined;
  readonly selectedSkillIdsFor?: ((request: string) => readonly string[]) | undefined;
  readonly skillRequestTextFor?: ((request: string) => string) | undefined;
}

/** Capture identity and meaning together before a queue's registry can change. */
export interface PromptSkillSnapshot {
  readonly skillIds: readonly string[];
  readonly request: string;
}

/** Optional v2 turn metadata is data only; malformed or excessive fields are dropped. */
export function readPromptSkillSnapshot(value: unknown): PromptSkillSnapshot | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  const ids: unknown = record['skillIds'];
  const request: unknown = record['request'];
  if (
    typeof request !== 'string' ||
    request.length > 65_536 ||
    !Array.isArray(ids) ||
    ids.length > 128
  )
    return undefined;
  const listed = ids as readonly unknown[];
  if (!listed.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256))
    return undefined;
  return Object.freeze({
    skillIds: Object.freeze([...new Set(listed as readonly string[])]),
    request,
  });
}

export function snapshotPromptSkills(
  source: PromptSkillSource,
  request: string,
): PromptSkillSnapshot {
  return Object.freeze({
    skillIds: Object.freeze([...(source.selectedSkillIdsFor?.(request) ?? [])]),
    request: skillRequestText(source, request),
  });
}

/** Only the already captured selection prefix accompanies a rewritten brief. */
export function promptSkillPrefix(request: string, snapshot?: PromptSkillSnapshot): string {
  return snapshot !== undefined && request.endsWith(snapshot.request)
    ? request.slice(0, request.length - snapshot.request.length)
    : '';
}

/** Editing the body preserves an unchanged chosen prefix even after the skill is renamed. */
export function updatePromptSkillSnapshot(
  source: PromptSkillSource,
  before: string,
  after: string,
  snapshot: PromptSkillSnapshot | undefined,
): PromptSkillSnapshot {
  if (snapshot !== undefined && before.endsWith(snapshot.request)) {
    const prefix = before.slice(0, before.length - snapshot.request.length);
    if (prefix.trim() !== '' && after.startsWith(prefix))
      return Object.freeze({ skillIds: snapshot.skillIds, request: after.slice(prefix.length) });
    const retainedAt = prefix.trim() === '' ? -1 : after.indexOf(prefix);
    if (retainedAt > 0) {
      const added = snapshotPromptSkills(source, after.slice(0, retainedAt));
      if (added.request.trim() === '')
        return Object.freeze({
          skillIds: Object.freeze([...new Set([...added.skillIds, ...snapshot.skillIds])]),
          request: after.slice(retainedAt + prefix.length),
        });
    }
  }
  return snapshotPromptSkills(source, after);
}

/** Turns and queues retain the raw text; routing and generation read its captured brief. */
export function skillRequestText(
  source: PromptSkillSource,
  request: string,
  snapshot?: PromptSkillSnapshot,
): string {
  return snapshot?.request ?? source.skillRequestTextFor?.(request) ?? request;
}

export function selectedSkillsForRequest(
  source: PromptSkillSource,
  request: string,
  snapshot?: PromptSkillSnapshot,
  registry?: Pick<AiSkillRegistry, 'get'>,
): readonly string[] | undefined {
  const chosen =
    snapshot === undefined
      ? (source.selectedSkillIdsFor?.(request) ?? [])
      : snapshot.skillIds.filter((id) => registry?.get(id) !== undefined);
  const ids = [...new Set([...(source.selectedSkillIds ?? []), ...chosen])];
  return ids.length === 0 ? undefined : ids;
}
