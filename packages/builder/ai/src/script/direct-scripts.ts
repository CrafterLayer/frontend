import { normalizeIntentText } from '../intent/normalize-arabic';

/**
 * Zero-token edit scripts (agent-script DESIGN §A.10): requests so common
 * that the script is known before any model is asked. `run-agent.ts` tries
 * `directScript` after the direct edit and direct tool readings; when the
 * script expands to at least one step the change lands with 0 provider calls,
 * and on E_EMPTY or any error it falls through to the model silently.
 *
 * Five readings, each with an Arabic and an English pattern:
 *   1. round every button              → borderRadius 'full'
 *   2. round the corners of every image → borderRadius 'xl'
 *   3. a shadow on every card           → boxShadow 'lg'
 *   4. Arabic-Indic digits (٠–٩) in every text
 *   5. Latin digits (0–9) in every text
 *
 * A reading must be the WHOLE request: one with an exception ("except the
 * hero", «ما عدا») or a second instruction ("… and make the footer dark") is
 * left to the model, which can do both halves.
 */

export type DirectScriptReading = 'round-buttons' | 'round-images' | 'card-shadow' | 'arabic-digits' | 'latin-digits';

const MAX_REQUEST = 90;

const EXCEPTION = /(?:\b(?:except|but not|apart from|other than|besides|excluding|only)\b|ماعدا|ما عدا|(?:^|\s)عدا\s|باستثناء|(?:^|\s)الا\s|فقط)/u;
const SECOND_CLAUSE =
  /(?:\b(?:and|then|also|plus)\s+(?:make|change|add|remove|set|put|give|turn|use|replace|delete|move)\b|(?:^|\s)(?:ثم|وبعدين|وكمان|كمان)\s|(?:^|\s)و(?:غير|اضف|ضيف|احذف|اكتب|اعمل|خلي|اجعل|حط|بدل|كبر|صغر|غيري|اضيف)|[.;!?،؛]\s*\S)/u;

const ALL_AR = '(?:كل|جميع|كافه)\\s+';

const READINGS: readonly { readonly reading: DirectScriptReading; readonly patterns: readonly RegExp[] }[] = [
  {
    reading: 'round-buttons',
    patterns: [
      new RegExp(`${ALL_AR}(?:ال)?ازرار.*(?:مدور|دائري|مستدير|دوائر|حواف ناعمه)`, 'u'),
      /(?:دور|استدير|استداره|تدوير)\s+(?:كل|جميع|كافه)\s+(?:ال)?ازرار/u,
      /(?:ال)?ازرار\s+(?:كلها|جميعها).*(?:مدور|دائري|مستدير)/u,
      /\bround(?:ed)?\b(?:\s+(?:off|out))?\s+(?:the\s+corners\s+of\s+)?(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?buttons?\b/u,
      /\b(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?buttons?\s+(?:should\s+be\s+|to\s+be\s+)?(?:round(?:ed)?|pill(?:s|-shaped| shaped)?|circular)\b/u,
      /\bmake\s+(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?buttons?\s+(?:round(?:ed)?|pill(?:s|-shaped| shaped)?|circular)\b/u,
    ],
  },
  {
    reading: 'round-images',
    patterns: [
      new RegExp(`${ALL_AR}(?:ال)?صور.*(?:مدور|زوايا|حواف|دائري|مستدير)`, 'u'),
      /(?:دور|تدوير)\s+(?:زوايا|حواف)\s+(?:كل|جميع)\s+(?:ال)?صور/u,
      /(?:ال)?صور\s+(?:كلها|جميعها).*(?:مدور|زوايا|حواف)/u,
      /\bround(?:ed)?\b\s+(?:the\s+)?(?:corners\s+(?:of|on)\s+)?(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?(?:images?|photos?|pictures?)\b/u,
      /\b(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?(?:images?|photos?|pictures?)\s+(?:should\s+have\s+|with\s+|get\s+)?(?:round(?:ed)?(?:\s+corners)?)\b/u,
      /\bmake\s+(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?(?:images?|photos?|pictures?)\s+round(?:ed)?\b/u,
    ],
  },
  {
    reading: 'card-shadow',
    patterns: [
      new RegExp(`ظل.*${ALL_AR}(?:ال)?(?:بطاقات|كروت|كاردات)`, 'u'),
      new RegExp(`${ALL_AR}(?:ال)?(?:بطاقات|كروت|كاردات).*ظل`, 'u'),
      /\bshadows?\b.*\b(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?cards?\b/u,
      /\b(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?cards?\b.*\bshadows?\b/u,
    ],
  },
  {
    reading: 'arabic-digits',
    patterns: [
      /(?:الارقام|ارقام|الاعداد)\s+(?:لل|بال|ال|ل|ب)?(?:ارقام\s+)?(?:عربيه|هنديه|مشرقيه|العربيه|الهنديه|المشرقيه)/u,
      /(?:حول|حولي|اجعل|خلي|استخدم)\s+.*(?:ارقام|الارقام)\s+(?:عربيه|هنديه|مشرقيه)/u,
      /\b(?:arabic-indic|eastern arabic|hindi|indic)\s+(?:digits|numerals|numbers)\b/u,
      /\barabic\s+(?:digits|numbers)\b/u,
    ],
  },
  {
    reading: 'latin-digits',
    patterns: [
      /(?:الارقام|ارقام|الاعداد)\s+(?:لل|بال|ال|ل|ب)?(?:ارقام\s+)?(?:انجليزيه|انكليزيه|لاتينيه|غربيه|الانجليزيه|الانكليزيه|اللاتينيه|الغربيه|انجليزي|انكليزي|لاتيني)/u,
      /\b(?:latin|western|english|ascii|western arabic)\s+(?:digits|numerals|numbers)\b/u,
    ],
  },
];

/** Which direct reading a request is, or undefined. */
export function directScriptReading(request: string): DirectScriptReading | undefined {
  const text = normalizeIntentText(request);
  if (text === '' || text.length > MAX_REQUEST) return undefined;
  if (EXCEPTION.test(text) || SECOND_CLAUSE.test(text)) return undefined;
  for (const { reading, patterns } of READINGS) {
    if (patterns.some((pattern) => pattern.test(text))) return reading;
  }
  return undefined;
}

function arabic(locale: string | { readonly lang: string } | undefined): boolean {
  const lang = typeof locale === 'string' ? locale : (locale?.lang ?? '');
  return lang.trim().toLowerCase().startsWith('ar');
}

/** A single-quoted JavaScript string literal (the note is the history label). */
function quoted(text: string): string {
  return `'${text.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;
}

const DIGIT_KINDS = "['heading','text','button','link','item']";

/**
 * The digits script: every heading, text, button, link and item whose text
 * holds a digit of the other system gets it rewritten. Elements whose text is
 * carried by an indexed descendant are skipped (the descendant is written),
 * as are part items and texts cut at the index's 500-character cap.
 */
function digitsScript(to: 'arab' | 'latn', note: string): string {
  const swap =
    to === 'arab'
      ? "t=e.text.replace(/[0-9]/g,function(c){return d.charAt(+c)})"
      : "t=e.text.replace(/[\\u0660-\\u0669\\u06F0-\\u06F9]/g,function(c){var k=c.charCodeAt(0);return String(k>=1776?k-1776:k-1632)})";
  return [
    "var d='٠١٢٣٤٥٦٧٨٩'",
    `var es=ck.find({kind:${DIGIT_KINDS}}).filter(function(e){return e.text.length<500&&!(e.part&&e.kind==='item')})`,
    'var n=0',
    "es.forEach(function(e){if(e.path&&es.some(function(o){return o!==e&&o.node===e.node&&o.path&&o.path.indexOf(e.path.slice(0,-1)+',')===0}))return;var " +
      swap +
      ';if(t!==e.text){ck.set(e,{text:t});n++}})',
    `ck.note(${quoted(note)})`,
    'return n',
  ].join(';');
}

/** The zero-token script for a request, or undefined when it is not one of the five readings. */
export function directScript(request: string, locale?: string | { readonly lang: string }): string | undefined {
  const reading = directScriptReading(request);
  if (reading === undefined) return undefined;
  const ar = arabic(locale);
  switch (reading) {
    case 'round-buttons':
      return `ck.note(${quoted(ar ? 'تدوير كل الأزرار' : 'Round every button')});ck.style(ck.find({kind:'button'}),{borderRadius:'full'})`;
    case 'round-images':
      return `ck.note(${quoted(ar ? 'زوايا مدوّرة لكل الصور' : 'Rounded corners on every image')});ck.style(ck.find({kind:'image'}),{borderRadius:'xl'})`;
    case 'card-shadow':
      return `ck.note(${quoted(ar ? 'ظل لكل البطاقات' : 'Shadow on every card')});ck.style(ck.find({kind:'card'}),{boxShadow:'lg'})`;
    case 'arabic-digits':
      return digitsScript('arab', ar ? 'أرقام عربية (٠–٩)' : 'Arabic-Indic digits');
    case 'latin-digits':
      return digitsScript('latn', ar ? 'أرقام لاتينية (0–9)' : 'Latin digits');
  }
}
