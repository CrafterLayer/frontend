import type { PagePlanIssue } from '../../types';
import { VERIFIED_FONT_FAMILIES } from '../../skills/verified-fonts';
import { PAGE_PLAN_PALETTE_HEX } from './palette';

/**
 * The FIELD rules of a page plan: one reader per kind of value, each of which
 * normalises what it can and records what it cannot as a repair instruction.
 *
 * ## Why hand-written and not zod
 *
 * zod is a devDependency of this package only (package.json, 2026-09-28), and
 * the wire door (`@craftkit/builder/wire`) promises a Node service that nothing
 * here drags in beyond what the manifests list. The readers are also where the
 * MESSAGES live, and those are the product: a model repairs from them on its
 * one repair round, so "Expected string, received undefined" would be a wasted
 * model call where "Write the section's purpose…" is not.
 *
 * ## Why normalise rather than refuse
 *
 * Speed first (owner priority): every refusal costs a repair round — a whole
 * model call. So anything code can decide without guessing is decided here
 * (palette names → hex, `#rgb` → `#rrggbb`, "Hero Section" → `hero-section`,
 * `16:9` → `landscape`, a font's casing), and only what needs judgement is
 * refused. Cross-field rules live in validate-page-plan.ts.
 */

export type Issues = PagePlanIssue[];

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function quoted(value: unknown): string {
  // Scalars verbatim; anything else by kind. JSON.stringify would throw on a bigint.
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean' || value === null
        ? String(value)
        : typeof value;
  return `"${text.slice(0, 60)}"`;
}

/** Length in code points, so an Arabic title is not over-counted by UTF-16 surrogates. */
function codePoints(text: string): number {
  return Array.from(text).length;
}

/** A required, trimmed, bounded string. */
export function readText(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
  max: number,
): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({
      path,
      message: `Write ${what} as a non-empty string of at most ${String(max)} characters.`,
    });
    return undefined;
  }
  const text = value.trim();
  if (codePoints(text) > max) {
    issues.push({
      path,
      message: `Shorten ${what} to at most ${String(max)} characters (it has ${String(codePoints(text))}).`,
    });
    return undefined;
  }
  return text;
}

/** An optional string: absent, null or blank is `undefined` without an issue. */
export function readOptionalText(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return readText(value, path, issues, what, max);
}

const SLUG = /^[a-z][a-z0-9-]{0,39}$/u;

/** Folds "Hero Section" / "hero_section" to `hero-section`; refuses what cannot fold. */
export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

export function readSlug(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({
      path,
      message: `Write ${what} as a slug: a-z, 0-9 and hyphens, starting with a letter (e.g. "pricing").`,
    });
    return undefined;
  }
  const slug = toSlug(value);
  if (!SLUG.test(slug)) {
    issues.push({
      path,
      message: `Write ${what} as a slug: a-z, 0-9 and hyphens, starting with a letter, at most 40 characters (e.g. "pricing"); ${quoted(value)} is not one. Latin letters only, even on an Arabic page.`,
    });
    return undefined;
  }
  return slug;
}

export function readEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: Issues,
  what: string,
): T | undefined {
  const folded = typeof value === 'string' ? value.trim().toLowerCase() : value;
  const match = allowed.find((option) => option === folded);
  if (match === undefined) {
    issues.push({
      path,
      message: `Set ${what} to one of: ${allowed.join(', ')}${value === undefined ? '' : `; ${quoted(value)} is not one`}.`,
    });
  }
  return match;
}

/** A JSON array, or `[]` for an absent optional one. */
export function readArray(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
  options: { readonly required: boolean; readonly max: number },
): readonly unknown[] {
  if (value === undefined || value === null) {
    if (options.required) {
      issues.push({ path, message: `Write ${what} as a JSON array.` });
    }
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({ path, message: `Write ${what} as a JSON array, not ${typeof value}.` });
    return [];
  }
  if (value.length > options.max) {
    issues.push({
      path,
      message: `Keep ${what} to at most ${String(options.max)} entries (it has ${String(value.length)}); drop the weakest.`,
    });
    return value.slice(0, options.max);
  }
  return value;
}

export function readTextList(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
  limits: { readonly maxItems: number; readonly maxLength: number },
): readonly string[] {
  const items = readArray(value, path, issues, what, { required: false, max: limits.maxItems });
  const texts: string[] = [];
  items.forEach((item, index) => {
    const text = readText(
      item,
      `${path}[${String(index)}]`,
      issues,
      `each of ${what}`,
      limits.maxLength,
    );
    if (text !== undefined) texts.push(text);
  });
  return texts;
}

// ── colours ──────────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

/** `#rgb` / `#rrggbb` / a palette shade (optionally `bg-`/`text-` prefixed) → lower-case `#rrggbb`. */
export function resolveColour(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (HEX.test(text)) {
    return text.length === 4
      ? `#${text.slice(1).replace(/./gu, (channel) => channel + channel)}`
      : text;
  }
  const name = text.replace(/^(?:bg|text|border|ring|fill)-/u, '');
  return PAGE_PLAN_PALETTE_HEX[name];
}

export function readColour(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
): string | undefined {
  const resolved = typeof value === 'string' ? resolveColour(value) : undefined;
  if (resolved === undefined) {
    issues.push({
      path,
      message: `Write ${what} as #rrggbb hex (e.g. #c2410c) or a Tailwind palette shade such as orange-700${value === undefined ? '' : `; ${quoted(value)} is neither`}.`,
    });
  }
  return resolved;
}

// ── fonts ────────────────────────────────────────────────────────────────────

const FAMILY_BY_FOLDED = new Map(
  Object.keys(VERIFIED_FONT_FAMILIES).map((family) => [family.toLowerCase(), family]),
);

/** The verified families, Arabic-capable first — the list a repair message offers. */
export function verifiedFamilies(arabicOnly: boolean): readonly string[] {
  return Object.entries(VERIFIED_FONT_FAMILIES)
    .filter(([, face]) => !arabicOnly || face.arabic)
    .map(([family]) => family);
}

export interface ReadFace {
  readonly family: string;
  readonly weights: readonly number[];
}

/**
 * A verified family and weights it ships. Weights absent or empty → the
 * family's 400 and 700 where shipped, else its first weight: a face with no
 * weights named still gets a working import.
 */
export function readFace(
  value: unknown,
  path: string,
  issues: Issues,
  what: string,
): ReadFace | undefined {
  if (!isRecord(value)) {
    issues.push({
      path,
      message: `Write ${what} as an object { "family": <a verified family>, "weights": [400, 700] }.`,
    });
    return undefined;
  }
  const raw = value['family'];
  const family =
    typeof raw === 'string' ? FAMILY_BY_FOLDED.get(raw.trim().toLowerCase()) : undefined;
  if (family === undefined) {
    issues.push({
      path: `${path}.family`,
      message: `Use a verified font family${raw === undefined ? '' : `; ${quoted(raw)} is not one`}. Choose from: ${verifiedFamilies(false).join(', ')}.`,
    });
    return undefined;
  }
  const shipped = VERIFIED_FONT_FAMILIES[family]?.weights ?? [];
  const requested = value['weights'];
  if (requested !== undefined && requested !== null && !Array.isArray(requested)) {
    issues.push({
      path: `${path}.weights`,
      message: `Write the weights as an array of numbers, e.g. [400, 700].`,
    });
    return undefined;
  }
  const weights = new Set<number>();
  const listed: readonly unknown[] = requested ?? [];
  let refused = false;
  for (const [index, weight] of listed.entries()) {
    if (typeof weight === 'number' && shipped.includes(weight)) {
      weights.add(weight);
      continue;
    }
    refused = true;
    issues.push({
      path: `${path}.weights[${String(index)}]`,
      message: `${family} ships only the weights ${shipped.join(', ')}; ${quoted(weight)} is not one of them — one wrong weight drops every face in the import.`,
    });
  }
  if (refused) return undefined;
  if (weights.size === 0) {
    const defaults = shipped.filter((weight) => weight === 400 || weight === 700);
    for (const weight of defaults.length === 0 ? shipped.slice(0, 1) : defaults)
      weights.add(weight);
  }
  return { family, weights: [...weights].sort((left, right) => left - right) };
}
