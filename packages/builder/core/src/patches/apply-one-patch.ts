import { builderError, type BuilderErrorCode, type JsonValue } from '@craftkit/builder-schema';

/** One immer-style patch over a draft root, as the transforms codec emits. */
export interface RootPatch {
  op: 'add' | 'remove' | 'replace';
  path: (string | number)[];
  value?: JsonValue | undefined;
}

/**
 * Apply one immer-style patch to a draft. Own-property access only: a hostile
 * path like ["nodes", "__proto__"] must address a real key or fail, never the
 * prototype (the same discipline as the codec's parser).
 *
 * Extracted from `applyPatches` when `applySitePatches` needed the identical
 * walk over a `BuilderSite`. Duplicating it would have meant two answers to
 * "what does this patch address", and the prototype guard is exactly the kind
 * of rule that gets fixed in one copy and not the other. The root is `unknown`
 * because the walker never needs to know the shape — only the caller's
 * `errorCode` differs, so the thrown code still names the document or the site.
 */
export function applyOnePatch(root: unknown, patch: RootPatch, errorCode: BuilderErrorCode): void {
  const parentPath = patch.path.slice(0, -1);
  const last = patch.path[patch.path.length - 1];
  let target: unknown = root;
  for (const step of parentPath) {
    if (Array.isArray(target)) {
      target = typeof step === 'number' ? target[step] : undefined;
    } else if (typeof target === 'object' && target !== null) {
      target = Object.hasOwn(target, step) ? (target as Record<string, unknown>)[step] : undefined;
    } else {
      target = undefined;
    }
    if (target === undefined) {
      throw builderError(
        errorCode,
        `Patch path does not exist: ${patch.path.join('/')}`,
        patch.path,
      );
    }
  }
  if (Array.isArray(target)) {
    if (typeof last !== 'number') {
      throw builderError(errorCode, 'Array patches need a numeric index.', patch.path);
    }
    if (patch.op === 'add') {
      target.splice(last, 0, patch.value);
    } else if (patch.op === 'remove') {
      target.splice(last, 1);
    } else {
      target[last] = patch.value;
    }
    return;
  }
  if (typeof target !== 'object' || target === null) {
    throw builderError(errorCode, 'Patch parent is not a container.', patch.path);
  }
  const record = target as Record<string, unknown>;
  const key = String(last);
  if (patch.op === 'remove') {
    if (!Object.hasOwn(record, key)) {
      throw builderError(errorCode, 'Cannot remove a key that does not exist.', patch.path);
    }
    delete record[key];
    return;
  }
  record[key] = patch.value;
}
