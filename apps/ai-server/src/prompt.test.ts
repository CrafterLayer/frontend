import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder-ai';

import { buildPrompt } from './prompt';

function wireRequest(overrides: Partial<AiPlanWireRequest> = {}): AiPlanWireRequest {
  return {
    version: 1,
    request: 'a CV page',
    context: {
      fragments: [],
      totalTokens: 0,
      blocks: [{ type: 'hero', description: 'A hero.' }],
      templates: [],
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: [{ id: 'root', type: 'page', props: {}, slots: { default: [] } }],
      },
      selection: { ids: [] },
      commands: [{ name: 'insertNode', argsSchema: { type: 'object' } }],
      outputContract: { version: 1, schema: { type: 'object' } },
    },
    ...overrides,
  };
}

/** A catalog long enough to pass the 1024-token cache floor. */
function bigCatalog(): AiPlanWireRequest {
  return wireRequest({
    context: {
      ...wireRequest().context,
      blocks: Array.from({ length: 200 }, (_unused, at) => ({
        type: `block-${String(at)}`,
        description: 'A registered block with a description long enough to matter for sizing.',
      })),
    },
  });
}

describe('prompt layout', () => {
  it('puts the rules first and the catalog second, so the prefix is stable', () => {
    const { system } = buildPrompt(bigCatalog());

    expect(system).toHaveLength(2);
    expect(system[0]?.text).toContain('You turn a request about a web page into a PLAN');
    expect(system[1]?.text).toContain('# Block catalog');
  });

  it('marks the catalog as the cache breakpoint, not the rules', () => {
    // The breakpoint goes AFTER the last stable content: caching the rules
    // alone would leave the expensive half re-billed every turn.
    const { system } = buildPrompt(bigCatalog());

    expect(system[0]?.cache_control).toBeUndefined();
    expect(system[1]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('marks the breakpoint even for an empty catalog — the vocabulary alone clears the floor', () => {
    /*
      Below ~1024 tokens the API silently refuses to cache, and the code
      declines to write a `cache_control` it knows would be ignored. That
      guard used to fire for a small catalog. It no longer can: the utility
      vocabulary (~750 tokens) now lives in the stable segment beside the
      rules (~1,200), so the segment clears the floor before a single block
      is added — which is exactly right, because that text is identical on
      every request and is the part worth caching under `none` mode, where
      the catalog is one block.
    */
    const { system } = buildPrompt(wireRequest());

    expect(system[1]?.cache_control).toEqual({ type: 'ephemeral' });
    expect((system[0]?.text.length ?? 0) + (system[1]?.text.length ?? 0)).toBeGreaterThan(
      1024 * 4,
    );
  });

  it('keeps the document out of the cached prefix — it changes every turn', () => {
    const { system, messages } = buildPrompt(bigCatalog());

    expect(system.map((part) => part.text).join('')).not.toContain('# The page right now');
    expect(messages.at(-1)?.content).toContain('# The page right now');
  });

  it('holds the rules byte-identical across requests', () => {
    // Any interpolation here — a count, a timestamp — would invalidate the
    // catalog behind it on every single request.
    const first = buildPrompt(wireRequest()).system[0]?.text;
    const second = buildPrompt(bigCatalog()).system[0]?.text;

    expect(first).toBe(second);
  });

  it('holds the catalog segment identical for an unchanged registry', () => {
    // The client canonicalises key order, so this is genuinely stable rather
    // than accidentally so — which is what makes the prefix match hold.
    const a = buildPrompt(bigCatalog()).system[1]?.text;
    const b = buildPrompt(bigCatalog()).system[1]?.text;

    expect(a).toBe(b);
  });
});

describe('prompt content', () => {
  it('carries history before the page state so a follow-up resolves', () => {
    const { messages } = buildPrompt(
      wireRequest({
        history: [
          { role: 'user', text: 'add a hero' },
          { role: 'assistant', text: 'added' },
        ],
      }),
    );

    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[0]?.content).toBe('add a hero');
  });

  it('sends a rejected plan WITH its issues, so a repair is a correction', () => {
    const { messages } = buildPrompt(
      wireRequest({
        attempt: {
          plan: { rationale: 'x', commands: [{ command: 'insertNode', args: {} }] },
          issues: [{ code: 'invalid-args', message: 'parentId is required', step: 0 }],
        },
      }),
    );

    const last = messages.at(-1)?.content ?? '';
    expect(last).toContain('REJECTED');
    expect(last).toContain('parentId is required');
  });

  it('teaches the escape hatch and the two conventions that make it usable', () => {
    const { system } = buildPrompt(wireRequest());
    const rules = system[0]?.text ?? '';

    expect(rules).toContain('customCode');
    expect(rules).toContain('ck-');
    expect(rules).toContain('var(--t-accent)');
  });

  it('states the colour and spacing laws the validator will enforce', () => {
    // A model told the rule produces fewer rejected plans than one corrected
    // by a repair round after the fact.
    const rules = buildPrompt(wireRequest()).system[0]?.text ?? '';

    expect(rules).toContain('bg-accent');
    expect(rules).toContain('p-[17px]');
  });

  it('ships the real utility vocabulary in the cached segment', () => {
    // A model writing whole pages needs the list, not a description of it.
    const catalog = buildPrompt(wireRequest()).system[1]?.text ?? '';

    expect(catalog).toContain('# Utility classes you may use');
    expect(catalog).toContain('{sm:,md:,lg:,}grid-cols-{1..12}');
  });

  it('forbids inventing a component type — references are only to the catalog given', () => {
    const rules = buildPrompt(wireRequest()).system[0]?.text ?? '';

    expect(rules).toContain('only for a type present in the catalog');
    expect(rules).toContain('Never invent a component type');
  });

  it('teaches the icon node and where its names come from', () => {
    const rules = buildPrompt(wireRequest()).system[0]?.text ?? '';

    expect(rules).toContain('"kind":"icon"');
    expect(rules).toContain('lucide.dev/icons');
    expect(rules).toContain('refused by name');
  });

  it('tells the model that an empty catalog means build, not refuse', () => {
    const rules = buildPrompt(wireRequest()).system[0]?.text ?? '';

    expect(rules).toContain('holds nothing but `customCode`');
  });

  it('explains what a detail-free catalog entry means, since index mode sends many', () => {
    const rules = buildPrompt(wireRequest()).system[0]?.text ?? '';

    expect(rules).toContain('do not invent its props');
  });
});
