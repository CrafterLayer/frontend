import {
  ADDABLE_PAGE_NOUNS,
  ADVERBIAL_START_OVERS,
  BARE_START_OVER_WORDS,
  CLEAR_ALL,
  COMPARATIVES,
  CONTROL_FILLERS,
  CONTROL_WORDS,
  COPULAS,
  DEFINITE_AR,
  DEFINITE_EN,
  GREETINGS,
  INDEFINITE_EN,
  INTERROGATIVE_PAIRS,
  INTERROGATIVES,
  NEW_WORDS_AR,
  NEW_WORDS_EN,
  NOT_THE_ARTICLE,
  NOUN_PAIRS_AR,
  NOUNS,
  OBJECT_FILLERS,
  OBJECT_PRONOUNS,
  OPENERS,
  PAGE_NAME_PAIRS_AR,
  PAGE_NAMES_AR,
  PAGE_NAMES_EN,
  PAGE_WORDS,
  PHRASE_STOPS,
  PLURAL_PAGE_NOUNS,
  PRONOUNS,
  REPLACE_STRONG,
  REPLACE_WEAK,
  START_OVER_LINKS,
  START_OVER_OBJECTS_AR,
  SUGGESTION_OPENERS,
  THIRD_PERSON_WANTS,
  VERB_PAIRS_EN,
  VERBS_AR,
  VERBS_EN,
  type NounCategory,
  type VerbKind,
} from './intent-lexicon';
import {
  findPhrase,
  phraseAt,
  readingOf,
  readsAs,
  tokenize,
  type IntentToken,
} from './intent-tokens';
import { normalizeIntentText } from './normalize-arabic';

/**
 * WHAT A REQUEST IS FOR — decided by rules, before any model is asked.
 *
 * ## Why this replaced keyword routing
 *
 * The panel used to decide "build a whole page, or not?" by asking the skill
 * registry whether an archetype skill auto-activated, and activation is a
 * substring match over keywords (resolve-skills.ts `matchesAuto`). A keyword
 * says what a request MENTIONS, not what it ASKS FOR: "change the wedding date"
 * mentions a wedding, so it scaffolded a wedding page on top of the one being
 * edited, and "Build a website for my bakery" mentioned no listed keyword, so
 * it never reached the build. Measured (agent-audit §2 P0-1 / P1-5,
 * `routing.mjs`, 2026-09-28): 8 of 12 edits misrouted into a build, 14 of 17
 * page asks missed. It also never looked at the page — so a page ask on the
 * default workspace appended a café under a 17-section demo (P1-15).
 *
 * ## How it decides
 *
 * The request is folded (`normalizeIntentText`), split into words with their
 * Arabic clitics peeled (`tokenize`), and read for a few structural signals:
 * a VERB and the noun phrase that is its OBJECT ("build | a website"), whether
 * that object is DEFINITE (the page that exists) or not (one to make), whether
 * the words ask for several PAGES, to START OVER, for a NEW page, or to ADD a
 * SECTION. The page's own state — empty, only an unfilled skeleton, or content
 * — then decides between "build it" and "edit it", and where a build goes.
 *
 * ## What it will not do
 *
 * Guess past the words. A page with content is edited unless the request
 * explicitly asks for a page ("build a website…", "a new page", "start over");
 * a bare subject ("a bakery in Amman") is a brief only on an empty page.
 * Confidence says how explicit the words were, so a host can confirm the
 * uncertain routes instead of acting on them. No model is called: the audit's
 * plan puts a small classification call behind the ambiguous cases, and this
 * is the layer that decides which cases those are.
 */

export const INTENT_KINDS = [
  'build-page',
  'build-site',
  'add-section',
  'edit',
  'question',
] as const;

/**
 * - `build-page` — one whole page, written section by section.
 * - `build-site` — several named or counted pages.
 * - `add-section` — one new section on the page that exists.
 * - `edit` — a change to what is already there (or pointed at).
 * - `question` — an answer in words; nothing is written.
 */
export type IntentKind = (typeof INTENT_KINDS)[number];

/**
 * Where a build or a new section lands.
 * - `new-page` — beside the page that exists, which is left untouched.
 * - `replace` — the build owns this page: it is empty, holds only an unfilled
 *   skeleton, or the request said to start over.
 * - `append` — added to this page, after what is there.
 */
export type IntentTarget = 'new-page' | 'replace' | 'append';

/** The three facts about a page the router reads (see `summarizeDocumentForIntent`). */
export interface IntentDocumentSummary {
  /** Nodes under the root, the root itself excluded. Zero is an empty page. */
  readonly nodeCount: number;
  /** Every node is an unfilled build placeholder: nothing a person would keep. */
  readonly placeholderOnly: boolean;
  /** The top-level sections' names, in page order. */
  readonly sectionLabels: readonly string[];
}

export interface RouteIntentInput {
  /** What the person typed, as typed. */
  readonly request: string;
  /**
   * The page the request is about. Absent means UNKNOWN, and unknown is read
   * as a page with content — the reading that never turns an edit into a build.
   */
  readonly document?: IntentDocumentSummary;
  /** Blocks the person pointed at (canvas selection or @mentions), the page root excluded. */
  readonly selection?: readonly string[];
}

export interface IntentRoute {
  readonly kind: IntentKind;
  /** 0–1: how explicitly the words asked for this. Below ~0.6, confirm before acting. */
  readonly confidence: number;
  /** Which rule decided, in words, for logs and tests. Not written for the person. */
  readonly reason: string;
  /** Present for a build or a section; absent for an edit or a question. */
  readonly target?: IntentTarget;
}

/** Whether the route takes a build — a page or a site — rather than one ordinary run. */
export function isBuildIntent(route: IntentRoute): boolean {
  return route.kind === 'build-page' || route.kind === 'build-site';
}

/*
  Confidence, as a small table rather than numbers scattered through the rules,
  so the ORDER of trust is readable in one place: a counted page ask beats a
  named one; a verb with its object beats a bare noun phrase; the same ask is
  surer on an empty page than over content it would sit beside.
*/
const CONFIDENCE = {
  interrogative: 0.9,
  trailingQuestion: 0.75,
  greeting: 0.7,
  siteCounted: 0.9,
  siteNamed: 0.8,
  startOver: 0.85,
  /*
    Below the ~0.6 confirm line on purpose: "start over" with nothing about
    what replaces the page would wipe a page with content for a build that
    has to invent its own brief (wave-1 verifier, 2026-09-28).
  */
  startOverBare: 0.5,
  addSection: 0.85,
  newPage: 0.85,
  createOnEmpty: 0.9,
  createBeside: 0.75,
  phraseOnEmpty: 0.8,
  phraseBeside: 0.6,
  definiteOnEmpty: 0.7,
  briefOnEmpty: 0.6,
  editPointed: 0.85,
  editNamed: 0.85,
  editVerb: 0.8,
  editPointedOverBuild: 0.7,
  editDefinite: 0.5,
  editOnEmpty: 0.5,
  editDefault: 0.6,
  control: 0.4,
} as const;

type Canvas = 'empty' | 'placeholders' | 'content' | 'unknown';

function canvasOf(document: IntentDocumentSummary | undefined): Canvas {
  if (document === undefined) return 'unknown';
  if (document.nodeCount <= 0) return 'empty';
  return document.placeholderOnly ? 'placeholders' : 'content';
}

/** Nothing on the page is worth keeping, so a build may own it. */
function ownable(canvas: Canvas): boolean {
  return canvas === 'empty' || canvas === 'placeholders';
}

function route(
  kind: IntentKind,
  confidence: number,
  reason: string,
  target?: IntentTarget,
): IntentRoute {
  return Object.freeze(
    target === undefined ? { kind, confidence, reason } : { kind, confidence, reason, target },
  );
}

/** Decide what a request is for. Pure: the same input always routes the same way. */
export function routeIntent(input: RouteIntentInput): IntentRoute {
  const folded = normalizeIntentText(input.request);
  const all = tokenize(folded);
  if (all.length === 0) return route('question', 0, 'the request says nothing');
  if (all.every((token) => readsAs(token, GREETINGS))) {
    return route('question', CONFIDENCE.greeting, 'a greeting, not a request');
  }
  const labels = input.document?.sectionLabels ?? [];
  const opened = stripOpeners(all);
  const suggestion = stripSuggestion(opened.tokens, folded, labels);
  if (suggestion === undefined) {
    return routeWords(input, folded, labels, opened.tokens, opened.polite);
  }
  const routed = routeWords(input, folded, labels, suggestion.rest, true);
  return route(
    routed.kind,
    routed.confidence,
    `a suggestion (“${suggestion.opener}”), ${routed.reason}`,
    routed.target,
  );
}

/** The request's own words, past its courtesy — and past a suggestion's opening — routed. */
function routeWords(
  input: RouteIntentInput,
  folded: string,
  labels: readonly string[],
  tokens: readonly IntentToken[],
  polite: boolean,
): IntentRoute {
  const asking = interrogative(tokens);
  if (asking !== undefined) {
    return route('question', CONFIDENCE.interrogative, `opens with a question (“${asking}”)`);
  }
  const steering = steersTheRun(tokens);
  if (steering !== undefined) {
    return route(
      'edit',
      CONFIDENCE.control,
      `steers the run or its history (“${steering}”), which is never a brief`,
    );
  }

  const read = readSignals(tokens, folded, labels);
  if (!polite && /\?[\s.!)]*$/u.test(folded) && !read.acting) {
    return route(
      'question',
      CONFIDENCE.trailingQuestion,
      'ends in a question mark and asks for nothing',
    );
  }

  const canvas = canvasOf(input.document);
  const pointed = (input.selection ?? []).length > 0;
  const owned = ownable(canvas);

  if (read.site !== undefined) {
    return route(
      'build-site',
      read.site.counted ? CONFIDENCE.siteCounted : CONFIDENCE.siteNamed,
      read.site.reason,
      owned ? 'replace' : 'new-page',
    );
  }
  if (read.startOver !== undefined) {
    const { phrase, namesPage, brief } = read.startOver;
    /*
      "Redesign it from scratch" with the hero selected restarts the hero. A
      start-over that NAMES the page ("rebuild the page") is the page's
      whatever is selected.
    */
    if (pointed && !namesPage) {
      return route(
        'edit',
        CONFIDENCE.editPointed,
        `a block is pointed at, and “${phrase}” names no page`,
      );
    }
    return brief
      ? route('build-page', CONFIDENCE.startOver, `asks to start over (“${phrase}”)`, 'replace')
      : route(
          'build-page',
          CONFIDENCE.startOverBare,
          `asks to start over (“${phrase}”), and says nothing about what replaces the page`,
          'replace',
        );
  }
  if (read.newPage !== undefined) {
    /*
      "A new page" on a page with nothing to keep takes its place: built
      beside an empty page, it leaves a blank page behind for nothing.
    */
    return route(
      'build-page',
      CONFIDENCE.newPage,
      `asks for a new page (“${read.newPage}”)`,
      owned ? 'replace' : 'new-page',
    );
  }
  if (read.createPage !== undefined) {
    return owned
      ? route(
          'build-page',
          CONFIDENCE.createOnEmpty,
          `asks for a page (“${read.createPage}”) on a page with nothing to keep`,
          'replace',
        )
      : route(
          'build-page',
          CONFIDENCE.createBeside,
          `asks for a page (“${read.createPage}”) where content already is`,
          'new-page',
        );
  }
  /*
    After the page asks, deliberately: "create a landing page and add a
    pricing section" is a page that has a pricing section, not one section.
  */
  if (read.addSection !== undefined) {
    return route(
      'add-section',
      CONFIDENCE.addSection,
      `asks for a new section (“${read.addSection}”)`,
      'append',
    );
  }

  /*
    WEAK build signals from here on: a noun phrase with no verb, a definite
    page ("build MY portfolio"), a bare subject on an empty page. A person who
    has pointed at a block is talking about that block, and none of these
    overrides that — only the explicit asks above do.
  */
  const weakBuild = read.nounPhrase !== undefined || read.definitePage !== undefined || owned;
  if (pointed && weakBuild) {
    return route(
      'edit',
      CONFIDENCE.editPointedOverBuild,
      'a block is pointed at, and the words do not explicitly ask for a page',
    );
  }
  if (read.nounPhrase !== undefined) {
    return owned
      ? route(
          'build-page',
          CONFIDENCE.phraseOnEmpty,
          `names a page (“${read.nounPhrase}”) on a page with nothing to keep`,
          'replace',
        )
      : route(
          'build-page',
          CONFIDENCE.phraseBeside,
          `names a page (“${read.nounPhrase}”) where content already is`,
          'new-page',
        );
  }
  if (read.definitePage !== undefined) {
    return owned
      ? route(
          'build-page',
          CONFIDENCE.definiteOnEmpty,
          `asks to make “${read.definitePage}” on a page with nothing to keep`,
          'replace',
        )
      : route(
          'edit',
          CONFIDENCE.editDefinite,
          `names this page (“${read.definitePage}”); rebuilding it needs an explicit “start over”`,
        );
  }
  if (owned) {
    /*
      An add or a change aimed at the page's parts is still that — "add a dua
      under the hero" on an empty page has nothing to go under, and building a
      whole page around it would answer a request nobody made. So is a "make"
      whose object points back ("make it pop"): there is nothing to point at.
    */
    return read.changes || read.adds || read.refersBack
      ? route(
          'edit',
          CONFIDENCE.editOnEmpty,
          'asks to change a page that has nothing to change yet',
        )
      : route(
          'build-page',
          CONFIDENCE.briefOnEmpty,
          'a request on a page with nothing to keep is the brief for one',
          'replace',
        );
  }

  if (pointed) return route('edit', CONFIDENCE.editPointed, 'a block is pointed at');
  if (read.label !== undefined) {
    return route('edit', CONFIDENCE.editNamed, `names the page’s own “${read.label}” section`);
  }
  if (read.changes) return route('edit', CONFIDENCE.editVerb, 'asks to change what is there');
  return route(
    'edit',
    CONFIDENCE.editDefault,
    'the page has content and the words ask for no new page',
  );
}

/* ── Openers and questions ─────────────────────────────────────────────── */

/**
 * The request without its courtesy, vocatives and greetings, and whether any
 * of it was courtesy. Never strips the last word: "please" alone stays
 * "please", and "hi" alone was answered as a greeting before this runs.
 */
function stripOpeners(tokens: readonly IntentToken[]): {
  tokens: readonly IntentToken[];
  polite: boolean;
} {
  let start = 0;
  let polite = false;
  for (let pass = 0; pass < 4; pass += 1) {
    const opener = OPENERS.find(
      (candidate) =>
        phraseAt(tokens, start, candidate.words) && start + candidate.words.length < tokens.length,
    );
    if (opener === undefined) break;
    start += opener.words.length;
    polite ||= opener.polite;
  }
  return { tokens: tokens.slice(start), polite };
}

/**
 * The request past a suggestion's opening — "why not | add a pricing section",
 * "ليش ما | تضيف قسم آراء" — when what follows asks for something, read as the
 * polite request it is; undefined when it does not open with one, or when
 * what follows asks for nothing ("why not?", "ليش ما اشتغل؟").
 */
function stripSuggestion(
  tokens: readonly IntentToken[],
  folded: string,
  labels: readonly string[],
): { readonly opener: string; readonly rest: readonly IntentToken[] } | undefined {
  const opener = SUGGESTION_OPENERS.find(
    (words) => words.length < tokens.length && phraseAt(tokens, 0, words),
  );
  if (opener === undefined) return undefined;
  const rest = tokens.slice(opener.length);
  return readSignals(rest, folded, labels).acting ? { opener: opener.join(' '), rest } : undefined;
}

/** The question word the request opens with, if it opens with one. */
function interrogative(tokens: readonly IntentToken[]): string | undefined {
  const pair = INTERROGATIVE_PAIRS.find((candidate) => phraseAt(tokens, 0, candidate));
  if (pair !== undefined) return pair.join(' ');
  const first = tokens[0];
  return first !== undefined && INTERROGATIVES.has(first.raw) ? first.raw : undefined;
}

/**
 * The control word, when the request only steers the run or the history —
 * "undo", "stop", "try again", "كمل" — with nothing but its fillers beside it.
 * "Stop the carousel autoplay" names something else, so it is read as the
 * edit it is.
 */
function steersTheRun(tokens: readonly IntentToken[]): string | undefined {
  const steering = tokens.find((token) => readsAs(token, CONTROL_WORDS));
  if (steering === undefined) return undefined;
  const only = tokens.every(
    (token) => readsAs(token, CONTROL_WORDS) || readsAs(token, CONTROL_FILLERS),
  );
  return only ? steering.raw : undefined;
}

/* ── Nouns, verbs and the phrases between them ─────────────────────────── */

interface Noun {
  readonly index: number;
  readonly category: NounCategory;
  readonly stem: string;
  readonly definite: boolean;
  /** Tokens the noun spans: 2 for "معرض اعمال". */
  readonly width: number;
}

interface Verb {
  readonly index: number;
  readonly kind: VerbKind;
  readonly width: number;
}

/**
 * A request read ONCE: the noun each token starts, and the verbs in order.
 *
 * Every signal below asks "is there a noun here?" of the same tokens, and the
 * first version asked afresh each time — about 0.3 ms a request, most of it
 * re-reading the same words (profiled 2026-09-28). A person sends one request
 * at a time, so this was never slow to see, but a router a host may one day run
 * on every keystroke should cost what one pass over the words costs.
 */
interface Scan {
  readonly tokens: readonly IntentToken[];
  readonly nouns: readonly (Noun | undefined)[];
  readonly verbs: readonly Verb[];
}

function scanOf(tokens: readonly IntentToken[]): Scan {
  const verbs: Verb[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const found = verbAt(tokens, index);
    if (found === undefined) continue;
    verbs.push(found);
    index += found.width - 1;
  }
  return { tokens, nouns: tokens.map((_token, index) => nounAt(tokens, index)), verbs };
}

function nounAt(tokens: readonly IntentToken[], index: number): Noun | undefined {
  const token = tokens[index];
  if (token === undefined) return undefined;
  if (token.arabic) {
    for (const [first, second, category] of NOUN_PAIRS_AR) {
      if (!phraseAt(tokens, index, [first, second])) continue;
      const reading = readingOf(token, (stem) => stem === first);
      return { index, category, stem: first, definite: reading?.definite ?? false, width: 2 };
    }
  }
  const reading = readingOf(token, (stem) => NOUNS.has(stem));
  const category = reading === undefined ? undefined : NOUNS.get(reading.stem);
  if (reading === undefined || category === undefined) return undefined;
  return { index, category, stem: reading.stem, definite: reading.definite, width: 1 };
}

/*
  The Arabic verb patterns, one alternation per KIND. The lexicon keeps one
  readable, separately tested pattern per verb; tried one by one that was ~45
  regex runs for every Arabic word. Joined per kind it is five, in the same
  order the lexicon lists them, so the first kind to match still wins.
*/
const VERB_KIND_ORDER: readonly VerbKind[] = ['create', 'want', 'make', 'add', 'edit'];
const ARABIC_VERBS: readonly (readonly [RegExp, VerbKind])[] = VERB_KIND_ORDER.map(
  (kind): readonly [RegExp, VerbKind] => [
    new RegExp(
      `^(?:${VERBS_AR.filter(([, of]) => of === kind)
        .map(([pattern]) => pattern.source.replace(/^\^/u, '').replace(/\$$/u, ''))
        .join('|')})$`,
      'u',
    ),
    kind,
  ],
);

function verbAt(tokens: readonly IntentToken[], index: number): Verb | undefined {
  const token = tokens[index];
  if (token === undefined) return undefined;
  if (token.arabic) {
    const hit = ARABIC_VERBS.find(([pattern]) => pattern.test(token.raw));
    return hit === undefined ? undefined : { index, kind: hit[1], width: 1 };
  }
  for (const [first, second, kind] of VERB_PAIRS_EN) {
    if (phraseAt(tokens, index, [first, second])) return { index, kind, width: 2 };
  }
  const kind = VERBS_EN.get(token.raw);
  return kind === undefined ? undefined : { index, kind, width: 1 };
}

/** Arabic words that open a noun phrase, whatever letter they start with. */
const PHRASE_HEADS_AR: ReadonlySet<string> = new Set([
  ...NOUNS.keys(),
  ...NOUN_PAIRS_AR.map(([first]) => first),
]);

/**
 * Whether a token ends a noun phrase: a preposition, a conjunction, or — in
 * Arabic, where "for" and "with" are glued on — a word that carries one
 * ("لمطعم", "للصفحه", "بصفحات"). A listed noun that merely STARTS with ل or ب
 * ("لاندنج", "بروفايل") is a noun, not a preposition.
 */
function endsPhrase(token: IntentToken): boolean {
  if (PHRASE_STOPS.has(token.raw)) return true;
  if (!token.arabic || token.raw.length < 4 || PHRASE_HEADS_AR.has(token.raw)) return false;
  return /^[وف]?(?:لل|ل|بال|ب|كال)/u.test(token.raw);
}

/** Words a page's name may carry before the page word: "about US page". */
const NAME_TAILS_EN: ReadonlySet<string> = new Set(['us', 'me']);

/**
 * `endsPhrase`, read in place: a page's NAME is not a preposition.
 *
 * "About" is both, and read only as the preposition it ended "add an about
 * page" before "page" was reached — so the request found no page, and the
 * landing workspace's own "about" section claimed it as an edit (probed
 * 2026-09-28). A page name followed by the page word, directly or after
 * "us"/"me", is part of the phrase; "a section about the page" still stops.
 */
function stopsPhraseAt(tokens: readonly IntentToken[], index: number): boolean {
  const token = tokens[index];
  if (token === undefined) return true;
  if (!endsPhrase(token)) return false;
  if (!PAGE_NAMES_EN.has(token.raw)) return true;
  let next = index + 1;
  if (NAME_TAILS_EN.has(tokens[next]?.raw ?? '')) next += 1;
  const after = tokens[next];
  return after === undefined || after.breakBefore || !readsAs(after, PAGE_WORDS);
}

const PHRASE_MAX = 6;

interface Phrase {
  /** The noun the phrase is ABOUT: the last in English, the first in Arabic. */
  readonly head: Noun | undefined;
  readonly headDefinite: boolean;
}

/**
 * The noun phrase starting at `from`: what a verb is asked to act on.
 *
 * English puts the head LAST ("a landing page", "an invite friends button" —
 * a button, not an invitation); Arabic puts it FIRST ("قسم اسعار" — a section,
 * of prices). The phrase ends at a break, a preposition, or six words.
 */
function phraseFrom(scan: Scan, from: number, skipFillers: boolean): Phrase {
  const { tokens } = scan;
  let start = from;
  if (skipFillers) {
    while (start < tokens.length && readsAs(tokens[start], OBJECT_FILLERS)) start += 1;
  }
  const nouns: Noun[] = [];
  for (let index = start; index < Math.min(tokens.length, start + PHRASE_MAX); index += 1) {
    const token = tokens[index];
    if (token === undefined) break;
    if (index > from && token.breakBefore) break;
    if (stopsPhraseAt(tokens, index)) break;
    const noun = scan.nouns[index];
    if (noun === undefined) continue;
    nouns.push(noun);
    index += noun.width - 1;
  }
  const head = pickHead(nouns);
  return { head, headDefinite: head === undefined ? false : definiteAt(tokens, start, head) };
}

function pickHead(nouns: readonly Noun[]): Noun | undefined {
  const first = nouns[0];
  if (first === undefined) return undefined;
  return ARABIC_STEM.test(first.stem) ? first : nouns[nouns.length - 1];
}

const ARABIC_STEM = /[\u0600-\u06FF]/u;

/**
 * Whether the head names something that exists. Arabic marks it on the word
 * (ال, "my"), or with a demonstrative before it; English with the nearest
 * determiner before it inside the phrase — "the landing page" is the page on
 * screen, "a landing page" is one to make, and a bare noun is one to make.
 */
function definiteAt(tokens: readonly IntentToken[], start: number, head: Noun): boolean {
  if (head.definite) return true;
  for (let index = head.index - 1; index >= start; index -= 1) {
    const raw = tokens[index]?.raw ?? '';
    if (DEFINITE_EN.has(raw) || DEFINITE_AR.has(raw)) return true;
    if (INDEFINITE_EN.has(raw)) return false;
  }
  return false;
}

/** A noun naming a whole page or site — the proof a build needs. */
type PageNoun = Noun & { readonly category: 'page' | 'site' };

const isPageLevel = (noun: Noun | undefined): noun is PageNoun =>
  noun !== undefined && (noun.category === 'page' || noun.category === 'site');

/** The word a noun was written as, for a reason a person can match to their request. */
const spelled = (scan: Scan, noun: Noun): string => scan.tokens[noun.index]?.raw ?? noun.stem;

/* ── Signals ───────────────────────────────────────────────────────────── */

interface Signals {
  /** Any verb, comparative or page-naming phrase: the request asks for SOMETHING. */
  readonly acting: boolean;
  /** An edit verb or a comparative: it asks to change what exists. */
  readonly changes: boolean;
  /** An add verb: it asks to put something into what exists. */
  readonly adds: boolean;
  /** A "make" whose object points back at what exists: "make it pop", "خليها". */
  readonly refersBack: boolean;
  readonly site?: { readonly counted: boolean; readonly reason: string };
  /** The PAGE starts over (a start-over aimed at one part is an edit, and counts as `changes`). */
  readonly startOver?: PageStartOver;
  readonly addSection?: string;
  readonly newPage?: string;
  /** A verb whose object is a page not yet made: "build | a website". */
  readonly createPage?: string;
  /** A creation verb whose object is a page that exists: "build | my portfolio". */
  readonly definitePage?: string;
  /** The request opens with a page it names: "a site for my clinic", "موقع لعياده". */
  readonly nounPhrase?: string;
  /** An existing section the request names. */
  readonly label?: string;
}

function readSignals(
  tokens: readonly IntentToken[],
  folded: string,
  labels: readonly string[],
): Signals {
  const scan = scanOf(tokens);
  const comparative = tokens.some((token) => readsAs(token, COMPARATIVES));

  let createPage: string | undefined;
  let definitePage: string | undefined;
  let addSection: string | undefined;
  /* A section NAMED by an Arabic construct, which is one to make unless the words restart it. */
  let namedSection: string | undefined;
  for (const found of scan.verbs) {
    if (found.kind === 'edit') continue;
    const phrase = phraseFrom(scan, found.index + found.width, true);
    const head = phrase.head;
    if (head === undefined) continue;
    if (found.kind === 'add') {
      if (head.category === 'section') addSection ??= spelled(scan, head);
      else if (!phrase.headDefinite && ADDABLE_PAGE_NOUNS.has(head.stem)) {
        createPage ??= spelled(scan, head);
      }
      continue;
    }
    /*
      An Arabic construct — "صفحة العيادة", the clinic's page — is definite
      through its second noun, and is ALSO how Arabic names a page or section
      to make: "اعمل صفحة الهبوط لتطبيقي" asks for a landing page. It reads as
      the one that exists only when the words change it: a make verb ("خلي
      صفحة العيادة أغمق") or a comparative. Read as a name everywhere, those
      routed build-page/new-page@0.75 on a page with content — with a block
      selected too — while "make the clinic page darker" routed edit (wave-2
      verifier, 2026-09-28).
    */
    const construct = !phrase.headDefinite && constructIsDefinite(scan, head);
    const definite = phrase.headDefinite || (construct && (found.kind === 'make' || comparative));
    if (isPageLevel(head)) {
      if (!definite) createPage ??= spelled(scan, head);
      else if (found.kind === 'create') definitePage ??= spelled(scan, head);
    } else if (head.category === 'section' && !definite) {
      if (construct) namedSection ??= spelled(scan, head);
      else addSection ??= spelled(scan, head);
    }
  }

  const nounPhrase = openingNounPhrase(scan, comparative);
  const site = siteSignal(scan, folded, nounPhrase !== undefined);
  const restart = startOverSignal(scan, createPage ?? definitePage);
  /*
    "صمم قسم الأسعار من الصفر" restarts the prices section the page has; read
    as a name it appended a second one, at 0.85, beside the first (wave-2
    verifier, 2026-09-28). Without the restart the construct names one to make.
  */
  if (restart?.aim !== 'part') addSection ??= namedSection;
  const startOver = restart?.aim === 'page' ? restart : undefined;
  const newPage = newPageSignal(scan);
  const label = namedLabel(tokens, labels);
  /*
    Restarting a PART ("start over on the hero") changes what exists, whatever
    its verb: "start" is a creation verb, and read as one on an empty page the
    request became the brief for a whole page (wave-1 verifier, 2026-09-28).
  */
  const changes =
    comparative || restart?.aim === 'part' || scan.verbs.some((found) => found.kind === 'edit');

  return {
    acting: scan.verbs.length > 0 || comparative || nounPhrase !== undefined,
    changes,
    adds: scan.verbs.some((found) => found.kind === 'add' || wantsAPart(scan, found)),
    refersBack: scan.verbs.some((found) => pointsBack(scan, found)),
    ...(site === undefined ? {} : { site }),
    ...(startOver === undefined ? {} : { startOver }),
    ...(addSection === undefined ? {} : { addSection }),
    ...(newPage === undefined ? {} : { newPage }),
    ...(createPage === undefined ? {} : { createPage }),
    ...(definitePage === undefined ? {} : { definitePage }),
    ...(nounPhrase === undefined ? {} : { nounPhrase }),
    ...(label === undefined ? {} : { label }),
  };
}

/**
 * Whether a "make" points back at something: "make IT pop", "make THIS
 * cleaner", and in Arabic the object glued on as a suffix — "خليها", "اجعله".
 * A creation verb is never read this way: "build it" on an empty page is the
 * person asking for the page the conversation was about.
 */
function pointsBack(scan: Scan, found: Verb): boolean {
  if (found.kind !== 'make') return false;
  const token = scan.tokens[found.index];
  if (token?.arabic === true && /(?:ها|ه)$/u.test(token.raw)) return true;
  let next = found.index + found.width;
  while (next < scan.tokens.length && readsAs(scan.tokens[next], OBJECT_FILLERS)) next += 1;
  if (readsAs(scan.tokens[next], PRONOUNS)) return true;
  /*
    …or a part named as the one that exists: "make THE title Hello", "اجعل
    لون الخلفية بلون القهوة" (the colour OF THE background — an Arabic
    construct is definite through its second noun). On an empty page both
    built a whole page with the words as its brief (probed 2026-09-28). A
    page object stays a page ask: "make my portfolio" on an empty page is.
  */
  const phrase = phraseFrom(scan, next, false);
  const head = phrase.head;
  if (head === undefined || isPageLevel(head)) return false;
  return phrase.headDefinite || constructIsDefinite(scan, head);
}

/**
 * An Arabic noun followed by a definite one — "لون الخلفيه" — names something
 * that exists. A two-word noun is definite through its own second word:
 * "صفحة الهبوط" is the landing page, "صفحة هبوط" a landing page.
 */
function constructIsDefinite(scan: Scan, head: Noun): boolean {
  if (!ARABIC_STEM.test(head.stem)) return false;
  if (head.width > 1 && carriesArticle(scan.tokens[head.index + head.width - 1])) return true;
  const next = scan.tokens[head.index + head.width];
  return next !== undefined && !next.breakBefore && carriesArticle(next);
}

/** An Arabic word opening with its article — not "الكتروني", whose ال is a folded إل. */
function carriesArticle(token: IntentToken | undefined): boolean {
  return (
    token !== undefined &&
    token.arabic &&
    token.raw.startsWith('ال') &&
    token.raw.length >= 4 &&
    !NOT_THE_ARTICLE.has(token.raw)
  );
}

/**
 * "The menu NEEDS new prices": a third-person want whose subject exists and
 * whose object is a part, not a page — an addition to what exists.
 */
function wantsAPart(scan: Scan, found: Verb): boolean {
  if (found.kind !== 'want' || found.index === 0) return false;
  if (!THIRD_PERSON_WANTS.has(scan.tokens[found.index]?.raw ?? '')) return false;
  const head = phraseFrom(scan, found.index + found.width, true).head;
  return head !== undefined && !isPageLevel(head);
}

/**
 * A request that IS a page's name: "a site for my dental clinic…", "landing
 * for my app", "موقع الكتروني لعياده". No verb opens it, its first phrase is
 * headed by an indefinite page noun, and nothing in it says the page already
 * exists ("the page IS slow", "darker").
 */
function openingNounPhrase(scan: Scan, comparative: boolean): string | undefined {
  if (comparative || scan.tokens.some((token) => COPULAS.has(token.raw))) return undefined;
  if (scan.verbs[0]?.index === 0) return undefined;
  const phrase = phraseFrom(scan, 0, false);
  const head = phrase.head;
  if (!isPageLevel(head) || phrase.headDefinite) return undefined;
  return spelled(scan, head);
}

/* ── Several pages ─────────────────────────────────────────────────────── */

const ENGLISH_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  single: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const ARABIC_NUMBERS: Readonly<Record<string, number>> = {
  ثلاث: 3,
  ثلاثه: 3,
  اربع: 4,
  اربعه: 4,
  خمس: 5,
  خمسه: 5,
  ست: 6,
  سته: 6,
  سبع: 7,
  سبعه: 7,
  ثمان: 8,
  ثماني: 8,
  ثمانيه: 8,
  تسع: 9,
  تسعه: 9,
  عشر: 10,
  عشره: 10,
};
/** "Several" pages is a site of an unknown size — at least two. */
const MANY = 2;

const COUNT_EN =
  /(?<![\p{L}\p{N}])(\d{1,2}|one|single|two|three|four|five|six|seven|eight|nine|ten)[\s-]*pages?(?!\p{L})/u;
const MANY_EN = /(?<!\p{L})(?:multi|multiple|several|many|few)[\s-]*pages?(?!\p{L})/u;
const COUNT_AR_DIGITS = /(?<![\p{L}\p{N}])(\d{1,2})\s*(?:صفحات|صفحه)(?!\p{L})/u;
const COUNT_AR_WORDS = new RegExp(
  `(?<!\\p{L})(${Object.keys(ARABIC_NUMBERS).join('|')})\\s+صفحات(?!\\p{L})`,
  'u',
);
const TWO_AR = /(?<!\p{L})[وبل]?صفحتين(?!\p{L})/u;
const ONE_AR = /(?<!\p{L})صفحه\s+(?:واحده|وحده)(?!\p{L})/u;
const MANY_AR =
  /(?<!\p{L})(?:(?:عده|كذا|متعدده|متعدد)\s+(?:ال)?صفح(?:ات|ه)|صفحات\s+متعدده|متعدد\s+الصفحات)(?!\p{L})/u;

/** How many pages the words ask for, when they say; undefined when they do not. */
function pageCount(folded: string): number | undefined {
  if (ONE_AR.test(folded)) return 1;
  const english = COUNT_EN.exec(folded)?.[1];
  if (english !== undefined) return ENGLISH_NUMBERS[english] ?? Number(english);
  const digits = COUNT_AR_DIGITS.exec(folded)?.[1];
  if (digits !== undefined) return Number(digits);
  const word = COUNT_AR_WORDS.exec(folded)?.[1];
  if (word !== undefined) return ARABIC_NUMBERS[word];
  if (TWO_AR.test(folded)) return 2;
  if (MANY_EN.test(folded) || MANY_AR.test(folded)) return MANY;
  return undefined;
}

/** The distinct page names the request lists: "about", "من نحن", "services". */
function pageNames(tokens: readonly IntentToken[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    const pair = PAGE_NAME_PAIRS_AR.find(([first, second]) =>
      phraseAt(tokens, index, [first, second]),
    );
    if (pair !== undefined) {
      names.add(pair[2]);
      index += 1;
      continue;
    }
    const table = token.arabic ? PAGE_NAMES_AR : PAGE_NAMES_EN;
    const reading = readingOf(token, (stem) => table.has(stem));
    const name = reading === undefined ? undefined : table.get(reading.stem);
    if (name !== undefined) names.add(name);
  }
  return names;
}

/** Whether a token is one of a site's page names, in either language. */
function isPageName(token: IntentToken): boolean {
  const table = token.arabic ? PAGE_NAMES_AR : PAGE_NAMES_EN;
  return readingOf(token, (stem) => table.has(stem)) !== undefined;
}

/** What joins a list of page names: "about, services AND contact", "about US". */
const LIST_JOINS: ReadonlySet<string> = new Set(['and', 'or', '&', 'us', 'me']);

/**
 * Where a list of page names ending at `index` starts — across commas and
 * "and", which `phraseStart` stops at.
 *
 * A determiner before a LIST governs every name in it: in "fix the about and
 * services pages" the "the" belongs to "pages" too, and read only from
 * "services" the plural looked like pages to make — so an edit of two
 * existing pages routed to build-site (probed 2026-09-28).
 */
function listStart(tokens: readonly IntentToken[], index: number): number {
  let cursor = index;
  while (cursor > 0) {
    const before = tokens[cursor - 1];
    if (before === undefined || !(LIST_JOINS.has(before.raw) || isPageName(before))) break;
    cursor -= 1;
  }
  return cursor;
}

/**
 * Whether the words ask for SEVERAL pages — counted ("a 4-page website", "من
 * ثلاث صفحات"), plural ("with about and services pages"), or named beside a
 * page word ("موقع فيه صفحة من نحن وخدمات"). Named sections without a page word
 * are one page's sections: "a site … with services, team, pricing and contact"
 * — unless "home" is among them, which is a page and never a section.
 * A count of one pins a single page whatever else is listed.
 *
 * Every rule needs the site to be ASKED FOR — a site noun that is not already
 * the person's ("a website", not "my website"), or a verb that makes or adds.
 * Pages named in an edit are the site's existing pages: "fix the about and
 * services pages on my website" routed to build-site until this was checked
 * (probed 2026-09-28).
 */
function siteSignal(
  scan: Scan,
  folded: string,
  namesAPage: boolean,
): { counted: boolean; reason: string } | undefined {
  const { tokens, verbs } = scan;
  const freshSite = asksForASite(scan);
  /*
    "Add" is not creative here: "add links to other pages" names pages it does
    not ask for. Adding counts only with the pages NAMED (below).
  */
  const creative = verbs.some((found) => found.kind !== 'edit' && found.kind !== 'add');
  const adding = verbs.some((found) => found.kind === 'add');
  /*
    A count or a list is a site only when it is ASKED FOR: "translate the 3
    pages" is an edit that happens to count, so a request whose only verbs
    edit does not become a build by containing a number or a list of pages.
  */
  const asked = freshSite || creative || adding || namesAPage || verbs.length === 0;
  if (!asked) return undefined;
  /*
    Pages named inside a PART being made or added are where its links go:
    "add a nav with links to home, about and contact pages", "أضف قائمة فيها
    روابط لصفحات من نحن والخدمات". Read as a list of pages, each routed to
    build-site at 0.8 (wave-1 verifier, 2026-09-28). The part is what the
    verb asks for; a fresh site noun ("a website with a footer linking to…")
    still asks for the site.
  */
  const object = firstObjectHead(scan);
  if (!freshSite && object !== undefined && !isPageLevel(object)) return undefined;
  /*
    With nothing else asking for them, an ADD asks for pages only when they
    are its object: "add about and services pages", not "add something that
    links to the 4 pages".
  */
  const direct = addsPagesDirectly(scan);
  if (adding && !direct && !freshSite && !creative && !namesAPage && verbs.length > 0) {
    return undefined;
  }
  const count = pageCount(folded);
  if (count !== undefined) {
    return count >= 2
      ? { counted: true, reason: `asks for ${count === MANY ? 'several' : String(count)} pages` }
      : undefined;
  }
  const names = pageNames(tokens);
  const plural = tokens.some((token, index) => {
    const noun = scan.nouns[index];
    if (noun === undefined || !readsAs(token, PLURAL_PAGE_NOUNS)) return false;
    const from = Math.min(phraseStart(tokens, index), Math.max(0, listStart(tokens, index) - 1));
    return !definiteAt(tokens, from, noun);
  });
  if (plural && (freshSite || creative)) {
    return { counted: false, reason: 'asks for pages, in the plural' };
  }
  const pageWords = tokens.filter((token) => readsAs(token, PAGE_WORDS)).length;
  if (adding && direct && names.size >= 2 && (plural || pageWords >= 2)) {
    return { counted: false, reason: `adds ${String(names.size)} named pages` };
  }
  if (!freshSite || names.size < 2) return undefined;
  if (tokens.some((token) => readsAs(token, PAGE_WORDS))) {
    return { counted: false, reason: `names ${String(names.size)} pages of a site` };
  }
  return names.has('home')
    ? { counted: false, reason: `names ${String(names.size)} pages of a site, home among them` }
    : undefined;
}

/**
 * Whether a site not yet made is what the words ASK FOR: the head of a
 * making, wanting or adding verb's object ("build | a website with…"), or of
 * the phrase the request opens with ("a website with about and contact").
 *
 * Anywhere else a site noun is where something points. Counted anywhere, the
 * "blog" in "add a nav with links to home, blog and contact" was a site to
 * make, which skipped the guard for a part's link list and routed
 * build-site@0.8 (wave-2 verifier, 2026-09-28).
 */
function asksForASite(scan: Scan): boolean {
  const { tokens } = scan;
  const fresh = (noun: Noun | undefined): boolean =>
    noun?.category === 'site' && !definiteAt(tokens, phraseStart(tokens, noun.index), noun);
  if (scan.verbs[0]?.index !== 0 && fresh(phraseFrom(scan, 0, false).head)) return true;
  return scan.verbs.some(
    (found) =>
      found.kind !== 'edit' && fresh(phraseFrom(scan, found.index + found.width, true).head),
  );
}

/** The head of what the first verb that makes, wants or adds is asked for, if it names one. */
function firstObjectHead(scan: Scan): Noun | undefined {
  for (const found of scan.verbs) {
    if (found.kind === 'edit') continue;
    const head = phraseFrom(scan, found.index + found.width, true).head;
    if (head !== undefined) return head;
  }
  return undefined;
}

/** A word a list of pages is made of: a name, "and", an article, "new", a number. */
function listsPages(token: IntentToken): boolean {
  return (
    isPageName(token) ||
    LIST_JOINS.has(token.raw) ||
    INDEFINITE_EN.has(token.raw) ||
    readsAs(token, OBJECT_FILLERS) ||
    readsAs(token, NEW_WORDS_EN) ||
    readsAs(token, NEW_WORDS_AR) ||
    /^\d{1,2}$/u.test(token.raw) ||
    ENGLISH_NUMBERS[token.raw] !== undefined ||
    ARABIC_NUMBERS[token.raw] !== undefined
  );
}

/**
 * Whether an ADD's object IS pages — the page word reached from the verb
 * across nothing but a list of page names: "add about and services pages",
 * "add 3 new pages", "أضف صفحات…", "اضف صفحتين".
 */
function addsPagesDirectly(scan: Scan): boolean {
  const { tokens } = scan;
  return scan.verbs.some((found) => {
    if (found.kind !== 'add') return false;
    for (let index = found.index + found.width; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) return false;
      if (readsAs(token, PAGE_WORDS) || TWO_AR.test(token.raw)) return true;
      if (!listsPages(token)) return false;
    }
    return false;
  });
}

/** Where the phrase holding `index` starts: after the nearest break or stop before it. */
function phraseStart(tokens: readonly IntentToken[], index: number): number {
  for (let cursor = index; cursor > 0; cursor -= 1) {
    const token = tokens[cursor];
    if (token === undefined || token.breakBefore) return cursor;
    const before = tokens[cursor - 1];
    if (before !== undefined && endsPhrase(before)) return cursor;
  }
  return 0;
}

/* ── Start over, and a new page ────────────────────────────────────────── */

/** A start-over of the whole page, as the router reads it. */
interface PageStartOver {
  readonly aim: 'page';
  /** The start-over words, as the lexicon spells them. */
  readonly phrase: string;
  /** A page or site noun is what starts over ("rebuild THE PAGE"), not merely no part. */
  readonly namesPage: boolean;
  /** The words say something about what replaces the page. */
  readonly brief: boolean;
}

type StartOverRead = PageStartOver | { readonly aim: 'part'; readonly phrase: string };

/**
 * An explicit "start over", and what it is aimed at.
 *
 * A strong phrase ("from scratch", "من الصفر", "أعد تصميم") restarts whatever
 * it is AIMED at: a verb's object follows it ("redesign | the hero section of
 * the homepage", "start over on | the hero"); an adverb's is the first thing
 * named in its own clause ("rewrite the hero on the landing page | from
 * scratch"); each falls back to the other side when its own names nothing. The
 * first version asked only whether any page noun appeared ANYWHERE, so the
 * page named as where the section is won — "redesign the hero section of the
 * homepage" and "أعد تصميم قسم الأسعار في الصفحة" routed to build-page/replace
 * at 0.85 (wave-1 verifier, 2026-09-28). A weak one ("redo", "replace",
 * "امسح") needs a page as its object — a bare "redo" is the history button's
 * word — and "من جديد" ("anew") restarts a page only when one is being made in
 * the same breath ("صمم الصفحه من جديد"), and a part when it is aimed at one
 * ("صمم قسم الخدمات من جديد"); on its own it only means "again".
 */
function startOverSignal(scan: Scan, pageBeingMade: string | undefined): StartOverRead | undefined {
  const { tokens } = scan;
  const strong = earliestPhrase(tokens, REPLACE_STRONG);
  if (strong !== undefined) {
    const phrase = strong.phrase.join(' ');
    const aim = startOverAim(scan, strong.at, strong.phrase);
    if (aim === 'part') return { aim: 'part', phrase };
    return { aim: 'page', phrase, namesPage: aim === 'page', brief: hasBrief(scan) };
  }
  /*
    "Delete everything and build a website for my bakery" said what goes and
    what replaces it; read without this, the build went BESIDE the content
    the person had just asked to delete (probed 2026-09-28).
  */
  if (pageBeingMade !== undefined) {
    const cleared = CLEAR_ALL.find((phrase) => findPhrase(tokens, phrase) >= 0);
    if (cleared !== undefined) {
      return { aim: 'page', phrase: cleared.join(' '), namesPage: true, brief: hasBrief(scan) };
    }
  }
  for (const phrase of REPLACE_WEAK) {
    const at = findPhrase(tokens, phrase);
    if (at < 0) continue;
    const page = { aim: 'page', phrase: phrase.join(' '), namesPage: true } as const;
    if (phrase.join(' ') === 'من جديد') {
      if (pageBeingMade !== undefined) return { ...page, brief: hasBrief(scan) };
      if (startOverAim(scan, at, phrase) === 'part') return { aim: 'part', phrase: page.phrase };
      continue;
    }
    if (isPageLevel(phraseFrom(scan, at + phrase.length, false).head)) {
      return { ...page, brief: hasBrief(scan) };
    }
  }
  return undefined;
}

/** The phrase of `phrases` that starts first in the request, the longer one on a tie. */
function earliestPhrase(
  tokens: readonly IntentToken[],
  phrases: readonly (readonly string[])[],
): { readonly at: number; readonly phrase: readonly string[] } | undefined {
  let found: { at: number; phrase: readonly string[] } | undefined;
  for (const phrase of phrases) {
    const at = findPhrase(tokens, phrase);
    if (at < 0) continue;
    if (
      found === undefined ||
      at < found.at ||
      (at === found.at && phrase.length > found.phrase.length)
    ) {
      found = { at, phrase };
    }
  }
  return found;
}

/** Words that open a new clause, so what comes before them is not what restarts. */
const CLAUSE_JOINS: ReadonlySet<string> = new Set(['and', 'then', 'but', 'ثم', 'بس', 'لكن']);

/** A start-over whose object is read BEFORE it: "…from scratch", "…من الصفر", "…من جديد". */
const isAdverbial = (phrase: readonly string[]): boolean =>
  phrase.join(' ') === 'من جديد' ||
  ADVERBIAL_START_OVERS.some((candidate) => candidate.join(' ') === phrase.join(' '));

const START_OVER_OBJECTS: ReadonlySet<string> = new Set(START_OVER_OBJECTS_AR);

/** An Arabic verb with its object glued on: "صممه", "اعملها", "سويهم". */
const ARABIC_OBJECT_SUFFIX = /(?:ه|ها|هم)$/u;

type StartOverAim = 'page' | 'part' | undefined;

/**
 * What a start-over at `at` restarts: 'page' when its object is a page or a
 * site, 'part' when it is a section or an element, undefined when it names
 * nothing ("start over", "من الصفر"). A verb's object follows it; an adverb's
 * ("…from scratch") is its clause's own object, before it.
 *
 * An object that POINTS BACK — "it", "them", the ه of "أعد تصميمه" — restarts
 * what it points at, named in an earlier clause: "the hero looks bad,
 * redesign it from scratch" is the hero's. Read as naming nothing, those fell
 * back to the page at 0.85 (wave-2 verifier, 2026-09-28).
 */
function startOverAim(scan: Scan, at: number, phrase: readonly string[]): StartOverAim {
  const aim = isAdverbial(phrase)
    ? (aimBefore(scan, at, phrase) ?? aimAfter(scan, at, phrase))
    : (aimAfter(scan, at, phrase) ?? aimBefore(scan, at, phrase));
  if (aim !== undefined) return aim;
  return pointsBackFrom(scan, at, phrase)
    ? antecedentAim(scan, clauseStart(scan.tokens, at, phrase))
    : undefined;
}

function aimOf(head: Noun | undefined): StartOverAim {
  if (head === undefined) return undefined;
  return isPageLevel(head) ? 'page' : 'part';
}

/** Where a start-over's object starts: past "on", "with", "في" — "start over ON | the hero". */
function objectAfter(scan: Scan, at: number, phrase: readonly string[]): number {
  const { tokens } = scan;
  let next = at + phrase.length;
  while (
    next < tokens.length &&
    (START_OVER_LINKS.has(tokens[next]?.raw ?? '') || readsAs(tokens[next], OBJECT_FILLERS))
  ) {
    next += 1;
  }
  return next;
}

/** The object after the phrase: "start over on | the hero". */
function aimAfter(scan: Scan, at: number, phrase: readonly string[]): StartOverAim {
  return aimOf(phraseFrom(scan, objectAfter(scan, at, phrase), false).head);
}

/** The first thing named in the phrase's own clause: "rewrite | the hero | … from scratch". */
function aimBefore(scan: Scan, at: number, phrase: readonly string[]): StartOverAim {
  return firstNamed(scan, clauseStart(scan.tokens, at, phrase), at);
}

/** The first thing named between `start` and `end`, read as the phrase it heads. */
function firstNamed(scan: Scan, start: number, end: number): StartOverAim {
  for (let index = start; index < end; index += 1) {
    const noun = scan.nouns[index];
    if (noun === undefined) continue;
    return aimOf(
      phraseFrom(scan, Math.max(start, phraseStart(scan.tokens, index)), false).head ?? noun,
    );
  }
  return undefined;
}

/**
 * Whether the start-over's object points back: a pronoun as its object
 * ("redesign IT", "start over on THEM"), the object glued to its Arabic verbal
 * noun ("أعد تصميمه") or verb ("صممه من جديد"), or — for an adverb — a
 * pronoun in the clause it modifies ("redo it | from scratch").
 */
function pointsBackFrom(scan: Scan, at: number, phrase: readonly string[]): boolean {
  const { tokens } = scan;
  if (START_OVER_OBJECTS.has(tokens[at + phrase.length - 1]?.raw ?? '')) return true;
  if (readsAs(tokens[objectAfter(scan, at, phrase)], OBJECT_PRONOUNS)) return true;
  if (!isAdverbial(phrase)) return false;
  for (let index = clauseStart(tokens, at, phrase); index < at; index += 1) {
    const token = tokens[index];
    if (readsAs(token, OBJECT_PRONOUNS) || START_OVER_OBJECTS.has(token?.raw ?? '')) return true;
  }
  return scan.verbs.some(
    (found) =>
      found.index < at &&
      found.index >= clauseStart(tokens, at, phrase) &&
      tokens[found.index]?.arabic === true &&
      ARABIC_OBJECT_SUFFIX.test(tokens[found.index]?.raw ?? ''),
  );
}

/**
 * What a pointing object points at: the first thing named in the nearest
 * clause before `end` that names one — the SUBJECT of "the hero looks bad",
 * not the place in "the hero looks bad on the landing page". Nothing named
 * before it leaves the start-over the page's, as a bare "redesign it" is.
 */
function antecedentAim(scan: Scan, end: number): StartOverAim {
  let cursor = end;
  while (cursor > 0) {
    const start = clauseHolding(scan.tokens, cursor - 1);
    const aim = firstNamed(scan, start, cursor);
    if (aim !== undefined) return aim;
    cursor = start;
  }
  return undefined;
}

/**
 * Where the clause holding a start-over at `at` begins: after the nearest
 * break or joining word before it — or AT it, when the phrase's own first
 * word carries the Arabic "and" ("احذف الهيرو وابدأ من جديد").
 */
function clauseStart(
  tokens: readonly IntentToken[],
  at: number,
  phrase: readonly string[],
): number {
  const first = tokens[at];
  if (first?.arabic === true && first.raw !== phrase[0] && /^[وف]/u.test(first.raw)) return at;
  return clauseHolding(tokens, at);
}

/** Where the clause holding the token at `index` begins: after a break or a joining word. */
function clauseHolding(tokens: readonly IntentToken[], index: number): number {
  for (let cursor = index; cursor > 0; cursor -= 1) {
    if (tokens[cursor]?.breakBefore === true) return cursor;
    if (CLAUSE_JOINS.has(tokens[cursor - 1]?.raw ?? '')) return cursor;
  }
  return 0;
}

/** The clauses of a request, as [start, end) ranges, in order. */
function clausesOf(tokens: readonly IntentToken[]): readonly (readonly [number, number])[] {
  const clauses: (readonly [number, number])[] = [];
  let start = 0;
  for (let index = 1; index <= tokens.length; index += 1) {
    const token = tokens[index];
    const opens =
      token === undefined || token.breakBefore || CLAUSE_JOINS.has(tokens[index - 1]?.raw ?? '');
    if (!opens) continue;
    clauses.push([start, index]);
    start = index;
  }
  return clauses;
}

/**
 * Whether a start-over says what replaces the page: a word left once the
 * start-over and clearing phrases, the verbs, the nouns of the page and its
 * parts, page names, courtesy and vocatives, and the words that carry no
 * subject ("the", "whole", "ok", "بالكامل") are set aside. "Start over with a
 * landing page for my BAKERY" has one; "rebuild the whole website from
 * scratch" has none.
 *
 * Only where a brief CAN be: in a clause that restarts, makes or asks for
 * something, or says what it is for ("…, a portfolio FOR a photographer"),
 * and from its verb on — "let's | start over", "I think we should | start
 * over" say nothing about the page. A clause that only JUDGES the page ("I
 * don't like it", "الصفحة سيئة", "ما عجبني") is no brief either. Read over the
 * whole request, every word the lists did not name was one, and those
 * start-overs routed at 0.85 (wave-2 verifier, 2026-09-28).
 */
function hasBrief(scan: Scan): boolean {
  const { tokens } = scan;
  const covered = coveredWords(scan);
  return clausesOf(tokens).some(([start, end]) => {
    const from = briefStart(scan, start, end);
    if (from === undefined) return false;
    for (let index = from; index < end; index += 1) {
      const token = tokens[index];
      if (token !== undefined && !covered.has(index) && !saysNoSubject(token)) return true;
    }
    return false;
  });
}

/** Every word that is structure, not subject: phrases, verbs, the lexicon's nouns, courtesy. */
function coveredWords(scan: Scan): ReadonlySet<number> {
  const { tokens } = scan;
  const covered = new Set<number>();
  const cover = (phrase: readonly string[]): void => {
    for (let index = 0; index < tokens.length; index += 1) {
      if (!phraseAt(tokens, index, phrase)) continue;
      for (let offset = 0; offset < phrase.length; offset += 1) covered.add(index + offset);
    }
  };
  for (const phrases of [REPLACE_STRONG, REPLACE_WEAK, CLEAR_ALL]) phrases.forEach(cover);
  // "…لو سمحت", "…يا أبو غضب": courtesy and the assistant's name, wherever they stand.
  for (const opener of OPENERS) cover(opener.words);
  for (const found of scan.verbs) {
    for (let offset = 0; offset < found.width; offset += 1) covered.add(found.index + offset);
  }
  /*
    Every noun the lexicon knows — pages, sections, elements — is structure,
    not subject: "delete the hero and start over" names what goes, and says
    no more about the page that replaces it than "start over" does.
  */
  scan.nouns.forEach((noun, index) => {
    if (noun === undefined) return;
    for (let offset = 0; offset < noun.width; offset += 1) covered.add(index + offset);
  });
  return covered;
}

/**
 * Where a clause's brief may start, or undefined when the clause cannot hold
 * one: its first verb (or verbal start-over) when it has one, else its start.
 */
function briefStart(scan: Scan, start: number, end: number): number | undefined {
  const { tokens } = scan;
  let restarts = false;
  let from: number | undefined;
  for (const phrases of [REPLACE_STRONG, REPLACE_WEAK, CLEAR_ALL]) {
    for (const phrase of phrases) {
      for (let index = start; index < end; index += 1) {
        if (!phraseAt(tokens, index, phrase)) continue;
        restarts = true;
        if (!isAdverbial(phrase)) from = Math.min(from ?? index, index);
      }
    }
  }
  let asks = false;
  for (const found of scan.verbs) {
    if (found.index < start || found.index >= end || !usedAsVerb(tokens, found)) continue;
    from = Math.min(from ?? found.index, found.index);
    asks ||= found.kind !== 'edit';
  }
  for (let index = start; index < end && !asks; index += 1) {
    const noun = scan.nouns[index];
    asks =
      statesAPurpose(tokens[index]) ||
      (isPageLevel(noun) && !definiteAt(tokens, phraseStart(tokens, index), noun));
  }
  if (!restarts && !asks) return undefined;
  return from ?? start;
}

/**
 * A verb word that is a verb here: English puts a determiner before the noun
 * a verb doubles as — "I hate THIS design" names a design, it asks for none.
 */
function usedAsVerb(tokens: readonly IntentToken[], found: Verb): boolean {
  const before = tokens[found.index - 1];
  if (before === undefined || before.arabic) return true;
  return !DEFINITE_EN.has(before.raw) && !INDEFINITE_EN.has(before.raw);
}

/** "For", "as", or an Arabic word carrying "for": "لمخبز", "للاطفال". */
function statesAPurpose(token: IntentToken | undefined): boolean {
  if (token === undefined) return false;
  if (!token.arabic) return token.raw === 'for' || token.raw === 'as';
  return token.raw.length >= 4 && !PHRASE_HEADS_AR.has(token.raw) && /^[وف]?لل?/u.test(token.raw);
}

const NO_SUBJECT: readonly ReadonlySet<string>[] = [
  BARE_START_OVER_WORDS,
  START_OVER_LINKS,
  DEFINITE_EN,
  INDEFINITE_EN,
  DEFINITE_AR,
  NEW_WORDS_EN,
  NEW_WORDS_AR,
  OBJECT_FILLERS,
  PHRASE_STOPS,
  PRONOUNS,
  CONTROL_WORDS,
];

function saysNoSubject(token: IntentToken): boolean {
  return isPageName(token) || NO_SUBJECT.some((words) => readsAs(token, words));
}

/**
 * "A new page", "another site", "صفحه جديده" — a page that does not exist yet,
 * named as such, as WHAT IS ASKED FOR: the object of a verb that makes, wants
 * or adds ("add | a new page", "ابي | صفحه ثانيه"), or the request's own
 * opening ("new page for our team", "صفحه جديده للعروض").
 *
 * Anywhere else it is where something points. The first version took "new" +
 * a page noun anywhere in the sentence, and "add a link to a new page", "move
 * the pricing to a new page" and "أضف رابط لصفحة جديدة" all routed to a build at
 * 0.85 (probed 2026-09-28) — the audit's P0-1 failure in new words. The page
 * must also HEAD the phrase: "a new hero for the page" is a section, and "a
 * new page link" is a link.
 */
function newPageSignal(scan: Scan): string | undefined {
  for (const found of scan.verbs) {
    if (found.kind === 'edit') continue;
    const asked = newPageFrom(scan, found.index + found.width, true);
    if (asked !== undefined) return asked;
  }
  if (scan.verbs[0]?.index === 0) return undefined;
  const { tokens } = scan;
  let first = 0;
  while (isArticle(tokens[first])) first += 1;
  const opening = tokens[first];
  if (opening === undefined) return undefined;
  const opens = opening.arabic ? isPageLevel(scan.nouns[first]) : NEW_WORDS_EN.has(opening.raw);
  return opens ? newPageFrom(scan, first, false) : undefined;
}

/** "a", "an", "one" — an article, and not itself a "new" word as "another" is. */
const isArticle = (token: IntentToken | undefined): boolean =>
  token !== undefined && INDEFINITE_EN.has(token.raw) && !NEW_WORDS_EN.has(token.raw);

/** The new page the phrase starting at `from` asks for, spelled as the request spelled it. */
function newPageFrom(scan: Scan, from: number, skipFillers: boolean): string | undefined {
  const { tokens } = scan;
  const head = phraseFrom(scan, from, skipFillers).head;
  if (!isPageLevel(head) || head.definite) return undefined;
  if (ARABIC_STEM.test(head.stem)) {
    const next = tokens[head.index + head.width];
    return next !== undefined && !next.breakBefore && readsAs(next, NEW_WORDS_AR)
      ? `${spelled(scan, head)} ${next.raw}`
      : undefined;
  }
  for (let index = head.index - 1; index >= from; index -= 1) {
    const raw = tokens[index]?.raw ?? '';
    if (!NEW_WORDS_EN.has(raw)) continue;
    // "THE new page" is one that already exists.
    return DEFINITE_EN.has(tokens[index - 1]?.raw ?? '')
      ? undefined
      : `${raw} ${spelled(scan, head)}`;
  }
  return undefined;
}

/* ── The page's own sections ───────────────────────────────────────────── */

/**
 * The first of the page's sections the request names, as the page names it.
 *
 * Matched as a PHRASE of whole words — "hero" is found in "the hero title" and
 * not in "heroic", "logoCloud" is the words "logo cloud" — through the same
 * clitic readings every other rule uses, so a section labelled "الأسعار" is
 * named by "اسعار" and "للاسعار" alike. Tokens, not a RegExp per label: a
 * label is page data of any shape, and compiling it on every request is both
 * the slow path and one more place for an escape to go wrong.
 */
function namedLabel(tokens: readonly IntentToken[], labels: readonly string[]): string | undefined {
  return labels.find((label) => {
    const words = tokenize(normalizeIntentText(label.replace(/([a-z\d])([A-Z])/gu, '$1 $2'))).map(
      (word) =>
        word.arabic && word.raw.startsWith('ال') && word.raw.length >= 4
          ? word.raw.slice(2)
          : word.raw,
    );
    if (words.join(' ').length < 3) return false;
    return findPhrase(tokens, words) >= 0;
  });
}
