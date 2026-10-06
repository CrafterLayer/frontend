import type { BuilderKernel } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AgentTool, AgentToolContext, AgentToolStep } from '../tools/agent/types';

/*
  A style tool run straight against a kernel, outside a model plan: parse,
  expand, and dispatch the steps as ONE labelled group (one transaction, one
  Undo) — the commit law of DESIGN §0.1/§A.8. The quick bar's "Edit with AI"
  shortcut, the direct-tool path and the tests use it; a model plan instead
  carries `{"command":"tool"}` steps through expandAgentTools and the door.
*/

export type StyleToolResult =
  | {
      readonly ok: true;
      readonly transaction: Transaction;
      readonly steps: readonly AgentToolStep[];
      readonly label: string;
      readonly note?: string;
    }
  | { readonly ok: false; readonly error: string };

/** A tool context over the live page: no earlier plan steps. */
export function liveToolContext(kernel: BuilderKernel): AgentToolContext {
  const document = kernel.getDocument();
  const lang = document.nodes[document.rootId]?.props['lang'];
  const dir = document.dir === 'rtl' ? 'rtl' : 'ltr';
  return {
    kernel,
    readProp: (id, key) => {
      const nodes = kernel.getDocument().nodes;
      if (!Object.hasOwn(nodes, id)) return undefined;
      const props = nodes[id]?.props;
      return props !== undefined && Object.hasOwn(props, key) ? props[key] : undefined;
    },
    locale: { lang: typeof lang === 'string' && lang.trim() !== '' ? lang.trim().toLowerCase() : dir === 'rtl' ? 'ar' : 'en', dir },
    sampleValues: [],
  };
}

/** Run one tool and land its steps as one labelled transaction. */
export function runStyleTool<I>(
  kernel: BuilderKernel,
  tool: AgentTool<I>,
  input: unknown,
  options: { readonly author?: 'user' | 'ai'; readonly label?: string } = {},
): StyleToolResult {
  const parsed = tool.parse(input);
  if (!parsed.ok) return { ok: false, error: `${tool.name}: ${parsed.error}` };
  const result = tool.run(parsed.value, liveToolContext(kernel));
  if (!result.ok) return { ok: false, error: `${tool.name}: ${result.error}` };
  const label = (options.label ?? result.steps[0]?.title ?? tool.name).slice(0, 160);
  try {
    const transaction = kernel.dispatchGroup(
      result.steps.map(({ command, args }) => ({ command, args })),
      { author: options.author ?? 'ai', label },
    );
    return {
      ok: true,
      transaction,
      steps: result.steps,
      label,
      ...(result.note === undefined ? {} : { note: result.note }),
    };
  } catch (cause) {
    return { ok: false, error: `${tool.name}: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}
