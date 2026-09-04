import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCss,
  defineBlockSchema,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { AiPlan, AiPlanProvider, AiPlanValidationIssue } from '../types';
import { generateAiPlan } from './generate-plan';
import { validateAiPlan } from './validate-plan';

/**
 * The stylesheet door.
 *
 * A refused construct does not fail loudly anywhere downstream: the kernel
 * accepts the string (zod only checks its length), the transaction commits,
 * and the RENDERER then drops the whole sheet — every rule in it, not just the
 * offending line — with no message on the canvas and none in the published
 * page. These tests pin that the plan is refused HERE, while the reason is
 * still reportable and the model still has its one repair attempt.
 */

const cssHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'custom-css-host',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'A page root carrying the site stylesheet.',
          props: z.object({ title: z.string().default(''), pageCss: customCss(20_000) }),
          slots: { default: { allow: ['region', 'plain'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'region',
          description: 'A custom-code region with its own scoped stylesheet.',
          props: z.object({ label: z.string().default('region'), css: customCss(8_000) }),
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'A block whose string prop is a caption, not a stylesheet.',
          // Named `css` on purpose: the door must match the DECLARATION, so
          // this one is not policed even though its name says stylesheet.
          props: z.object({ css: z.string().default('') }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function cssDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Home', pageCss: '' },
        slots: { default: ['hero', 'caption'] },
      },
      hero: { id: 'hero', type: 'region', props: { label: 'hero', css: '' } },
      caption: { id: 'caption', type: 'plain', props: { css: 'not a stylesheet' } },
    },
  };
}

function cssKernel() {
  return createBuilder({
    document: cssDocument(),
    extensions: [cssHost],
    ports: { clock: fixedClock(10), ids: seededIds('custom-css-live') },
  });
}

const ports = (seed = 'custom-css') => ({ clock: fixedClock(20), ids: seededIds(seed) });

function setPageCss(css: string) {
  return {
    rationale: 'style the page',
    commands: [{ command: 'setProp', args: { id: 'root', key: 'pageCss', value: css } }],
  };
}

function insertStyledRegion(css: string) {
  return {
    rationale: 'add a styled region',
    commands: [
      {
        command: 'insertNode',
        args: { type: 'region', parentId: 'root', props: { label: 'promo', css } },
      },
    ],
  };
}

function patchRegionCss(css: string) {
  return {
    rationale: 'patch the region stylesheet',
    commands: [
      {
        command: 'applyPatches',
        args: {
          patches: [{ op: 'replace', path: ['nodes', 'hero', 'props', 'css'], value: css }],
        },
      },
    ],
  };
}

const CLEAN_SHEET =
  '.hero { color: #1e3a8a; background-image: url("https://img.test/a.jpg") } @keyframes rise { to { opacity: 1 } }';

describe('AI plan stylesheet refusal', () => {
  it('lets a clean stylesheet through — hex, https images, and keyframes are design, not threats', () => {
    const result = validateAiPlan(setPageCss(CLEAN_SHEET), cssKernel(), ports());

    expect(result.ok).toBe(true);
  });

  it.each([
    ['@import', '@import url("https://evil.test/x.css"); .a { color: red }'],
    ['insecure (http or //) url()', '.a { background: url(http://evil.test/p.png) }'],
    ['expression()', '.a { width: expression(alert(1)) }'],
    ['behavior', '.a { behavior: url(#default#time2) }'],
    ['-moz-binding', '.a { -moz-binding: url("x.xml#e") }'],
    ['javascript:', '.a { background: url(javascript:alert(1)) }'],
    ['</style>', '.a { color: red } </style><script>alert(1)</script>'],
  ])('refuses a page stylesheet carrying %s, naming the sheet and the construct', (reason, css) => {
    const result = validateAiPlan(setPageCss(css), cssKernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues[0];
    expect(issue?.code).toBe('policy-rejected');
    expect(issue?.step).toBe(0);
    expect(issue?.message).toContain('pageCss');
    expect(issue?.message).toContain(reason);
    // The consequence, not just the verdict: a person reading this must know
    // the whole sheet dies, not the one rule.
    expect(issue?.message).toMatch(/whole|every rule/iu);
  });

  it('refuses before the dry run, where the kernel would have accepted the string happily', () => {
    const result = validateAiPlan(
      setPageCss('@import url("https://evil.test/x.css");'),
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.every((issue) => issue.code !== 'door-rejected')).toBe(true);
  });

  it('catches a region stylesheet arriving as insertNode props, not only a setProp value', () => {
    const result = validateAiPlan(
      insertStyledRegion('.promo { -moz-binding: url("x.xml#e") }'),
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('"css"');
    expect(result.issues[0]?.message).toContain('-moz-binding');
  });

  it('catches a stylesheet buried in a JSON patch path', () => {
    const result = validateAiPlan(
      patchRegionCss('.hero { background: url(//evil.test/p.png) }'),
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('"css"');
    expect(result.issues[0]?.message).toContain('insecure');
  });

  it('names the node the sheet belongs to, so the person knows which one went dark', () => {
    const result = validateAiPlan(
      {
        rationale: 'style the hero region',
        commands: [
          {
            command: 'setProp',
            args: { id: 'hero', key: 'css', value: '.a { color: expression(1) }' },
          },
        ],
      },
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('hero');
  });

  it.each([
    ['Google Fonts', 'https://fonts.googleapis.com/css2?family=Inter&display=swap'],
    ['Bunny Fonts', 'https://fonts.bunny.net/css?family=inter'],
  ])('still allows a font @import from %s', (_label, href) => {
    const result = validateAiPlan(
      setPageCss(`@import url("${href}"); .hero { font-family: Inter, sans-serif }`),
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(true);
  });

  it('leaves a plain string prop alone even when it is called css', () => {
    const result = validateAiPlan(
      {
        rationale: 'write a caption',
        commands: [
          {
            command: 'setProp',
            args: { id: 'caption', key: 'css', value: 'Ask us about @import pricing' },
          },
        ],
      },
      cssKernel(),
      ports(),
    );

    expect(result.ok).toBe(true);
  });

  it('is not a vocabulary preference: it stands even when utility enforcement is off', () => {
    const result = validateAiPlan(
      setPageCss('@import url("https://evil.test/x.css");'),
      cssKernel(),
      ports(),
      undefined,
      { enforceUtilityVocabulary: false },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain('@import');
  });

  it('reaches the model as a repairable issue rather than a dead stylesheet', async () => {
    const refused: AiPlan = {
      rationale: 'style the page',
      commands: [
        {
          command: 'setProp',
          args: { id: 'root', key: 'pageCss', value: '@import url("https://evil.test/x.css");' },
        },
      ],
    };
    const repaired: AiPlan = {
      rationale: 'style the page',
      commands: [{ command: 'setProp', args: { id: 'root', key: 'pageCss', value: CLEAN_SHEET } }],
    };
    let seen: readonly AiPlanValidationIssue[] = [];
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(refused),
      repair: (_request, _context, _plan, issues) => {
        seen = issues;
        return Promise.resolve(repaired);
      },
    };

    const plan = await generateAiPlan({
      kernel: cssKernel(),
      provider,
      request: 'give the page a typeface and a background',
      validationPorts: ports('repair'),
    });

    expect(plan).toEqual(repaired);
    expect(seen[0]?.code).toBe('policy-rejected');
    expect(seen[0]?.message).toContain('@import');
    expect(seen[0]?.message).toContain('fonts.googleapis.com');
  });
});
