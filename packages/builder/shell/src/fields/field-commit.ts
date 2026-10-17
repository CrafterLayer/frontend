export type FieldCommitResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** A synchronous write through the owning top-level property door. */
export type FieldCommit = (next: unknown) => FieldCommitResult;
