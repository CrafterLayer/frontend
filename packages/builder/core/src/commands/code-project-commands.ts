import { z } from 'zod';

import {
  builderError,
  codeAttributionSchema,
  codeFileHash,
  codeFileSchema,
  codeProjectSchema,
  managedDependencyLockSchema,
  modulePathSchema,
  type CodeProject,
  type RegisteredSiteCommand,
} from '@craftkit/builder-schema';

import { defineSiteCommand } from './define-site-command';

export const codeFileChangeSchema = z
  .strictObject({
    path: modulePathSchema,
    /** null means this path must not exist, including on a rebased revision. */
    expectedHash: z.string().nullable(),
    /** null deletes a file; stored invalid source is otherwise allowed. */
    file: codeFileSchema.nullable(),
  })
  .refine(
    (change) => change.file !== null || change.expectedHash !== null,
    'Deleting a file requires an existing content hash.',
  );
export type CodeFileChange = z.infer<typeof codeFileChangeSchema>;

export const applyCodeChangesArgsSchema = z
  .strictObject({
    projectId: z.string().min(1),
    expectedProjectRevision: z.string().min(1),
    changes: z.array(codeFileChangeSchema),
    dependencyLock: managedDependencyLockSchema.optional(),
    attribution: codeAttributionSchema,
  })
  .refine(
    (args) => args.changes.length > 0 || args.dependencyLock !== undefined,
    'A code transaction needs source or dependency changes.',
  )
  .refine(
    (args) => new Set(args.changes.map((change) => change.path)).size === args.changes.length,
    'Each file may be changed only once per transaction.',
  );
export type ApplyCodeChangesArgs = z.infer<typeof applyCodeChangesArgsSchema>;

export interface CodeProjectCommands {
  createCodeProject: { projectId: string; project: CodeProject };
  applyCodeChanges: ApplyCodeChangesArgs;
}

export const codeProjectCommands: Record<keyof CodeProjectCommands, RegisteredSiteCommand> = {
  createCodeProject: defineSiteCommand({
    args: z.strictObject({
      projectId: z
        .string()
        .min(1)
        .refine((id) => !['__proto__', 'prototype', 'constructor'].includes(id)),
      project: codeProjectSchema,
    }),
    run: (args) => (draft) => {
      if (Object.hasOwn(draft.codeProjects ?? {}, args.projectId)) {
        throw builderError('site/structural-violation', 'That code project already exists.');
      }
      draft.codeProjects = { ...draft.codeProjects, [args.projectId]: args.project };
    },
  }),
  applyCodeChanges: defineSiteCommand({
    args: applyCodeChangesArgsSchema,
    run: (args) => (draft, rt) => {
      const project = draft.codeProjects?.[args.projectId];
      if (!project || !Object.hasOwn(draft.codeProjects ?? {}, args.projectId)) {
        throw builderError('site/structural-violation', 'The code project does not exist.');
      }
      if (project.revision !== args.expectedProjectRevision) {
        throw builderError(
          'code/revision-conflict',
          'The code project changed; refresh or validate a disjoint rebase.',
        );
      }
      const candidate = projectAfterChanges(project, args);
      if (sameProjectContent(candidate, project)) return;
      draft.codeProjects = {
        ...draft.codeProjects,
        [args.projectId]: { ...candidate, revision: rt.ids.newId() },
      };
    },
  }),
};

/** Pure preflight shared by the synchronous command and the host's merge preparation. */
export function projectAfterChanges(project: CodeProject, args: ApplyCodeChangesArgs): CodeProject {
  for (const change of args.changes) {
    const present = Object.hasOwn(project.files, change.path);
    const file = project.files[change.path];
    if (
      change.expectedHash === null
        ? present
        : !present || file === undefined || codeFileHash(file) !== change.expectedHash
    ) {
      throw builderError('code/file-conflict', `Source changed at "${change.path}".`, [
        'changes',
        change.path,
      ]);
    }
  }
  const files = { ...project.files };
  for (const change of args.changes) {
    if (change.file === null) delete files[change.path];
    else files[change.path] = change.file;
  }
  return { ...project, files, dependencyLock: args.dependencyLock ?? project.dependencyLock };
}

/**
 * Compilation stays outside the synchronous kernel. The returned request is pinned
 * to the snapshot that was compiled; a write during the await fails the command CAS.
 * A stale dependency change is refused because file hashes cannot prove lock disjointness.
 */
export async function prepareCodeChangesRebase(
  current: CodeProject,
  input: ApplyCodeChangesArgs,
  compileMergedGraph: (project: Readonly<CodeProject>) => Promise<{ ok: boolean }>,
): Promise<ApplyCodeChangesArgs> {
  const args = applyCodeChangesArgsSchema.parse(input);
  const base = codeProjectSchema.parse(current);
  if (base.revision === args.expectedProjectRevision) return args;
  if (args.dependencyLock !== undefined) {
    throw builderError(
      'code/revision-conflict',
      'A stale dependency change cannot be rebased by file hashes.',
    );
  }
  const candidate = projectAfterChanges(base, args);
  const result = await compileMergedGraph(candidate);
  if (!result.ok) {
    throw builderError(
      'code/merge-invalid',
      'The merged module graph did not compile; no changes were applied.',
    );
  }
  return { ...args, expectedProjectRevision: base.revision };
}

function sameProjectContent(left: CodeProject, right: CodeProject): boolean {
  return (
    JSON.stringify(left.files) === JSON.stringify(right.files) &&
    JSON.stringify(left.dependencyLock) === JSON.stringify(right.dependencyLock)
  );
}
