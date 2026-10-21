import type { AiSkillDefinitionV1 } from '../types';
import { TYPE_MOODS } from './design-intelligence';

/**
 * Five everyday default skills (2026-10-12): interaction and UX rules (UI UX Pro Max's
 * high-severity `ux-guidelines.csv` rows for the web, Next Level Builder, MIT), type and
 * colour, forms people finish, natural copy in English and Arabic, and honest trust and proof. Each turns on
 * by its own words in English and Arabic and stays small, so several can share a request.
 */

const UX_RULES = `Run these on every section you write or change.
TOUCH AND POINTER: targets at least 44px (h-11) with space between; every clickable card shows it (cursor-pointer, a hover change of colour or shadow, never a size jump); primary actions work by tap and click, never hover alone.
FOCUS AND KEYBOARD: never remove the focus outline; tab order follows the visual order; an icon-only control has an aria-label; a sticky header must not cover the focused element.
FEEDBACK: a button that starts work shows it is working and cannot be pressed twice; errors appear beside what caused them; a destructive action asks first; success says what happened.
LAYOUT: choose widths and density for the task; mixed reading, data and full-width regions are valid. Avoid page overflow at 375px; wide tables or timelines may scroll inside a labelled, keyboard-usable region. Reserve image/embed space and wrap long links (break-words).
RESPONSIVE: adapt at the widths where content needs it. Purposeful phone grids, dense readable data and local table overflow are valid; stack, reflow or disclose secondary detail without losing essential actions. Use readable type, including text-base for reading copy; supplied phone numbers and addresses get useful links.
MOTION: choose animation by purpose and measured cost; prefer transform/opacity for performance, without a fixed effect count or duration. Keep content usable before animation; honor reduced motion, and give automatically rotating content controls to move and pause.
CONTENT: colour never carries meaning alone (add an icon or a word); meaningful images have alt text; text never truncates without a way to read it all.`;

const TYPE_COLOUR = `TYPE: choose hierarchy, measure, scale and density for this content. Optional pairing references, never a required mood or family count: ${TYPE_MOODS.map((mood) => `${mood.mood} ${mood.display} + ${mood.body}, Arabic ${mood.arabicDisplay} + ${mood.arabicBody}`).join('; ')}. fonts.set {"display":"…","body":"…"} sets the two base roles; it is not a limit on a bespoke composition. Additional faces must be verified, loaded with shipped weights and cover their text's script. Preserve the chosen contract on edits. Arabic needs readable line height, script coverage and no forced tracking or Latin casing.
COLOUR: derive a coherent palette from the brief, existing design and supplied references; multiple semantic accents are valid. No fixed hue, industry-to-colour mapping or percentage formula. theme.apply {"accent":"#hex","bg":"#hex"} sets base roles and derives inks; bespoke CSS may carry further deliberate roles. Text holds 4.5:1 on its ground (3:1 for large headings); never rely on colour alone for meaning. Preserve state meanings and brand choices, and explain any accessible shade correction. Coordinate ink and ground when changing a section's tone: section.ops {"op":"tone","id":"…","tone":"dark|light|surface|accent"}.`;

const FORMS = `Use a catalog form block when its layout and connected behavior fit. A custom form may use supported native controls and permitted scoped behavior with real labels; distinguish local/demo state from actual delivery.
FEWER FIELDS: ask only what the next step needs (a booking needs name, phone and time; a quote needs what and where). Optional fields say "optional"; required ones are marked in words, not colour alone.
LABELS: a visible label above every field, never placeholder-only; the right type and autocomplete (type email with autocomplete email, type tel with autocomplete tel, inputmode numeric for numbers) so phones show the right keyboard and browsers fill it.
ERRORS: say exactly what to fix, under the field, linked with aria-describedby; keep what the person typed; on submit failure move focus to the first problem.
SUBMIT: the button says the result ("Send my request", «أرسل طلبي»); while sending it shows progress and cannot be pressed twice; after, a clear success message says what happens next and when.
ALTERNATIVES: offer a supplied direct contact path when it serves this form, such as tel:, mailto: or WhatsApp (https://wa.me/number); an internal tool does not need invented contact channels. Explain how submitted details are used when relevant. Do not claim delivery or persistence without an integration.`;

const NATURAL_COPY = `Copy that reads as if a native writer wrote it, in every language the page uses.
EVERY LANGUAGE: use clear, task-appropriate copy; headline length follows the content and composition, without a fixed word count. Prefer direct verbs and useful labels; calls to action describe a verb and its result ("Book a table", «احجز طاولة»), never "Click here" or «اضغط هنا»; on a page in one language every string is in it: buttons, form labels, errors, alt text, the page title and description.
ENGLISH: plain words over jargon; sentence case for headings and buttons; no exclamation marks in headings; spell numbers as digits with the person's own currency and date order, and stay consistent (one spelling, US or UK, per site).
ARABIC: clear Modern Standard Arabic (فصحى مبسّطة), a dialect only when the person writes in it and asks; Arabic marks inside Arabic text («،» «؛» «؟» and «» quotes), no Latin comma or question mark between Arabic words; no tatweel (ـ) and no decorative diacritics; one digit system per page (Western digits by default, Arabic-Indic when the person writes them); Gregorian dates unless the context asks for Hijri.
LANGUAGE VERSIONS: rewrite meaning, never translate idioms word by word; keep brand and product names as written; keep numbers, prices, phones and links identical across versions; expect one language to run longer than another and keep layouts flexible. In an edit, put a whole page in another language with page.translate {"lang":"ar","texts":{"<each page text>":"<its translation>"}}.`;

const TRUST_PROOF = `Trust is built from proof the person can stand behind; never invent it.
TESTIMONIALS: a quote with a first name and role or city the person gave; without real ones, write clearly marked placeholders and list them in followUp. No stock face beside an invented name (use initials).
NUMBERS: years in business, clients, ratings and results only as given; a counter animates to the real number and states its date or period when it can change.
CREDENTIALS: licences, certificates, memberships and awards near the claim they support, with the issuer's name; client logos only with permission.
GUARANTEES AND POLICIES: state refunds, delivery, warranty or cancellation plainly near the price or the main action.
OBJECTIONS: include relevant answers where the task needs them; an FAQ, its question count and a closing sales action are optional. A report or workspace should prioritize its evidence and workflow.
CONTACT: for a local business, make supplied useful contact details and hours easy to find. Do not add contact sections or a map to unrelated screens, or invent missing details.`;

function skill(
  id: string,
  name: string,
  description: string,
  priority: number,
  keywords: readonly string[],
  instructions: string,
  check: string,
): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id,
    name,
    description,
    version: '1.1.0',
    source: 'builtin',
    trust: 'builtin',
    priority,
    activation: { mode: 'auto', keywords: [...keywords] },
    tags: ['default'],
    instructions,
    references: { 'checks/default.md': check },
  };
}

export const EVERYDAY_DEFAULT_SKILLS: readonly AiSkillDefinitionV1[] = [
  skill(
    'craftkit.pro-max-ux',
    'Interaction and UX rules',
    'Accessible targets, focus and feedback with task-led responsive geometry, readable data and purposeful motion.',
    35,
    [
      'button',
      'buttons',
      'navigation',
      'menu',
      'mobile',
      'responsive',
      'carousel',
      'slider',
      'modal',
      'sticky',
      'ux',
      'usability',
      'زر',
      'أزرار',
      'قائمة',
      'جوال',
      'موبايل',
      'متجاوب',
      'تجربة',
      'سلايدر',
    ],
    UX_RULES,
    'Targets 44px; visible focus and action feedback; no page overflow; intentional phone grids and local data scrolling; readable type, reduced motion and pause controls; meaning never by colour alone.',
  ),
  skill(
    'craftkit.type-colour',
    'Type pairing and colour',
    'Optional verified font inspiration and content-led colour roles; accessible contrast, script coverage and supplied brand choices.',
    34,
    [
      'font',
      'fonts',
      'typography',
      'typeface',
      'colour',
      'color',
      'colours',
      'colors',
      'palette',
      'brand',
      'theme',
      'خط',
      'خطوط',
      'لون',
      'ألوان',
      'هوية',
      'ثيم',
    ],
    TYPE_COLOUR,
    'Typography and semantic accents serve the content; pairings optional, extra faces verified and loaded; readable script coverage, 4.5:1 text contrast and 3:1 large text; semantic meaning and brand choices preserved.',
  ),
  skill(
    'craftkit.forms-convert',
    'Forms people finish',
    'Short, labelled, accessible forms: suitable input types, linked errors, honest submission states and useful supplied alternatives.',
    35,
    [
      'form',
      'forms',
      'contact',
      'booking',
      'signup',
      'sign up',
      'register',
      'newsletter',
      'subscribe',
      'quote',
      'نموذج',
      'استمارة',
      'تواصل',
      'حجز',
      'تسجيل',
      'اشتراك',
      'عرض سعر',
    ],
    FORMS,
    'Only needed fields; visible labels with type and autocomplete; specific linked errors; result-named submit with progress and honest success; supplied contact alternatives only when useful.',
  ),
  skill(
    'craftkit.natural-copy',
    'Natural copy in English and Arabic',
    'Copy that reads native in English and Arabic: short sentences, verb-first calls to action, each language’s punctuation and numbers, every string in the page’s language.',
    36,
    [
      'copy',
      'text',
      'headline',
      'wording',
      'rewrite',
      'write',
      'tone',
      'english',
      'arabic',
      'عربي',
      'بالعربي',
      'إنجليزي',
      'بالإنجليزي',
      'محتوى',
      'نصوص',
      'صياغة',
      'اكتب',
      'صمم',
      'موقع',
      'صفحة',
      'translate',
      'language',
      'ترجم',
      'لغة',
    ],
    NATURAL_COPY,
    'Native phrasing in each language, never word-by-word; verb-first CTAs; English sentence case, Arabic «،» «؛» «؟» «»; one digit system; brand names kept; every string in the page’s language.',
  ),
  skill(
    'craftkit.trust-proof',
    'Honest trust and proof',
    'Testimonials, numbers, credentials, guarantees and FAQs that build trust, and the rule never to invent any of them.',
    33,
    [
      'testimonials',
      'reviews',
      'trust',
      'credibility',
      'social proof',
      'case study',
      'results',
      'guarantee',
      // Logo strips are proof (2026-10-14). Not a bare «لوجو»: «صمم لي لوجو» is the person's own.
      'logos',
      'لوجوهات',
      'لوجو العملاء',
      'لوجو الشركاء',
      'آراء',
      'تقييمات',
      'ثقة',
      'شهادات',
      'عملاء',
      'ضمان',
      'نتائج',
    ],
    TRUST_PROOF,
    'Proof only as given (placeholders marked and listed); dated numbers; credentials by the claim; relevant plain policies; answers and supplied contact details only where the task needs them.',
  ),
];
