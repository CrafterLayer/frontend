import type { z } from 'zod';

import type { BlockSchemaLookup } from './document/validate';
import type { BuilderDocument } from './document/types';
import type { IdPort } from './ports';

/**
 * Deterministic capabilities available inside a command body: id allocation (Law D)
 * and the block-schema lookup that powers structural guards (slot existence,
 * allow lists, capacity, prop parsing).
 */
export interface CommandRuntime {
  ids: IdPort;
  blocks: BlockSchemaLookup;
}

/**
 * Authoring shape — full zod inference at the definition site; no `any` anywhere.
 */
export interface CommandInput<S extends z.ZodType> {
  args: S;
  run: (args: z.output<S>) => (draft: BuilderDocument, rt: CommandRuntime) => void;
}

/**
 * Registered/stored shape — variance-safe under strict TypeScript. `apply` parses
 * through the command's own schema BEFORE invoking the typed handler, so malformed
 * args physically cannot reach handler code (Law V executes inside the door).
 */
export interface RegisteredCommand {
  /** Exposed for documentation and AI context assembly. */
  argsSchema: z.ZodType;
  apply(args: unknown): (draft: BuilderDocument, rt: CommandRuntime) => void;
}
