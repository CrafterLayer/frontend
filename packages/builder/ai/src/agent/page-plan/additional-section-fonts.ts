import {
  CUSTOM_CSS_FONT_HOSTS,
  CUSTOM_CSS_FONT_IMPORT,
  normalizeCssForInspection,
} from '@craftkit/builder-schema';

import { VERIFIED_FONT_FAMILIES } from '../../skills/verified-fonts';
import type { LandedNode } from './check-section';
import type { PagePlan, SectionCheckIssue } from './types';

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'revert',
]);
const SITE_FACE_CLASSES = new Set(['font-sans', 'font-serif']);
const NAMED_WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

interface Readers {
  readonly classesOf: (node: Readonly<Record<string, unknown>>) => readonly string[];
  readonly baseUtility: (name: string) => string;
  readonly declarations: (css: string) => readonly (readonly [string, string])[];
}

function families(value: string): readonly string[] {
  return value
    .replace(/\s*!important$/u, '')
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/gu, ''))
    .filter(
      (family) =>
        family !== '' && !family.startsWith('var(') && !GENERIC_FAMILIES.has(family.toLowerCase()),
    );
}

function classFamilies(base: string): readonly string[] {
  const inner = /^font-\[(.+)\]$/u.exec(base)?.[1] ?? /^\[font-family:(.+)\]$/u.exec(base)?.[1];
  if (inner === undefined) return [];
  const value = inner.replace(/^family-name:/u, '').replaceAll('_', ' ');
  return /^(?:(?:number|weight):)?\d+$/u.test(value) ? [] : families(value);
}

function verifiedFamily(name: string, bunny: boolean): string | undefined {
  return Object.keys(VERIFIED_FONT_FAMILIES).find(
    (family) => (bunny ? family.toLowerCase().replaceAll(' ', '-') : family) === name,
  );
}

/** Only published normal, discrete weights; metadata does not verify italic axes or ranges. */
function requestedFace(
  value: string,
  bunny: boolean,
  css2: boolean,
): readonly [string, readonly number[]] | undefined {
  const colon = value.indexOf(':');
  const name = colon < 0 ? value : value.slice(0, colon);
  const family = verifiedFamily(name, bunny);
  if (family === undefined) return undefined;
  const suffix = colon < 0 ? undefined : value.slice(colon + 1);
  if (suffix !== undefined && css2 && !suffix.startsWith('wght@')) return undefined;
  const list = suffix === undefined ? '400' : css2 ? suffix.slice(5) : suffix;
  if (!(css2 ? /^\d+(?:;\d+)*$/u : /^\d+(?:,\d+)*$/u).test(list)) return undefined;
  const weights = list.split(/[;,]/u).map(Number);
  if (
    !weights.every(
      (weight, index) =>
        VERIFIED_FONT_FAMILIES[family]?.weights.includes(weight) &&
        (index === 0 || weight > (weights[index - 1] ?? 0)),
    )
  )
    return undefined;
  return [family, weights];
}

/** Match renderer import hoisting; disguised imports cannot claim a face actually loaded. */
function extraLoadedFaces(
  css: string,
  arabic: boolean,
): {
  readonly loaded: ReadonlyMap<string, ReadonlySet<number>>;
  readonly invalid: readonly string[];
} {
  const loaded = new Map<string, Set<number>>();
  const invalid: string[] = [];
  for (const match of css.matchAll(new RegExp(CUSTOM_CSS_FONT_IMPORT))) {
    const address = /https:\/\/[^"')\s]+/u.exec(match[0])?.[0];
    const url = address === undefined ? undefined : (URL.parse(address) ?? undefined);
    const bunny = url?.origin === 'https://fonts.bunny.net';
    const allowed =
      url !== undefined && CUSTOM_CSS_FONT_HOSTS.some((host) => url.href.startsWith(host));
    const endpoint = bunny ? url.pathname === '/css' : /^\/css2?$/u.test(url?.pathname ?? '');
    const values = url?.searchParams.getAll('family') ?? [];
    const faces = values
      .flatMap((value) => (url?.pathname === '/css2' ? [value] : value.split('|')))
      .map((value) => requestedFace(value, bunny, url?.pathname === '/css2'));
    const knownQuery = [...(url?.searchParams.keys() ?? [])].every(
      (key) => key === 'family' || key === 'display',
    );
    const displays = url?.searchParams.getAll('display') ?? [];
    const displayValid =
      displays.length === 0 ||
      (displays.length === 1 &&
        ['auto', 'block', 'swap', 'fallback', 'optional'].includes(displays[0] ?? ''));
    const trailing =
      address === undefined
        ? ''
        : match[0]
            .slice(match[0].indexOf(address) + address.length)
            .replace(/^["']?\s*\)?\s*/u, '')
            .replace(/;$/u, '')
            .trim();
    if (
      url === undefined ||
      !allowed ||
      !endpoint ||
      url.username !== '' ||
      url.password !== '' ||
      url.hash !== '' ||
      trailing !== '' ||
      !knownQuery ||
      !displayValid ||
      (url.pathname !== '/css2' && values.length !== 1) ||
      faces.length === 0 ||
      faces.some(
        (face) =>
          face === undefined || (arabic && VERIFIED_FONT_FAMILIES[face[0]]?.arabic !== true),
      )
    ) {
      invalid.push(address ?? match[0]);
      continue;
    }
    for (const face of faces) {
      if (face === undefined) continue;
      const key = face[0].toLowerCase();
      const weights = loaded.get(key) ?? new Set<number>();
      for (const weight of face[1]) weights.add(weight);
      loaded.set(key, weights);
    }
  }
  const rest = normalizeCssForInspection(css.replace(CUSTOM_CSS_FONT_IMPORT, ''));
  if (/@import\b/iu.test(rest)) invalid.push('unapproved @import');
  return { loaded, invalid };
}

function explicitWeight(value: string): number | undefined {
  const bare = value.trim().replace(/\s*!important$/u, '');
  if (bare === 'normal') return 400;
  if (bare === 'bold') return 700;
  return /^\d+$/u.test(bare) ? Number(bare) : undefined;
}

/** Font checks stay local; the existing schema still validates CSS/hosts and command ownership. */
export function checkSectionFonts(
  plan: PagePlan,
  css: string,
  nodes: readonly LandedNode[],
  readers: Readers,
): readonly SectionCheckIssue[] {
  const bespoke = plan.design?.composition === 'bespoke';
  const planFaces = new Set(
    [plan.tokens.fontDisplay.family, plan.tokens.fontBody.family].map((family) =>
      family.toLowerCase(),
    ),
  );
  const { loaded, invalid } = bespoke
    ? extraLoadedFaces(css, /^ar(?:-|$)/u.test(plan.locale.lang))
    : { loaded: new Map<string, ReadonlySet<number>>(), invalid: [] };
  const bad = new Map<string, string>();
  const used = (family: string, path: string, weight?: number) => {
    const key = family.toLowerCase();
    if (planFaces.has(key)) return;
    const available = loaded.get(key);
    if (available === undefined) bad.set(family, path);
    else if (weight !== undefined && !available.has(weight))
      bad.set(`${family} weight ${String(weight)} (not loaded)`, path);
  };
  for (const [property, value] of readers.declarations(css)) {
    if (property === 'font-family') for (const family of families(value)) used(family, 'css');
  }
  // Check explicit weights colocated with extra-family declarations. This is not a CSS cascade engine.
  for (const block of css.matchAll(/\{([^{}]*)\}/gu)) {
    const declarations = readers.declarations(`{${block[1] ?? ''}}`);
    const weight = declarations.findLast(([property]) => property === 'font-weight')?.[1];
    if (weight === undefined) continue;
    for (const [property, value] of declarations) {
      if (property === 'font-family')
        for (const family of families(value)) used(family, 'css', explicitWeight(weight));
    }
  }
  if (!bespoke) {
    for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/giu)) {
      const url = match[1] ?? '';
      const imported = [...url.matchAll(/family=([^:&]+)/gu)].map((family) => {
        try {
          return decodeURIComponent((family[1] ?? '').replaceAll('+', ' '));
        } catch {
          return url;
        }
      });
      for (const family of imported.length === 0 ? [url] : imported) used(family, 'css');
    }
  }
  const siteFaces = new Map<string, string>();
  for (const entry of nodes) {
    const bases = readers.classesOf(entry.node).map(readers.baseUtility);
    const weights = bases.flatMap((base) => {
      const named = /^font-(\w+)$/u.exec(base)?.[1];
      const arbitrary =
        /^font-\[(?:(?:number|weight):)?(\d+)\]$/u.exec(base)?.[1] ??
        /^\[font-weight:(\d+)\]$/u.exec(base)?.[1];
      const weight = arbitrary === undefined ? NAMED_WEIGHTS[named ?? ''] : Number(arbitrary);
      return weight === undefined ? [] : [weight];
    });
    for (const name of readers.classesOf(entry.node)) {
      const base = readers.baseUtility(name);
      if (SITE_FACE_CLASSES.has(base)) siteFaces.set(name, `${entry.path}.className`);
      for (const family of classFamilies(base)) {
        used(family, `${entry.path}.className`);
        for (const weight of weights) used(family, `${entry.path}.className`, weight);
      }
    }
  }
  for (const invalidImport of invalid) bad.set(invalidImport, 'css');
  const issues: SectionCheckIssue[] = [];
  if (bad.size > 0)
    issues.push({
      code: 'foreign-font',
      path: bad.values().next().value ?? 'css',
      message: bespoke
        ? `Load additional verified faces first with an approved Google/Bunny font @import; use shipped normal weights and Arabic-capable faces on Arabic pages. Fix ${[...bad.keys()].slice(0, 8).join(', ')}. The page's inherited ck-display/ck-body and var(--ck-font-display)/var(--ck-font-body) remain available.`
        : `Use the page's two faces — ck-display or ck-body on an element, font-family: var(--ck-font-display) or var(--ck-font-body) in the region css, both already loaded by the page — not ${[...bad.keys()].slice(0, 8).join(', ')}; and no @import in a section.`,
    });
  if (siteFaces.size > 0)
    issues.push({
      code: 'foreign-font',
      path: siteFaces.values().next().value ?? 'css',
      message: `Remove ${[...siteFaces.keys()].slice(0, 8).join(', ')}: they switch to the site's face. The page's faces are inherited; add ck-display for a display line.`,
    });
  return issues;
}
