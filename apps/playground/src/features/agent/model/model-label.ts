import type { ModelOption, ModelSelectionView, ModelTier } from './view-types';

/**
 * Model id → the name a person reads (SPEC §4.17 ModelMenu: "Raw model ids are never
 * shown; `model-label.ts` maps ids to tier and product").
 *
 * Two parts, because they answer two questions. The TIER ("Fast", "Careful", "Free") is
 * what the choice means for this person: speed, care, or cost. It is the trigger's whole
 * label and the menu's first line, and its words are catalog keys (`model.*`), so this
 * module returns the tier, never its name. The PRODUCT ("Sonnet", "MiniMax M3") says
 * which model that is, on the menu's second line, for the person who knows the names.
 *
 * The ids arrive in two shapes (`apps/ai-server/src/main.ts`, `.env.example`):
 * - `cli:<family>`: the person's own Claude subscription through the local CLI; a bare
 *   `cli:` is the CLI's own default model.
 * - OpenRouter slugs, `vendor/model[:variant]`: `minimax/minimax-m3:free`,
 *   `nvidia/nemotron-3-ultra-550b-a55b:free`, `anthropic/claude-sonnet-4.5`.
 * v1 showed `minimax-m3 · free` and `haiku · Claude CLI`: the slug with its hyphens, a
 * middle dot the copy rules now forbid (SPEC §4.0), and a transport name nobody chose.
 */

export interface ModelLabel {
  readonly tier: ModelTier;
  readonly product: string;
}

/*
  Words that mark a model built for speed and price. Matched as whole TOKENS, never as
  substrings: `minimax` contains "mini" and is not a small model.
*/
const FAST_WORDS: ReadonlySet<string> = new Set([
  'haiku',
  'flash',
  'mini',
  'nano',
  'lite',
  'fast',
  'small',
  'tiny',
  'instant',
  'turbo',
  'air',
]);

/*
  How vendors write their own names. A token not listed here is title-cased, which is
  right for most ("gemini" → "Gemini"), and wrong only for these.
*/
const BRAND_CASE: Readonly<Record<string, string>> = {
  minimax: 'MiniMax',
  deepseek: 'DeepSeek',
  gpt: 'GPT',
  glm: 'GLM',
  oss: 'OSS',
  vl: 'VL',
  ai: 'AI',
  xai: 'xAI',
};

/*
  Release bookkeeping, not part of a name: `-instruct`, `-it`, `-latest`, `-hf`.
  `preview` and `exp` stay: they tell a person the model may change under them.
*/
const NOISE_WORDS: ReadonlySet<string> = new Set(['instruct', 'it', 'latest', 'hf']);

/** A size a person may use to tell two models apart: `70b` → `70B`. */
const PARAMETER_SIZE = /^\d+(?:\.\d+)?[bm]$/iu;
/** A mixture-of-experts' ACTIVE size (`a55b`): a detail of the size already named. */
const ACTIVE_SIZE = /^a\d+(?:\.\d+)?b$/iu;
/** A date stamp: `2507`, `20251001`. */
const DATE_STAMP = /^\d{4,8}$/u;
/** A version piece short enough to be half of a split version: `4`-`5` is `4.5`. */
const VERSION_PART = /^\d{1,2}$/u;

/*
  An id that carries no name at all (`''`, `/`, `:free`) has no product to show. It is
  `''`, not an English stand-in: the ModelMenu item then reads by its tier's catalog word
  alone (`model.fast` «سريع»), which is true in both locales (view-types `ModelOption`).
*/
const UNNAMED = '';

function titleCase(token: string): string {
  return `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

function displayToken(token: string): string {
  const lower = token.toLowerCase();
  const brand = BRAND_CASE[lower];
  if (brand !== undefined) return brand;
  // OpenAI's reasoning models are written lowercase: o3, o4.
  if (/^o\d+$/u.test(lower)) return lower;
  if (PARAMETER_SIZE.test(lower)) return lower.toUpperCase();
  // One letter, or one letter and a version: s, m3, k2, v3.1, r1.
  if (/^[a-z](?:\d+(?:\.\d+)*)?$/u.test(lower)) return lower.toUpperCase();
  return titleCase(lower);
}

/**
 * The name inside a slug's model part (`minimax-m3` → `MiniMax M3`). Split versions are
 * rejoined (`claude-sonnet-4-5` → `4.5`), GPT keeps its hyphen (`GPT-5`), and the
 * active-parameter count, date stamps and fine-tune suffixes are dropped.
 */
function productName(modelPart: string): string {
  const tokens = modelPart
    .split(/[-_\s]+/u)
    .filter((token) => token !== '')
    .filter((token) => !ACTIVE_SIZE.test(token) && !DATE_STAMP.test(token))
    .filter((token) => !NOISE_WORDS.has(token.toLowerCase()));

  const words: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    const next = tokens[index + 1];
    if (VERSION_PART.test(token) && next !== undefined && VERSION_PART.test(next)) {
      words.push(`${token}.${next}`);
      index += 1;
      continue;
    }
    if (token.toLowerCase() === 'gpt' && next !== undefined) {
      // The joined word keeps its vendor casing: `gpt-oss` is GPT-OSS, `gpt-4o` is GPT-4o.
      const joined = next.toLowerCase();
      words.push(`GPT-${BRAND_CASE[joined] ?? joined}`);
      index += 1;
      continue;
    }
    words.push(displayToken(token));
  }
  return words.join(' ');
}

function tierOf(modelPart: string, free: boolean): ModelTier {
  if (free) return 'free';
  const tokens = modelPart.toLowerCase().split(/[-_\s.]+/u);
  /*
    An unknown paid model reads as `careful`: of the two promises a tier makes, "slower,
    more careful" is the one that cannot disappoint a person who picked it for speed.
  */
  return tokens.some((token) => FAST_WORDS.has(token)) ? 'fast' : 'careful';
}

export function modelLabel(id: string): ModelLabel {
  const trimmed = id.trim();

  if (trimmed.startsWith('cli:')) {
    const family = trimmed.slice('cli:'.length);
    // A bare `cli:` is whatever the CLI defaults to, and that is always a Claude.
    if (family === '') return { tier: 'careful', product: 'Claude' };
    const named = productName(family);
    return { tier: tierOf(family, false), product: named === '' ? UNNAMED : named };
  }

  /*
    `api:<model>`: the same Claude on the server's API key. "API" stays in the product so
    a person can tell it from the `cli:` entry of the same model: one costs the key.
  */
  if (trimmed.startsWith('api:')) {
    const family = trimmed.slice('api:'.length);
    const named = productName(family);
    return { tier: tierOf(family, false), product: named === '' ? 'API' : `${named} API` };
  }

  /*
    `vendor/model:variant`. The variant is a price or routing tag (`:free`, `:nitro`,
    `:beta`), never part of the name; only `:free` changes what the person pays.
  */
  const colon = trimmed.lastIndexOf(':');
  const variant = colon < 0 ? '' : trimmed.slice(colon + 1).toLowerCase();
  const slug = colon < 0 ? trimmed : trimmed.slice(0, colon);
  const modelPart = slug.slice(slug.lastIndexOf('/') + 1);
  const product = productName(modelPart);
  return {
    tier: tierOf(modelPart, variant === 'free'),
    product: product === '' ? UNNAMED : product,
  };
}

/** One ModelMenu item: the raw id stays only for `setModel`. */
export function modelOption(id: string): ModelOption {
  return { id, ...modelLabel(id) };
}

/** The host's ids as menu items, each once, in the host's order. */
export function modelOptions(ids: readonly string[]): readonly ModelOption[] {
  return [...new Set(ids)].map(modelOption);
}

/**
 * The picker's state, or `null` when there is nothing to choose: one model is a fact,
 * not a choice (v1 `AssistantHeader` rule, kept). A chosen id the host no longer offers
 * falls back to the first offered, since the server refuses a model it does not allow.
 */
export function modelSelection(
  ids: readonly string[],
  selectedId: string | undefined,
): ModelSelectionView | null {
  const options = modelOptions(ids);
  const first = options[0];
  if (first === undefined || options.length < 2) return null;
  const selected = options.find((option) => option.id === selectedId) ?? first;
  return { selected, options };
}
