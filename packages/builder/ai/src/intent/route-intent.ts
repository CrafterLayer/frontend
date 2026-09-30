import {
  ADDABLE_PAGE_NOUNS,
  ADVERBIAL_START_OVERS,
  BARE_START_OVER_WORDS,
  CHANGE_VERBAL_NOUNS_AR,
  CLEAR_ALL,
  COMPARATIVES,
  CONSEQUENCE_AUXILIARIES,
  CONTROL_FILLERS,
  CONTROL_WORDS,
  COPULAS,
  DEFINITE_AR,
  DEFINITE_EN,
  EXISTENTIALS_AR,
  EXISTENTIALS_EN,
  FIRST_PERSON,
  FUNCTION_WORDS,
  GREETINGS,
  HYPOTHETICAL_OPENERS,
  IDENTITY_WORDS,
  INDEFINITE_EN,
  INTERROGATIVE_PAIRS,
  INTERROGATIVES,
  IRREGULAR_PASTS_EN,
  JUDGMENTS,
  LEADING_VERBS_EN,
  NEGATIONS,
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
  PAST_SUFFIXES_AR,
  PHRASE_STOPS,
  PLURAL_PAGE_NOUNS,
  PRONOUNS,
  REPLACE_STRONG,
  REPLACE_WEAK,
  RESTART_VERBS_AR,
  SECTION_WORDS,
  START_OVER_LINKS,
  START_OVER_OBJECTS_AR,
  SUGGESTION_OPENERS,
  SUGGESTION_SUBJECTS,
  THIRD_PERSON_WANTS,
  TIME_ADVERBS,
  VERB_GOVERNORS_AR,
  VERB_PAIRS_EN,
  VERBAL_NOUNS_AR,
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
  /*
    CEILINGS for a request shaped as a question (router-3, 2026-09-28). A
    suggestion ("how about adding a map?") names its change, so it is acted
    on — but as an idea weighed, never above 0.7. A capability question ("is
    it possible to change the font?") is asked of the product first, so it
    sits below the ~0.6 confirm line and the host asks "shall I?" before any
    write. Either one that would BUILD is answered in words instead.
  */
  suggestion: 0.7,
  capability: 0.5,
  /* A verbless phrase headed by a section: "a nav with links to home and blog". */
  partPhrase: 0.7,
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
  const frame = frameOf(opened);
  if (frame !== undefined) return routeFramed(input, folded, labels, opened, frame);
  const routed = routeWords(input, folded, labels, opened.tokens, opened.polite);
  return opened.ability === undefined
    ? routed
    : askedOfTheAssistant(routed, opened.tokens, opened.ability);
}

/**
 * A build asked for as a question of ABILITY — "can you…", «هل يمكنك…», «هل
 * بتقدر…», «ممكن…» — whose verb the router does not know.
 *
 * Such a question says what it asks in the verb after its opener. When no
 * verb the router knows stands anywhere in the words, and they do not open
 * with what they ask for either («ممكن موقع لمطعمي؟» asks for the site
 * itself), the page a later noun names is a GUESS at the request: the owner's
 * «هل يمكنك تربط ال صفحه هاي داخل عليها» ("can you link this page inside
 * it") built a page at 0.8 on an empty canvas, no check made, because «تربط»
 * was unknown and «صفحه» read as a page's name (final test, 2026-09-29). The
 * build stays what the words most likely ask for, at `CONFIDENCE.capability`
 * — below the confirm line, so the host checks before minutes of building.
 */
function askedOfTheAssistant(
  routed: IntentRoute,
  tokens: readonly IntentToken[],
  opener: string,
): IntentRoute {
  if (routed.kind === 'edit') return unaimedEditAsked(routed, tokens, opener);
  if (!isBuildIntent(routed) || routed.confidence <= CONFIDENCE.capability) return routed;
  const scan = scanOf(tokens);
  if (scan.verbs.length > 0) return routed;
  let first = 0;
  while (first < tokens.length && readsAs(tokens[first], OBJECT_FILLERS)) first += 1;
  // What is asked for, or MSA's verbal noun as the verb: «هل يمكنك تصميم موقع لعيادتي؟».
  if (scan.nouns[first] !== undefined || readsAs(tokens[first], VERBAL_NOUNS_AR)) return routed;
  return route(
    routed.kind,
    CONFIDENCE.capability,
    `asks whether it can (“${opener}”) “${tokens[first]?.raw ?? ''}”, a verb it does not know, and ${routed.reason}`,
    routed.target,
  );
}

/**
 * The reasons of an edit aimed at nothing in particular: no block pointed at,
 * no section of the page named — the whole page, changed as the words say.
 */
const EDIT_UNAIMED = {
  verb: 'asks to change what is there',
  bare: 'the page has content and the words ask for no new page',
} as const;

/**
 * An edit asked as a question of ABILITY — "can you…", «هل يمكنك…» — that
 * aims at no block and no section the page has: a change to the WHOLE page,
 * asked of the assistant rather than told to it.
 *
 * It sits at `CONFIDENCE.capability`, below the confirm line, like the same
 * change asked as "is it possible to…": the owner's «هل يمكنك تربط ال صفحه
 * هاي داخل عليها» over a landing page routed edit@0.8 once «تربط» was known,
 * so no check was made and a whole-page edit started at once (final test,
 * 2026-09-30). An edit that names a part — "could you make the hero
 * darker?", «هل ممكن تحذف الفوتر؟» — or a pointed block is aimed, and keeps
 * its confidence.
 */
function unaimedEditAsked(
  routed: IntentRoute,
  tokens: readonly IntentToken[],
  opener: string,
): IntentRoute {
  const unaimed = routed.reason === EDIT_UNAIMED.verb || routed.reason === EDIT_UNAIMED.bare;
  if (!unaimed || routed.confidence <= CONFIDENCE.capability) return routed;
  // A part the words name — «هل ممكن تحذف الفوتر؟» — aims it, labelled on this page or not.
  const scan = scanOf(tokens);
  const isVerb = (index: number): boolean =>
    scan.verbs.some((found) => index >= found.index && index < found.index + found.width);
  const aimed = scan.nouns.some(
    (noun) => noun !== undefined && !isPageLevel(noun) && !isVerb(noun.index),
  );
  if (aimed) return routed;
  return route(
    'edit',
    CONFIDENCE.capability,
    `asks whether it can (“${opener}”) change the whole page, and ${routed.reason}`,
  );
}

/**
 * A request shaped as a QUESTION about a change — one rule, both languages
 * (router-3, 2026-09-28):
 *
 * 1. It asks what WOULD HAPPEN — a later clause asks about the outcome ("what
 *    if I remove the footer, WILL the page break?", "لو حذفت الفوتر، هل…؟")
 *    or the person is the subject of the idea ("what if I delete the hero?",
 *    "how about I…") — and is answered in words: the person asked about their
 *    own action, not for it.
 * 2. It asks what CAN be done ("is it possible to…", "هل يمكن + verbal noun")
 *    and is routed as the request it names below the confirm line, so the
 *    host asks before any write.
 * 3. It SUGGESTS ("how about adding…", "ما رأيك لو أضفت…") and is routed as
 *    the change it names, at most at `CONFIDENCE.suggestion`.
 * 4. Whatever its shape, one that would BUILD a page or a site is answered
 *    first: minutes of building never follow from a question.
 *
 * Measured before (wave-2 and v1-panel verifiers, 2026-09-28): "what if I
 * delete the hero?" edit@0.8, "is it possible to make a multi-page site?"
 * build-site@0.9, while "how about adding a testimonials section?" and "ما
 * رأيك لو أضفت قسم أسعار؟" were answered in words and changed nothing.
 */
function routeFramed(
  input: RouteIntentInput,
  folded: string,
  labels: readonly string[],
  opened: OpenedRequest,
  frame: Frame,
): IntentRoute {
  const outcome = asksAboutAnOutcome(opened.tokens);
  if (outcome !== undefined) {
    return route(
      'question',
      CONFIDENCE.interrogative,
      `asks what would happen (“${frame.opener}” … “${outcome}”), which is answered in words`,
    );
  }
  /*
    Whatever the frame — "what if I…", "suppose I…", "if I…", "هل ممكن أنا…"
    — the person as the subject asks about their OWN action. Read past a
    condition's opener as an instruction, "if I delete the hero?" and "suppose
    I remove the pricing section?" routed edit@0.8-0.85 (router-3 probe,
    2026-09-28), where "what if I delete the hero?" was already answered.
  */
  const speaker = frame.rest[0];
  if (speaker !== undefined && readsAs(speaker, FIRST_PERSON)) {
    return route(
      'question',
      CONFIDENCE.interrogative,
      `asks about the person’s own action (“${frame.opener} ${speaker.raw}”), which is theirs to take`,
    );
  }
  if (frame.kind === 'condition') {
    return routeWords(input, folded, labels, opened.tokens, opened.polite);
  }
  const rest = frame.kind === 'suggestion' ? proposalOf(frame.rest, frame.afterIf) : frame.rest;
  const said =
    frame.kind === 'suggestion'
      ? `a suggestion (“${frame.opener}”)`
      : `asks whether it can be done (“${frame.opener}”)`;
  if (!readSignals(rest, folded, labels).acting) {
    return frame.kind === 'capability'
      ? route('question', CONFIDENCE.interrogative, `${said}, and names nothing to do`)
      : routeWords(input, folded, labels, opened.tokens, opened.polite);
  }
  const routed = routeWords(input, folded, labels, rest, true);
  if (routed.kind === 'question') {
    return route('question', routed.confidence, `${said}, ${routed.reason}`);
  }
  if (isBuildIntent(routed)) {
    return route(
      'question',
      CONFIDENCE.interrogative,
      `${said} of a build (${routed.reason}), answered in words first: a page is never built from a question`,
    );
  }
  const ceiling = frame.kind === 'suggestion' ? CONFIDENCE.suggestion : CONFIDENCE.capability;
  return route(
    routed.kind,
    Math.min(routed.confidence, ceiling),
    `${said}, ${routed.reason}`,
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
  const weakBuild =
    read.nounPhrase !== undefined ||
    read.definitePage !== undefined ||
    read.partPhrase !== undefined ||
    owned;
  if (pointed && weakBuild) {
    return route(
      'edit',
      CONFIDENCE.editPointedOverBuild,
      'a block is pointed at, and the words do not explicitly ask for a page',
    );
  }
  if (read.partPhrase !== undefined && (owned || read.label === undefined)) {
    /*
      On a page with content, a section the page already has ("a pricing
      section with three tiers" beside its Pricing) is the one to change: the
      label rule below owns it.
    */
    return route(
      'add-section',
      CONFIDENCE.partPhrase,
      `names a new section (“${read.partPhrase}”) and no page`,
      'append',
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
  if (read.changes) return route('edit', CONFIDENCE.editVerb, EDIT_UNAIMED.verb);
  return route('edit', CONFIDENCE.editDefault, EDIT_UNAIMED.bare);
}

/* ── Openers and questions ─────────────────────────────────────────────── */

/** The request past its courtesy, and what that courtesy said. */
interface OpenedRequest {
  readonly tokens: readonly IntentToken[];
  readonly polite: boolean;
  /** The opener asked whether something CAN be done ("is it possible to"), as its words. */
  readonly capability?: string;
  /** The opener asked whether the ASSISTANT can do something ("can you"), as its words. */
  readonly ability?: string;
}

/**
 * The request without its courtesy, vocatives and greetings, and whether any
 * of it was courtesy. Never strips the last word: "please" alone stays
 * "please", and "hi" alone was answered as a greeting before this runs.
 */
function stripOpeners(tokens: readonly IntentToken[]): OpenedRequest {
  let start = 0;
  let polite = false;
  let capability: string | undefined;
  let ability: string | undefined;
  for (let pass = 0; pass < 4; pass += 1) {
    const opener = OPENERS.find(
      (candidate) =>
        phraseAt(tokens, start, candidate.words) && start + candidate.words.length < tokens.length,
    );
    if (opener === undefined) break;
    start += opener.words.length;
    polite ||= opener.polite;
    const asksWhatIsPossible =
      opener.possibility === 'infinitive' ||
      (opener.possibility === 'verbal-noun' &&
        (readsAs(tokens[start], VERBAL_NOUNS_AR) || firstPersonVerbAr(tokens, start)));
    if (asksWhatIsPossible) capability ??= opener.words.join(' ');
    if (opener.ability === true) ability ??= opener.words.join(' ');
  }
  return {
    tokens: tokens.slice(start),
    polite,
    ...(capability === undefined ? {} : { capability }),
    ...(ability === undefined ? {} : { ability }),
  };
}

/**
 * Whether the word at `index` is an Arabic verb in the FIRST person — "هل ممكن
 * أحذف الفوتر؟" ("is it possible that I delete the footer?", "can I…") — the
 * Arabic of "can I delete the footer?", which is answered, not performed.
 *
 * Folded, the first person's أ is the imperative's ا ("احذف", delete!), so
 * the word alone cannot tell them apart; after an explicit "هل" of
 * possibility it is read as a question of what can be done, below the confirm
 * line, rather than an instruction at 0.8 (router-3 probe, 2026-09-28). A
 * verb that carries "for me / us" — "هل ممكن اعمل لي موقع؟", "اعمللي" — is
 * addressed to the assistant, and stays the courtesy it was.
 */
function firstPersonVerbAr(tokens: readonly IntentToken[], index: number): boolean {
  const token = tokens[index];
  if (token?.arabic !== true || !token.raw.startsWith('ا') || token.raw.length < 3) return false;
  if (/(?:لي|للي|لنا)$/u.test(token.raw) || FOR_THE_SPEAKER_AR.has(tokens[index + 1]?.raw ?? '')) {
    return false;
  }
  const verb = ARABIC_VERBS.find(
    ([pattern]) => pattern.test(token.raw) || pattern.test(`ي${token.raw.slice(1)}`),
  );
  return verb !== undefined && verb[1] !== 'want';
}

/** "For me", "for us", after a verb: the verb is asked OF the assistant. */
const FOR_THE_SPEAKER_AR: ReadonlySet<string> = new Set(['لي', 'الي', 'لنا', 'النا']);

/** How a request shaped as a question is framed; see `routeFramed`. */
type Frame =
  | {
      readonly kind: 'suggestion';
      readonly opener: string;
      readonly rest: readonly IntentToken[];
      /** The opener ends in "if" / "لو": "لو فيه قسم…" is "if there were a section". */
      readonly afterIf: boolean;
    }
  | { readonly kind: 'capability'; readonly opener: string; readonly rest: readonly IntentToken[] }
  | { readonly kind: 'condition'; readonly opener: string; readonly rest: readonly IntentToken[] };

/**
 * The frame a request opens with, if any: a capability question the courtesy
 * already carried, a suggestion's opener with something after it, or a
 * condition ("if…", "لو…").
 */
function frameOf(opened: OpenedRequest): Frame | undefined {
  const { tokens } = opened;
  if (opened.capability !== undefined) {
    return { kind: 'capability', opener: opened.capability, rest: tokens };
  }
  const opens = (words: readonly string[]): boolean =>
    words.length < tokens.length && phraseAt(tokens, 0, words);
  const suggestion = SUGGESTION_OPENERS.find(opens);
  if (suggestion !== undefined) {
    const last = suggestion[suggestion.length - 1];
    return {
      kind: 'suggestion',
      opener: suggestion.join(' '),
      rest: tokens.slice(suggestion.length),
      afterIf: last === 'if' || last === 'لو',
    };
  }
  const condition = HYPOTHETICAL_OPENERS.find(opens);
  return condition === undefined
    ? undefined
    : { kind: 'condition', opener: condition.join(' '), rest: tokens.slice(condition.length) };
}

/**
 * The word that opens a later clause ASKING about an outcome — "…, WILL the
 * page break?", "… — WOULD it load slower?", "…، هل ستتعطل الصفحة؟" — if one
 * does. "…, can you?" asks the assistant to act, and is not one.
 */
function asksAboutAnOutcome(tokens: readonly IntentToken[]): string | undefined {
  for (const [clauseStart, end] of clausesOf(tokens).slice(1)) {
    let start = clauseStart;
    while (start < end && CLAUSE_JOINS.has(tokens[start]?.raw ?? '')) start += 1;
    const first = tokens[start];
    if (first === undefined || start >= end) continue;
    const askedOfYou = SUGGESTION_SUBJECTS.has(tokens[start + 1]?.raw ?? '');
    if (CONSEQUENCE_AUXILIARIES.has(first.raw) && !askedOfYou) return first.raw;
    const asking = interrogative(tokens.slice(start, end));
    if (asking !== undefined) return asking;
  }
  return undefined;
}

/**
 * What a suggestion proposes, read as the request it would be: its subject set
 * aside ("what if WE | changed the hero"), "there was" read as asking for the
 * thing to exist ("what if there was a contact form" → add a contact form),
 * and its verbs read in the present — the gerund of "how about ADDING a map",
 * the past of "what if we CHANGED the hero", the Arabic past after "لو" ("ما
 * رأيك لو أضفت قسم أسعار"). Only here: elsewhere "adding" and "أضفت" describe.
 */
function proposalOf(rest: readonly IntentToken[], afterIf: boolean): readonly IntentToken[] {
  let tokens = rest;
  if (tokens.length > 1 && readsAs(tokens[0], SUGGESTION_SUBJECTS)) tokens = tokens.slice(1);
  const existential =
    EXISTENTIALS_EN.find((words) => phraseAt(tokens, 0, words)) ??
    (afterIf ? EXISTENTIALS_AR.find((words) => phraseAt(tokens, 0, words)) : undefined);
  if (existential !== undefined && tokens.length > existential.length) {
    const add = tokens[0]?.arabic === true ? 'اضف' : 'add';
    tokens = [wordLike(add, tokens[0]), ...tokens.slice(existential.length)];
  }
  /*
    Only the proposal's own verb, which stands first: in "what if the user
    has javascript DISABLED?" the participle describes, and read as "disable"
    it turned a question into edit@0.7 (probed 2026-09-28).
  */
  const [first, ...others] = tokens;
  if (first === undefined) return tokens;
  const present = first.arabic ? arabicPresentOf(first.raw) : englishPresentOf(first.raw);
  return present === undefined ? tokens : [wordLike(present, first), ...others];
}

/** A token for `word`, standing where `like` stood. */
function wordLike(word: string, like: IntentToken | undefined): IntentToken {
  const token = tokenize(word)[0];
  if (token === undefined) throw new Error(`routeIntent: “${word}” is not a word`);
  return { ...token, breakBefore: like?.breakBefore ?? false };
}

const VERB_PAIR_HEADS: ReadonlySet<string> = new Set(VERB_PAIRS_EN.map(([first]) => first));
const isEnglishVerb = (word: string): boolean => VERBS_EN.has(word) || VERB_PAIR_HEADS.has(word);

/** The last letter doubled before an ending: "swapp|ing", "putt|ing", "embedd|ed". */
const doubledEnd = (stem: string): boolean =>
  stem.length >= 3 && stem.at(-1) === stem.at(-2) && !/[aeiou]/u.test(stem.at(-1) ?? '');

/**
 * The present of an English gerund or past whose present is a verb the router
 * knows — "adding" → add, "changed" → change, "swapped" → swap, "made" →
 * make — or undefined.
 */
function englishPresentOf(raw: string): string | undefined {
  if (isEnglishVerb(raw)) return undefined;
  const irregular = IRREGULAR_PASTS_EN.get(raw);
  if (irregular !== undefined) return irregular;
  const without = (ending: string): string | undefined =>
    raw.endsWith(ending) && raw.length > ending.length + 1
      ? raw.slice(0, -ending.length)
      : undefined;
  const candidates: string[] = [];
  const ing = without('ing');
  if (ing !== undefined) {
    candidates.push(ing, `${ing}e`, ...(doubledEnd(ing) ? [ing.slice(0, -1)] : []));
  }
  const ied = without('ied');
  if (ied !== undefined) candidates.push(`${ied}y`);
  const ed = without('ed');
  if (ed !== undefined) candidates.push(ed, `${ed}e`, ...(doubledEnd(ed) ? [ed.slice(0, -1)] : []));
  return candidates.find(isEnglishVerb);
}

/**
 * The present of an Arabic past — "اضفت" → "اضف", "غيرنا" → "غير", "حذفت" →
 * "يحذف" (a stem the lexicon reads only with its present prefix) — when the
 * word is no verb as written, or undefined.
 */
function arabicPresentOf(raw: string): string | undefined {
  const isVerb = (word: string): boolean => ARABIC_VERBS.some(([pattern]) => pattern.test(word));
  if (isVerb(raw)) return undefined;
  for (const suffix of PAST_SUFFIXES_AR) {
    if (!raw.endsWith(suffix) || raw.length - suffix.length < 2) continue;
    const stem = raw.slice(0, -suffix.length);
    const present = [stem, `ي${stem.replace(/^[وف]/u, '')}`].find(isVerb);
    if (present !== undefined) return present;
  }
  return undefined;
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
  /** Positions of "this time", "هالمرة": when, never a part of the page. */
  readonly adverbs: ReadonlySet<number>;
  /** Positions of the verbs whose object is another verb: "WANT to remove", "بدي حذف". */
  readonly governing: ReadonlySet<number>;
}

function scanOf(tokens: readonly IntentToken[]): Scan {
  const adverbs = new Set<number>();
  for (let index = 0; index < tokens.length; index += 1) {
    for (const phrase of TIME_ADVERBS) {
      if (!phraseAt(tokens, index, phrase)) continue;
      for (let offset = 0; offset < phrase.length; offset += 1) adverbs.add(index + offset);
    }
  }
  const nouns = tokens.map((_token, index) =>
    adverbs.has(index) ? undefined : nounAt(tokens, index),
  );
  const verbs: Verb[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const found = verbAt(tokens, index);
    if (found === undefined) continue;
    verbs.push(found);
    index += found.width - 1;
  }
  const spoken = verbalNounsOf(tokens, nouns, verbs);
  const all = spoken.length === 0 ? verbs : [...verbs, ...spoken].sort((a, b) => a.index - b.index);
  return { tokens, nouns, verbs: all, adverbs, governing: governingVerbs(tokens, all) };
}

/**
 * The verbs whose object is ANOTHER verb — "I want TO REMOVE a page", "we need
 * to delete a section", "بدي حذف قسم الأسئلة" — by position. The governed verb
 * says what is asked; the governing one only says that it is wanted, and its
 * object is read nowhere.
 *
 * Read as the want's object, "a page" and "قسم الأسئلة" were a page or a
 * section to MAKE: "I want to remove a page" routed build-page/replace@0.9 on
 * an empty page and new-page@0.75 beside content, "بدي حذف قسم الأسئلة"
 * add-section@0.85 — a deletion that would have written a page or a section
 * (router-3 probe, 2026-09-28). "I want to build a website" reads the same
 * with or without this: its governed verb asks for the page itself.
 */
function governingVerbs(
  tokens: readonly IntentToken[],
  verbs: readonly Verb[],
): ReadonlySet<number> {
  const governing = new Set<number>();
  for (const found of verbs) {
    let next = found.index + found.width;
    while (next < tokens.length && readsAs(tokens[next], OBJECT_FILLERS)) next += 1;
    if (verbs.some((other) => other.index === next)) governing.add(found.index);
  }
  return governing;
}

/** A verb whose own object is what it asks for: not an edit, and not governing another verb. */
const asksForItsObject = (scan: Scan, found: Verb): boolean =>
  found.kind !== 'edit' && !scan.governing.has(found.index);

/**
 * The MSA verbal nouns of change that stand as the request's verb: the first
 * word ("تغيير عنوان القسم إلى مرحبا", and after courtesy: "هل يمكن | تعديل
 * رقم الهاتف؟", "الرجاء | حذف قسم المنيو"), or the object of a want, a make
 * or a must ("أريد تعديل السعر", "سوي تغيير بسيط", "لازم تغيير الخط").
 *
 * A first word must be followed by something on the page — a part the lexicon
 * names, or a definite word — because a verbal noun also names a trade: "نقل
 * عفش في عمان" (furniture moving in Amman) and "ترجمة معتمدة" (certified
 * translation) are briefs on an empty page, not changes.
 */
function verbalNounsOf(
  tokens: readonly IntentToken[],
  nouns: readonly (Noun | undefined)[],
  verbs: readonly Verb[],
): Verb[] {
  const found: Verb[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.arabic !== true || !isChangeVerbalNoun(token)) continue;
    if (verbs.some((verb) => verb.index === index)) continue;
    const governed =
      verbs.some(
        (verb) => verb.index === index - 1 && verb.kind !== 'edit' && verb.kind !== 'add',
      ) || VERB_GOVERNORS_AR.has(tokens[index - 1]?.raw ?? '');
    if (governed || (index === 0 && namesWhatExists(tokens, nouns, index + 1))) {
      found.push({ index, kind: 'edit', width: 1 });
    }
  }
  return found;
}

/** A change's verbal noun as written, or with the "and" a sentence glues on — never "التعديل". */
function isChangeVerbalNoun(token: IntentToken): boolean {
  return (
    CHANGE_VERBAL_NOUNS_AR.has(token.raw) ||
    (/^[وف]/u.test(token.raw) && CHANGE_VERBAL_NOUNS_AR.has(token.raw.slice(1)))
  );
}

/**
 * Whether the phrase from `from` names a part of the page, or a word with its
 * article ("رقم هاتف العيادة"). The article only: a possessive reading makes
 * "عربي" "my Arab", and "ترجمة عربي انجليزي" (a translation office) an edit.
 */
function namesWhatExists(
  tokens: readonly IntentToken[],
  nouns: readonly (Noun | undefined)[],
  from: number,
): boolean {
  for (let index = from; index < Math.min(tokens.length, from + PHRASE_MAX); index += 1) {
    const token = tokens[index];
    if (token === undefined || (index > from && token.breakBefore) || endsPhrase(token)) break;
    if (nouns[index] !== undefined || withArticle(token)) return true;
  }
  return false;
}

/** An Arabic word carrying the article, alone or after و/ف/ب/ك/ل: "العيادة", "بالعيادة", "للعيادة". */
function withArticle(token: IntentToken): boolean {
  return (
    token.arabic &&
    token.raw.length >= 4 &&
    /^[وف]?(?:ال|بال|كال|لل)/u.test(token.raw) &&
    !NOT_THE_ARTICLE.has(token.raw)
  );
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
  const kind =
    VERBS_EN.get(token.raw) ??
    (leadsAsAVerb(tokens, index) ? LEADING_VERBS_EN.get(token.raw) : undefined);
  return kind === undefined ? undefined : { index, kind, width: 1 };
}

/**
 * Whether the word at `index` stands where a request's verb does — first, or
 * first after a break — with its object right after it: "LINK this page…",
 * "DO a landing page…". Followed by a preposition it is the noun: "link in
 * bio page for my shop", "link to my instagram in the footer".
 */
function leadsAsAVerb(tokens: readonly IntentToken[], index: number): boolean {
  const token = tokens[index];
  const next = tokens[index + 1];
  if (token === undefined || next === undefined || next.breakBefore) return false;
  return (index === 0 || token.breakBefore) && !PHRASE_STOPS.has(next.raw);
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
  /** The index just past the phrase's last word. */
  readonly end: number;
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
  let end = start;
  for (let index = start; index < Math.min(tokens.length, start + PHRASE_MAX); index += 1) {
    const token = tokens[index];
    if (token === undefined) break;
    if (index > from && token.breakBefore) break;
    if (stopsPhraseAt(tokens, index)) break;
    const noun = scan.nouns[index];
    end = index + (noun?.width ?? 1);
    if (noun === undefined) continue;
    nouns.push(noun);
    index += noun.width - 1;
  }
  const head = pickHead(nouns);
  return {
    head,
    headDefinite: head === undefined ? false : definiteAt(tokens, start, head),
    end,
  };
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
  /** The request IS one new section, named with no verb: "a nav with links to home and blog". */
  readonly partPhrase?: string;
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
    if (!asksForItsObject(scan, found)) continue;
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
  const partPhrase = openingPartPhrase(scan, comparative);
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
    acting:
      scan.verbs.length > 0 || comparative || nounPhrase !== undefined || partPhrase !== undefined,
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
    ...(partPhrase === undefined ? {} : { partPhrase }),
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
  if (found.kind !== 'want' || found.index === 0 || scan.governing.has(found.index)) return false;
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

/** Words that join a LIST of parts: "a hero, THEN a menu", "هيرو وقسم منيو". */
const PART_LIST_JOINS: ReadonlySet<string> = new Set(['and', 'then', 'or', 'plus', 'ثم', 'او']);

/**
 * A request that IS one new section, named with no verb: "a nav with links to
 * home, blog and contact", "بانر وداع سامر ووسيم", "قسم أسعار بثلاث باقات".
 * What heads the phrase is what is asked for, as it is after "add": read as a
 * page's brief, the nav above built a whole page on an empty canvas,
 * build-page/replace@0.6 (wave-2 router owner's not-done list, 2026-09-28).
 *
 * Only a NEW section — English names one with its article ("A nav", "another
 * hero"), so a terse "hero title: Welcome" is the hero that exists — with no
 * verb before it, nothing compared or stated about it ("a darker hero", "the
 * hero is…"), and no second part LISTED after it: "a hero with a photo, then
 * a menu, then contact" describes a page. Not an ELEMENT: an element heads
 * pages as often — "an Eid al-Fitr card for our clients" is a greeting page,
 * and read as a part it lost the occasion playbook (probed 2026-09-28). And
 * not a section that is also a page's NAME ("a menu for my restaurant", "a
 * gallery of my work") unless a section word says which: "a menu section".
 */
function openingPartPhrase(scan: Scan, comparative: boolean): string | undefined {
  const { tokens } = scan;
  if (comparative || tokens.some((token) => COPULAS.has(token.raw))) return undefined;
  const phrase = phraseFrom(scan, 0, false);
  const head = phrase.head;
  if (head?.category !== 'section' || phrase.headDefinite) return undefined;
  if (constructIsDefinite(scan, head)) return undefined;
  const saysSection = tokens.slice(0, phrase.end).some((token) => readsAs(token, SECTION_WORDS));
  const headToken = tokens[head.index];
  if (!saysSection && headToken !== undefined && isPageName(headToken)) return undefined;
  if (scan.verbs.some((found) => found.index < head.index)) return undefined;
  const arabic = ARABIC_STEM.test(head.stem);
  if (!arabic) {
    const named = tokens
      .slice(0, head.index)
      .some((token) => INDEFINITE_EN.has(token.raw) || NEW_WORDS_EN.has(token.raw));
    if (!named) return undefined;
  }
  const listsAnother = scan.nouns.some((noun, index) => {
    if (noun?.category !== 'section' || index < phrase.end) return false;
    // "…وقسم منيو": the Arabic "and" glued to the second section lists it.
    const token = tokens[index];
    if (token?.arabic === true && token.raw.startsWith('و') && noun.stem !== token.raw) return true;
    const start = phraseStart(tokens, index);
    const before = tokens[start - 1];
    return (
      tokens[start]?.breakBefore === true ||
      (before !== undefined && PART_LIST_JOINS.has(before.raw))
    );
  });
  return listsAnother ? undefined : spelled(scan, head);
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
  const creative = verbs.some((found) => asksForItsObject(scan, found) && found.kind !== 'add');
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
      asksForItsObject(scan, found) &&
      fresh(phraseFrom(scan, found.index + found.width, true).head),
  );
}

/** The head of what the first verb that makes, wants or adds is asked for, if it names one. */
function firstObjectHead(scan: Scan): Noun | undefined {
  for (const found of scan.verbs) {
    if (!asksForItsObject(scan, found)) continue;
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
  const strong = earliestRestart(scan);
  if (strong !== undefined) {
    const phrase = strong.phrase.join(' ');
    const aim = startOverAim(scan, strong.at, strong.phrase);
    if (aim === 'part') return { aim: 'part', phrase };
    return { aim: 'page', phrase, namesPage: aim === 'page', brief: hasBrief(scan, strong.at) };
  }
  /*
    "Delete everything and build a website for my bakery" said what goes and
    what replaces it; read without this, the build went BESIDE the content
    the person had just asked to delete (probed 2026-09-28).
  */
  if (pageBeingMade !== undefined) {
    for (const phrase of CLEAR_ALL) {
      const at = findPhrase(tokens, phrase);
      if (at < 0) continue;
      return { aim: 'page', phrase: phrase.join(' '), namesPage: true, brief: hasBrief(scan, at) };
    }
  }
  for (const phrase of REPLACE_WEAK) {
    const at = findPhrase(tokens, phrase);
    if (at < 0) continue;
    const page = { aim: 'page', phrase: phrase.join(' '), namesPage: true } as const;
    if (phrase.join(' ') === 'من جديد') {
      if (pageBeingMade !== undefined) return { ...page, brief: hasBrief(scan, at) };
      if (startOverAim(scan, at, phrase) === 'part') return { aim: 'part', phrase: page.phrase };
      continue;
    }
    if (isPageLevel(phraseFrom(scan, at + phrase.length, false).head)) {
      return { ...page, brief: hasBrief(scan, at) };
    }
  }
  return undefined;
}

/** The strong start-over that starts first in the request, the longer one on a tie. */
function earliestRestart(
  scan: Scan,
): { readonly at: number; readonly phrase: readonly string[] } | undefined {
  let found: { at: number; phrase: readonly string[] } | undefined;
  for (const phrase of REPLACE_STRONG) {
    for (let at = 0; at < scan.tokens.length; at += 1) {
      if (found !== undefined && at > found.at) break;
      if (!restartsAt(scan, at, phrase)) continue;
      if (found === undefined || at < found.at || phrase.length > found.phrase.length) {
        found = { at, phrase };
      }
      break;
    }
  }
  return found;
}

const RESTART_VERBS: ReadonlySet<string> = new Set(RESTART_VERBS_AR);

/** Words of conversation a verb may follow: "يلا عيد تصميمها", "طيب أعد بناء الصفحة". */
const LEAD_INS_AR: ReadonlySet<string> = new Set([
  'يلا',
  'طيب',
  'اوكي',
  'تمام',
  'خلينا',
  'هلا',
  'خلص',
  'خلاص',
  'الان',
]);

/**
 * Whether the strong start-over `phrase` stands at `at`.
 *
 * The Arabic restart verbs are checked as VERBS: written as the verb (or with
 * a glued و/ف), their object written bare — "عيد بتصميم ذهبي" is Eid "with a
 * golden design" — and standing where a verb stands: first in the request or
 * its clause, after a join, a lead-in ("يلا", "طيب"), a must ("لازم"), a want
 * or a make ("بدي إعادة تصميم"), or the assistant's name. After a noun it is
 * that noun's complement: "بطاقة عيد تصميم بسيط" is an Eid card, and
 * "خدمات إعادة تصميم المواقع" website-redesign services — both routed as a
 * confident start-over before (wave-2 verifier, 2026-09-28: build-page/replace
 * @0.85 over a page with content).
 */
function restartsAt(scan: Scan, at: number, phrase: readonly string[]): boolean {
  const { tokens } = scan;
  if (!phraseAt(tokens, at, phrase)) return false;
  const [verb, object] = phrase;
  if (verb === undefined || !RESTART_VERBS.has(verb)) return true;
  const token = tokens[at];
  if (token === undefined) return false;
  const glued = /^[وف]/u.test(token.raw) && token.raw.slice(1) === verb;
  if (token.raw !== verb && !glued) return false;
  if (object !== undefined && tokens[at + 1]?.raw !== object) return false;
  if (at === 0 || token.breakBefore || glued) return true;
  const before = tokens[at - 1];
  if (before === undefined) return true;
  return (
    CLAUSE_JOINS.has(before.raw) ||
    LEAD_INS_AR.has(before.raw) ||
    VERB_GOVERNORS_AR.has(before.raw) ||
    scan.verbs.some((found) => found.index === at - 1 && found.kind !== 'edit') ||
    OPENERS.some((opener) => phraseAt(tokens, at - opener.words.length, opener.words))
  );
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

/**
 * Where a start-over's object starts: past "on", "with", "في" — "start over ON
 * | the hero" — and past "this time". Undefined past a break: a verb's object
 * never sits beyond a comma, a full stop or a dash, so "start over, the footer
 * can stay" and "ابدأ من جديد، الألوان كلها غلط" restart the page and COMMENT on
 * a part. Read across the break, they aimed the start-over at that part and
 * routed edit@0.8 (wave-2 verifier, 2026-09-28). A link word carries its
 * object across: "start over, with a landing page for…".
 */
function objectAfter(scan: Scan, at: number, phrase: readonly string[]): number | undefined {
  const { tokens } = scan;
  let next = at + phrase.length;
  const first = tokens[next];
  /*
    An ADVERB that opens its clause alone modifies the next one: "from
    scratch, | redesign the pricing section" restarts the pricing section.
    After its own verb ("ابدأ من الصفر، …") it has its object already.
  */
  const leads =
    isAdverbial(phrase) &&
    !scan.verbs.some((found) => found.index < at && found.index >= clauseStart(tokens, at, phrase));
  if (first?.breakBefore === true && !START_OVER_LINKS.has(first.raw) && !leads) return undefined;
  while (
    next < tokens.length &&
    (START_OVER_LINKS.has(tokens[next]?.raw ?? '') ||
      readsAs(tokens[next], OBJECT_FILLERS) ||
      scan.adverbs.has(next))
  ) {
    next += 1;
  }
  return next;
}

/** The object after the phrase: "start over on | the hero". */
function aimAfter(scan: Scan, at: number, phrase: readonly string[]): StartOverAim {
  const object = objectAfter(scan, at, phrase);
  return object === undefined ? undefined : aimOf(phraseFrom(scan, object, false).head);
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
  const object = objectAfter(scan, at, phrase);
  if (object !== undefined && readsAs(tokens[object], OBJECT_PRONOUNS)) return true;
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
function hasBrief(scan: Scan, at: number): boolean {
  const { tokens } = scan;
  const covered = coveredWords(scan);
  const clauses = clausesOf(tokens);
  const restart = clauses.findIndex(([start, end]) => at >= start && at < end);
  /* The clause after the restarting one, past any that is only "and" / "but". */
  const after = clauses.findIndex(
    ([start, end], index) =>
      index > restart && tokens.slice(start, end).some((token) => !CLAUSE_JOINS.has(token.raw)),
  );
  return clauses.some(([start, end], index) => {
    const from =
      briefStart(scan, start, end) ??
      (index === after ? describesTheBusiness(scan, start, end) : undefined);
    if (from === undefined) return false;
    for (let position = from; position < end; position += 1) {
      const token = tokens[position];
      if (token !== undefined && !covered.has(position) && !saysNoSubject(token)) return true;
    }
    return false;
  });
}

/** The article or demonstrative a clause about what EXISTS opens with: "THE footer can stay". */
const POINTING_EN: ReadonlySet<string> = new Set([
  'the',
  'this',
  'that',
  'these',
  'those',
  'its',
  'all',
  'every',
  'each',
]);

/**
 * Where the clause right after a start-over says what the next page is FOR,
 * with no verb: "start over: | bakery in Amman", "rebuild the page — | we're a
 * dental clinic now", "ابدأ من جديد، | احنا صرنا مطعم". Undefined when it
 * comments on what exists instead: it opens with an article, a demonstrative,
 * a pronoun or a part of the page ("the footer can stay", "الألوان كلها غلط",
 * "hero too big"), with the person's own opinion ("I don't like it"), or it
 * judges or denies anything ("…was ugly", "النص مش واضح").
 *
 * Only the clause right after the restart: that is where a brief follows a
 * start-over. Missing it, those briefed start-overs routed at the bare 0.5
 * (wave-2 verifier, 2026-09-28) — the host would have asked what the page is
 * for right after being told.
 */
function describesTheBusiness(scan: Scan, start: number, end: number): number | undefined {
  const { tokens } = scan;
  // A clause with a verb is `briefStart`'s to read: "…and this time USE a serif font" is how.
  if (scan.verbs.some((found) => found.index >= start && found.index < end)) return undefined;
  let from = start;
  while (
    from < end &&
    (CLAUSE_JOINS.has(tokens[from]?.raw ?? '') ||
      scan.adverbs.has(from) ||
      readsAs(tokens[from], BARE_START_OVER_WORDS))
  ) {
    from += 1;
  }
  const first = tokens[from];
  if (first === undefined || from >= end) return undefined;
  if (POINTING_EN.has(first.raw) || DEFINITE_AR.has(first.raw) || carriesArticle(first)) {
    return undefined;
  }
  if (PRONOUNS.has(first.raw) || /^(?:it|that|they|there|you)'/u.test(first.raw)) return undefined;
  // "…, with a darker look" says how; "…, you messed up" talks to the assistant.
  if (PHRASE_STOPS.has(first.raw) || readsAs(first, FUNCTION_WORDS)) return undefined;
  const noun = scan.nouns[from];
  if (noun !== undefined && !isPageLevel(noun)) return undefined;
  if (first.raw === 'i' && tokens[from + 1]?.raw !== 'am') return undefined;
  for (let index = from; index < end; index += 1) {
    if (readsAs(tokens[index], JUDGMENTS) || readsAs(tokens[index], NEGATIONS)) return undefined;
  }
  return from;
}

/** Every word that is structure, not subject: phrases, verbs, the lexicon's nouns, courtesy. */
function coveredWords(scan: Scan): ReadonlySet<number> {
  const { tokens } = scan;
  const covered = new Set<number>(scan.adverbs);
  const cover = (phrase: readonly string[]): void => {
    for (let index = 0; index < tokens.length; index += 1) {
      if (!phraseAt(tokens, index, phrase)) continue;
      for (let offset = 0; offset < phrase.length; offset += 1) covered.add(index + offset);
    }
  };
  for (const phrase of REPLACE_STRONG) {
    for (let index = 0; index < tokens.length; index += 1) {
      if (!restartsAt(scan, index, phrase)) continue;
      for (let offset = 0; offset < phrase.length; offset += 1) covered.add(index + offset);
    }
  }
  for (const phrases of [REPLACE_WEAK, CLEAR_ALL]) phrases.forEach(cover);
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
        const stands =
          phrases === REPLACE_STRONG
            ? restartsAt(scan, index, phrase)
            : phraseAt(tokens, index, phrase);
        if (!stands) continue;
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
  /*
    How, who and what-was-wrong are not WHAT the page is for: "start over, and
    make it BETTER" routed at a briefed 0.85 on "better" (wave-2 verifier,
    2026-09-28); "we're" alone names nobody.
  */
  COMPARATIVES,
  IDENTITY_WORDS,
  JUDGMENTS,
  NEGATIONS,
  COPULAS,
  FUNCTION_WORDS,
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
    if (!asksForItsObject(scan, found)) continue;
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
