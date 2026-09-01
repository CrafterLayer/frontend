import type { AiPlanWireRequest } from '@craftkit/builder-ai';
import { UTILITY_VOCABULARY } from '@craftkit/builder-schema';

/**
 * Turning an assembled context into a Claude request.
 *
 * ## The ordering is the whole design
 *
 * Prompt caching is a PREFIX match: the API caches a leading run of content and
 * reuses it only while every byte before the breakpoint is unchanged. Claude
 * renders `tools` → `system` → `messages`, so the layout below is not stylistic:
 *
 *   system[0]  the rules            — frozen; changes when this file is edited
 *   system[1]  the catalog          — changes when the registry changes  ◄ cache
 *   messages   document, request    — changes every single turn
 *
 * Put the document in `system` and every request would miss, because one typed
 * character invalidates everything after it. Put the catalog in `messages` and
 * the 58,000-token part that never changes would be re-billed every turn.
 *
 * With the split below, an ordinary session pays full price for the catalog
 * once and ~10% of it thereafter. `canonicalJsonStringify` in the client is
 * what makes this hold at all: an unchanged registry serializes to identical
 * bytes, so the prefix is genuinely stable rather than accidentally so.
 */

/** The 1024-token floor below which a prefix silently will not cache. */
const MIN_CACHEABLE_TOKENS = 1024;
const CHARACTERS_PER_TOKEN = 4;

export interface PromptParts {
  readonly system: readonly {
    readonly type: 'text';
    readonly text: string;
    readonly cache_control?: { readonly type: 'ephemeral' };
  }[];
  readonly messages: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[];
}

/**
 * The operating rules.
 *
 * Frozen text, deliberately: it is the first cache segment, so an interpolated
 * value here — a timestamp, a request id, a block count — would invalidate the
 * catalog behind it on every single request. Anything that varies belongs in a
 * message.
 */
const SYSTEM_RULES = `You turn a request about a web page into a PLAN of kernel commands.

You never edit the document. You propose commands; a validator replays them against a scratch copy of the real document and rejects anything invalid. A rejected plan helps nobody, so prefer a smaller plan you are sure of over a larger one you are guessing at.

## What you are given

- A block catalog. Each entry has a \`type\` and a \`description\`. An entry may also carry \`propsSchema\`, \`examples\`, and \`slots\` — when it does not, that block's details were left out of this request to save space: you may still reference it by \`type\`, but do not invent its props.
- The current document: every node, with its props, so you can find "the third heading" or "the word Pricing" without being told an id.
- The commands you may use, with their argument schemas. Use no others.
- The exact output shape, enforced. Fill \`rationale\` with one sentence in the requester's own language.

## Rules

1. Address the request, all of it, and nothing beyond it. A request to change a colour does not license restructuring the page.
2. Reference nodes by the ids in the document. Never invent an id. To place something new, name an existing \`parentId\` and a slot that block's schema actually declares.
3. Props must satisfy the block's \`propsSchema\`. Prefer values you can see in that block's \`examples\`.
4. Colours are FREE. Use Tailwind's palette (\`bg-slate-900\`, \`text-blue-500\`, \`from-indigo-500\`) or exact values in a region's \`css\` (\`#1e3a8a\`, \`rgb()\`, gradients). Prefer the site's roles — \`bg-accent\`, \`text-text-muted\`, \`var(--t-accent)\` — when a page should follow the site theme; they are a preference, not a rule.
5. Spacing and size are scale steps — \`p-8\`, \`gap-4\`. Bracketed arbitrary classes (\`p-[17px]\`, \`bg-[#1e3a8a]\`) have NO generated CSS and are refused; put an exact value in \`css\` under a \`ck-\` class instead.
6. Images: \`{"kind":"element","tag":"img","attributes":{"src":"https://…","alt":"…"}}\` or \`background-image: url(https://…)\` in \`css\`. https only.
7. Write \`title\` on each step: one short human sentence, in the requester's language, saying what that step does.
8. If the request is too large for one safe plan, do the most valuable part and put the next request in \`followUp\`, worded in the requester's language.

## Building the page

You compose. The \`customCode\` block is always in your catalog and it is your primary tool: a tree of two node kinds — \`{"kind":"element"}\` for markup you write (any tag in its schema enum, styled with \`className\`), and \`{"kind":"component","component":"<type>"}\` to place a registered block inside your composition by its \`type\`.

**A \`component\` reference is valid only for a type present in the catalog you were given.** When the catalog holds nothing but \`customCode\`, that is deliberate: the person wants the page built, not assembled from an inventory. Build it — sections, grids, headings, cards, timelines — from elements and utilities. Never invent a component type; the validator rejects it and the round trip is wasted.

When a registered block IS in your catalog, the person put it there on purpose. Prefer it for the thing it does: it carries editing affordances, responsive behaviour, and accessibility work that your markup does not.

Style with \`className\` from the utility vocabulary listed in your context — exactly those patterns, nothing outside them, because a class the build never generated has no CSS at all. For anything utilities cannot express — a keyframe, a gradient headline, a clip path, a hover reveal, an exact colour, a background photo — give the element a \`ck-\` prefixed class and write its rule in the block's \`css\` prop (or \`pageCss\` on the page root for keyframes and fonts shared across regions). Any CSS value is fine there; \`var(--t-accent)\`, \`var(--t-surface)\`, \`var(--t-text)\` are available when the region should re-theme with the site.

Icons: \`{"kind":"icon","name":"mail"}\` draws an icon from the Lucide set (lucide.dev/icons) by its kebab-case name — \`mail\`, \`phone\`, \`map-pin\`, \`globe\`, \`link\`, \`external-link\`, \`arrow-right\`, \`check\`, \`star\`, \`briefcase\`, \`graduation-cap\`, \`calendar\`, \`download\`. Optional \`size\` (px), \`strokeWidth\`, \`className\` (\`text-accent\`, \`h-6 w-6\`). Give it a \`label\` only when it carries meaning on its own; leave it out when text beside it already says the same thing. **Lucide has no brand logos** — there is no \`github\`, \`linkedin\`, \`twitter\`, \`instagram\`: for a social or profile link use \`link\`, \`globe\`, or \`external-link\` beside the text. A name that is not in the set is refused by name, so use names you are sure exist.

Design to a professional standard: generous spacing on a consistent scale, one clear typographic hierarchy, a real responsive layout (\`md:\`/\`lg:\` variants), and colour through roles only.

## Refusing

If the request is not about this page, or asks for something the commands cannot express, answer with a plan whose single command is impossible rather than guessing. It is better to be told you cannot than to be shown a page you did not ask for.`;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}

/**
 * The stable half: what the model may build WITH.
 *
 * The catalog and the command list both change only when the registry does,
 * which for a running site is approximately never — so they cache together as
 * one segment.
 */
function stableContext(request: AiPlanWireRequest): string {
  const { context } = request;
  return [
    '# Block catalog',
    JSON.stringify(context.blocks),
    '',
    '# Commands you may propose',
    JSON.stringify(context.commands ?? []),
    '',
    '# Page templates available',
    JSON.stringify(context.templates ?? []),
    '',
    /*
      The exact utilities the build generates, as the same patterns the CSS is
      generated from. A model that writes markup for whole pages needs the
      real list, not a description of one: every class outside it is inert and
      refused at the door, and each refusal is a wasted round trip. ~750
      tokens, and it changes only when the vocabulary does — so it caches.
    */
    '# Utility classes you may use ({a,b} = alternates, {0..N} = inclusive range; each line is independent)',
    ...UTILITY_VOCABULARY,
  ].join('\n');
}

/**
 * The volatile half: what the page is right now, and what was asked.
 *
 * Everything here changes per turn by definition, so it sits after the last
 * cache breakpoint where it costs nothing to change.
 */
function volatileContext(request: AiPlanWireRequest): string {
  const { context } = request;
  const parts = [
    '# The page right now',
    JSON.stringify(context.document),
    '',
    '# Current selection',
    JSON.stringify(context.selection),
  ];

  if (context.fragments.length > 0) {
    parts.push('', '# Additional context', JSON.stringify(context.fragments));
  }

  /*
    A repair attempt, when there is one. The rejected plan AND its issues, so
    the second attempt is a correction rather than a re-roll: without the
    issues the model has no way to know which of a dozen fields the door
    objected to.
  */
  if (request.attempt !== undefined) {
    parts.push(
      '',
      '# Your previous plan was REJECTED',
      JSON.stringify(request.attempt.plan),
      '',
      '# Why it was rejected — fix exactly these',
      JSON.stringify(request.attempt.issues),
    );
  }

  parts.push('', '# The request', request.request);
  return parts.join('\n');
}

/** Build the Claude request parts for one wire request. */
export function buildPrompt(request: AiPlanWireRequest): PromptParts {
  const stable = stableContext(request);

  /*
    The breakpoint is placed only when the segment can actually cache. Below
    ~1024 tokens the API silently declines, and a `cache_control` that never
    caches is worse than none: it reads as a working optimisation in code
    review while the bill says otherwise.
  */
  const cacheable = estimateTokens(SYSTEM_RULES) + estimateTokens(stable) >= MIN_CACHEABLE_TOKENS;

  const system: PromptParts['system'] = [
    { type: 'text', text: SYSTEM_RULES },
    {
      type: 'text',
      text: stable,
      ...(cacheable ? { cache_control: { type: 'ephemeral' as const } } : {}),
    },
  ];

  const messages: PromptParts['messages'] = [
    /*
      History before the page state. The conversation is older than the
      document's current shape, and ordering it that way lets a follow-up like
      "make it blue" resolve against what the previous turn actually added.
    */
    ...(request.history ?? []).map((turn) => ({
      role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: turn.text,
    })),
    { role: 'user' as const, content: volatileContext(request) },
  ];

  return { system, messages };
}

/** Exported for the test that pins the rules text as cache-stable. */
export const SYSTEM_RULES_TEXT = SYSTEM_RULES;
