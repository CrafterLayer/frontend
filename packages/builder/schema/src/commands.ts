import type { z } from 'zod';

import type { BlockSchemaLookup } from './document/validate';
import type { BuilderDocument } from './document/types';
import type { BuilderSite } from './site/types';
import type { IdPort } from './ports';
import type { CompositionDef } from './widgets/contract';

/**
 * Deterministic capabilities available inside a command body: id allocation (Law D)
 * and the block-schema lookup that powers structural guards (slot existence,
 * allow lists, capacity, prop parsing).
 */
export interface CommandRuntime {
  ids: IdPort;
  blocks: BlockSchemaLookup;
  /** Live lookup so commands can detach-clone declarative templates safely. */
  compositions: (id: string) => CompositionDef | undefined;
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

/**
 * The SITE half of the same contract. A site command's draft is the whole
 * `BuilderSite` — pages, shared regions, design system, assets — because that
 * is the only draft over which a page addition and a design-token change can be
 * ONE immer production, and therefore one transaction and one undo.
 *
 * Deliberately a separate pair rather than a generic `CommandInput<S, Draft>`:
 * the two drafts are not interchangeable, and a shared generic would let a
 * document command be registered in the site map (and vice versa) with the
 * mistake surfacing only at runtime, inside a producer, as a read of a field
 * that does not exist.
 */
export interface SiteCommandInput<S extends z.ZodType> {
  args: S;
  run: (args: z.output<S>) => (draft: BuilderSite, rt: CommandRuntime) => void;
}

/** Registered/stored shape for a site command; `apply` parses before running. */
export interface RegisteredSiteCommand {
  /** Exposed for documentation and AI context assembly. */
  argsSchema: z.ZodType;
  apply(args: unknown): (draft: BuilderSite, rt: CommandRuntime) => void;
}
