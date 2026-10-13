/*
  A built site's pages, linked from each page's menus (T230b, 2026-10-12). After a site
  build every page holds its own header and footer, whose menus link that page's sections.
  `linkSitePages` points them at the site's pages instead: one `nav.pages` tool step,
  expanded and judged by the door like any plan (the build's own SEO pass applies its
  `nav.sync` the same way), landed as ONE AI transaction on the page under `label`.
*/
import type { BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import { applyAiPlan } from '../../plan/apply-plan';
import { expandAgentTools } from '../../tools/agent/expand';
import { AGENT_TOOL_COMMAND } from '../../tools/agent/types';
import type { AiPlan, AiValidationPorts } from '../../types';

export interface LinkSitePagesOptions {
  /** The page whose menus are linked (a page lens of the site). */
  readonly kernel: BuilderKernel;
  /** The site's pages, in menu order: 2 to 8, each a name and its address ("/about"). */
  readonly pages: readonly { readonly label: string; readonly href: string }[];
  /** This page's own address, marked `aria-current="page"` in its menus. */
  readonly current: string;
  /** The history entry's label, in the person's language. */
  readonly label: string;
  readonly validationPorts: AiValidationPorts;
}

/**
 * Link the site's pages from this page's header menu and footer link list, as one AI
 * transaction. `null` when there is nothing to link from (no header or footer menu) or
 * the tool refuses its input: the page is left as it is. Throws only what the door throws.
 */
export function linkSitePages(options: LinkSitePagesOptions): Transaction | null {
  const { kernel, label } = options;
  const candidate = {
    rationale: label,
    commands: [
      {
        command: AGENT_TOOL_COMMAND,
        args: { name: 'nav.pages', input: { pages: options.pages, current: options.current } },
      },
    ],
  };
  const expanded = expandAgentTools(candidate, kernel, { lanes: ['edit'] });
  if (expanded.issues.length > 0) return null;
  const commands = (expanded.plan as { readonly commands: AiPlan['commands'] }).commands;
  if (commands.length === 0) return null;
  const plan: AiPlan = { rationale: label, commands };
  const applied = applyAiPlan({
    kernel,
    validationPorts: options.validationPorts,
    plan,
    policy: {
      allowedCommands: [...new Set(commands.map(({ command }) => command))],
      maxCommands: commands.length,
    },
    label,
  });
  return applied.transactions[0] ?? null;
}
