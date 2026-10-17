/* Shared fixtures for the split-build suites (split from AssistantPanel.test.tsx, 2026-10-13). */
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

import { fixedClock, seededIds } from '@craftkit/builder/testing';
import {
  AiProviderError,
  createBuilder,
  defineBlockSchema,
  type AiPlan,
  type AiPlanProvider,
  type AiBuildOwnEvent,
  type BuilderKernel,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { z } from 'zod';
import { nullRender as Null } from './AssistantPanel.test-helpers';

/**
 * THE SPLIT BUILD.
 *
 * A page-sized request stops being one six-minute model call and becomes a
 * skeleton plus one run per section. These tests own the panel's half of that:
 * when it routes to the orchestrator at all, what the person sees while it
 * runs, what they are asked, and what is left behind when it ends.
 */
/*
  The region's content prop is `tree`, not `body`. Since 2026-09-28 a fill may
  write only its OWN region's `tree` and `css` (the target guard, agent-audit
  P0-2: one writer replaced the page CSS, another overwrote the hero, and both
  were reported applied) — so a fixture writing `body` had every section
  dropped and skipped, which is the guard working, not the panel failing.
*/
export const buildRegion = defineBlockSchema({
  type: 'region',
  description: 'A freely composed page section.',
  props: z.object({
    label: z.string().default('Section'),
    tree: z.string().default(''),
  }),
  examples: [],
});
export const buildRoot = defineBlockSchema({
  type: 'buildPage',
  description: 'The page root a build scaffolds into.',
  props: z.object({}),
  slots: { default: { allow: ['region'] } },
  examples: [],
});
export const buildVocabulary: TrustedExtensionManifest = {
  tier: 1,
  name: 'assistant-panel.build-vocabulary',
  version: '0.0.0',
  contributes: {
    blocks: [
      { schema: buildRoot, render: Null },
      { schema: buildRegion, render: Null },
    ],
  },
};

export const BUILD_REQUEST = 'build me a landing page for my ceramics studio';
export const BUILD_DIRECTION =
  'A calm studio page for ceramicists. Palette bg-white text-slate-900. Faces Inter and Inter.';

export function createBuildKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'buildPage', props: {}, slots: { default: [] } } },
    },
    extensions: [buildVocabulary],
    ports: { clock: fixedClock(0), ids: seededIds('assistant-build') },
  });
}

/** A block prop read back as text; anything else on that key is not a title. */
export function propText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(cause: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export interface BuildScript {
  readonly provider: AiPlanProvider;
  /** How many times the provider was asked for a plan — 1 scaffold + n fills. */
  calls(): number;
  /** The fills held open, by section title. */
  readonly gates: Map<string, Deferred<AiPlan>>;
}

/**
 * A scripted build: one scaffold plan naming every section, then one fill per
 * region, found by the selection the orchestrator scoped that run to. Never a
 * network, and never a guess about which region a fill was handed.
 */
export function scriptBuild(
  kernel: BuilderKernel,
  titles: readonly string[],
  options: { readonly hold?: readonly string[]; readonly refuse?: readonly string[] } = {},
): BuildScript {
  const gates = new Map<string, Deferred<AiPlan>>();
  let calls = 0;
  const provider: AiPlanProvider = {
    propose(_request, context) {
      calls += 1;
      /*
        A SCAFFOLD is the run with nothing selected; a fill is scoped to one
        region. Keyed on the selection rather than on `calls === 1`, because a
        planned page that is then built for real scaffolds twice — and the
        second scaffold used to arrive here as a fill with no region and throw.
      */
      if (context.selection.ids.length === 0) {
        return Promise.resolve<AiPlan>({
          rationale: BUILD_DIRECTION,
          commands: titles.map((title) => ({
            command: 'insertNode',
            args: { type: 'region', parentId: 'root', props: { label: title, tree: '' } },
          })),
        });
      }
      const id = context.selection.ids[0];
      if (id === undefined) {
        throw new Error('A fill run reached the provider with no region selected.');
      }
      const title = propText(kernel.getDocument().nodes[id]?.props['label']);
      if (options.refuse?.includes(title) === true) {
        return Promise.reject(
          new AiProviderError(`The model would not write "${title}".`, {
            code: 'refusal',
            retryable: false,
          }),
        );
      }
      const plan: AiPlan = {
        rationale: `Fill ${title}.`,
        commands: [{ command: 'setProp', args: { id, key: 'tree', value: `Body for ${title}.` } }],
      };
      if (options.hold?.includes(title) === true) {
        const gate = gates.get(title) ?? deferred<AiPlan>();
        gates.set(title, gate);
        return gate.promise;
      }
      return Promise.resolve(plan);
    },
  };
  return { provider, calls: () => calls, gates };
}

/** Every region on the page, in reading order, as `[label, tree]` — duplicates kept. */
export function regionList(kernel: BuilderKernel): (readonly [string, string])[] {
  const document = kernel.getDocument();
  return (document.nodes[document.rootId]?.slots?.['default'] ?? []).map((id) => {
    const node = document.nodes[id];
    return [propText(node?.props['label']), propText(node?.props['tree'])] as const;
  });
}

/** Every region on the page, in reading order, as `label → tree`. */
export function regionsOf(kernel: BuilderKernel): Record<string, string> {
  return Object.fromEntries(regionList(kernel));
}

/** The id of the (first) region with this label — a hand edit needs one. */
export function regionId(kernel: BuilderKernel, label: string): string {
  const document = kernel.getDocument();
  const id = Object.keys(document.nodes).find(
    (key) => document.nodes[key]?.props['label'] === label,
  );
  if (id === undefined) throw new Error(`No region is labelled "${label}".`);
  return id;
}

export function historyLabels(kernel: BuilderKernel): string[] {
  return kernel.transactions().map(({ command }) => command);
}

export async function send(
  user: ReturnType<typeof userEvent.setup>,
  request: string,
): Promise<void> {
  const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask the assistant' });
  await user.clear(composer);
  await user.type(composer, request);
  await user.click(screen.getByRole('button', { name: 'Send' }));
}

export function buildEventTypes(events: readonly AiBuildOwnEvent[]): string[] {
  return events.map(({ type }) => type);
}

export const TEN = [
  'Hero',
  'Proof',
  'Benefits',
  'How It Works',
  'Gallery',
  'Testimonials',
  'Pricing',
  'FAQ',
  'Final Call',
  'Footer',
] as const;

export const THREE = ['Hero', 'Proof', 'Pricing'] as const;
