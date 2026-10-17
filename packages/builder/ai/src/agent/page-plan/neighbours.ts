import { landedText, walkLandedTree, type LandedNode } from './check-section';
import type { LandedSection, LandedSections, PagePlan, SectionContract } from './types';

/**
 * The summary never exceeds this many characters: it rides in every writer's
 * prompt. 600 (2026-09-28): three neighbour lines of ~200 characters each —
 * a headline and four short claims — which is what a writer needs to avoid
 * repeating them, at ~150 tokens per writer instead of the ~13k characters of
 * neighbouring page JSON a scoped writer used to carry (agent-audit P1-15).
 */
export const NEIGHBOUR_SUMMARY_MAX_CHARS = 600;

/** A neighbour's title, quoted in its line's head. */
const TITLE_MAX = 70;
/** One claim before any budget: mustSay's own ceiling (validatePagePlan), so a claim is whole whenever it fits. */
const QUOTE_MAX = 200;
/** When the claims alone overflow the summary, no quote is cut shorter than this. */
const QUOTE_MIN = 24;
/** A purpose cut shorter than this says nothing a writer can use; it is dropped instead. */
const PURPOSE_MIN = 24;
const MAX_CLAIMS = 4;
const MAX_PROMISES = 3;
/** Short enough to be a claim (a stat, a price, a card title), not a paragraph. */
const CLAIM_TEXT_MAX = 90;
const DIGIT = /\p{Nd}/u;

function collapse(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

/**
 * Cut to `max` UTF-16 units, marking the cut — never between the halves of a
 * surrogate pair. The cut used to fall wherever the count did: 416 of 768
 * emoji-titled summaries in the verifier's fuzz carried a lone surrogate, which
 * a prompt renders as a replacement box (neighbours-fuzz.mjs, 2026-09-28).
 */
function clip(value: string, max: number): string {
  const text = collapse(value);
  if (text.length <= max) return text;
  if (max < 1) return '';
  let end = max - 1;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

function tagOf(entry: LandedNode): string {
  return typeof entry.node['tag'] === 'string' ? entry.node['tag'] : '';
}

/**
 * What a landed section says, read from its tree: the headline (its h1, else
 * its first h2) and up to four short claims — card titles (h3/h4) and any
 * short text carrying a number, because repeated numbers (the hero's proof
 * facts again in the stats band) were the duplicate the audit measured.
 */
function written(landed: LandedSection): { headline?: string; claims: readonly string[] } {
  const nodes = walkLandedTree(landed.tree);
  const heading =
    nodes.find((entry) => tagOf(entry) === 'h1') ?? nodes.find((entry) => tagOf(entry) === 'h2');
  const headline = heading === undefined ? undefined : landedText(nodes, heading);
  const claims: string[] = [];
  for (const entry of nodes) {
    if (claims.length >= MAX_CLAIMS) break;
    const tag = tagOf(entry);
    const own = entry.node['text'];
    const value =
      tag === 'h3' || tag === 'h4'
        ? landedText(nodes, entry)
        : typeof own === 'string' && DIGIT.test(own) && own.trim().length <= CLAIM_TEXT_MAX
          ? collapse(own)
          : '';
    if (value !== '' && value !== headline && !claims.includes(value)) claims.push(value);
  }
  return headline === undefined || headline === '' ? { claims } : { headline, claims };
}

/** Quotes after a lead: `: headline "…"`, `; says "…" · "…"`, ` Will say "…"`. */
interface QuoteGroup {
  readonly lead: string;
  readonly quotes: readonly string[];
}

/**
 * One neighbour's line, in the order its parts give way under the ceiling:
 * the head (who and where) is kept, the claims (what it says or will say —
 * what the summary exists to carry) come next, and the purpose, last, is the
 * first to be cut. The purpose used to come BEFORE the claims and the cut fell
 * at the end of the line, so on the verifier's 7-section café plan the summary
 * for section 4 lost "يمن حرازي", "قهوة عربية ١ د.أ", "توصيل مجاني داخل عمّان"
 * and "تحميص يومي" while keeping 140 characters of every purpose
 * (neighbours-real.mjs, 2026-09-28).
 */
interface Line {
  readonly head: string;
  readonly groups: readonly QuoteGroup[];
  /** Ends the claims when there are any. */
  readonly close: string;
  readonly purpose: string;
}

/** The line at `quoteCap` characters a quote and `purposeRoom` for the purpose (its space included). */
function render(line: Line, quoteCap: number, purposeRoom: number): string {
  const groups = line.groups.filter(({ quotes }) => quotes.length > 0);
  const said = groups
    .map(
      ({ lead, quotes }) =>
        `${lead}${quotes.map((quote) => `"${clip(quote, quoteCap)}"`).join(' · ')}`,
    )
    .join('');
  const purpose =
    line.purpose === '' || purposeRoom < PURPOSE_MIN
      ? ''
      : ` ${clip(line.purpose, purposeRoom - 1)}`;
  return `${line.head}${said}${groups.length > 0 ? line.close : ''}${purpose}`;
}

function line(
  label: string,
  plan: PagePlan,
  index: number,
  landed: LandedSections,
): Line | undefined {
  const contract: SectionContract | undefined = plan.sections[index];
  if (contract === undefined) return undefined;
  const head = `${label} — ${String(index + 1)}/${String(plan.sections.length)} "${clip(contract.title, TITLE_MAX)}"`;
  const section = landed.get(contract.key);
  if (contract.role === 'header' || contract.role === 'footer') {
    return {
      head: `${head}: the site ${contract.role}${section === undefined ? ', not written yet' : ''}.`,
      groups: [],
      close: '',
      purpose: '',
    };
  }
  if (section === undefined) {
    return {
      head: `${head} (not written yet):`,
      groups: [{ lead: ' Will say ', quotes: contract.mustSay.slice(0, MAX_PROMISES) }],
      close: '.',
      purpose: collapse(contract.purpose),
    };
  }
  const { headline, claims } = written(section);
  return {
    head: `${head} (written)`,
    groups: [
      ...(headline === undefined ? [] : [{ lead: ': headline ', quotes: [headline] }]),
      { lead: headline === undefined ? ': says ' : '; says ', quotes: claims },
    ],
    close: '.',
    purpose: '',
  };
}

function total(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + text.length, 0) + Math.max(0, texts.length - 1);
}

/**
 * Share `room` among parts that want `wants[i]` each: a part that wants less
 * than its fair share keeps what it wants, and what it leaves goes to the rest.
 */
function share(wants: readonly number[], room: number): number[] {
  const budgets = wants.map(() => 0);
  let left = room;
  let open = wants.length;
  const order = wants.map((want, at) => ({ want, at })).sort((a, b) => a.want - b.want);
  for (const { want, at } of order) {
    const budget = Math.max(0, Math.min(want, Math.floor(left / open)));
    budgets[at] = budget;
    left -= budget;
    open -= 1;
  }
  return budgets;
}

/**
 * The lines under the ceiling, giving way in order: purposes first (shared
 * among the lines that have one), then every quote cut to one shared length no
 * shorter than QUOTE_MIN, then the last quotes of the fullest lines dropped
 * whole. Claims are cut only when the claims alone overflow it.
 */
function fit(lines: readonly Line[], max: number): string {
  const whole = lines.map((each) => render(each, QUOTE_MAX, Number.POSITIVE_INFINITY));
  if (total(whole) <= max) return whole.join('\n');

  const claimsOnly = lines.map((each) => render(each, QUOTE_MAX, 0));
  const room = max - total(claimsOnly);
  if (room >= 0) {
    const wants = lines.map((each) => (each.purpose === '' ? 0 : each.purpose.length + 1));
    const budgets = share(wants, room);
    return lines.map((each, at) => render(each, QUOTE_MAX, budgets[at] ?? 0)).join('\n');
  }

  // The claims alone overflow: the longest quote is cut first, to one shared length.
  let low = QUOTE_MIN;
  let high = QUOTE_MAX;
  const fits = (cap: number) => total(lines.map((each) => render(each, cap, 0))) <= max;
  if (fits(low)) {
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(middle)) low = middle;
      else high = middle - 1;
    }
    return lines.map((each) => render(each, low, 0)).join('\n');
  }

  // Even short quotes overflow: the fullest line gives up its last quote, until it fits.
  let trimmed: Line[] = [...lines];
  const quoteCount = (each: Line) =>
    each.groups.reduce((sum, { quotes }) => sum + quotes.length, 0);
  while (total(trimmed.map((each) => render(each, QUOTE_MIN, 0))) > max) {
    const fullest = trimmed.reduce(
      (best, each, at) => (quoteCount(each) >= quoteCount(trimmed[best] ?? each) ? at : best),
      0,
    );
    const target = trimmed[fullest];
    if (target === undefined || quoteCount(target) === 0) break;
    const lastGroup = target.groups.findLastIndex(({ quotes }) => quotes.length > 0);
    trimmed = trimmed.map((each, at) =>
      at !== fullest
        ? each
        : {
            ...each,
            groups: each.groups.map((group, groupAt) =>
              groupAt === lastGroup ? { ...group, quotes: group.quotes.slice(0, -1) } : group,
            ),
          },
    );
  }
  return clip(trimmed.map((each) => render(each, QUOTE_MIN, 0)).join('\n'), max);
}

/**
 * What section `index`'s writer is told about the sections around it, so it
 * stops writing blind (agent-audit P1-10: writers could not see neighbours,
 * and an empty skeleton region was shown to them as "filled").
 *
 * For the previous and the next section (and the hero, when it is neither),
 * one line each, labelled BEFORE, AFTER and HERO: a landed one
 * (`landed.has(key)`) is summarised from what was WRITTEN — its headline and
 * the claims it already makes — and one not yet landed by its contract
 * (title, the `mustSay` it will say, then its purpose), marked "not written
 * yet". A header or footer is named for what it is and nothing more. Plain
 * text, quoting the page in the plan's language, at most
 * `NEIGHBOUR_SUMMARY_MAX_CHARS` characters: purposes give way before any
 * claim is cut. `''` for a one-section plan or an index outside the plan.
 *
 * Pure and deterministic.
 *
 * @param index position of the section being written, in `plan.sections`.
 * @param landed the sections landed so far, keyed by `SectionContract.key`.
 */
export function summarizeNeighbours(plan: PagePlan, index: number, landed: LandedSections): string {
  const { sections } = plan;
  if (!Number.isInteger(index) || index < 0 || index >= sections.length || sections.length < 2) {
    return '';
  }
  const hero = sections.findIndex(({ role }) => role === 'hero');
  const lines = [
    line('BEFORE', plan, index - 1, landed),
    line('AFTER', plan, index + 1, landed),
    hero !== -1 && Math.abs(hero - index) > 1 ? line('HERO', plan, hero, landed) : undefined,
  ].filter((each): each is Line => each !== undefined);
  return fit(lines, NEIGHBOUR_SUMMARY_MAX_CHARS);
}
