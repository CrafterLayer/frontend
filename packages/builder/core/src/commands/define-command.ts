import type { z } from 'zod';

import { builderError, type CommandInput, type RegisteredCommand } from '@craftkit/builder-schema';

/**
 * Law V made structural: authoring keeps full zod inference; registration ERASES
 * to a uniform, variance-safe `RegisteredCommand` whose `apply` parses the raw
 * args before the typed handler ever runs. There is no path that hands unparsed
 * input to a handler.
 */
export function defineCommand<S extends z.ZodType>(def: CommandInput<S>): RegisteredCommand {
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
