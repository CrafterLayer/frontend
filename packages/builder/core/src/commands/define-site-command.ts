import type { z } from 'zod';

import {
  builderError,
  type RegisteredSiteCommand,
  type SiteCommandInput,
} from '@craftkit/builder-schema';

/**
 * Law V for the site door, identical in shape to `defineCommand` and separate
 * on purpose (see `SiteCommandInput`): authoring keeps full zod inference,
 * registration ERASES to a variance-safe `RegisteredSiteCommand` whose `apply`
 * parses the raw args before the typed handler runs. There is no path that
 * hands unparsed input to a site handler.
 */
export function defineSiteCommand<S extends z.ZodType>(
  def: SiteCommandInput<S>,
): RegisteredSiteCommand {
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
