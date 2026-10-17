import { systemClock, type BuilderKernel } from '@craftkit/builder-core';
import type { BuilderDocument, Node, NodeId } from '@craftkit/builder-schema';

import { resolveAiCompositionPolicy, type AiCompositionPolicy } from '../context/composition-policy';
import {
  namedSection,
  namingWords,
  outlinePageSections,
  parentsOf,
  sectionMentions,
  sectionOf,
  stemsOf,
  subtreeIds,
  treeElementText,
  type NamingWord,
  type PageSectionOutline,
} from '../context/document-tree-mode';
import { summarizeDocumentForIntent } from '../intent/document-summary';
import { tokenize } from '../intent/intent-tokens';
import { normalizeIntentText } from '../intent/normalize-arabic';
import { routeIntent, type IntentRoute } from '../intent/route-intent';
import { resolveAiCommandPolicy, type AiEffectiveCommandPolicy } from '../skills';
import type { AiPlan, AiPlanStep, AiValidationPorts } from '../types';
import { EDIT_TREE_COMMAND, expandTreeEdits } from './tree-edits';
import { serializeTreeMarkup } from './tree-markup';
import { validateAiPlan } from './validate-plan';

/**
 * ZERO-TOKEN EDITS: the small change a person states in full, made without
 * asking a model (fast-edits, 2026-09-28).
 *
 * ## Why
 *
 * «تغيير عنوان قسم التعليم والشهادات إلى مرحبا» carried 11,368 wire tokens
 * and took 46 s through cli:haiku (ai-server log, 2026-09-28: 1,560 output
 * tokens to rewrite a whole region for one h2). Every fact that edit needed
 * was in the sentence: WHAT (a title), WHERE (the section named «التعليم
 * والشهادات») and the NEW TEXT («مرحبا»). Reading those off the words and
 * finding the one element they point at is a parse and a tree walk —
 * milliseconds, no tokens — and the result still lands only through the
 * kernel door, like any model's plan.
 *
 * ## What it reads
 *
 * A change verb (MSA and Levantine غيّر/بدّل/عدّل/اجعل/خلّي/حط/سمّي, their
 * verbal nouns and imperfects; English change/rename/replace/set/make/update…),
 * a ROLE — a title or heading, a button, the phone number, the email, a
 * price — with an optional locator («عنوان قسم X», «العنوان تبع X», "the
 * title of the X section", "the X heading", «في قسم X»), and the NEW TEXT
 * after a marker (إلى/لـ/بـ/ليصبح/يقول…, to/with/as/say…), quoted or not. Or
 * a text swap: «"A" بدل "B"», "replace 'A' with 'B'", "change A to B".
 *
 * ## What it refuses
 *
 * Everything it is not sure of, by returning `null`; the model path then
 * runs exactly as before. Two candidate elements, a name that fits two
 * sections, a bare «العنوان» with nothing selected (it also means "the
 * address"), a value glued to a bare «ل» with no tatweel or quote («لبنان» is
 * a word, not «ل»+«بنان»), a short value that reads as a style ("blue",
 * «أكبر»: "make the button blue" is not a label), a phone with too few
 * digits, a route that is not an edit, a new text that is only a pronoun
 * ("retitle it" names where, not what), a request holding an @mention (the
 * panel's pointer, read with the words only on the model path). A wrong
 * zero-token edit costs the person more than a right one-call edit.
 */

export type DirectEditRole = 'title' | 'button' | 'phone' | 'email' | 'price' | 'text';

/** One prop a direct edit writes. */
export interface DirectEditChange {
  /** The node written. */
  readonly nodeId: NodeId;
  /** The page section (a child of the root) holding it. */
  readonly sectionId: NodeId;
  /** `tree` for a composed region; the text prop's key for a registered block. */
  readonly key: string;
  /** For a composed region: child indices from the tree root to the element changed. */
  readonly path?: readonly number[];
  /** The text (or, for a link, the href) before, and after. */
  readonly before: string;
  readonly after: string;
}

/** What a direct edit points at. */
export interface DirectEditTarget {
  readonly role: DirectEditRole;
  /** The section of the first change. */
  readonly sectionId: NodeId;
  /** That section's name as the page shows it (its label, else its heading), when it has one. */
  readonly sectionName?: string;
  /** Every prop written, in page order; more than one only when one value shows in several places. */
  readonly changes: readonly DirectEditChange[];
}

export interface DirectEdit {
  /**
   * The plan: `setProp` steps only (an `editTree` is expanded before the
   * door), validated by the door's rehearsal unless `dryRun: false` left that
   * to the caller's `applyAiPlan`.
   */
  readonly plan: AiPlan;
  readonly target: DirectEditTarget;
  /** One sentence in the request's language, e.g. «تغيير عنوان «التعليم والشهادات» إلى «مرحبا»». */
  readonly summary: string;
  readonly language: 'ar' | 'en';
}

export interface TryDirectEditOptions {
  /** Blocks the person pointed at (canvas selection or @mentions). Absent: the kernel's selection. */
  readonly selection?: readonly NodeId[];
  /** The router's reading. Absent: routed here against the page. Anything but `edit` returns null. */
  readonly route?: IntentRoute;
  /** Ports for the door's dry run. Absent: a wall clock and throwaway ids (a setProp mints none). */
  readonly validationPorts?: AiValidationPorts;
  /** The run's effective command policy. Absent: every registered command, default limits. */
  readonly policy?: AiEffectiveCommandPolicy;
  /** The run's composition policy (vocabulary enforcement, colour policy) for the door. */
  readonly composition?: AiCompositionPolicy;
  /**
   * `false` skips the door's rehearsal here, for a caller that applies the
   * plan at once through `applyAiPlan`: that door rehearses it again anyway,
   * and refuses it before any write (`AiPlanRejectedError`). A rehearsal
   * rebuilds and re-validates the whole page, so an Auto edit paid for two
   * (final test, 2026-09-28). Everything else still runs: the parse, the ONE
   * element, the tree edit reading back as meant. Default: rehearse.
   */
  readonly dryRun?: boolean;
}

/** A person types an edit on one line; a multi-line brief is never a direct edit. */
const MAX_REQUEST_CHARS = 280;
const MAX_VALUE_CHARS = 160;
/** A value this short that names a style is a style: "blue", «أكبر», "bold and centered". */
const STYLE_VALUE_MAX_WORDS = 3;
const CUSTOM_CODE = 'customCode';
const TREE_WALK_LIMIT = 4_000;
/** The verb opens the request, after at most this many words of courtesy or topic. */
const VERB_WINDOW = 6;

type Json = Record<string, unknown>;

/** A vocabulary written as folded words separated by spaces, one or more lines of them. */
function wordSet(...lines: readonly string[]): ReadonlySet<string> {
  return new Set(lines.flatMap((line) => line.trim().split(/\s+/u)));
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── The request as tokens ────────────────────────────────────────────────────

interface Token {
  readonly kind: 'word' | 'quote' | 'mark';
  /** As typed: a word, a quote's inner text, or the mark itself. */
  readonly raw: string;
  /** Offset of the token in the request (a quote: its opening mark). */
  readonly start: number;
  /** Offset just past it (a quote: past its closing mark). */
  readonly end: number;
  /** Folded for matching (normalizeIntentText). */
  readonly norm: string;
  /** Every reading's stem: Arabic clitics peeled, plurals folded. */
  readonly stems: ReadonlySet<string>;
  /** A glued «لـ»/«بـ» (or ل/ب before a digit, a Latin letter or a quote) opened this token. */
  readonly glued?: { readonly marker: 'to' | 'with'; readonly valueStart: number };
}

const QUOTE_PAIRS: readonly (readonly [string, string])[] = [
  ['«', '»'],
  ['“', '”'],
  ['"', '"'],
  ['„', '“'],
  ['`', '`'],
  ["'", "'"],
];

const WORD = /[\p{L}\p{M}\p{N}_]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
const MARKS = /->|→|⟶|=>|=|:/gu;
const TATWEEL = 'ـ';
const ARABIC = /[؀-ۿ]/u;

function stemsFor(norm: string): ReadonlySet<string> {
  const [token] = tokenize(norm);
  return token === undefined ? new Set([norm]) : stemsOf(token);
}

/**
 * «لـمرحبا», «بـ0791…», «لHello»: a preposition glued to the value. Only when
 * the glue is unmistakable — a tatweel, or a digit or Latin letter after the
 * letter. «لمرحبا» stays one word: «لبنان» is a place, not «ل»+«بنان».
 */
function gluedMarkerOf(raw: string, start: number): Token['glued'] {
  const first = raw.charAt(0);
  if (first !== 'ل' && first !== 'ب') return undefined;
  const marker = first === 'ل' ? 'to' : 'with';
  if (raw.charAt(1) === TATWEEL) {
    let at = 1;
    while (raw.charAt(at) === TATWEEL) at += 1;
    return at < raw.length ? { marker, valueStart: start + at } : undefined;
  }
  return /^[0-9٠-٩۰-۹A-Za-z]/u.test(raw.slice(1)) ? { marker, valueStart: start + 1 } : undefined;
}

function wordToken(raw: string, start: number): Token {
  const norm = normalizeIntentText(raw);
  const glued = gluedMarkerOf(raw, start);
  return {
    kind: 'word',
    raw,
    start,
    end: start + raw.length,
    norm,
    stems: stemsFor(norm),
    ...(glued === undefined ? {} : { glued }),
  };
}

function quoteAt(request: string, at: number): { close: number; inner: string } | undefined {
  const open = request.charAt(at);
  const pair = QUOTE_PAIRS.find(([opening]) => opening === open);
  if (pair === undefined) return undefined;
  if (open === "'" || open === '`') {
    // An apostrophe inside a word ("don't", "Reem's") is not a quote.
    const before = request.charAt(at - 1);
    if (at > 0 && /[\p{L}\p{N}]/u.test(before) && before !== 'ل' && before !== 'ب') return undefined;
  }
  const close = request.indexOf(pair[1], at + 1);
  if (close < 0) return undefined;
  const inner = request.slice(at + 1, close);
  if (inner.trim() === '') return undefined;
  if (open === "'" && /[\p{L}\p{N}]/u.test(request.charAt(close + 1))) return undefined;
  return { close, inner };
}

/** The request as words, quotes and marks, each with its offsets in the text as typed. */
function scan(request: string): readonly Token[] {
  const tokens: Token[] = [];
  const flush = (plain: string, offset: number): void => {
    const pieces: Token[] = [];
    for (const match of plain.matchAll(WORD)) {
      pieces.push(wordToken(match[0], offset + match.index));
    }
    for (const match of plain.matchAll(MARKS)) {
      const start = offset + match.index;
      pieces.push({
        kind: 'mark',
        raw: match[0],
        start,
        end: start + match[0].length,
        norm: match[0],
        stems: new Set([match[0]]),
      });
    }
    tokens.push(...pieces.sort((left, right) => left.start - right.start));
  };
  let plainStart = 0;
  for (let at = 0; at < request.length; ) {
    const quote = quoteAt(request, at);
    if (quote === undefined) {
      at += 1;
      continue;
    }
    flush(request.slice(plainStart, at), plainStart);
    const norm = normalizeIntentText(quote.inner);
    tokens.push({
      kind: 'quote',
      raw: quote.inner.trim(),
      start: at,
      end: quote.close + 1,
      norm,
      stems: new Set([norm]),
    });
    at = quote.close + 1;
    plainStart = at;
  }
  flush(request.slice(plainStart), plainStart);
  // «لـ"مرحبا"», «ب«أهلا»»: a lone ل/ب glued to the quote after it is that quote's marker.
  return tokens.map((token, index) => {
    const next = tokens[index + 1];
    if (token.kind !== 'word' || next?.kind !== 'quote' || next.start !== token.end) return token;
    const bare = token.raw.replaceAll(TATWEEL, '');
    if (bare !== 'ل' && bare !== 'ب') return token;
    return { ...token, glued: { marker: bare === 'ل' ? 'to' : 'with', valueStart: next.start } };
  });
}

// ── The vocabulary ────────────────────────────────────────────────────────────

type VerbClass = 'change' | 'make' | 'put' | 'rename' | 'replace';

/** Arabic verb forms over a folded token: و/ف, the imperfect prefixes, the object suffixes. */
const AR_SUFFIX = '(?:ي|و|وا|ين|لي|للي|لنا|ه|ها|هم|يه|يها|وه|وها|يلي)?';
const arVerb = (stem: string, prefixes = '(?:ا|ت|ي|ن)?'): RegExp =>
  new RegExp(`^[وف]?${prefixes}${stem}${AR_SUFFIX}$`, 'u');
const arNoun = (stem: string): RegExp => new RegExp(`^[وف]?(?:ب|ل)?(?:ال)?${stem}$`, 'u');

const AR_VERBS: readonly (readonly [RegExp, VerbClass])[] = [
  [arVerb('غير'), 'change'],
  [arVerb('عدل'), 'change'],
  [arVerb('حول'), 'change'],
  [arVerb('حدث'), 'change'],
  [arVerb('صحح'), 'change'],
  [arVerb('بدل'), 'replace'],
  [arVerb('ستبدل'), 'replace'],
  [arNoun('تغيير'), 'change'],
  [arNoun('تعديل'), 'change'],
  [arNoun('تحويل'), 'change'],
  [arNoun('تحديث'), 'change'],
  [arNoun('تصحيح'), 'change'],
  [arNoun('تبديل'), 'replace'],
  [arNoun('استبدال'), 'replace'],
  [arVerb('جعل'), 'make'],
  [/^[وف]?(?:ت|ن)?خل(?:ي|يه|يها|يلي|يو|وه|وها|و)$/u, 'make'],
  [arVerb('سمي'), 'rename'],
  [arNoun('تسميه'), 'rename'],
  [arVerb('حط'), 'put'],
  [/^[وف]?ضع(?:ي|و|وا)?$/u, 'put'],
  [arVerb('كتب'), 'put'],
  [arNoun('كتابه'), 'put'],
];

const EN_VERBS: ReadonlyMap<string, VerbClass> = new Map([
  ['change', 'change'],
  ['update', 'change'],
  ['edit', 'change'],
  ['modify', 'change'],
  ['alter', 'change'],
  ['correct', 'change'],
  ['fix', 'change'],
  ['switch', 'change'],
  ['turn', 'change'],
  ['replace', 'replace'],
  ['swap', 'replace'],
  ['rename', 'rename'],
  ['retitle', 'rename'],
  ['name', 'rename'],
  ['call', 'rename'],
  ['make', 'make'],
  ['set', 'make'],
  ['put', 'put'],
  ['write', 'put'],
]);

function verbOf(token: Token | undefined): VerbClass | undefined {
  if (token?.kind !== 'word') return undefined;
  if (ARABIC.test(token.norm)) return AR_VERBS.find(([pattern]) => pattern.test(token.norm))?.[1];
  return EN_VERBS.get(token.norm);
}

/** The role nouns, by stem. «رقم» alone is not a phone: a statistic is a number too. */
const ROLE_WORDS: ReadonlyMap<string, DirectEditRole> = new Map([
  ['عنوان', 'title'],
  ['هيدنج', 'title'],
  ['هيدينج', 'title'],
  ['title', 'title'],
  ['heading', 'title'],
  ['headline', 'title'],
  ['زر', 'button'],
  ['زرار', 'button'],
  ['بوتون', 'button'],
  ['بتن', 'button'],
  ['button', 'button'],
  ['cta', 'button'],
  ['هاتف', 'phone'],
  ['تلفون', 'phone'],
  ['تليفون', 'phone'],
  ['جوال', 'phone'],
  ['موبايل', 'phone'],
  ['phone', 'phone'],
  ['telephone', 'phone'],
  ['mobile', 'phone'],
  ['ايميل', 'email'],
  ['اميل', 'email'],
  ['بريد', 'email'],
  ['email', 'email'],
  ['mail', 'email'],
  ['سعر', 'price'],
  ['ثمن', 'price'],
  ['price', 'price'],
  ['cost', 'price'],
  ['نص', 'text'],
  ['كلمه', 'text'],
  ['عباره', 'text'],
  ['جمله', 'text'],
  ['text', 'text'],
  ['word', 'text'],
  ['wording', 'text'],
  ['label', 'text'],
]);

/** «رقم التواصل» (the contact number): a number that says it is a phone. */
const PHONE_NUMBER_WORDS: ReadonlySet<string> = new Set(['تواصل', 'اتصال', 'واتس', 'واتساب']);
/** Words that complete a role rather than locate it: «رقم الهاتف», «البريد الإلكتروني», "phone number". */
const ROLE_COMPANIONS: ReadonlySet<string> = new Set(['رقم', 'الكتروني', 'number', 'no', 'address', 'e']);

/** Where two role words share a phrase, the stronger wins: «نص الزر» is the button. */
const ROLE_RANK: Readonly<Record<DirectEditRole, number>> = {
  phone: 5,
  email: 5,
  price: 4,
  button: 3,
  title: 2,
  text: 1,
};

/** Separate-word markers before the new text. */
const TO_MARKERS: ReadonlySet<string> = wordSet(
  'الي ل to into as ليصبح لتصبح ليكون لتكون ليصير لتصير يصبح تصبح يصير تصير يكون تكون',
  'يقول تقول say says read reads',
);
const WITH_MARKERS: ReadonlySet<string> = new Set(['ب', 'with', 'by']);
/** Markers whose own next word is part of them: "to be", «إلى أن يصبح». */
const MARKER_TAILS: ReadonlySet<string> = new Set(['be', 'say', 'read', 'ان', 'يصبح', 'تصبح', 'يكون', 'تكون']);
/** "X instead of Y" / «X بدل Y»: the new text first. */
const INSTEAD: ReadonlySet<string> = new Set(['بدل', 'بدال', 'مكان', 'instead']);

/** Words that never carry meaning for the target. */
const FILLERS: ReadonlySet<string> = wordSet(
  'the a an of my our your its please pls kindly can could would will you u i i\'d want',
  'need like just also hey hi and then go ahead current currently existing تبع تبعه',
  'تبعها تاع حق حقه الخاص خاص الخاصه لي لنا يا ابو غضب ممكن لو سمحت من فضلك رجاء رجاءا',
  'بليز بدي بدنا اريد نريد ابغي ابغا عايز حابب حابه هل يمكنك تقدر تستطيع الحالي الحاليه',
  'الموجود الموجوده فيه عليه مكتوب مكتوبه',
);

/** Words that say "a section" without naming one. */
const SECTION_WORDS: ReadonlySet<string> = new Set(['قسم', 'سكشن', 'جزء', 'section', 'part', 'block', 'area']);
/** Locator prepositions: «في قسم X», "in the X section". */
const LOCATOR_PREPOSITIONS: ReadonlySet<string> = new Set(['في', 'داخل', 'ضمن', 'in', 'on', 'inside', 'within', 'under']);
/** "The main title": the page's one h1. */
const MAIN_WORDS: ReadonlySet<string> = new Set(['main', 'primary', 'رئيسي', 'الرئيسي', 'اساسي', 'الاساسي']);
/** Words that point at "this": the selection. */
const THIS_WORDS: ReadonlySet<string> = new Set([
  'هذا',
  'هذه',
  'هاد',
  'هاي',
  'هذي',
  'this',
  'that',
  'these',
  'those',
  'it',
  'them',
]);
/**
 * The object pronouns among them: "retitle it", "call them …". A pronoun
 * always points at the selection and is never the new text; a demonstrative
 * can open a name instead ("Roasted this week in Irbid").
 */
const PRONOUNS: ReadonlySet<string> = new Set(['it', 'them']);
/**
 * "@menu", «و@الفوتر»: a block the person pointed at in the panel, which the
 * panel turns into the run's selection. The words around it are for the
 * model path, which reads that selection with them; this parse never guesses
 * whether the mention resolved. An email's "@" follows its name, so it never
 * matches.
 */
const MENTION = /(?:^|[^\p{L}\p{M}\p{N}_.%+-])(?:[وفبلك]\p{M}*)?@[\p{L}\p{M}\p{N}_-]/u;
/** «عنوان البيت / الشركة / شارع…»: «عنوان» as an address, which this edit never guesses at. */
const ADDRESS_WORDS: ReadonlySet<string> = wordSet(
  'سكن بيت منزل مكتب شركه محل عياده مطعم شارع طريق حي عماره بنايه مبني فرع street road',
  'avenue building',
);

/**
 * Words that make a short value a STYLE, not text: "make the button blue",
 * «خلي العنوان أكبر», "change the title to bold". Folded spellings.
 */
const STYLE_WORDS: ReadonlySet<string> = wordSet(
  'red blue green yellow orange purple pink black white gray grey brown teal navy gold',
  'silver dark darker light lighter bright brighter bold bolder italic bigger smaller',
  'larger big small large huge tiny center centered centre left right rounded round',
  'transparent hidden visible uppercase lowercase gradient shadow color colour font',
  'size background wider narrower taller shorter thicker thinner underline underlined',
  'primary secondary ghost outline solid احمر ازرق اخضر اصفر برتقالي بنفسجي زهري وردي',
  'اسود ابيض رمادي بني ذهبي فضي كحلي داكن غامق اغمق فاتح افتح عريض اعرض بولد مائل اكبر',
  'كبير اصغر صغير نص وسط منتصف يمين يسار مدور دائري شفاف مخفي ظاهر خط لون الوان حجم',
  'خلفيه ظل تدرج اطول اقصر اضيق سميك رفيع',
);

/** Courtesy that trails a value: stripped from its end. */
const TRAILING_COURTESY =
  /\s*(?:please|pls|thanks|thank you|لو سمحت|من فضلك|رجاء[اً]?|شكرا[ًا]?|يعطيك العافي[ةه]|الله يعافيك)\s*[.!؟?]*\s*$/iu;

function has(set: ReadonlySet<string>, token: Token | undefined): boolean {
  if (token?.kind !== 'word') return false;
  if (set.has(token.norm)) return true;
  for (const stem of token.stems) if (set.has(stem)) return true;
  return false;
}

function roleOf(token: Token | undefined, next: Token | undefined): DirectEditRole | undefined {
  if (token?.kind !== 'word') return undefined;
  for (const stem of [token.norm, ...token.stems]) {
    const role = ROLE_WORDS.get(stem);
    if (role !== undefined) return role;
  }
  // «رقمي» (my number), «رقم التواصل»: a number that is a phone.
  if (token.norm === 'رقمي' || token.norm === 'رقمك') return 'phone';
  if (token.stems.has('رقم') && has(PHONE_NUMBER_WORDS, next)) return 'phone';
  return undefined;
}

/** A value that only points ("it", «هذا»): the words say where, never what. */
function onlyPoints(value: string): boolean {
  const words = value.split(/\s+/u).filter((word) => word !== '');
  return words.length > 0 && words.every((word) => THIS_WORDS.has(normalizeIntentText(word)));
}

/**
 * "this" / «هذا» points at the selection, unless a name goes on after it:
 * "the Roasted this week in Irbid section" names a section, and read as
 * "this" it refused the edit with nothing selected (final test, 2026-09-28).
 * A pronoun always points; a demonstrative points when what follows is a
 * section or role word, a marker, filler or the end.
 */
function pointsAt(tokens: readonly Token[], index: number): boolean {
  const token = tokens[index];
  if (!has(THIS_WORDS, token)) return false;
  if (has(PRONOUNS, token)) return true;
  const next = tokens[index + 1];
  if (next?.kind !== 'word' || markerAt(tokens, index + 1) !== undefined) return true;
  return (
    has(SECTION_WORDS, next) ||
    has(FILLERS, next) ||
    has(THIS_WORDS, next) ||
    has(ROLE_COMPANIONS, next) ||
    roleOf(next, tokens[index + 2]) !== undefined
  );
}

/** A value that is a style, not text: short, unquoted, and naming a colour, size or alignment. */
function readsAsStyle(value: string): boolean {
  const words = tokenize(normalizeIntentText(value));
  if (words.length === 0 || words.length > STYLE_VALUE_MAX_WORDS) return false;
  return words.some((word) => word.readings.some(({ stem }) => STYLE_WORDS.has(stem)));
}

// ── Parsing ───────────────────────────────────────────────────────────────────

interface RoleEdit {
  readonly kind: 'role';
  readonly role: DirectEditRole;
  /** The words that say WHERE (a section, a button's current text, a priced item), stemmed. */
  readonly hint: readonly NamingWord[];
  /** The same words as typed, for matching a button by its text. */
  readonly hintText: string;
  /** The request said "main title" / «العنوان الرئيسي». */
  readonly main: boolean;
  /** The request said "this" / «هذا»: the selection. */
  readonly pointsAtSelection: boolean;
  /** The role came from «عنوان», which also means "address". */
  readonly arabicTitle: boolean;
  readonly value: string;
}

interface TextSwap {
  readonly kind: 'swap';
  readonly first: string;
  readonly second: string;
  /** Which of the two is on the page now; `unknown` lets the page decide. */
  readonly order: 'old-new' | 'new-old' | 'unknown';
  /** A trailing «في قسم X» / "in the X section". */
  readonly hint: readonly NamingWord[];
}

type ParsedEdit = RoleEdit | TextSwap;

interface Marker {
  readonly index: number;
  /** Offset in the request where the new text starts. */
  readonly valueStart: number;
  readonly kind: 'to' | 'with' | 'weak' | 'strong' | 'instead' | 'mark';
}

function markerAt(tokens: readonly Token[], index: number): Marker | undefined {
  const token = tokens[index];
  if (token === undefined) return undefined;
  if (token.kind === 'mark') return { index, valueStart: token.end, kind: 'mark' };
  if (token.kind !== 'word') return undefined;
  if (token.glued !== undefined) {
    return { index, valueStart: token.glued.valueStart, kind: token.glued.marker };
  }
  const norm = normalizeIntentText(token.raw.replaceAll(TATWEEL, ''));
  const next = tokens[index + 1];
  const tail = next?.kind === 'word' && MARKER_TAILS.has(next.norm) ? next : undefined;
  if (TO_MARKERS.has(norm)) return { index, valueStart: (tail ?? token).end, kind: 'to' };
  if (WITH_MARKERS.has(norm)) return { index, valueStart: token.end, kind: 'with' };
  if (INSTEAD.has(norm)) {
    const of = next?.kind === 'word' && next.norm === 'of' ? next : undefined;
    return { index, valueStart: (of ?? token).end, kind: 'instead' };
  }
  // «رقم الهاتف صار …», "the phone is now …": a state, strong enough only for a phone, email or price.
  if (norm === 'صار' || norm === 'صارت') return { index, valueStart: token.end, kind: 'weak' };
  if (norm === 'now' && tokens[index - 1]?.norm === 'is') {
    return { index, valueStart: token.end, kind: 'weak' };
  }
  // "should be", "must say", «لازم يكون», «يجب أن يكون»: an instruction for any role.
  if (['should', 'must', 'لازم', 'يجب'].includes(norm)) {
    const after = next?.norm === 'ان' ? tokens[index + 2] : next;
    if (after?.kind === 'word' && MARKER_TAILS.has(after.norm) && after.norm !== 'ان') {
      return { index, valueStart: after.end, kind: 'strong' };
    }
  }
  return undefined;
}

function firstMarkerAfter(tokens: readonly Token[], from: number): Marker | undefined {
  for (let index = from; index < tokens.length; index += 1) {
    const marker = markerAt(tokens, index);
    if (marker !== undefined) return marker;
  }
  return undefined;
}

function markersAfter(tokens: readonly Token[], from: number): readonly Marker[] {
  const markers: Marker[] = [];
  for (let index = from; index < tokens.length; index += 1) {
    const marker = markerAt(tokens, index);
    if (marker !== undefined) markers.push(marker);
  }
  return markers;
}

/** The words name ONE section in full: every word of its label, heading or anchor. */
function namesOneSectionFully(words: readonly NamingWord[], sections: readonly PageSectionOutline[]): boolean {
  const [best, second] = sectionMentions(words, sections);
  return best?.score === 1 && (second === undefined || second.score < 1);
}

/** The new text: the request after the marker, less trailing courtesy, punctuation and wrapping quotes. */
function valueFrom(request: string, start: number, end = request.length): string {
  let value = request.slice(start, end).trim();
  for (let pass = 0; pass < 2; pass += 1) {
    value = value.replace(TRAILING_COURTESY, '').trim();
    value = value.replace(/[\s.!؟?،,؛;]+$/u, '').trim();
    value = value.replace(/^[:\-–—]\s*/u, '').trim();
  }
  for (const [open, close] of QUOTE_PAIRS) {
    if (value.length > 2 && value.startsWith(open) && value.endsWith(close)) {
      const inner = value.slice(open.length, value.length - close.length);
      if (!inner.includes(open) && !inner.includes(close)) value = inner.trim();
    }
  }
  return value;
}

/** Words between two indices that can say WHERE: no fillers, section words, markers or role words. */
function whereTokens(tokens: readonly Token[], from: number, to: number, role: DirectEditRole): readonly Token[] {
  return tokens.slice(from, to).filter((token, offset) => {
    if (token.kind === 'quote') return true;
    if (token.kind !== 'word') return false;
    if (has(FILLERS, token) || has(SECTION_WORDS, token) || has(ROLE_COMPANIONS, token)) return false;
    if (LOCATOR_PREPOSITIONS.has(token.norm) || MAIN_WORDS.has(token.norm) || has(THIS_WORDS, token)) {
      return false;
    }
    if (verbOf(token) !== undefined) return false;
    // The role's own word, and generic "text"/«نص», never locate; «قسم الأسعار» (another role) does.
    const own = roleOf(token, tokens[from + offset + 1]);
    return own === undefined || (own !== role && own !== 'text');
  });
}

function wordsOf(tokens: readonly Token[]): readonly NamingWord[] {
  return tokens.flatMap((token) => namingWords(token.raw));
}

/**
 * A locator trailing the value: «مرحبا في قسم التعليم», "Hello in the
 * Education section", «بقسم التعليم». Where the value really ends, and the
 * locator's words.
 */
function trailingLocator(
  tokens: readonly Token[],
  from: number,
  role: DirectEditRole,
): { readonly cut: number; readonly hint: readonly Token[] } | undefined {
  for (let index = tokens.length - 1; index > from; index -= 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    const glued = token.kind === 'word' && /^[بف](?:ال)?قسم$/u.test(token.norm);
    if (!glued && !LOCATOR_PREPOSITIONS.has(token.norm)) continue;
    const rest = tokens.slice(index + 1);
    if (!glued && !rest.some((word) => has(SECTION_WORDS, word))) continue;
    const hint = whereTokens(rest, 0, rest.length, role);
    if (hint.length > 0) return { cut: token.start, hint };
  }
  return undefined;
}

function firstVerb(tokens: readonly Token[]): { index: number; verb: VerbClass } | undefined {
  for (const [index, token] of tokens.slice(0, VERB_WINDOW + 1).entries()) {
    const verb = verbOf(token);
    if (verb !== undefined) return { index, verb };
  }
  return undefined;
}

/** «اسم القسم», "the section name": a name that is the section's title. */
function sectionNameIndex(tokens: readonly Token[], end: number): number {
  const mentionsSection = tokens.slice(0, end).some((token) => has(SECTION_WORDS, token));
  if (!mentionsSection) return -1;
  return tokens.findIndex(
    (token, index) => index < end && token.kind === 'word' && (token.stems.has('اسم') || token.norm === 'name'),
  );
}

/** The request read every way it can be read, most specific first. */
function parse(request: string, sections: readonly PageSectionOutline[]): readonly ParsedEdit[] {
  if (MENTION.test(request)) return [];
  const tokens = scan(request);
  if (tokens.length < 2) return [];
  const verb = firstVerb(tokens);
  const from = verb === undefined ? 0 : verb.index + 1;
  const firstMarker = firstMarkerAfter(tokens, from);
  const end = firstMarker?.index ?? tokens.length;

  // The role word: the first after the verb, else before it («عنوان قسم التعليم غيّره إلى …»).
  let roleIndex = -1;
  let role: DirectEditRole | undefined;
  const ranges: readonly (readonly [number, number])[] =
    verb === undefined ? [[0, end]] : [[from, end], [0, verb.index]];
  for (const [start, stop] of ranges) {
    for (let index = start; index < stop && role === undefined; index += 1) {
      const found = roleOf(tokens[index], tokens[index + 1]);
      if (found === undefined) continue;
      const next = index + 1 < stop ? roleOf(tokens[index + 1], tokens[index + 2]) : undefined;
      const stronger = next !== undefined && ROLE_RANK[next] > ROLE_RANK[found];
      role = stronger ? next : found;
      roleIndex = stronger ? index + 1 : index;
    }
    if (role !== undefined) break;
  }
  if (role === undefined) {
    const named = sectionNameIndex(tokens, end);
    if (named >= 0) {
      role = 'title';
      roleIndex = named;
    }
  }
  const renamed = role === undefined && verb?.verb === 'rename';
  if (renamed) {
    role = 'title';
    roleIndex = verb.index;
  }

  const readings: ParsedEdit[] = [];
  if (role !== undefined && roleIndex >= 0) {
    const edit = parseRoleEdit(request, tokens, verb, role, roleIndex, sections);
    if (edit !== undefined) readings.push(edit);
    if (!renamed) return readings;
  }
  const swap = parseSwap(request, tokens, verb);
  if (swap !== undefined) readings.push(swap);
  return readings;
}

function parseRoleEdit(
  request: string,
  tokens: readonly Token[],
  verb: { index: number; verb: VerbClass } | undefined,
  role: DirectEditRole,
  roleIndex: number,
  sections: readonly PageSectionOutline[],
): RoleEdit | undefined {
  const markers = markersAfter(tokens, roleIndex + 1);
  const leadingVerb = verb !== undefined && verb.index < roleIndex ? verb : undefined;
  const before =
    leadingVerb === undefined ? [] : whereTokens(tokens, leadingVerb.index + 1, roleIndex, role);
  /*
    The FIRST marker, unless a later one ends a phrase that names a section
    in full: "the heading of How to book to Booking" splits at the second
    "to", because "How" alone only half-names "How to book".
  */
  const marker =
    markers.find((candidate) => {
      const where = [...before, ...whereTokens(tokens, roleIndex + 1, candidate.index, role)];
      return where.length > 0 && namesOneSectionFully(wordsOf(where), sections);
    }) ?? markers[0];
  const activeVerb = verb !== undefined && (marker === undefined || verb.index < marker.index) ? verb : undefined;
  const weakRole = role === 'phone' || role === 'email' || role === 'price';
  const head = marker?.index ?? tokens.length;
  const phrase = tokens.slice(0, head);
  const main = phrase.some((token) => MAIN_WORDS.has(token.norm));
  const pointsAtSelection = phrase.some((_token, index) => pointsAt(tokens, index));
  const arabicTitle = role === 'title' && ARABIC.test(tokens[roleIndex]?.norm ?? '');
  const edit = (where: readonly Token[], value: string): RoleEdit | undefined => {
    if (value === '' || value.length > MAX_VALUE_CHARS || /[\r\n]/u.test(value)) return undefined;
    // "retitle it", "change the title to it": the pronoun is the selection, not the new title.
    if (onlyPoints(value)) return undefined;
    return {
      kind: 'role',
      role,
      hint: wordsOf(where),
      hintText: where.map(({ raw }) => raw).join(' '),
      main,
      pointsAtSelection,
      arabicTitle,
      value,
    };
  };

  if (marker !== undefined) {
    if (marker.kind === 'instead') return undefined;
    if (marker.kind === 'weak' && !weakRole) return undefined;
    // Without a verb only a declaration or a colon states a new value: "the title is long" does not.
    if (activeVerb === undefined && (marker.kind === 'to' || marker.kind === 'with')) return undefined;
    const between = whereTokens(tokens, roleIndex + 1, marker.index, role);
    const tail = trailingLocator(tokens, marker.index, role);
    const cut = tail !== undefined && tail.cut > marker.valueStart ? tail.cut : request.length;
    const valueTokens = tokens.filter((token) => token.start >= marker.valueStart && token.start < cut);
    const quoted = valueTokens.length === 1 && valueTokens[0]?.kind === 'quote';
    const value = valueFrom(request, marker.valueStart, cut);
    // "…to market section to Launch": a value that says "section" swallowed a locator.
    if (valueTokens.some((token) => has(SECTION_WORDS, token))) return undefined;
    if (!quoted && !weakRole && readsAsStyle(value)) return undefined;
    return edit([...before, ...between, ...(cut < request.length && tail !== undefined ? tail.hint : [])], value);
  }

  // No marker: MAKE, PUT and RENAME take the value straight after the object
  // («خلّي عنوان قسم المشاريع أعمالي», «حط رقم الهاتف 079…», "call the X section 'Y'").
  if (activeVerb === undefined || activeVerb.verb === 'change' || activeVerb.verb === 'replace') {
    return undefined;
  }
  const after = tokens.slice(roleIndex + 1);
  const last = after.at(-1);
  if (last?.kind === 'quote') {
    return edit([...before, ...whereTokens(tokens, roleIndex + 1, tokens.length - 1, role)], last.raw);
  }
  if (weakRole) {
    /*
      The value is whatever reads as a phone, an email or a price, found in
      the TEXT after the role word: «حط الإيميل reem@x.com» scans as the words
      reem/x/com — "@", "+" and "$" never make a word token — so looking for
      them among tokens found no email at all (fast-edits, 2026-09-28).
    */
    const roleEnd = tokens[roleIndex]?.end ?? 0;
    const found = /[A-Za-z0-9._%+-]+@|[+$€£0-9٠-٩۰-۹]/u.exec(request.slice(roleEnd));
    if (found === null) return undefined;
    const valueStart = roleEnd + found.index;
    const stop = tokens.findIndex((token) => token.end > valueStart);
    return edit(
      [...before, ...whereTokens(tokens, roleIndex + 1, stop < 0 ? tokens.length : stop, role)],
      valueFrom(request, valueStart),
    );
  }
  // The value starts where a section's WHOLE name ends; no name, and the whole tail is the value.
  for (let cut = after.length - 1; cut >= 1; cut -= 1) {
    const locator = whereTokens(after, 0, cut, role);
    const start = after[cut];
    if (locator.length === 0 || start === undefined) continue;
    const words = wordsOf(locator);
    const section = namedSection(words, sections);
    if (section === undefined) continue;
    const names = [section.label, section.heading].filter((name): name is string => name !== undefined);
    if (!names.some((name) => namingWords(name).length === words.length)) continue;
    const value = valueFrom(request, start.start);
    if (readsAsStyle(value)) return undefined;
    return edit([...before, ...locator], value);
  }
  // «خلّي عنوان هاد القسم مرحبا»: "this section" is where, not what.
  const pointing = after.findIndex(
    (token) => !(has(THIS_WORDS, token) || has(SECTION_WORDS, token) || has(FILLERS, token)),
  );
  const first = after[pointing];
  if (first === undefined || before.length > 0) return undefined;
  if (pointing > 0 && !after.slice(0, pointing).some((token) => has(THIS_WORDS, token))) return undefined;
  const value = valueFrom(request, first.start);
  if (readsAsStyle(value)) return undefined;
  return edit([], value);
}

function parseSwap(
  request: string,
  tokens: readonly Token[],
  verb: { index: number; verb: VerbClass } | undefined,
): TextSwap | undefined {
  const from = verb === undefined ? 0 : verb.index + 1;
  const start = tokens[from]?.start;
  if (start === undefined) return undefined;
  const swap = (
    first: string,
    second: string,
    order: TextSwap['order'],
    hint: readonly Token[],
    secondQuoted: boolean,
  ): TextSwap | undefined => {
    if (first === '' || second === '' || first === second) return undefined;
    if (first.length > MAX_VALUE_CHARS || second.length > MAX_VALUE_CHARS) return undefined;
    // "change it to Hello": "it" is the selection, not two letters of «Visit» to replace.
    if (onlyPoints(first) || onlyPoints(second)) return undefined;
    if (!secondQuoted && readsAsStyle(order === 'new-old' ? first : second)) return undefined;
    return { kind: 'swap', first, second, order, hint: wordsOf(hint) };
  };
  const quotedAt = (at: number, until: number): boolean => {
    const inside = tokens.filter((token) => token.start >= at && token.start < until);
    return inside.length === 1 && inside[0]?.kind === 'quote';
  };

  // «حط X بدل Y», "put X instead of Y", «X بدل Y»: the new text first.
  const insteadIndex = tokens.findIndex(
    (token, index) => index >= from && token.kind === 'word' && INSTEAD.has(token.norm),
  );
  if (insteadIndex >= 0 && verb?.verb !== 'make' && verb?.verb !== 'rename') {
    const instead = markerAt(tokens, insteadIndex);
    const cut = tokens[insteadIndex]?.start;
    if (instead === undefined || cut === undefined) return undefined;
    const tail = trailingLocator(tokens, insteadIndex, 'text');
    const end = tail?.cut ?? request.length;
    return swap(
      valueFrom(request, start, cut),
      valueFrom(request, instead.valueStart, end),
      'new-old',
      tail?.hint ?? [],
      quotedAt(start, cut),
    );
  }
  if (verb === undefined) return undefined;
  if (verb.verb !== 'change' && verb.verb !== 'replace' && verb.verb !== 'rename') return undefined;
  // "change A to B", «غيّر A إلى B», "replace A with B", «بدّل A بـB».
  let marker: Marker | undefined;
  for (let index = from + 1; index < tokens.length && marker === undefined; index += 1) {
    const found = markerAt(tokens, index);
    if (found !== undefined && (found.kind === 'to' || found.kind === 'with' || found.kind === 'mark')) {
      marker = found;
    }
  }
  const cut = marker === undefined ? undefined : tokens[marker.index]?.start;
  if (marker === undefined || cut === undefined) return undefined;
  const tail = trailingLocator(tokens, marker.index, 'text');
  const end = tail?.cut ?? request.length;
  // «بدّل A بـB» / «استبدل A بـB» read both ways in Arabic: the page decides which is there.
  const arabicReplace = verb.verb === 'replace' && ARABIC.test(tokens[verb.index]?.norm ?? '');
  return swap(
    valueFrom(request, start, cut),
    valueFrom(request, marker.valueStart, end),
    arabicReplace ? 'unknown' : 'old-new',
    tail?.hint ?? [],
    quotedAt(marker.valueStart, end),
  );
}

// ── Folding with offsets: «التعليم» found inside «التعليم والشهادات» ─────────

interface Folded {
  readonly text: string;
  /** For each folded character, the offset it came from in the original. */
  readonly origin: readonly number[];
}

/** normalizeIntentText one character at a time, remembering where each came from. */
function foldWithOrigin(text: string): Folded {
  let out = '';
  const origin: number[] = [];
  let spaced = false;
  for (let at = 0; at < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(at) ?? 0);
    if (/\s/u.test(char)) {
      if (!spaced) {
        out += ' ';
        origin.push(at);
      }
      spaced = true;
    } else {
      for (const piece of normalizeIntentText(char)) {
        out += piece;
        origin.push(at);
      }
      spaced = false;
    }
    at += char.length;
  }
  return { text: out, origin };
}

function folded(text: string): string {
  return foldWithOrigin(text).text.trim();
}

function sameText(left: string, right: string): boolean {
  return folded(left) === folded(right);
}

/** Every [start, end) of `needle` in `text`: exact first, else compared folded. */
function occurrencesOf(text: string, needle: string): readonly (readonly [number, number])[] {
  const exact: (readonly [number, number])[] = [];
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
    exact.push([at, at + needle.length]);
  }
  if (exact.length > 0) return exact;
  const hay = foldWithOrigin(text);
  const want = folded(needle);
  if (want === '') return [];
  const found: (readonly [number, number])[] = [];
  for (let at = hay.text.indexOf(want); at >= 0; at = hay.text.indexOf(want, at + 1)) {
    const first = hay.origin[at];
    const last = hay.origin[at + want.length - 1];
    if (first === undefined || last === undefined) continue;
    found.push([first, last + String.fromCodePoint(text.codePointAt(last) ?? 0).length]);
  }
  return found;
}

// ── The page: text runs and elements ─────────────────────────────────────────

/** One run of text a person can see, and where it lives. */
interface Piece {
  readonly nodeId: NodeId;
  readonly sectionId: NodeId;
  /** `tree` for a composed region, else the block prop holding the text. */
  readonly key: string;
  /** Inside a tree: the element's path. */
  readonly path?: readonly number[];
  readonly text: string;
}

/** One element of a composed tree, with its path. */
interface TreeElement {
  readonly nodeId: NodeId;
  readonly sectionId: NodeId;
  readonly path: readonly number[];
  readonly element: Json;
  readonly tag: string;
}

/** Block props that hold addresses, classes and switches, never words a person reads. */
const NOT_TEXT_PROPS: ReadonlySet<string> = wordSet(
  'className css pageCss href src url link id anchor anchorId variant tone align',
  'spacing width layout size emphasis icon imageSrc formAction method target lang dir',
);

interface PageIndex {
  readonly document: BuilderDocument;
  readonly sections: readonly PageSectionOutline[];
  readonly parents: ReadonlyMap<NodeId, NodeId>;
  readonly pieces: readonly Piece[];
  readonly elements: readonly TreeElement[];
}

function walkTree(node: Node, sectionId: NodeId, pieces: Piece[], elements: TreeElement[]): void {
  const tree = node.props['tree'];
  if (!isRecord(tree) || !Array.isArray(tree['children'])) return;
  const stack: { value: unknown; path: readonly number[] }[] = (tree['children'] as unknown[])
    .map((value, index) => ({ value, path: [index] }))
    .reverse();
  let seen = 0;
  while (stack.length > 0 && seen < TREE_WALK_LIMIT) {
    const entry = stack.pop();
    seen += 1;
    if (entry === undefined || !isRecord(entry.value)) continue;
    const element = entry.value;
    if (element['kind'] === 'element' && typeof element['tag'] === 'string') {
      elements.push({ nodeId: node.id, sectionId, path: entry.path, element, tag: element['tag'] });
      const text = element['text'];
      if (typeof text === 'string' && text.trim() !== '') {
        pieces.push({ nodeId: node.id, sectionId, key: 'tree', path: entry.path, text });
      }
    }
    const children = element['children'];
    if (Array.isArray(children)) {
      for (let at = children.length - 1; at >= 0; at -= 1) {
        stack.push({ value: children[at], path: [...entry.path, at] });
      }
    }
  }
}

function indexPage(document: BuilderDocument): PageIndex {
  const sections = outlinePageSections(document);
  const pieces: Piece[] = [];
  const elements: TreeElement[] = [];
  for (const section of sections) {
    for (const nodeId of subtreeIds(section.id, document)) {
      const node = document.nodes[nodeId];
      if (node === undefined) continue;
      if (node.type === CUSTOM_CODE) {
        walkTree(node, section.id, pieces, elements);
        continue;
      }
      for (const [key, value] of Object.entries(node.props)) {
        if (typeof value !== 'string' || NOT_TEXT_PROPS.has(key) || !/[\p{L}\p{N}]/u.test(value)) continue;
        pieces.push({ nodeId, sectionId: section.id, key, text: value });
      }
    }
  }
  return { document, sections, parents: parentsOf(document), pieces, elements };
}

function startsWith(path: readonly number[], prefix: readonly number[]): boolean {
  return prefix.length <= path.length && prefix.every((step, index) => path[index] === step);
}

/** Where a role is looked for: whole sections, optionally only some nodes, optionally one element. */
interface Scope {
  readonly sections: ReadonlySet<NodeId>;
  /** The selected nodes and everything under them; absent: the whole of each section. */
  readonly nodes?: ReadonlySet<NodeId>;
  readonly element?: { readonly nodeId: NodeId; readonly path: readonly number[] };
}

function inScope(
  scope: Scope,
  at: { readonly nodeId: NodeId; readonly sectionId: NodeId; readonly path?: readonly number[] },
): boolean {
  if (!scope.sections.has(at.sectionId)) return false;
  if (scope.nodes !== undefined && !scope.nodes.has(at.nodeId)) return false;
  if (scope.element === undefined) return true;
  return (
    at.nodeId === scope.element.nodeId &&
    at.path !== undefined &&
    startsWith(at.path, scope.element.path)
  );
}

// ── Resolution ────────────────────────────────────────────────────────────────

/** One change: a tree element's text or attribute, or a block's prop. */
interface PlannedChange {
  readonly nodeId: NodeId;
  readonly sectionId: NodeId;
  readonly key: string;
  readonly path?: readonly number[];
  readonly before: string;
  readonly after: string;
  /** For a tree element: the attribute written instead of its text (a link's href). */
  readonly attribute?: 'href';
}

interface Resolved {
  readonly role: DirectEditRole;
  readonly changes: readonly PlannedChange[];
  readonly sectionName?: string;
  /** For a swap: the words replaced and their replacement, for the summary. */
  readonly swapped?: { readonly old: string; readonly next: string };
  /** For a phone, email or price: the new value as the page will show it, for the summary. */
  readonly value?: string;
}

interface ResolveContext {
  readonly page: PageIndex;
  readonly kernel: BuilderKernel;
  /** The selection as a scope, or undefined with nothing selected. */
  readonly selection?: Scope;
}

function sectionNameOf(page: PageIndex, sectionId: NodeId | undefined): { sectionName?: string } {
  const section = page.sections.find(({ id }) => id === sectionId);
  const name = section?.label ?? section?.heading;
  return name === undefined ? {} : { sectionName: name };
}

function pageScope(page: PageIndex): Scope {
  return { sections: new Set(page.sections.map(({ id }) => id)) };
}

/** The scope the words point at: a named section, else the selection, else (when allowed) the page. */
function scopeFor(hint: readonly NamingWord[], context: ResolveContext, allowPage: boolean): Scope | undefined {
  if (hint.length > 0) {
    const section = namedSection(hint, context.page.sections);
    return section === undefined ? undefined : { sections: new Set([section.id]) };
  }
  if (context.selection !== undefined) return context.selection;
  return allowPage ? pageScope(context.page) : undefined;
}

/** A composed element's one text run: its own text, or the one descendant that has any. */
function soleTextOf(page: PageIndex, element: TreeElement): Piece | undefined {
  const inside = page.pieces.filter(
    (piece) => piece.nodeId === element.nodeId && piece.path !== undefined && startsWith(piece.path, element.path),
  );
  return inside.length === 1 ? inside[0] : undefined;
}

function headingLevel(tag: string): number {
  return tag === 'h1' ? 1 : tag === 'h2' ? 2 : tag === 'h3' ? 3 : 0;
}

function textChange(role: DirectEditRole, piece: Piece, after: string, page: PageIndex): Resolved | undefined {
  if (sameText(piece.text, after)) return undefined;
  return {
    role,
    changes: [
      {
        nodeId: piece.nodeId,
        sectionId: piece.sectionId,
        key: piece.key,
        ...(piece.path === undefined ? {} : { path: piece.path }),
        before: piece.text,
        after,
      },
    ],
    ...sectionNameOf(page, piece.sectionId),
  };
}

/** The prop that is a registered block's title: its declared inline-editable prop, else heading/title. */
function blockTitleKey(kernel: BuilderKernel, node: Node): string | undefined {
  const declared = kernel.context.registry.block(node.type)?.schema.inlineEditable;
  if (typeof declared === 'string' && typeof node.props[declared] === 'string') return declared;
  return ['heading', 'title', 'headline'].find((key) => typeof node.props[key] === 'string');
}

function resolveTitle(edit: RoleEdit, context: ResolveContext): Resolved | undefined {
  const { page, kernel } = context;
  // "The main title", «العنوان الرئيسي»: the page's one h1.
  if (edit.main && edit.hint.length === 0) {
    const h1s = page.elements.filter(({ tag }) => tag === 'h1');
    const piece = h1s.length === 1 && h1s[0] !== undefined ? soleTextOf(page, h1s[0]) : undefined;
    return piece === undefined ? undefined : textChange('title', piece, edit.value, page);
  }
  // A bare «العنوان» / "the title" with nothing selected: the page title? the h1? an address? Not guessed.
  const scope = scopeFor(edit.hint, context, false);
  if (scope?.sections.size !== 1) return undefined;
  const [sectionId] = scope.sections;
  const section = sectionId === undefined ? undefined : page.document.nodes[sectionId];
  if (sectionId === undefined || section === undefined) return undefined;

  if (section.type !== CUSTOM_CODE) {
    if (scope.nodes !== undefined && !scope.nodes.has(sectionId)) return undefined;
    const key = blockTitleKey(kernel, section);
    const before = key === undefined ? undefined : section.props[key];
    if (key === undefined || typeof before !== 'string') return undefined;
    return textChange('title', { nodeId: sectionId, sectionId, key, text: before }, edit.value, page);
  }
  const headings = page.elements.filter(
    (element) => element.nodeId === sectionId && headingLevel(element.tag) > 0 && inScope(scope, element),
  );
  const top = Math.min(...headings.map(({ tag }) => headingLevel(tag)));
  let candidates = headings.filter(({ tag }) => headingLevel(tag) === top);
  if (candidates.length > 1) {
    // Two headings at the section's top level: the one that reads as the section's name.
    const { sectionName } = sectionNameOf(page, sectionId);
    candidates = candidates.filter(
      ({ element }) => sectionName !== undefined && sameText(treeElementText(element), sectionName),
    );
  }
  const piece = candidates.length === 1 && candidates[0] !== undefined ? soleTextOf(page, candidates[0]) : undefined;
  return piece === undefined ? undefined : textChange('title', piece, edit.value, page);
}

/** A composed element drawn as a button: a `button`, or a link styled as one. */
function looksLikeButton(element: TreeElement): boolean {
  if (element.tag === 'button') return true;
  if (element.tag !== 'a') return false;
  const className = element.element['className'];
  const classes = typeof className === 'string' ? className.split(/\s+/u) : [];
  if (classes.some((name) => /(?:^|-)btn(?:$|-)|button/u.test(name))) return true;
  const padded = classes.some((name) => /^(?:[a-z0-9]+:)*px-/u.test(name));
  const drawn = classes.some((name) => /^(?:[a-z0-9]+:)*(?:bg-|border|ring-|rounded)/u.test(name));
  return padded && drawn;
}

/** Every button on the page, as the one text run it shows. */
function buttonsOf(page: PageIndex, kernel: BuilderKernel): readonly Piece[] {
  const out: Piece[] = [];
  for (const element of page.elements) {
    if (!looksLikeButton(element)) continue;
    const piece = soleTextOf(page, element);
    if (piece !== undefined) out.push(piece);
  }
  for (const section of page.sections) {
    for (const nodeId of subtreeIds(section.id, page.document)) {
      const node = page.document.nodes[nodeId];
      if (node === undefined || node.type === CUSTOM_CODE || !/button|cta/iu.test(node.type)) continue;
      const declared = kernel.context.registry.block(node.type)?.schema.inlineEditable;
      const key =
        typeof declared === 'string' && typeof node.props[declared] === 'string'
          ? declared
          : typeof node.props['label'] === 'string'
            ? 'label'
            : undefined;
      const text = key === undefined ? undefined : node.props[key];
      if (key !== undefined && typeof text === 'string') out.push({ nodeId, sectionId: section.id, key, text });
    }
  }
  return out;
}

function resolveButton(edit: RoleEdit, context: ResolveContext): Resolved | undefined {
  const { page, kernel } = context;
  const buttons = buttonsOf(page, kernel);
  // «زر أرسل رسالة», "the 'Book now' button": the words are the button's own text.
  if (edit.hintText.trim() !== '') {
    const byText = buttons.filter((piece) => sameText(piece.text, edit.hintText));
    const selection = context.selection;
    const inSelection = selection === undefined ? [] : byText.filter((piece) => inScope(selection, piece));
    const pick = inSelection.length === 1 ? inSelection : byText;
    if (pick.length === 1 && pick[0] !== undefined) return textChange('button', pick[0], edit.value, page);
    if (byText.length > 1) return undefined;
  }
  const scope = scopeFor(edit.hint, context, true);
  if (scope === undefined) return undefined;
  const inside = buttons.filter((piece) => inScope(scope, piece));
  return inside.length === 1 && inside[0] !== undefined ? textChange('button', inside[0], edit.value, page) : undefined;
}

// ── Phones, emails, prices ────────────────────────────────────────────────────

const DIGIT = '[0-9٠-٩۰-۹]';
const PHONE = new RegExp(`\\+?${DIGIT}(?:[0-9٠-٩۰-۹\\s\\-().]{5,}${DIGIT})`, 'gu');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu;
const CURRENCY =
  '(?:\\$|€|£|¥|₪|JOD|JD|USD|EUR|SAR|AED|EGP|KWD|QAR|BHD|OMR|دينار|دنانير|د\\.أ|د\\.ا|ريال|ر\\.س|درهم|د\\.إ|جنيه|ج\\.م|ليرة|ليره|شيكل|دولار|يورو)';
const AMOUNT = `${DIGIT}+(?:[.,٫]${DIGIT}+)?`;
const PRICE = new RegExp(`${CURRENCY}\\s?${AMOUNT}|${AMOUNT}\\s?${CURRENCY}`, 'gu');
/** "12-06-2026", "2026/06/12": a date, never a phone. */
const DATE_SHAPE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/u;
/**
 * "2019 - 2021", a CV's years at a job: eight digits and a dash read as a
 * phone, and every CV has several, so no CV phone could ever be changed
 * (fast-edits, 2026-09-28). Two years are a span, never a number.
 */
const YEAR_SPAN = /^(?:19|20)\d\d\s*[-/]\s*(?:19|20)\d\d$/u;

function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/gu, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function phoneDigits(text: string): string {
  return asciiDigits(text).replace(/\D/gu, '');
}

/**
 * One number written two ways: `tel:+962791234567` behind a link that shows
 * «0791 234 567». The trunk zero dropped, the shorter is the tail of the
 * longer — at least 7 digits of it, so two different short numbers never
 * pass as one. Without this, the commonest contact block (an international
 * href, a local label) refused every phone edit.
 */
function samePhone(left: string, right: string): boolean {
  const a = left.replace(/^0+/u, '');
  const b = right.replace(/^0+/u, '');
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 7 && longer.endsWith(shorter);
}

/** A phone as a person writes one: 7–16 digits, with only +, spaces, dashes and brackets around them. */
function isPhone(text: string, minimum = 7): boolean {
  const trimmed = text.trim();
  const digits = phoneDigits(trimmed);
  return (
    digits.length >= minimum &&
    digits.length <= 16 &&
    /^\+?[0-9٠-٩۰-۹\s\-().]+$/u.test(trimmed) &&
    !DATE_SHAPE.test(asciiDigits(trimmed)) &&
    !YEAR_SPAN.test(asciiDigits(trimmed))
  );
}

function isEmail(text: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(text.trim());
}

/** One place a phone, email or price shows: a span of a text run, or a link's href. */
interface ValueSpot {
  readonly nodeId: NodeId;
  readonly sectionId: NodeId;
  readonly key: string;
  readonly path?: readonly number[];
  /** The whole text (or href) the value sits in, and its span inside it. */
  readonly text: string;
  readonly span: readonly [number, number];
  readonly attribute?: 'href';
  /** The value as compared: digits, lowercase, amount. */
  readonly identity: string;
}

function textSpots(
  page: PageIndex,
  pattern: RegExp,
  identity: (value: string) => string,
  accept: (value: string) => boolean,
): ValueSpot[] {
  const spots: ValueSpot[] = [];
  for (const piece of page.pieces) {
    for (const match of piece.text.matchAll(pattern)) {
      if (!accept(match[0])) continue;
      const start = match.index;
      spots.push({
        nodeId: piece.nodeId,
        sectionId: piece.sectionId,
        key: piece.key,
        ...(piece.path === undefined ? {} : { path: piece.path }),
        text: piece.text,
        span: [start, start + match[0].length],
        identity: identity(match[0]),
      });
    }
  }
  return spots;
}

function hrefSpots(
  page: PageIndex,
  scheme: 'tel:' | 'mailto:',
  identity: (value: string) => string,
  accept: (value: string) => boolean,
): ValueSpot[] {
  const spots: ValueSpot[] = [];
  for (const element of page.elements) {
    const attributes = element.element['attributes'];
    const href = isRecord(attributes) ? attributes['href'] : undefined;
    if (typeof href !== 'string' || !href.toLowerCase().startsWith(scheme)) continue;
    const value = href.slice(scheme.length).split('?')[0] ?? '';
    if (!accept(value)) continue;
    spots.push({
      nodeId: element.nodeId,
      sectionId: element.sectionId,
      key: 'tree',
      path: element.path,
      text: href,
      span: [scheme.length, scheme.length + value.length],
      attribute: 'href',
      identity: identity(value),
    });
  }
  return spots;
}

/** Each run rewritten once, its spots back to front. */
function valueChanges(spots: readonly ValueSpot[], replacement: (spot: ValueSpot) => string): readonly PlannedChange[] {
  const runs = new Map<string, ValueSpot[]>();
  for (const spot of spots) {
    const key = `${spot.nodeId}|${spot.key}|${(spot.path ?? []).join('.')}|${spot.attribute ?? ''}`;
    runs.set(key, [...(runs.get(key) ?? []), spot]);
  }
  const changes: PlannedChange[] = [];
  for (const run of runs.values()) {
    const first = run[0];
    if (first === undefined) continue;
    let text = first.text;
    for (const spot of [...run].sort((left, right) => right.span[0] - left.span[0])) {
      text = text.slice(0, spot.span[0]) + replacement(spot) + text.slice(spot.span[1]);
    }
    if (text === first.text) continue;
    changes.push({
      nodeId: first.nodeId,
      sectionId: first.sectionId,
      key: first.key,
      ...(first.path === undefined ? {} : { path: first.path }),
      before: first.text,
      after: text,
      ...(first.attribute === undefined ? {} : { attribute: first.attribute }),
    });
  }
  return changes;
}

function resolveContact(edit: RoleEdit, context: ResolveContext, kind: 'phone' | 'email'): Resolved | undefined {
  const { page } = context;
  const value = edit.value.trim();
  if (kind === 'phone' ? !isPhone(value) : !isEmail(value)) return undefined;
  const scope = scopeFor(edit.hint, context, true);
  if (scope === undefined) return undefined;
  const identity = kind === 'phone' ? phoneDigits : (text: string) => text.toLowerCase();
  // A phone in running text needs 8 digits: fewer is as likely a count or a code.
  const spots = [
    ...(kind === 'phone'
      ? textSpots(page, PHONE, identity, (text) => isPhone(text, 8))
      : textSpots(page, EMAIL, identity, isEmail)),
    ...hrefSpots(page, kind === 'phone' ? 'tel:' : 'mailto:', identity, kind === 'phone' ? (text) => isPhone(text) : isEmail),
  ].filter((spot) => inScope(scope, spot));
  // ONE number (or address) on the page, however many places show it: they all change together.
  const [first] = spots;
  const same = kind === 'phone' ? samePhone : (left: string, right: string) => left === right;
  if (first === undefined || !spots.every((spot) => same(spot.identity, first.identity))) return undefined;
  const href =
    kind === 'phone'
      ? `${/^(?:\+|00)/u.test(asciiDigits(value)) ? '+' : ''}${phoneDigits(value).replace(/^00/u, '')}`
      : value;
  const changes = valueChanges(spots, (spot) => (spot.attribute === 'href' ? href : value));
  if (changes.length === 0) return undefined;
  return { role: kind, changes, value, ...sectionNameOf(page, changes[0]?.sectionId) };
}

/**
 * A price's card — the largest element around it that holds no other price —
 * as its first words (the item's name, which a menu writes before its price
 * and description) and all of its words.
 */
function cardOf(
  page: PageIndex,
  spot: ValueSpot,
  spots: readonly ValueSpot[],
): { readonly first: string; readonly all: string } {
  if (spot.path === undefined) {
    const node = page.document.nodes[spot.nodeId];
    const texts =
      node === undefined
        ? [spot.text]
        : Object.values(node.props).filter((value): value is string => typeof value === 'string');
    return { first: texts[0] ?? spot.text, all: texts.join(' ') };
  }
  let card: readonly number[] = spot.path;
  for (let depth = spot.path.length - 1; depth >= 1; depth -= 1) {
    const prefix = spot.path.slice(0, depth);
    const others = spots.filter(
      (other) => other.nodeId === spot.nodeId && other.path !== undefined && startsWith(other.path, prefix),
    );
    if (others.length > 1) break;
    card = prefix;
  }
  const inside = page.pieces.filter(
    (piece) => piece.nodeId === spot.nodeId && piece.path !== undefined && startsWith(piece.path, card),
  );
  return {
    first: inside[0]?.text ?? spot.text,
    all: inside.map(({ text }) => text).join(' '),
  };
}

function saysAll(hint: readonly NamingWord[], text: string): boolean {
  const words = namingWords(text);
  return hint.every((want) => words.some((word) => [...want.stems].some((stem) => word.stems.has(stem))));
}

function resolvePrice(edit: RoleEdit, context: ResolveContext): Resolved | undefined {
  const { page } = context;
  const value = edit.value.trim();
  if (!new RegExp(DIGIT, 'u').test(value) || value.length > 40) return undefined;
  const spots = textSpots(page, PRICE, (text) => asciiDigits(text).replace(/\s/gu, ''), () => true).filter((spot) =>
    inScope(context.selection ?? pageScope(page), spot),
  );
  let chosen: readonly ValueSpot[] = [];
  if (edit.hint.length === 0) {
    chosen = spots;
  } else {
    // «سعر شاورما لحم»: the item whose card NAMES it first, then whose card says it at all.
    const cards = spots.map((spot) => ({ spot, card: cardOf(page, spot, spots) }));
    const byName = cards.filter(({ card }) => saysAll(edit.hint, card.first));
    const byCard = cards.filter(({ card }) => saysAll(edit.hint, card.all));
    chosen = (byName.length === 1 ? byName : byCard.length === 1 ? byCard : []).map(({ spot }) => spot);
    // Else the words name a section in full, holding the one price: «سعر قسم العرض».
    if (chosen.length === 0 && namesOneSectionFully(edit.hint, page.sections)) {
      const section = namedSection(edit.hint, page.sections);
      chosen = spots.filter((spot) => spot.sectionId === section?.id);
    }
  }
  const [spot] = chosen;
  if (chosen.length !== 1 || spot === undefined) return undefined;
  const withCurrency = new RegExp(CURRENCY, 'u').test(value);
  // "20" for «15 دينار»: the number changes; the currency stays as the page writes it.
  const shown = withCurrency
    ? value
    : spot.text.slice(spot.span[0], spot.span[1]).replace(new RegExp(AMOUNT, 'u'), value);
  const changes = valueChanges(chosen, () => shown);
  if (changes.length !== 1) return undefined;
  return { role: 'price', changes, value: shown, ...sectionNameOf(page, spot.sectionId) };
}

/**
 * A plain text run: the one run of a selected block or focused element, or
 * of a section named in full («غيّر نص التذييل إلى …»).
 */
function resolveText(edit: RoleEdit, context: ResolveContext): Resolved | undefined {
  const { page } = context;
  let scope: Scope | undefined = context.selection;
  if (edit.hint.length > 0) {
    const section = namesOneSectionFully(edit.hint, page.sections) ? namedSection(edit.hint, page.sections) : undefined;
    scope = section === undefined ? undefined : { sections: new Set([section.id]) };
  }
  if (scope === undefined) return undefined;
  const pieces = page.pieces.filter((piece) => inScope(scope, piece));
  return pieces.length === 1 && pieces[0] !== undefined ? textChange('text', pieces[0], edit.value, page) : undefined;
}

function resolveSwap(edit: TextSwap, context: ResolveContext): Resolved | undefined {
  const { page } = context;
  const scope = scopeFor(edit.hint, context, true);
  if (scope === undefined) return undefined;
  const pieces = page.pieces.filter((piece) => inScope(scope, piece));
  const where = (needle: string) =>
    pieces.flatMap((piece) => occurrencesOf(piece.text, needle).map((span) => ({ piece, span })));
  const firstAt = where(edit.first);
  const secondAt = where(edit.second);
  let reading: { old: string; next: string; found: typeof firstAt } | undefined;
  if (edit.order === 'old-new') reading = { old: edit.first, next: edit.second, found: firstAt };
  else if (edit.order === 'new-old') reading = { old: edit.second, next: edit.first, found: secondAt };
  else if (firstAt.length > 0 && secondAt.length === 0) {
    reading = { old: edit.first, next: edit.second, found: firstAt };
  } else if (secondAt.length > 0 && firstAt.length === 0) {
    reading = { old: edit.second, next: edit.first, found: secondAt };
  }
  const only = reading?.found.length === 1 ? reading.found[0] : undefined;
  if (reading === undefined || only === undefined) return undefined;
  const { piece, span } = only;
  const after = piece.text.slice(0, span[0]) + reading.next + piece.text.slice(span[1]);
  const resolved = textChange('text', piece, after, page);
  return resolved === undefined ? undefined : { ...resolved, swapped: { old: reading.old, next: reading.next } };
}

function resolve(parsed: ParsedEdit, context: ResolveContext): Resolved | undefined {
  if (parsed.kind === 'swap') return resolveSwap(parsed, context);
  if (parsed.pointsAtSelection && context.selection === undefined) return undefined;
  if (parsed.arabicTitle) {
    // «عنوان» is also "address": a locator or a value that reads as one is never guessed at.
    const addressy = [...parsed.hint, ...namingWords(parsed.value)].some((word) =>
      [...word.stems].some((stem) => ADDRESS_WORDS.has(stem)),
    );
    if (addressy) return undefined;
  }
  switch (parsed.role) {
    case 'title':
      return resolveTitle(parsed, context);
    case 'button':
      return resolveButton(parsed, context);
    case 'phone':
    case 'email':
      return resolveContact(parsed, context, parsed.role);
    case 'price':
      return resolvePrice(parsed, context);
    case 'text':
      return resolveText(parsed, context);
  }
}

// ── The plan ──────────────────────────────────────────────────────────────────

function elementAt(tree: Json, path: readonly number[]): Json | undefined {
  let current: unknown = tree;
  for (const step of path) {
    if (!isRecord(current) || !Array.isArray(current['children'])) return undefined;
    current = (current['children'] as unknown[])[step];
  }
  return isRecord(current) ? current : undefined;
}

function markupOf(tree: Json, path: readonly number[]): string | undefined {
  if (path.length === 0) return serializeTreeMarkup(tree);
  const element = elementAt(tree, path);
  return element === undefined ? undefined : serializeTreeMarkup({ kind: 'root', children: [element] });
}

function occursOnce(text: string, find: string): boolean {
  const first = text.indexOf(find);
  return first >= 0 && !text.includes(find, first + 1);
}

/**
 * One region's changes as the `editTree` step `expandTreeEdits` reads: the
 * smallest element holding every change whose markup is unique in the
 * region, quoted as it stands and as it will stand. The whole region is
 * always unique, so the climb always ends. `expected` is the region's markup
 * after the edit, for the round-trip check once it is expanded.
 */
function editTreeStep(
  node: Node,
  changes: readonly PlannedChange[],
  title: string,
): { readonly step: AiPlanStep; readonly expected: string } | undefined {
  const tree = node.props['tree'];
  if (!isRecord(tree)) return undefined;
  const whole = serializeTreeMarkup(tree);
  const next = structuredClone(tree);
  for (const change of changes) {
    const element = change.path === undefined ? undefined : elementAt(next, change.path);
    if (element === undefined) return undefined;
    if (change.attribute === undefined) {
      element['text'] = change.after;
    } else {
      element['attributes'] = {
        ...(isRecord(element['attributes']) ? element['attributes'] : {}),
        [change.attribute]: change.after,
      };
    }
  }
  const expected = serializeTreeMarkup(next);
  if (whole === undefined || expected === undefined || whole === expected) return undefined;
  const paths = changes.map(({ path }) => path ?? []);
  let common = paths[0] ?? [];
  for (const path of paths.slice(1)) {
    let shared = 0;
    while (shared < common.length && shared < path.length && common[shared] === path[shared]) shared += 1;
    common = common.slice(0, shared);
  }
  for (let depth = common.length; depth >= 0; depth -= 1) {
    const prefix = common.slice(0, depth);
    const find = markupOf(tree, prefix);
    const replace = markupOf(next, prefix);
    if (find === undefined || replace === undefined || find === replace) continue;
    if (depth > 0 && !occursOnce(whole, find)) continue;
    return {
      step: { command: EDIT_TREE_COMMAND, args: { id: node.id, edits: [{ find, replace }] }, title },
      expected,
    };
  }
  return undefined;
}

/** The candidate plan and, per region, the markup its tree must serialize to once expanded. */
function buildPlan(
  resolved: Resolved,
  document: BuilderDocument,
  summary: string,
): { readonly plan: AiPlan; readonly expected: ReadonlyMap<NodeId, string> } | undefined {
  const steps: AiPlanStep[] = [];
  const expected = new Map<NodeId, string>();
  const byNode = new Map<NodeId, PlannedChange[]>();
  for (const change of resolved.changes) {
    byNode.set(change.nodeId, [...(byNode.get(change.nodeId) ?? []), change]);
  }
  for (const [nodeId, changes] of byNode) {
    const node = document.nodes[nodeId];
    if (node === undefined) return undefined;
    if (changes.some(({ key }) => key === 'tree')) {
      if (node.type !== CUSTOM_CODE || !changes.every(({ key }) => key === 'tree')) return undefined;
      const edit = editTreeStep(node, changes, summary);
      if (edit === undefined) return undefined;
      steps.push(edit.step);
      expected.set(nodeId, edit.expected);
      continue;
    }
    for (const change of changes) {
      steps.push({ command: 'setProp', args: { id: nodeId, key: change.key, value: change.after }, title: summary });
    }
  }
  return steps.length === 0 ? undefined : { plan: { rationale: summary, commands: steps }, expected };
}

/** Every expanded tree reads back as exactly the markup the edit meant: nothing else moved. */
function landsAsMeant(plan: unknown, expected: ReadonlyMap<NodeId, string>): boolean {
  if (!isRecord(plan) || !Array.isArray(plan['commands'])) return false;
  let checked = 0;
  for (const step of plan['commands'] as unknown[]) {
    if (!isRecord(step) || step['command'] !== 'setProp' || !isRecord(step['args'])) continue;
    const { id, key, value } = step['args'];
    if (key !== 'tree' || typeof id !== 'string') continue;
    if (serializeTreeMarkup(value) !== expected.get(id)) return false;
    checked += 1;
  }
  return checked === expected.size;
}

/** The expanded plan as the `setProp` steps it is, for a caller whose own door rehearses it. */
function setPropPlan(candidate: unknown, rationale: string): AiPlan | undefined {
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) return undefined;
  const commands: AiPlanStep[] = [];
  for (const step of candidate['commands'] as unknown[]) {
    if (!isRecord(step) || step['command'] !== 'setProp' || !isRecord(step['args'])) return undefined;
    const title = step['title'];
    commands.push({ command: 'setProp', args: step['args'], ...(typeof title === 'string' ? { title } : {}) });
  }
  return commands.length === 0 ? undefined : { rationale, commands };
}

// ── The summary ───────────────────────────────────────────────────────────────

function summaryOf(resolved: Resolved, language: 'ar' | 'en'): string {
  const first = resolved.changes[0];
  const after = first?.after ?? '';
  const before = first?.before ?? '';
  const many = resolved.changes.length;
  // A phone, email or price is named as typed: its change may be an href, or a span of a longer run.
  const value = resolved.value ?? after;
  if (language === 'ar') {
    const places = many > 1 ? ` (${String(many)} مواضع)` : '';
    switch (resolved.role) {
      case 'title':
        // The title as the page shows it now: a label can differ from its heading.
        return `تغيير العنوان «${before}» إلى «${after}»`;
      case 'button':
        return `تغيير نص الزر «${before}» إلى «${after}»`;
      case 'phone':
        return `تغيير رقم الهاتف إلى ${value}${places}`;
      case 'email':
        return `تغيير البريد الإلكتروني إلى ${value}${places}`;
      case 'price':
        return `تغيير السعر إلى «${value}»`;
      case 'text':
        return resolved.swapped === undefined
          ? `تعديل النص إلى «${after}»`
          : `استبدال «${resolved.swapped.old}» بـ«${resolved.swapped.next}»`;
    }
  }
  const places = many > 1 ? ` (${String(many)} places)` : '';
  switch (resolved.role) {
    case 'title':
      return `Change the title “${before}” to “${after}”`;
    case 'button':
      return `Change the “${before}” button to “${after}”`;
    case 'phone':
      return `Change the phone number to ${value}${places}`;
    case 'email':
      return `Change the email to ${value}${places}`;
    case 'price':
      return `Change the price to “${value}”`;
    case 'text':
      return resolved.swapped === undefined
        ? `Change the text to “${after}”`
        : `Replace “${resolved.swapped.old}” with “${resolved.swapped.next}”`;
  }
}

// ── Entry ─────────────────────────────────────────────────────────────────────

let dryRunIds = 0;
const DRY_RUN_PORTS: AiValidationPorts = {
  clock: systemClock,
  // A setProp mints no id; the port exists because the scratch kernel requires one.
  ids: {
    newId: () => {
      dryRunIds += 1;
      return `direct-edit-${String(dryRunIds)}`;
    },
  },
};

function selectionScope(kernel: BuilderKernel, page: PageIndex, selection: readonly NodeId[]): Scope | undefined {
  const { document } = page;
  const pointed = selection.filter((id) => id !== document.rootId && document.nodes[id] !== undefined);
  if (pointed.length === 0) return undefined;
  const sections = new Set<NodeId>();
  const nodes = new Set<NodeId>();
  for (const id of pointed) {
    const section = sectionOf(id, document, page.parents);
    if (section === undefined) return undefined;
    sections.add(section);
    for (const inside of subtreeIds(id, document)) nodes.add(inside);
  }
  // An element focused inside the one selected region narrows the scope to it.
  const focus = kernel.context.store.getState().elementFocus;
  const element =
    focus !== null && pointed.length === 1 && pointed[0] === focus.id
      ? { nodeId: focus.id, path: focus.path }
      : undefined;
  return { sections, nodes, ...(element === undefined ? {} : { element }) };
}

/**
 * Make `request` without a model when it is a small edit stated in full:
 * parse it, find the ONE element it points at in the current document
 * (restricted to the selection when the words name no section), build the
 * kernel plan and pass it through the door. Returns the validated plan, what
 * it targets and a one-line summary — or `null`, and the caller asks the
 * model as before. It reads the document and dry-runs the plan; it never
 * writes.
 */
export function tryDirectEdit(
  request: string,
  kernel: BuilderKernel,
  options: TryDirectEditOptions = {},
): DirectEdit | null {
  const trimmed = request.trim();
  if (trimmed === '' || trimmed.length > MAX_REQUEST_CHARS || /[\r\n]/u.test(trimmed)) return null;
  const document = kernel.getDocument();
  const selection = options.selection ?? kernel.context.store.getState().selection;
  const pointed = selection.filter((id) => id !== document.rootId);
  const route =
    options.route ??
    routeIntent({
      request: trimmed,
      document: summarizeDocumentForIntent(document),
      ...(pointed.length === 0 ? {} : { selection: pointed }),
    });
  if (route.kind !== 'edit') return null;

  const page = indexPage(document);
  if (page.sections.length === 0) return null;
  const readings = parse(trimmed, page.sections);
  if (readings.length === 0) return null;
  const scope = selectionScope(kernel, page, selection);
  const context: ResolveContext = { page, kernel, ...(scope === undefined ? {} : { selection: scope }) };
  const language: 'ar' | 'en' = ARABIC.test(trimmed) ? 'ar' : 'en';
  const policy =
    options.policy ?? resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() });

  for (const reading of readings) {
    const resolved = resolve(reading, context);
    const firstSection = resolved?.changes[0]?.sectionId;
    if (resolved === undefined || firstSection === undefined) continue;
    const summary = summaryOf(resolved, language);
    const built = buildPlan(resolved, document, summary);
    if (built === undefined) continue;
    const expanded = expandTreeEdits(built.plan, kernel);
    if (expanded.issues.length > 0 || !landsAsMeant(expanded.plan, built.expected)) continue;
    let plan: AiPlan | undefined;
    if (options.dryRun === false) {
      plan = setPropPlan(expanded.plan, summary);
    } else {
      const verdict = validateAiPlan(
        expanded.plan,
        kernel,
        options.validationPorts ?? DRY_RUN_PORTS,
        policy,
        resolveAiCompositionPolicy(options.composition),
      );
      plan = verdict.ok ? verdict.plan : undefined;
    }
    if (plan === undefined) continue;
    const changes = resolved.changes.map(
      (change): DirectEditChange =>
        Object.freeze({
          nodeId: change.nodeId,
          sectionId: change.sectionId,
          key: change.key,
          ...(change.path === undefined ? {} : { path: Object.freeze([...change.path]) }),
          before: change.before,
          after: change.after,
        }),
    );
    return Object.freeze({
      plan,
      target: Object.freeze({
        role: resolved.role,
        sectionId: firstSection,
        ...(resolved.sectionName === undefined ? {} : { sectionName: resolved.sectionName }),
        changes: Object.freeze(changes),
      }),
      summary,
      language,
    });
  }
  return null;
}
