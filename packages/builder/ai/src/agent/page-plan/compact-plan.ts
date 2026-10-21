import { parseHex } from '@craftkit/builder-schema';

import { DIRECTION_DECK_ROWS, type DeckFace } from '../../skills/direction-deck';
import { isRecord, resolveColour, toSlug } from './schema';
import { PAGE_PLAN_MAX_NAV_ITEMS, type PagePlanIssue } from './types';

/**
 * Expand compact metadata, outline and briefs through the same validator as legacy plans.
 * Derive missing palette/anchor/navigation values; authored values always win.
 * Keeping both representations canonical lets provisional and final plans reconcile.
 */

type JsonObject = Readonly<Record<string, unknown>>;

/** Languages in Arabic script: their pages take the deck row's Arabic faces. */
const ARABIC_SCRIPT_LANGUAGES = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ckb']);

/** The fields a brief carries into its section; brief values win. */
const BRIEF_FIELDS = [
  'layout',
  'purpose',
  'mustSay',
  'mustNotRepeat',
  'images',
  'slots',
  'variant',
  'kit',
] as const;

// ── 0. Latin section keys ─────────────────────────────────────────────────────

const SECTION_SLUG = /^[a-z][a-z0-9-]{0,39}$/u;

/** The plain name a role or a kit id gives a section: `menu-list` → `menu`, `band` → `section`. */
function plainKeyFor(section: Readonly<Record<string, unknown>>): string {
  const kit = typeof section['kit'] === 'string' ? toSlug(section['kit']) : '';
  const head = kit.split('-')[0] ?? '';
  if (SECTION_SLUG.test(head)) return head;
  const role = typeof section['role'] === 'string' ? toSlug(section['role']) : '';
  return SECTION_SLUG.test(role) && role !== 'band' ? role : 'section';
}

/** Every string in `value` equal to a key of `swap`, replaced; other values kept by reference. */
function swapStrings(value: unknown, swap: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return swap.get(value) ?? value;
  if (Array.isArray(value)) {
    const next = value.map((item: unknown) => swapStrings(item, swap));
    return next.some((item, index) => item !== value[index]) ? next : value;
  }
  if (!isRecord(value)) return value;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    next[key] = swapStrings(field, swap);
    if (next[key] !== field) changed = true;
  }
  return changed ? next : value;
}

/**
 * Section keys the model wrote in another script, renamed in code (live run
 * 2026-10-05): the Arabic restaurant plan keyed its sections «بطل», «قائمة»,
 * «حجز», and the slug rule refused the whole plan — a 15.7 s repair round on
 * the critical path for a name no visitor sees. Each such key (and the
 * anchorId that copies it) becomes a Latin slug from the outline alone — its
 * kit (`menu-list` → `menu`), else its role — so a provisional plan read from
 * the streamed outline renames exactly as the final one. Every reference is
 * renamed with it: brief keys, fact sections, nav anchors, `#anchor` links.
 */
function latinSectionKeys(
  value: Readonly<Record<string, unknown>>,
  warnings: PagePlanIssue[],
): Readonly<Record<string, unknown>> {
  const sections = value['sections'];
  if (!Array.isArray(sections)) return value;
  const taken = new Set<string>();
  for (const section of sections as readonly unknown[]) {
    if (!isRecord(section) || typeof section['key'] !== 'string') continue;
    const slug = toSlug(section['key']);
    if (SECTION_SLUG.test(slug)) taken.add(slug);
  }
  const keys = new Map<string, string>();
  const anchors = new Map<string, string>();
  const renamed = (sections as readonly unknown[]).map((section, index) => {
    if (!isRecord(section) || typeof section['key'] !== 'string') return section;
    const raw = section['key'];
    if (raw.trim() === '' || SECTION_SLUG.test(toSlug(raw))) return section;
    const plain = plainKeyFor(section);
    let key = plain;
    for (let n = 2; taken.has(key); n += 1) key = `${plain}-${String(n)}`;
    taken.add(key);
    keys.set(raw, key);
    keys.set(raw.trim(), key);
    anchors.set(`#${raw.trim()}`, `#${key}`);
    const next: Record<string, unknown> = { ...section, key };
    const anchor = section['anchorId'];
    if (typeof anchor === 'string' && !SECTION_SLUG.test(toSlug(anchor))) {
      next['anchorId'] = key;
      keys.set(anchor, key);
      anchors.set(`#${anchor.trim()}`, `#${key}`);
    }
    warnings.push({
      path: `sections[${String(index)}].key`,
      message: `The section key "${raw.slice(0, 40)}" is not a Latin slug; it was renamed "${key}".`,
    });
    return next;
  });
  if (keys.size === 0) return value;

  const out: Record<string, unknown> = { ...value, sections: renamed };
  const renameKey = (item: unknown, field: string): unknown => {
    if (!isRecord(item) || typeof item[field] !== 'string') return item;
    const key = keys.get(item[field]);
    return key === undefined ? item : { ...item, [field]: key };
  };
  for (const [field, key] of [
    ['briefs', 'key'],
    ['facts', 'section'],
    ['nav', 'anchorId'],
  ] as const) {
    const entries = value[field];
    if (Array.isArray(entries)) out[field] = entries.map((entry) => renameKey(entry, key));
  }
  return swapStrings(out, anchors) as Readonly<Record<string, unknown>>;
}

/** Absent, null or blank: the model did not write it. */
function written(value: unknown): boolean {
  return !(
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function hexOf(channels: { r: number; g: number; b: number }): string {
  const part = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(channels.r)}${part(channels.g)}${part(channels.b)}`;
}

/**
 * `weight` of `a` over `1 - weight` of `b`, per sRGB channel. Restated from
 * skeleton-from-plan.ts (`mix`), not imported: the two folders stay apart.
 */
function mix(a: string, b: string, weight: number): string {
  const one = parseHex(a);
  const two = parseHex(b);
  if (one === undefined || two === undefined) return a;
  return hexOf({
    r: one.r * weight + two.r * (1 - weight),
    g: one.g * weight + two.g * (1 - weight),
    b: one.b * weight + two.b * (1 - weight),
  });
}

function colourOf(value: unknown): string | undefined {
  return typeof value === 'string' ? resolveColour(value) : undefined;
}

function faceOf(face: DeckFace): JsonObject {
  return { family: face.family, weights: [...face.weights] };
}

function primaryLanguage(locale: unknown): string {
  if (!isRecord(locale) || typeof locale['lang'] !== 'string') return '';
  return locale['lang'].trim().toLowerCase().split('-')[0] ?? '';
}

/**
 * The tokens with every missing one filled from the named deck row; `undefined`
 * when nothing was filled (no row, an unknown row, or every token written).
 */
function expandTokens(tokens: unknown, locale: unknown): JsonObject | undefined {
  if (!isRecord(tokens)) return undefined;
  const id = typeof tokens['deckRowId'] === 'string' ? tokens['deckRowId'].trim() : '';
  const row = DIRECTION_DECK_ROWS.find((candidate) => candidate.id === id);
  if (row === undefined) return undefined;
  const { palette } = row;
  const bg = colourOf(palette.ground) ?? palette.ground;
  const muted = colourOf(palette.muted) ?? palette.muted;
  const faces = ARABIC_SCRIPT_LANGUAGES.has(primaryLanguage(locale)) ? row.arabic : row.latin;
  const deck: readonly (readonly [string, unknown])[] = [
    ['bg', bg],
    ['surface', colourOf(palette.card) ?? palette.card],
    ['ink', colourOf(palette.ink) ?? palette.ink],
    ['muted', muted],
    ['accent', colourOf(palette.accent) ?? palette.accent],
    ['onAccent', colourOf(palette.onAccent) ?? palette.onAccent],
    ['accentInk', colourOf(palette.accentInk) ?? palette.accentInk],
    /*
      A hairline: the ground with a fifth of the muted colour in it (80 % bg,
      20 % muted), from whatever bg and muted the plan ends with. Decorative
      and never measured; deterministic so a provisional and a final plan agree.
    */
    [
      'border',
      mix(colourOf(tokens['bg']) ?? bg, colourOf(tokens['muted']) ?? muted, 0.8).toLowerCase(),
    ],
    ['fontDisplay', faceOf(faces[0])],
    ['fontBody', faceOf(faces[1])],
    ['radius', 'xl'],
    ['signature', row.signature],
  ];
  /*
    A model that chose its own accent (a person asked for blue) gets the ink
    for it derived by the validator, not the deck accent's ink: an orange
    accentInk under a blue button would be a palette nobody chose.
  */
  const ownAccent = written(tokens['accent']);
  const filled: Record<string, unknown> = {};
  for (const [key, value] of deck) {
    if (written(tokens[key])) continue;
    if (key === 'accentInk' && ownAccent) continue;
    filled[key] = value;
  }
  return Object.keys(filled).length === 0 ? undefined : { ...tokens, ...filled };
}

function factKeyOf(fact: unknown): string | undefined {
  return isRecord(fact) && typeof fact['key'] === 'string' && fact['key'].trim() !== ''
    ? toSlug(fact['key'])
    : undefined;
}

function factSampleOf(fact: unknown): string | undefined {
  return isRecord(fact) && typeof fact['sample'] === 'string' ? fact['sample'].trim() : undefined;
}

/**
 * One fact per key, in first-seen order (fix pass 2026-10-05: the Arabic T1
 * wrote the same six facts at the top AND in the briefs, and the validator
 * refused the plan twice for duplicate keys — 53 s of T1 and a 208 s scaffold).
 *
 * - same key, same sample: the later copy is dropped, silently — it says nothing new;
 * - same key, different sample, one from a brief: the brief's fact replaces the
 *   other in place, with a warning — the brief is the section's contract;
 * - same key, different sample, same origin: both kept, so the validator still
 *   asks which one is meant (code cannot know).
 */
function mergeFacts(
  entries: readonly { readonly fact: unknown; readonly brief: boolean }[],
  warnings: PagePlanIssue[],
): unknown[] {
  const out: { fact: unknown; brief: boolean }[] = [];
  const at = new Map<string, number>();
  for (const entry of entries) {
    const key = factKeyOf(entry.fact);
    const index = key === undefined ? undefined : at.get(key);
    const kept = index === undefined ? undefined : out[index];
    if (key === undefined || index === undefined || kept === undefined) {
      if (key !== undefined) at.set(key, out.length);
      out.push({ ...entry });
      continue;
    }
    if (factSampleOf(kept.fact) === factSampleOf(entry.fact)) continue;
    if (entry.brief === kept.brief) {
      out.push({ ...entry });
      continue;
    }
    const winner = entry.brief ? entry : kept;
    const loser = entry.brief ? kept : entry;
    warnings.push({
      path: 'facts',
      message: `"${key}" was written twice; the brief's "${String(factSampleOf(winner.fact)).slice(0, 60)}" was kept over "${String(factSampleOf(loser.fact)).slice(0, 60)}".`,
    });
    out[index] = { ...winner };
  }
  return out.map(({ fact }) => fact);
}

interface BriefPatch {
  readonly fields: Record<string, unknown>;
}

/**
 * Turn a compact (or mixed) page-plan candidate into the classic shape
 * `validatePagePlan` reads (DESIGN §3, rules 1-6):
 *
 * 1. `tokens.deckRowId` naming a deck row fills every missing token from it
 *    (hex colours, `border` mixed from bg and muted, the row's Arabic faces on
 *    an Arabic-script page else its Latin ones, radius `xl`, its signature);
 *    a token the model wrote wins.
 * 2. Outline sections: `anchorId` defaults to `key`, `mustSay` and
 *    `mustNotRepeat` to `[]`.
 * 3. `briefs` are merged into the section with the same key (brief values
 *    win); a brief's `facts` join the top-level `facts` with `section` = its
 *    key (a section's own `facts` join too unless its brief carries some;
 *    one fact per key — see `mergeFacts`); a brief naming no section is
 *    dropped with a warning; `briefs` is removed.
 * 4. A header or footer without a purpose takes its title; any other section
 *    without one takes its title WITH A WARNING — never an issue, because a
 *    thin contract for one section beats a whole repair round.
 * 5. No top-level `nav`: it is derived from the sections' `nav` labels in page
 *    order (`[]` on a page without a header). Section `nav` keys are removed.
 * 6. `facts` absent → `[]`.
 *
 * Pure, total, idempotent and never throws. A value that needs none of it (a
 * classic plan, or anything that is not an object) is returned AS IS — the
 * same object — with no warnings.
 */
export function expandCompactPagePlan(candidate: unknown): {
  readonly value: unknown;
  readonly warnings: readonly PagePlanIssue[];
} {
  if (!isRecord(candidate)) return { value: candidate, warnings: [] };
  const warnings: PagePlanIssue[] = [];
  // 0. section keys in another script → Latin slugs, every reference with them
  const value = latinSectionKeys(candidate, warnings);
  let changed = value !== candidate;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (key !== 'briefs') out[key] = field;
  }

  // 1. tokens
  const tokens = expandTokens(value['tokens'], value['locale']);
  if (tokens !== undefined) {
    out['tokens'] = tokens;
    changed = true;
  }

  const rawSections = value['sections'];
  const sections: readonly unknown[] = Array.isArray(rawSections) ? rawSections : [];
  const sectionKeys = sections.map((section) =>
    isRecord(section) && typeof section['key'] === 'string' ? toSlug(section['key']) : undefined,
  );

  // 3. briefs → patches by section index, facts hoisted
  const patches = new Map<number, BriefPatch>();
  const hoisted: unknown[] = [];
  /** Sections whose brief carries facts: their own `facts` list is dropped. */
  const briefFacts = new Set<number>();
  const briefs = value['briefs'];
  if (briefs !== undefined) {
    changed = true;
    if (briefs !== null && !Array.isArray(briefs)) {
      warnings.push({
        path: 'briefs',
        message:
          'briefs was not a list; it was dropped and each section is built from its outline.',
      });
    }
    (Array.isArray(briefs) ? (briefs as readonly unknown[]) : []).forEach((brief, index) => {
      const path = `briefs[${String(index)}]`;
      const rawKey = isRecord(brief) ? brief['key'] : undefined;
      const at =
        typeof rawKey === 'string' && rawKey.trim() !== ''
          ? sectionKeys.indexOf(toSlug(rawKey))
          : -1;
      const section = at === -1 ? undefined : sections[at];
      if (!isRecord(brief) || !isRecord(section)) {
        warnings.push({
          path: `${path}.key`,
          message: `A brief names the section it is for; ${typeof rawKey === 'string' ? `"${rawKey.slice(0, 40)}" is no section key (${sectionKeys.filter((key) => key !== undefined).join(', ')})` : 'this one names none'}, so it was dropped.`,
        });
        return;
      }
      const patch = patches.get(at) ?? { fields: {} };
      for (const field of BRIEF_FIELDS) {
        if (brief[field] !== undefined) patch.fields[field] = brief[field];
      }
      patches.set(at, patch);
      const facts = brief['facts'];
      if (Array.isArray(facts)) {
        if (facts.length > 0) briefFacts.add(at);
        for (const fact of facts as readonly unknown[]) {
          hoisted.push(isRecord(fact) ? { ...fact, section: section['key'] } : fact);
        }
      } else if (facts !== undefined && facts !== null) {
        warnings.push({
          path: `${path}.facts`,
          message: 'A brief’s facts are a list of { "key", "sample" }; these were dropped.',
        });
      }
    });
  }

  // 2, 4, 5. the outline
  const navLabels: { readonly label: string; readonly anchorId: unknown }[] = [];
  const hasHeader = sections.some(
    (section) =>
      isRecord(section) &&
      typeof section['role'] === 'string' &&
      section['role'].trim().toLowerCase() === 'header',
  );
  /** Facts a section carried itself (a mixed answer); they join after the top-level ones. */
  const sectionFacts: unknown[] = [];
  const expanded = sections.map((section, index) => {
    if (!isRecord(section)) return section;
    const patch = patches.get(index);
    const next: Record<string, unknown> = { ...section, ...(patch?.fields ?? {}) };
    let touched = patch !== undefined;
    /*
      A mixed answer (2026-10-05, Arabic run) put facts on the section AND on
      its brief. The brief's are the contract; a section's own list is used
      only when its brief carries none, and the key never reaches readSection.
    */
    if (Object.hasOwn(next, 'facts')) {
      const own = next['facts'];
      if (!briefFacts.has(index) && Array.isArray(own)) {
        for (const fact of own as readonly unknown[]) {
          sectionFacts.push(isRecord(fact) ? { ...fact, section: next['key'] } : fact);
        }
      }
      delete next['facts'];
      touched = true;
    }
    if (!written(next['anchorId']) && typeof next['key'] === 'string') {
      next['anchorId'] = next['key'];
      touched = true;
    }
    for (const list of ['mustSay', 'mustNotRepeat'] as const) {
      if (next[list] === undefined || next[list] === null) {
        next[list] = [];
        touched = true;
      }
    }
    const title = next['title'];
    if (!written(next['purpose']) && typeof title === 'string' && title.trim() !== '') {
      next['purpose'] = title;
      touched = true;
      const role = typeof next['role'] === 'string' ? next['role'].trim().toLowerCase() : '';
      if (role !== 'header' && role !== 'footer') {
        warnings.push({
          path: `sections[${String(index)}].purpose`,
          message: `No brief for "${String(next['key'])}" — the writer builds from the title "${title.trim().slice(0, 60)}".`,
        });
      }
    }
    if (Object.hasOwn(next, 'nav')) {
      const nav = next['nav'];
      const label =
        typeof nav === 'string' && nav.trim() !== ''
          ? nav.trim()
          : nav === true && typeof title === 'string' && title.trim() !== ''
            ? title.trim()
            : undefined;
      if (label !== undefined) navLabels.push({ label, anchorId: next['anchorId'] });
      delete next['nav'];
      touched = true;
    }
    return touched ? next : section;
  });
  /*
    The brand a header or footer brief names (`slots.brand`) becomes the
    plan's own: those slots are dropped with the role's kit, and the English
    run's header then showed the title cut to "Invoice freelance clients in s…".
  */
  if (!written(value['brand'])) {
    for (const section of expanded) {
      if (!isRecord(section)) continue;
      const role = typeof section['role'] === 'string' ? section['role'].trim().toLowerCase() : '';
      const slots = section['slots'];
      if ((role === 'header' || role === 'footer') && isRecord(slots) && written(slots['brand'])) {
        if (typeof slots['brand'] === 'string') {
          out['brand'] = slots['brand'].trim();
          changed = true;
          break;
        }
      }
    }
  }
  if (expanded.some((section, index) => section !== sections[index])) {
    out['sections'] = expanded;
    changed = true;
  }

  if ((value['nav'] === undefined || value['nav'] === null) && (navLabels.length > 0 || changed)) {
    const derived = hasHeader ? navLabels : [];
    if (derived.length > PAGE_PLAN_MAX_NAV_ITEMS) {
      warnings.push({
        path: 'nav',
        message: `The menu keeps the first ${String(PAGE_PLAN_MAX_NAV_ITEMS)} of ${String(derived.length)} sections marked "nav".`,
      });
    }
    out['nav'] = derived.slice(0, PAGE_PLAN_MAX_NAV_ITEMS).map(({ label, anchorId }) => ({
      label,
      anchorId,
    }));
    changed = true;
  }

  // 6. facts — the top-level list, then the sections' own, then the briefs', deduplicated
  const facts = value['facts'];
  const joining = [...sectionFacts, ...hoisted];
  if (joining.length > 0) {
    if (facts === undefined || facts === null || Array.isArray(facts)) {
      const top: readonly unknown[] = Array.isArray(facts) ? (facts as readonly unknown[]) : [];
      out['facts'] = mergeFacts(
        [
          ...top.map((fact) => ({ fact, brief: false })),
          ...sectionFacts.map((fact) => ({ fact, brief: false })),
          ...hoisted.map((fact) => ({ fact, brief: true })),
        ],
        warnings,
      );
    } else {
      warnings.push({
        path: 'facts',
        message: 'facts was not a list, so the briefs’ facts could not join it.',
      });
    }
    changed = true;
  } else if ((facts === undefined || facts === null) && changed) {
    out['facts'] = [];
  }

  return changed ? { value: out, warnings } : { value, warnings: [] };
}
