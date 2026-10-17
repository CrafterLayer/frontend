import type { z } from 'zod';

import { builderError, type CommandInput, type RegisteredCommand } from '@craftkit/builder-schema';

/**
 * The kernel's `defineCommand` (core/src/commands/define-command.ts), mirrored
 * here line for line so this extension keeps its single runtime dependency on
 * the schema layer: authoring keeps full zod inference, registration erases to
 * the variance-safe `RegisteredCommand`, and `apply` parses the raw args BEFORE
 * the typed handler runs (Law V). There is no path that hands unparsed input
 * to a handler.
 *
 * Kept identical in behaviour on purpose — same error code, same message
 * shape — so a refusal from a tree command reads exactly like one from a core
 * command. If the kernel's version changes, change this one with it.
 */
export function definePageCommand<S extends z.ZodType>(def: CommandInput<S>): RegisteredCommand {
  return {
    argsSchema: def.args,
    apply(raw: unknown) {
      const parsed = def.args.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw builderError(
          'cmd/invalid-args',
          issue === undefined
            ? 'Command arguments failed validation.'
            : `Invalid command arguments: ${issue.message}`,
          issue === undefined ? undefined : (issue.path as (string | number)[]),
        );
      }
      return def.run(parsed.data);
    },
  };
}
