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

const QUOTE_MAX = 70;
const PURPOSE_MAX = 140;
const MAX_CLAIMS = 4;
const MAX_PROMISES = 3;
/** Short enough to be a claim (a stat, a price, a card title), not a paragraph. */
const CLAIM_TEXT_MAX = 90;
const DIGIT = /\p{Nd}/u;

function collapse(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

/** Cut to `max` characters, marking the cut. */
function clip(value: string, max: number): string {
  const text = collapse(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function quoted(values: readonly string[]): string {
  return values.map((value) => `"${clip(value, QUOTE_MAX)}"`).join(' · ');
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

function line(
  label: string,
  plan: PagePlan,
  index: number,
  landed: LandedSections,
): string | undefined {
  const contract: SectionContract | undefined = plan.sections[index];
  if (contract === undefined) return undefined;
  const head = `${label} — ${String(index + 1)}/${String(plan.sections.length)} "${clip(contract.title, QUOTE_MAX)}"`;
  const section = landed.get(contract.key);
  if (contract.role === 'header' || contract.role === 'footer') {
    return `${head}: the site ${contract.role}${section === undefined ? ', not written yet' : ''}.`;
  }
  if (section === undefined) {
    const promises = contract.mustSay.slice(0, MAX_PROMISES);
    return `${head} (not written yet): ${clip(contract.purpose, PURPOSE_MAX)}${
      promises.length === 0 ? '' : ` Will say ${quoted(promises)}.`
    }`;
  }
  const { headline, claims } = written(section);
  return `${head} (written)${headline === undefined ? '' : `: headline ${quoted([headline])}`}${
    claims.length === 0 ? '' : `; says ${quoted(claims)}`
  }.`;
}

/**
 * Fit the lines under the ceiling: a line shorter than its fair share keeps
 * its length, and the room it leaves goes to the others — so a one-line
 * chrome neighbour never costs a written one its claims.
 */
function fit(lines: readonly string[], max: number): string {
  const joined = lines.join('\n');
  if (joined.length <= max) return joined;
  let room = max - (lines.length - 1);
  let open = lines.length;
  const budgets = new Map<number, number>();
  const order = lines
    .map((text, at) => ({ text, at }))
    .sort((a, b) => a.text.length - b.text.length);
  for (const { text, at } of order) {
    const share = Math.floor(room / open);
    const budget = Math.min(text.length, share);
    budgets.set(at, budget);
    room -= budget;
    open -= 1;
  }
  return lines.map((text, at) => clip(text, budgets.get(at) ?? text.length)).join('\n');
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
 * (title, purpose, `mustSay`), marked "not written yet". A header or footer is
 * named for what it is and nothing more. Plain text, quoting the page in the
 * plan's language, at most `NEIGHBOUR_SUMMARY_MAX_CHARS` characters. `''` for
 * a one-section plan or an index outside the plan.
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
  ].filter((text): text is string => text !== undefined);
  return fit(lines, NEIGHBOUR_SUMMARY_MAX_CHARS);
}
