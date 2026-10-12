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
LAYOUT: one container width per page; nothing scrolls sideways at 375px; reserve space for images and embeds so the page does not jump; long words and links wrap (break-words).
MOBILE FIRST: body text at text-base or larger on phones; columns stack below md; the main action stays visible; phone numbers are tel: links and addresses open a map.
MOTION: one or two moving things per view; transform and opacity only; 150-300ms for state changes; a carousel or rotating content has previous, next and pause, and stops for reduced motion.
CONTENT: colour never carries meaning alone (add an icon or a word); meaningful images have alt text; text never truncates without a way to read it all.`;

const TYPE_COLOUR = `TYPE: pick one pairing by mood and set it with fonts.set {"display":"…","body":"…"}: ${TYPE_MOODS.map((mood) => `${mood.mood} ${mood.display} + ${mood.body}, Arabic ${mood.arabicDisplay} + ${mood.arabicBody}`).join('; ')}. Two families at most. Body 16px or more, leading-relaxed, 65-75 characters a line; headings step clearly (text-4xl md:text-6xl for the hero). Arabic: no italic, no uppercase, no letter spacing.
COLOUR: one accent and neutrals, roughly 60% ground, 30% surface, 10% accent; set them with theme.apply {"accent":"#hex","bg":"#hex"} and let it derive the inks. Text holds 4.5:1 on its ground (3:1 for large headings); muted text goes no lighter than the muted role. Success green, warning amber and error red keep their meaning and never decorate. A dark section flips ink and ground together. The person's brand colours always win; offer the nearest accessible shade if theirs fails contrast, and say so.
MOODS TO HUES: trust and health blue or teal; growth and money green; food and warmth red, orange or brown; luxury near-black with gold; calm and beauty soft pink or sage; energy orange on dark; children bright but soft.`;

const FORMS = `Use the form block when the catalog has it; otherwise a form element with real labels.
FEWER FIELDS: ask only what the next step needs (a booking needs name, phone and time; a quote needs what and where). Optional fields say "optional"; required ones are marked in words, not colour alone.
LABELS: a visible label above every field, never placeholder-only; the right type and autocomplete (type email with autocomplete email, type tel with autocomplete tel, inputmode numeric for numbers) so phones show the right keyboard and browsers fill it.
ERRORS: say exactly what to fix, under the field, linked with aria-describedby; keep what the person typed; on submit failure move focus to the first problem.
SUBMIT: the button says the result ("Send my request", «أرسل طلبي»); while sending it shows progress and cannot be pressed twice; after, a clear success message says what happens next and when.
ALTERNATIVES: beside a contact form offer a direct path: a tel: link, mailto: or a WhatsApp link (https://wa.me/number). Privacy: one short line on how the details are used.`;

const NATURAL_COPY = `Copy that reads as if a native writer wrote it, in every language the page uses.
EVERY LANGUAGE: short sentences with active verbs, one idea each; headlines of eight words or fewer; address the reader directly; calls to action are a verb and its result ("Book a table", «احجز طاولة»), never "Click here" or «اضغط هنا»; on a page in one language every string is in it: buttons, form labels, errors, alt text, the page title and description.
ENGLISH: plain words over jargon; sentence case for headings and buttons; no exclamation marks in headings; spell numbers as digits with the person's own currency and date order, and stay consistent (one spelling, US or UK, per site).
ARABIC: clear Modern Standard Arabic (فصحى مبسّطة), a dialect only when the person writes in it and asks; Arabic marks inside Arabic text («،» «؛» «؟» and «» quotes), no Latin comma or question mark between Arabic words; no tatweel (ـ) and no decorative diacritics; one digit system per page (Western digits by default, Arabic-Indic when the person writes them); Gregorian dates unless the context asks for Hijri.
LANGUAGE VERSIONS: rewrite meaning, never translate idioms word by word; keep brand and product names as written; keep numbers, prices, phones and links identical across versions; expect one language to run longer than another and keep layouts flexible.`;

const TRUST_PROOF = `Trust is built from proof the person can stand behind; never invent it.
TESTIMONIALS: a quote with a first name and role or city the person gave; without real ones, write clearly marked placeholders and list them in followUp. No stock face beside an invented name (use initials).
NUMBERS: years in business, clients, ratings and results only as given; a counter animates to the real number and states its date or period when it can change.
CREDENTIALS: licences, certificates, memberships and awards near the claim they support, with the issuer's name; client logos only with permission.
GUARANTEES AND POLICIES: state refunds, delivery, warranty or cancellation plainly near the price or the main action.
OBJECTIONS: an FAQ answering the three questions that stop people (price, time, risk) before the final call to action.
CONTACT: a real address, phone and hours make a local business credible: show them, and link the map.`;

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
    version: '1.0.0',
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
    'Touch targets, focus, feedback, layout, mobile-first and motion rules from UI UX Pro Max’s high-severity web guidelines.',
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
    'Targets 44px; visible focus; feedback on every action; no sideways scroll at 375px; mobile-first type; restrained, pausable motion; meaning never by colour alone.',
  ),
  skill(
    'craftkit.type-colour',
    'Type pairing and colour',
    'Font pairings by mood from verified families (Latin and Arabic) and colour rules: one accent, contrast, meaning, brand first.',
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
    'At most two families from one mood pairing; body 16px+; one accent at about 10%; 4.5:1 text contrast; semantic colours keep their meaning; the brand wins.',
  ),
  skill(
    'craftkit.forms-convert',
    'Forms people finish',
    'Short, labelled, accessible forms: the right input types, errors beside fields, honest submit states and a direct alternative.',
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
    'Only needed fields; visible labels with type and autocomplete; specific errors under fields; a result-named submit with progress and success; a phone, mail or WhatsApp alternative.',
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
      'آراء',
      'تقييمات',
      'ثقة',
      'شهادات',
      'عملاء',
      'ضمان',
      'نتائج',
    ],
    TRUST_PROOF,
    'Proof only as given (placeholders marked and listed); dated numbers; credentials by the claim; plain policies near the price; an objections FAQ before the final CTA; real contact details.',
  ),
];
