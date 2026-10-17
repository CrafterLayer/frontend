import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue, PagePlanCandidate } from '../types';
import { validatePagePlan } from './page-plan/validate-page-plan';
import { runAiBuild } from './run-build';

/*
  The code repairs in a real build (2026-10-13, ready scripts): every writer
  of a five-section page slips the way writers do — an h1 in a band, the
  anchor on an inner wrapper, the action's words on a link to the menu, a
  button where the action's link belongs, a raw shadow in the css, accent
  text that does not read — and the build sends NOTHING back: each slip is
  repaired in code before the check, and each section lands once. A slip only
  the writer can fix (filler copy) still costs its one repair round.
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'tidy-build-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({
              title: z.string().max(120).default(''),
              description: z.string().max(200).default(''),
              lang: z.string().max(12).default(''),
              pageCss: customCss(20_000),
            }),
            slots: { default: { allow: ['customCode'] } },
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'customCode',
            description: 'A freely composed region.',
            props: z.object({
              label: z.string().max(80).default('Custom section'),
              tree: customCodeTree().default(emptyCustomCodeTree()),
              css: customCss(8_000),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: { now: () => 1 }, ids: seededIds('tidy-build') },
  });
}

/** The builder page: its accent (yellow-400) is a fill, not a text colour. */
const PLAN: PagePlanCandidate = {
  intent: 'replace',
  locale: { lang: 'en' },
  title: 'Hadid Build | Amman',
  description: 'Residential construction in Amman since 2004.',
  tokens: {
    bg: 'white',
    surface: 'zinc-100',
    ink: 'zinc-900',
    muted: 'zinc-600',
    accent: 'yellow-400',
    onAccent: 'zinc-900',
    border: 'zinc-300',
    fontDisplay: { family: 'Archivo Black' },
    fontBody: { family: 'Archivo', weights: [400, 600] },
    radius: 'none',
    signature: 'a yellow rule under every heading',
  },
  primaryCta: { label: 'Get a quote', href: '#quote' },
  sections: [
    { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand.' },
    { key: 'hero', role: 'hero', title: 'Built to outlast', anchorId: 'hero', purpose: 'Pitch.' },
    { key: 'projects', role: 'band', title: 'Projects', anchorId: 'projects', purpose: 'Proof.' },
    { key: 'process', role: 'band', title: 'How we build', anchorId: 'process', purpose: 'Steps.' },
    { key: 'team', role: 'band', title: 'The team', anchorId: 'team', purpose: 'People.' },
    { key: 'quote', role: 'cta', title: 'Get a quote', anchorId: 'quote', purpose: 'Convert.' },
    { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Hours.' },
  ],
};

type Node = Record<string, JsonValue>;

function h(
  tag: string,
  className: string,
  content: string | Node[],
  attributes?: Record<string, string>,
): Node {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(typeof content === 'string' ? { text: content } : { children: content }),
    ...(attributes === undefined ? {} : { attributes }),
  };
}

const COPY = 'Licensed builders, family-run since 2004.';

/** What each section's writer slips on, by its title; `fixed` is what a repair would write. */
function written(
  title: string,
  fixed: boolean,
): { readonly tree: JsonValue; readonly css?: string } {
  const root = (child: Node): JsonValue => ({ kind: 'root', children: [child] });
  switch (title) {
    case 'Built to outlast':
      // The action's words on a link to the menu, and accent-coloured text.
      return {
        tree: root(
          h(
            'section',
            'ck-ground py-24',
            [
              h('h1', 'text-6xl', title),
              h('p', fixed ? 'ck-accent-ink' : 'text-yellow-400', COPY),
              h('a', 'ck-btn', 'Get a quote', { href: '#quote' }),
              h('a', 'ck-btn ck-btn--ghost', 'Get a quote', {
                href: fixed ? '#quote' : '#projects',
              }),
            ],
            { id: 'hero' },
          ),
        ),
      };
    case 'Projects':
      // An h1 where the page's one h1 is the hero's.
      return {
        tree: root(
          h('section', 'ck-surface py-24', [h(fixed ? 'h2' : 'h1', '', title), h('p', '', COPY)], {
            id: 'projects',
          }),
        ),
      };
    case 'How we build':
      // The anchor on the inner wrapper, and a raw shadow and hairline in the css.
      return {
        tree: root(
          h('section', 'py-24', [
            h('div', 'ck-step mx-auto max-w-6xl', [h('h2', '', title), h('p', '', COPY)], {
              id: 'process',
            }),
          ]),
        ),
        css: fixed
          ? '.ck-step{box-shadow:0 8px 24px rgb(0 0 0 / 0.08);border:1px solid var(--ck-border)}'
          : '.ck-step{box-shadow:0 8px 24px rgba(15,23,42,.08);border:1px solid #e4e4e7}',
      };
    case 'The team':
      // Filler copy: only its writer can finish it.
      return {
        tree: root(
          h(
            'section',
            'py-24',
            [h('h2', '', title), h('p', '', fixed ? COPY : 'Lorem ipsum dolor sit amet.')],
            { id: 'team' },
          ),
        ),
      };
    default:
      // A button where the action's link belongs.
      return {
        tree: root(
          h(
            'section',
            'ck-accent-fill py-16',
            [h('h2', '', title), h('button', 'ck-btn', 'Get a quote', { type: 'button' })],
            { id: 'quote' },
          ),
        ),
      };
  }
}

function scripted() {
  const repairs: (readonly AiPlanValidationIssue[])[] = [];
  const answer = (request: string, fixed: boolean): AiPlan => {
    const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
    const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? '';
    const { tree, css } = written(title, fixed);
    return {
      rationale: 'filled',
      commands: [
        { command: 'setProp', args: { id, key: 'tree', value: tree } },
        ...(css === undefined
          ? []
          : [{ command: 'setProp', args: { id, key: 'css', value: css } }]),
      ],
    };
  };
  const provider: AiPlanProvider = {
    propose: (request) => Promise.resolve(answer(request, false)),
    repair(request, _context, _plan, issues) {
      repairs.push(issues);
      return Promise.resolve(answer(request, true));
    },
    proposePagePlan: () => {
      const checked = validatePagePlan(PLAN);
      if (!checked.ok) throw new Error(checked.issues.map(({ message }) => message).join('\n'));
      return Promise.resolve({ pagePlan: PLAN, rationale: 'A builder.' });
    },
  };
  return { provider, repairs };
}

vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — what code can fix never costs a repair round', () => {
  it('lands four slipped sections once each, with no repair, and repairs only the filler copy', async () => {
    const script = scripted();
    const live = kernel();
    const result = await runAiBuild({
      runId: 'tidy-build',
      clock: { now: () => 1 },
      kernel: live,
      provider: script.provider,
      request: 'Build a page for Hadid Build, a construction firm in Amman',
      validationPorts: { clock: { now: () => 1 }, ids: seededIds('tidy-build-door') },
      skillRegistry: createCraftkitAiSkillRegistry(),
    });

    expect(result.outcome).toBe('completed');
    // Five writers slipped; one slip was the writer's to fix.
    expect(script.repairs).toHaveLength(1);
    expect(script.repairs[0]?.map(({ message }) => message.split(':')[0])).toEqual([
      'placeholder-left',
    ]);
    const checks = new Map(result.tasks.map(({ sectionKey, check }) => [sectionKey, check]));
    for (const key of ['hero', 'projects', 'process', 'quote']) {
      expect(checks.get(key)).toEqual({ issues: [], repaired: false });
    }
    expect(checks.get('team')).toEqual({ issues: [], repaired: true });

    const props = (key: string) => {
      const id = result.tasks.find(({ sectionKey }) => sectionKey === key)?.id ?? '';
      return live.getDocument().nodes[id]?.props ?? {};
    };
    expect(JSON.stringify(props('hero')['tree'])).not.toContain('#projects');
    expect(JSON.stringify(props('hero')['tree'])).toContain('ck-accent-ink');
    expect(JSON.stringify(props('projects')['tree'])).toContain('"tag":"h2"');
    expect(props('process')['css']).toBe(
      '.ck-step{box-shadow:0 8px 24px rgb(0 0 0 / 0.08);border:1px solid var(--ck-border)}',
    );
    const quote = JSON.stringify(props('quote')['tree']);
    expect(quote).toContain(
      '{"attributes":{"href":"#quote"},"className":"ck-btn","kind":"element","tag":"a"',
    );
    expect(quote).not.toContain('"tag":"button"');
  });
});
