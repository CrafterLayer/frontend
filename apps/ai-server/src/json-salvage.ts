import { jsonrepair } from 'jsonrepair';

/**
 * Bare JSON out of an answer a model dressed up.
 *
 * Every backend does it sometimes — the CLI's Sonnet as readily as a free
 * OpenRouter model: a plan inside a ```json fence, a sentence before or after
 * it, a reasoning model's `<think>` block left in the content, a trailing
 * comma. The object is what `claude.ts` parses, and the plan's CONTENT still
 * decides whether it is valid two layers later; this only undoes the
 * wrappers that would fail it for reasons that have nothing to do with the
 * plan. An answer with no object in it is returned as it was.
 *
 * Then the one defect that is not a wrapper: a miscounted run of closers.
 * `accept` judges the candidates a rebalance produces — a caller that knows
 * the shape it expects passes it, so a run rewritten to parse cannot quietly
 * move a key into the wrong object. Run it ONCE per answer, where the judge
 * is: a caller that only wants to know whether the model's text parses asks
 * `unwrapJson`, which costs a parse, not a search.
 */
export function salvageJson(text: string, accept?: (value: unknown) => boolean): string {
  const unwrapped = objectIn(text);
  const eased = salvageCommas(unwrapped);
  if (parsesAsJson(eased)) return eased;
  const search = new CloserSearch(unwrapped, accept ?? acceptAnything);
  // Every miscount measured on 2026-09-27 was ONE run, so one rewrite away.
  const near = search.run(1);
  if (near !== undefined) return near;
  /*
    Then a general repair, for the defects no closer count explains — a key
    that lost its opening quote, an unescaped quote in a string, a `}` dropped
    between two sibling nodes. After the single rewrites, and only when the
    shape judge approves: on a miscounted run it closes the wrong containers
    (measured: `title` inside `args` in 3 of 5 cases), which the rebalance
    never does. Before the deeper rewrites, though: an answer no single
    rewrite fixes is usually not a closer count at all, and the search would
    spend its whole budget proving that while jsonrepair fixes it in
    milliseconds.
  */
  const repaired = generalRepair(unwrapped);
  if (repaired !== undefined && accept !== undefined && isAccepted(repaired, accept)) {
    return repaired;
  }
  const far = search.run(REBALANCE_MAX_REWRITES);
  if (far !== undefined) return far;
  if (repaired !== undefined && isAccepted(repaired, accept)) return repaired;
  return search.fallback ?? repaired ?? eased;
}

/**
 * The wrappers undone and nothing else — the fence, the sentence around the
 * object, a `<think>` block, trailing commas — so every closer is still the
 * one the model wrote. What a backend shim may hand `claude.ts`, and what a
 * log line checks: a rewrite made here, without the caller's shape judge,
 * would parse and leave the judged salvage in `claude.ts` nothing to judge.
 */
export function unwrapJson(text: string): string {
  return salvageCommas(objectIn(text));
}

function acceptAnything(): boolean {
  return true;
}

function isAccepted(text: string, accept: ((value: unknown) => boolean) | undefined): boolean {
  try {
    return accept === undefined || accept(JSON.parse(text) as unknown);
  } catch {
    return false;
  }
}

/**
 * `jsonrepair`'s answer when it parses to an OBJECT, or undefined. It will
 * turn any prose into a JSON string ("not json at all" → a string), and a
 * string is never a plan — so only an object counts as a repair.
 */
function generalRepair(text: string): string | undefined {
  try {
    const repaired = jsonrepair(text);
    const value = JSON.parse(repaired) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? repaired
      : undefined;
  } catch {
    return undefined;
  }
}

function objectIn(text: string): string {
  // Some providers leave the reasoning model's own <think> block in the content.
  const trimmed = text.replace(/<think>[\s\S]*?<\/think>/giu, '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/u.exec(trimmed);
  if (fenced?.[1] !== undefined) return objectIn(fenced[1]);
  const start = trimmed.indexOf('{');
  if (start < 0) return text;
  const end = trimmed.lastIndexOf('}');
  /*
    What follows the last `}` is a sentence when that `}` closed the object —
    or when the object's closers are miscounted and the text does not go on
    the way JSON would. Otherwise it is the rest of the object, an answer
    that lost its final closer, and cutting there dropped the plan's last key
    (`followUp`, measured) while the shortened plan still passed.
  */
  if (end > start) {
    const through = trimmed.slice(start, end + 1);
    const scan = scanClosers(through).kind;
    const goesOn = /^[,\]]/u.test(trimmed.slice(end + 1).trimStart());
    if (scan === 'balanced' || (scan === 'runs' && !goesOn)) return through;
  }
  return trimmed.slice(start);
}

/** Whether `JSON.parse` accepts the text as it is. */
export function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A trailing comma is the commonest way a model breaks otherwise-sound JSON.
 * Eased only when the text does not parse as it is and does afterwards, so a
 * valid answer is never touched and an invalid one is never made worse.
 */
function salvageCommas(text: string): string {
  if (parsesAsJson(text)) return text;
  const eased = text.replace(/,\s*([}\]])/gu, '$1');
  return parsesAsJson(eased) ? eased : text;
}

type Opener = '{' | '[';

interface ClosingRun {
  readonly start: number;
  readonly end: number;
  readonly closers: number;
  /** The containers open when the run begins, outermost first. */
  readonly stack: readonly Opener[];
}

type Scan =
  | { readonly kind: 'balanced' }
  /**
   * A run of closers that pops the wrong kind, or closes the root with text
   * still to come — and the run before it, because a run with one closer too
   * many can still match (it shuts the command a level early) and the defect
   * only surfaces at the next run.
   */
  | { readonly kind: 'runs'; readonly runs: readonly ClosingRun[] }
  /** The text ended with containers (and maybe a string) still open: a cut-off answer. */
  | { readonly kind: 'open'; readonly stack: readonly Opener[]; readonly inString: boolean };

function closerOf(opener: Opener): '}' | ']' {
  return opener === '{' ? '}' : ']';
}

function isCloser(ch: string | undefined): boolean {
  return ch === '}' || ch === ']';
}

function isSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

function closingRun(text: string, start: number, stack: readonly Opener[]): ClosingRun {
  let end = start;
  let closers = 0;
  while (end < text.length && (isCloser(text[end]) || isSpace(text[end]))) {
    if (isCloser(text[end])) closers += 1;
    end += 1;
  }
  return { start, end, closers, stack };
}

/** The first run of closers that cannot be right, tracking strings so their brackets never count. */
function scanClosers(text: string): Scan {
  const stack: Opener[] = [];
  let inString = false;
  let escaped = false;
  let runStart = -1;
  let runStack: readonly Opener[] = [];
  let previous: { readonly start: number; readonly stack: readonly Opener[] } | undefined;
  const defectiveRun = (): Scan => ({
    kind: 'runs',
    runs: [
      closingRun(text, runStart, runStack),
      ...(previous === undefined ? [] : [closingRun(text, previous.start, previous.stack)]),
    ],
  });
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '}' || ch === ']') {
      if (runStart < 0) {
        runStart = index;
        runStack = [...stack];
      }
      const open = stack.pop();
      if (open === undefined || closerOf(open) !== ch) return defectiveRun();
      if (stack.length === 0 && text.slice(index + 1).trim() !== '') return defectiveRun();
      continue;
    }
    if (isSpace(ch)) continue;
    if (runStart >= 0) previous = { start: runStart, stack: runStack };
    runStart = -1;
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
  }
  return stack.length > 0 || inString ? { kind: 'open', stack, inString } : { kind: 'balanced' };
}

/** How many containers a rewritten run pops, nearest the model's own count first. */
function popCounts(written: number, open: number): number[] {
  const counts: number[] = [];
  for (let distance = 0; counts.length <= open; distance += 1) {
    for (const count of distance === 0 ? [written] : [written - distance, written + distance]) {
      if (count >= 0 && count <= open && !counts.includes(count)) counts.push(count);
    }
    if (written - distance < 0 && written + distance > open) break;
  }
  return counts;
}

function closersFor(stack: readonly Opener[], count: number): string {
  return stack
    .slice(stack.length - count)
    .reverse()
    .map(closerOf)
    .join('');
}

/** A cut-off answer, closed: the open string ended, a dangling separator dropped, every container shut. */
function closeOpen(text: string, stack: readonly Opener[], inString: boolean): string {
  let closed = inString ? `${text}"` : text.trimEnd();
  if (closed.endsWith(',')) closed = closed.slice(0, -1);
  if (closed.endsWith(':')) closed = `${closed}null`;
  return `${closed}${closersFor(stack, stack.length)}`;
}

function parsedValue(text: string): { readonly text: string; readonly value: unknown } | undefined {
  for (const candidate of [text, text.replace(/,\s*([}\]])/gu, '$1')]) {
    try {
      return { text: candidate, value: JSON.parse(candidate) as unknown };
    } catch {
      // Try the comma-eased form, then give up on this candidate.
    }
  }
  return undefined;
}

/** Candidates a rebalance may try before it gives up; each costs one scan and at most one parse. */
const REBALANCE_BUDGET = 800;
/**
 * Characters a rebalance may scan in all, summed over its candidates. The
 * candidate count alone let one 43k-character answer that no rewrite could
 * fix block the event loop for eight seconds (measured 2026-09-28), in the
 * process that streams every other section writer's status. This holds the
 * same answer to a few hundred milliseconds and still buys dozens of full
 * rewrites of a large one: every single-run fix measured took at most six
 * candidates, a two-run fix about thirty.
 */
const REBALANCE_WORK = 2_500_000;
/** Separate runs a single answer may have wrong before the answer is not worth saving. */
const REBALANCE_MAX_REWRITES = 4;

interface Candidate {
  readonly text: string;
  readonly rewrites: number;
}

/**
 * An answer whose only defect is a miscounted run of closers, made whole.
 *
 * Measured on 2026-09-27: 6 of 8 section plans the CLI's Sonnet wrote failed to
 * parse, and every one failed inside the run of closers that ends a deeply
 * nested tree (`…"}]}]}]}]}]}]}]}}],"followUp"`) — one too many, one too few,
 * or a `]` where a `}` belonged. A model does not lose track of WHAT it meant,
 * only of how many levels it had to climb back out, and the containers that
 * are actually open decide what each closer must be. So each defective run is
 * rewritten as the closers for n open containers, n nearest the model's own
 * count first, and the rewrites are searched breadth-first: the answer with
 * the fewest rewritten runs that parses AND that `accept` approves wins. With
 * no approved candidate, the first one that parses is returned so the plan's
 * validator can name what is wrong with it; with none, undefined.
 */
export function rebalanceClosers(
  text: string,
  accept: (value: unknown) => boolean = acceptAnything,
): string | undefined {
  const search = new CloserSearch(text, accept);
  return search.run(REBALANCE_MAX_REWRITES) ?? search.fallback;
}

/**
 * The breadth-first search behind `rebalanceClosers`, able to stop between
 * levels and go on later from where it stopped — so `salvageJson` can try
 * the general repair between the single rewrites and the deeper ones without
 * searching any level twice. One budget covers every level.
 */
class CloserSearch {
  private readonly queue: Candidate[];
  private readonly accept: (value: unknown) => boolean;
  private candidates = REBALANCE_BUDGET;
  private work = REBALANCE_WORK;
  /** The first candidate that parsed but that `accept` refused. */
  fallback: string | undefined;

  constructor(text: string, accept: (value: unknown) => boolean) {
    this.queue = [{ text, rewrites: 0 }];
    this.accept = accept;
  }

  /** On until a candidate is accepted, the next one rewrites more than `rewrites` runs, or the budget is spent. */
  run(rewrites: number): string | undefined {
    for (let next = this.queue[0]; next !== undefined; next = this.queue[0]) {
      if (next.rewrites > rewrites || this.candidates <= 0 || this.work <= 0) return undefined;
      this.queue.shift();
      this.candidates -= 1;
      this.work -= next.text.length;
      const found = scanClosers(next.text);
      if (found.kind === 'balanced') {
        const parsed = parsedValue(next.text);
        if (parsed !== undefined) {
          if (this.accept(parsed.value)) return parsed.text;
          this.fallback ??= parsed.text;
        }
        continue;
      }
      if (next.rewrites < REBALANCE_MAX_REWRITES) this.queue.push(...rewritesOf(next, found));
    }
    return undefined;
  }
}

/**
 * The candidates one defect allows, each rewriting one run more than `from`
 * did — nearest the model's own count first ACROSS the runs, not run by run,
 * so the likeliest fix is among the first few whichever run holds it: a large
 * answer affords only a few dozen scans, and a deep run offers twenty counts.
 */
function rewritesOf(from: Candidate, found: Exclude<Scan, { kind: 'balanced' }>): Candidate[] {
  const rewrites = from.rewrites + 1;
  if (found.kind === 'open') {
    return [{ text: closeOpen(from.text, found.stack, found.inString), rewrites }];
  }
  const perRun = found.runs.map((run) => {
    const rest = from.text.slice(run.end);
    const written = from.text.slice(run.start, run.end).replace(/\s/gu, '');
    const candidates: Candidate[] = [];
    for (const count of popCounts(run.closers, run.stack.length)) {
      // Closing the root is only right when nothing follows the run.
      if (count === run.stack.length && rest.trim() !== '') continue;
      // The run exactly as written is the defect, not a candidate.
      const rewritten = closersFor(run.stack, count);
      if (rewritten === written) continue;
      candidates.push({ text: `${from.text.slice(0, run.start)}${rewritten}${rest}`, rewrites });
    }
    return candidates;
  });
  const interleaved: Candidate[] = [];
  for (let index = 0; perRun.some((candidates) => index < candidates.length); index += 1) {
    for (const candidates of perRun) {
      const candidate = candidates[index];
      if (candidate !== undefined) interleaved.push(candidate);
    }
  }
  return interleaved;
}

/** `JSON.parse`'s own complaint, with the position it names — the owner's shortest path to the defect. */
export function jsonParseError(text: string): string | undefined {
  try {
    JSON.parse(text);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
