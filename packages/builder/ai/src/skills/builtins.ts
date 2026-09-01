import { createAiSkillRegistry } from './registry';
import type { AiSkillDefinitionV1, AiSkillRegistry } from './types';

function freezeData(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezeData(child);
  Object.freeze(value);
}

function builtin(definition: AiSkillDefinitionV1): AiSkillDefinitionV1 {
  freezeData(definition);
  return definition;
}

/**
 * Surgical edits. Explicit-only because no keyword can tell "change this title"
 * from "rewrite the hero": the host opts in when it wants a run that can only
 * setProp/setBinding/setResponsive. It conflicts with every insert playbook so
 * an explicit surgical run never carries a keyword-matched composition recipe.
 */
const PRECISE_EDIT: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.precise-edit',
  name: 'Surgical existing-content edit',
  description:
    'Constrain a run to setProp, setBinding and setResponsive on one resolved target; whole-tree copies for regions.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 100,
  activation: { mode: 'explicit' },
  tags: ['content', 'precision', 'safe-edit'],
  conflicts: [
    'craftkit.conversion-recipes',
    'craftkit.cv-page',
    'craftkit.page-composition',
    'craftkit.structure-recipes',
  ],
  restrictToCommands: ['setBinding', 'setProp', 'setResponsive'],
  instructions: `The smallest change that fully satisfies the request; nothing else moves.
TARGET: resolve it from the selection first, then by matching the quoted or described text in the document; if two nodes match, edit the selected one or the first in reading order and name the ambiguity in the rationale.
REGISTERED BLOCKS: change only the named prop with setProp, or the named breakpoint with setResponsive.
CUSTOMCODE REGIONS: setProp {key:'tree'} replaces the WHOLE tree — copy the existing tree verbatim from the document and change only the target node's text, className, href or attribute; keep every other node, class and icon byte-identical, keep the label and css unless asked. A text edit keeps the tag, classes and the language's punctuation («،؟» in Arabic); a colour edit swaps one class for one class; an alignment edit uses text-start/text-end.
RESPONSIVE: an "on mobile" request is setResponsive on a declared prop of a registered block, or a sm:/md:/lg: class inside the tree — never a second copy of the content.
NOT HERE: adding, moving, deleting or reordering nodes, restyling neighbours, fixing things not asked about, changing dir or lang. If the request needs those, say so in followUp instead of approximating.`,
  references: {
    'checks/precision.md':
      'Target confirmed from selection or text match; whole tree copied when editing a region; only the named property changed; no cosmetic cleanup; ambiguity stated in rationale.',
  },
});

/**
 * Recruiter-first CV and portfolio pages. A CV is not a landing page: it needs
 * linked contacts, dated experience and no marketing bands, so it conflicts
 * with page-composition and outranks it (90 > 80) when a request names both
 * ("a landing page for my portfolio"). Auto by CV/portfolio nouns in both
 * languages, including hamza-less spellings people actually type.
 */
const CV_PAGE: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.cv-page',
  name: 'CV, résumé and portfolio page',
  description:
    'Recruiter-first CV or portfolio page: header with linked contacts, summary, experience, skills, education, projects.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 90,
  activation: {
    mode: 'auto',
    keywords: [
      'cv',
      'resume',
      'résumé',
      'curriculum vitae',
      'portfolio',
      'personal site',
      'about me',
      'سيرة ذاتية',
      'سيرة الذاتية',
      'سيرتي',
      'سي في',
      'ملف شخصي',
      'معرض أعمال',
      'معرض اعمال',
      'أعمالي',
      'اعمالي',
      'بورتفوليو',
      'صفحة شخصية',
      'نبذة عني',
    ],
  },
  tags: ['composition', 'cv', 'portfolio'],
  dependencies: ['craftkit.copywriting'],
  conflicts: ['craftkit.page-composition'],
  instructions: `Scanned in 30 seconds by a recruiter, then read by a screen reader or printed: one accent, two weights, white space, borders not shadows, no marketing bands. setProp page contentWidth "standard"; regions wrap in div mx-auto max-w-4xl px-4 md:px-8. One region per block, in this order, skipping what the request lacks:
1 HEADER: grid md:grid-cols-3 gap-8 items-center. img h-40 w-40 rounded-full object-cover (alt = the name) only when a photo URL is given. div md:col-span-2: h1 text-4xl md:text-5xl font-bold, p text-xl text-accent font-medium (role), p text-text-muted max-w-prose (pitch), ul flex flex-wrap gap-x-6 gap-y-2 text-sm of li flex items-center gap-2 holding icon mail / phone / map-pin / globe / link size 16 text-accent and <a href="mailto:…"> / <a href="tel:…"> / <a href="https://…"> whose text is the visible value in span whitespace-nowrap. Link text "LinkedIn", "GitHub" beside a link icon — no brand logos exist.
2 SUMMARY: h2 + p max-w-prose leading-relaxed, ≤3 sentences: years, specialty, one measurable result.
3 EXPERIENCE: h2, then article per job, newest first, grid gap-1 md:grid-cols-4 mb-8: time datetime="YYYY-MM" text-sm text-text-muted tabular-nums, div md:col-span-3 with h3 text-lg font-semibold (role), p text-text-muted (company, city), ul mt-2 space-y-1 of ≤3 li flex gap-2 items-start led by icon chevron-right size 16 mt-1 shrink-0 text-accent (chevron-left in rtl), each a result with a number.
4 SKILLS: h2 + div flex flex-wrap gap-2 of span rounded-full border-2 border-slate-200 px-3 py-1 text-sm, 6–12 per group under h3 text-sm font-semibold; no percentage bars.
5 EDUCATION / CERTIFICATES: the article pattern with icons graduation-cap / badge-check.
6 PROJECTS: grid gap-6 md:grid-cols-2 of figure with img aspect-video w-full rounded-lg object-cover (alt names the project), figcaption h3 text-lg font-semibold, p text-text-muted line-clamp-2, <a href="https://…" class="text-accent underline"> when a URL was given.
Body headings: h2 mb-6 text-sm font-semibold uppercase tracking-wide text-text-muted (Arabic: drop uppercase and tracking). Timeline line: ck- class with border-inline-start: 2px solid var(--t-accent); padding-inline-start: 1.5rem. Dates in one format, Western digits on Arabic pages too. Never invent employers, dates or contacts: "[your email]" / "[بريدك]" placeholders, listed in followUp.
PORTFOLIO variant: Hero (h1 name, tagline, one action), Work grid gap-6 md:grid-cols-2 lg:grid-cols-3 of figure with img aspect-video w-full rounded-2xl object-cover + figcaption mt-3 font-semibold + p text-sm text-text-muted, About (portrait + 2 p), Contact (the header's link list).`,
  references: {
    'checks/cv.md':
      'h1 is the name, h2 per block, h3 per job or project; contact values are <a mailto:/tel:> in their own span; newest job first; impact lines carry numbers; no skill bars; alt on photo and project images; placeholders for unknown facts listed in followUp; contentWidth standard.',
  },
});

/**
 * The occasion page: invitation, farewell, greeting, condolence. The request
 * that motivated it ("بانر وداع سامر ووسيم مع خلفية سفر") got no archetype at
 * all and came back as a generic marketing band. Auto on occasion nouns in
 * both languages; conflicts with the other page archetypes because a page is
 * one of them; depends on copywriting because the message IS the page.
 */
const OCCASION_PAGE: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.occasion-page',
  name: 'Invitation, farewell and greeting page',
  description:
    'One-feeling page for a wedding, invitation, farewell, congratulation, condolence or celebration: names, date, place, message, one reply action.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 85,
  activation: {
    mode: 'auto',
    keywords: [
      'invitation',
      'invite',
      'wedding',
      'engagement',
      'farewell',
      'goodbye',
      'send-off',
      'retirement',
      'congratulation',
      'graduation',
      'birthday',
      'baby shower',
      'anniversary',
      'condolence',
      'memorial',
      'greeting card',
      'eid ',
      'ramadan',
      'celebration',
      'دعوة',
      'زفاف',
      'عرس',
      'خطوبة',
      'وداع',
      'توديع',
      'تهنئة',
      'مبروك',
      'تخرج',
      'عيد ميلاد',
      'ذكرى',
      'عزاء',
      'تعزية',
      'عيد ',
      'رمضان',
      'حفل',
      'دعاء',
    ],
  },
  tags: ['composition', 'occasion', 'invitation'],
  dependencies: ['craftkit.copywriting'],
  conflicts: ['craftkit.page-composition', 'craftkit.cv-page'],
  instructions: `One page, one feeling, read in ten seconds on a phone: the occasion, who, when, where, and one way to reply. setProp page contentWidth "narrow" for a card, "standard" when there is a gallery. Three to five regions, one block each, in this order:
1 CARD: section relative overflow-hidden rounded-3xl px-4 py-12 text-center md:px-8 md:py-16. Background: a photo only when the request gives or names one — img absolute inset-0 h-full w-full object-cover (alt describes the scene: "airport departures board" for a travel farewell) under div absolute inset-0 bg-black opacity-60 (never bg-black/60), text in text-white; otherwise bg-gradient-to-br from-rose-50 via-amber-50 to-white with text-text. Content: div relative mx-auto max-w-2xl space-y-4 holding icon heart / plane / gift / sparkles / party-popper / cake size 48 mx-auto (the one that fits), p text-sm font-semibold uppercase tracking-wide (the occasion: "You are invited" / "وداعاً" — Arabic drops uppercase and tracking), h1 text-4xl font-bold leading-tight md:text-6xl (the names, exactly as given), p text-lg md:text-xl (date · place on one line).
2 MESSAGE: div mx-auto max-w-2xl px-4 py-12 text-center with h2 text-2xl font-semibold and p text-lg leading-relaxed text-text-muted. Duas, verses and quotes are reproduced verbatim, never paraphrased; otherwise the writer's own words, ≤3 sentences, second person, warm and forward-looking.
3 DETAILS: div grid gap-6 text-center md:grid-cols-3 of div rounded-2xl border-2 border-slate-200 p-6 with icon calendar / clock / map-pin size 24 mx-auto text-accent, h3 mt-2 font-semibold, p text-text-muted; time datetime="YYYY-MM-DD" for the date; the place as <a href="https://…" class="text-accent underline"> when a map link is given.
4 GALLERY (only for photo URLs the request gives): div grid grid-cols-2 gap-4 md:grid-cols-3 of img aspect-square w-full rounded-xl object-cover, alt per photo.
5 REPLY: exactly one action — <a href="mailto:…"> / <a href="tel:…"> / <a href="https://wa.me/…"> styled inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 font-semibold text-accent-text, text naming the act ("RSVP by 12 June" / "أكّد حضورك"); never a form.
Names, dates and places come only from the request; unknowns become "[date]" / "[التاريخ]" placeholders listed in followUp. Condolences: bg-surface, text-text, no gradients, no party icons, no exclamation marks. Bilingual pages carry each language in its own p, never slash-separated. A banner (one region requested) is region 1 alone with the reply link inside it.`,
  references: {
    'checks/occasion.md':
      'h1 is the names as given; occasion label above it; one reply action, a link not a form; date as time datetime; photo background only when a URL or scene was given and then bg-black + opacity-60 with text-white; verbatim duas and quotes; placeholders for unknown facts listed in followUp; condolence pages plain.',
  },
});

/**
 * The complete landing or home page: section order, anatomy and rhythm with
 * exact class strings and a 10-insertNode budget. Auto only on whole-page
 * phrases so a single-section request never gets the full narrative; it
 * depends on copywriting because every section it plans carries real copy.
 */
const PAGE_COMPOSITION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.page-composition',
  name: 'Professional page composition',
  description:
    'Section order, anatomy and rhythm for a complete landing or home page, built from the primary visitor outcome outward.',
  version: '2.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 80,
  activation: {
    mode: 'auto',
    keywords: [
      'landing page',
      'full page',
      'complete page',
      'home page',
      'homepage',
      'whole site',
      'full site',
      'sales page',
      'صفحة هبوط',
      'صفحة كاملة',
      'صفحة رئيسية',
      'موقع كامل',
      'موقع متكامل',
      'صفحة تعريفية',
    ],
  },
  tags: ['composition', 'design', 'page'],
  dependencies: ['craftkit.copywriting'],
  instructions: `Plan from the primary visitor outcome: name it in the rationale, then build these sections in order, one region each, dropping any the request gives no material for.
1 HERO: h1 text-4xl md:text-6xl font-bold leading-tight (Arabic: leading-snug), p text-lg md:text-xl text-text-muted max-w-2xl, div flex flex-wrap gap-4 with one primary action and one secondary <a>, ul flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted of 3 proof facts, each li flex items-center gap-2 led by icon circle-check size 16 text-success. With an image: grid md:grid-cols-2 items-center gap-8, img aspect-video w-full rounded-2xl object-cover shadow-xl AFTER the text; without: mx-auto max-w-3xl text-center.
2 PROOF: grid grid-cols-2 md:grid-cols-4 gap-6 text-center; p text-4xl font-extrabold tabular-nums text-accent + p text-sm text-text-muted.
3 BENEFITS: h2 + p mx-auto max-w-2xl text-center text-text-muted, then 3 or 6 cards grid gap-6 md:grid-cols-3; card = div rounded-2xl border-2 border-slate-200 bg-surface p-6 md:p-8 with icon size 28 text-accent, h3 text-xl font-semibold, p text-text-muted leading-relaxed. A benefit names what changes for the visitor, with a number, example or mechanism.
4 HOW IT WORKS: ol grid gap-8 md:grid-cols-3; li opens with div h-10 w-10 rounded-full bg-accent text-accent-text flex items-center justify-center font-bold holding the number, then h3 + p.
5 TESTIMONIALS or PRICING only when the request gives quotes or prices (recipes in the conversion skill).
6 FAQ: div mx-auto max-w-3xl divide-y; 4–6 pairs, each div py-6 with h3 font-semibold + p mt-2 text-text-muted, answering unanswered objections.
7 FINAL ACTION: section bg-surface-inverse text-text-inverse py-16 text-center: h2 restating the promise, one p, the SAME primary action label as the hero.
8 FOOTER: footer border-t-2 border-slate-200 bg-slate-50 py-12 > grid gap-8 md:grid-cols-4: brand column plus three ul space-y-2 text-sm of <a href="#section-id"> (give each section its id), then small for the copyright.
RHYTHM: alternate bg-surface and bg-slate-50; one dark band besides the hero at most; exactly one h1; every section opens with h2; card grids hold 3 or 6; at most 10 insertNode per plan — sections 1–6 first, the rest in followUp; setProp page title and description when empty; use hero/features/pricing/testimonials/faq/cta/pageHeader/pageFooter blocks when in the catalog.`,
  references: {
    'checks/page-quality.md':
      'One h1; hero states an outcome, not a welcome; h1, action and proof fit the first phone screen; every action names its destination; mobile order = DOM order; primary action label identical in hero and final band; only logical spacing (ps-/pe-); pointing icons match doc.dir; every parentId is the page root.',
  },
});

/**
 * Arabic and RTL depth beyond the manual's floor. The matcher cannot detect
 * Arabic script, so the Arabic imperatives ("صمم لي", "أنشئ لي", ...) stand in
 * as proxies for "this request is in Arabic" alongside explicit RTL phrases.
 */
const ARABIC_RTL: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.arabic-rtl',
  name: 'Arabic and right-to-left composition',
  description:
    'Direction switch, logical layout, mirrored icons, Arabic typography and mixed-run isolation for Arabic or bilingual pages.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 65,
  activation: {
    mode: 'auto',
    // Any Arabic character activates it; the keywords keep the English asks.
    scripts: ['arabic'],
    keywords: [
      'arabic',
      'right-to-left',
      'right to left',
      'rtl layout',
      'rtl page',
      'rtl support',
      'rtl version',
      'make it rtl',
      'bilingual',
      'both languages',
      'عربي',
      'من اليمين',
      'ثنائي اللغة',
      'باللغتين',
      'اتجاه الصفحة',
      'صمم لي',
      'أنشئ لي',
      'ابني لي',
      'اعمل لي',
    ],
  },
  tags: ['arabic', 'i18n', 'rtl', 'typography'],
  instructions: `Arabic and right-to-left depth, on top of the manual's floor (dir/lang switch, logical utilities, mirrored arrows).
ONE DIRECTION: no per-element dir exists; a page has one direction, the primary language's. A bilingual page puts each language in its own region, never both in one paragraph.
LAYOUT: flex and grid already flow from the right in rtl: keep DOM order = reading order (icon before text, arrow after action text); never fake mirroring with flex-row-reverse or order-*. Side accents: border-s-* and rounded-s-* do not exist — ck- class with border-inline-start / border-start-start-radius in css. A shape anchored with start-0 mirrors correctly.
ICONS: mirror meaning only: arrow-left, chevron-left, arrow-up-left for "next/forward"; back is arrow-right; mail, phone, map-pin, check, star stay. The button block's "arrow" icon is a literal → that does not mirror: use icon "none" on Arabic pages.
TYPE: font-family: var(--t-font-family-sans) unless the request names a font URL (then @font-face with src:url(https://…) in pageCss; @import is refused). Body text-lg leading-relaxed; headings leading-snug; never italic, uppercase, capitalize, tracking-* (letter-spacing breaks the connected script) or text-justify. Reading column max-w-prose. Arabic headings ≤7 words.
MIXED RUNS: Western digits with tabular-nums; phones, emails, URLs, prices with currency codes and Latin product names each in their own span whitespace-nowrap so the bidi algorithm cannot flip them.
PUNCTUATION: «،» «؛» «؟», no «!», quotations with «».`,
  references: {
    'checks/rtl.md':
      'setDocMeta dir + page lang set when needed; only logical utilities; pointing icons mirrored by name, button icon none; no italic/uppercase/tracking/justify on Arabic; digits, emails, phones, URLs isolated in spans; Arabic punctuation; one direction per page, languages in separate regions.',
  },
});

/**
 * Exact class recipes for cards, stats, steps, testimonials, pricing and FAQ.
 * Priority 60 sits below the page archetypes so it layers on top of them when
 * a landing request also names pricing or testimonials. Section nouns only:
 * bare "feature"/"card" are excluded to avoid substring false positives.
 */
const CONVERSION_RECIPES: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.conversion-recipes',
  name: 'Conversion section recipes',
  description:
    'Exact class recipes for cards, stats, steps, testimonials, pricing and FAQ sections.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 60,
  activation: {
    mode: 'auto',
    keywords: [
      'pricing',
      'testimonial',
      'faq',
      'feature cards',
      'feature section',
      'features section',
      'benefits section',
      'stats',
      'how it works',
      'أسعار',
      'اسعار',
      'باقات',
      'آراء العملاء',
      'شهادات',
      'أسئلة شائعة',
      'إحصائيات',
      'ميزات',
      'خطوات',
    ],
  },
  tags: ['cards', 'composition', 'sections'],
  instructions: `Recipes; the wrapper is the manual's region shell. Use the registered block instead when its type is in the catalog (features, pricing, testimonials, faq, stats, processSteps, accordion).
CARD: div rounded-2xl border-2 border-slate-200 bg-white p-6 md:p-8 shadow-sm transition-colors hover:border-slate-300 > div mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-text with one icon size 24, h3 mb-2 text-xl font-semibold, p text-text-muted leading-relaxed. Grid gap-6 md:grid-cols-2 lg:grid-cols-3; 3 or 6 cards.
STATS: grid grid-cols-2 md:grid-cols-4 gap-8 text-center; p text-4xl md:text-5xl font-extrabold tabular-nums tracking-tight text-accent + p mt-2 text-sm text-text-muted.
STEPS: ol grid gap-8 md:grid-cols-3; each li opens with div mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-accent-text holding the number, then h3 + p.
TESTIMONIAL: figure rounded-2xl bg-slate-50 p-8: icon quote size 28 text-accent, blockquote mt-4 text-lg leading-relaxed, figcaption mt-6 flex items-center gap-4 with img h-12 w-12 rounded-full object-cover, p font-semibold, p text-sm text-text-muted. Grid gap-6 md:grid-cols-3.
PRICING: div grid items-stretch gap-6 md:grid-cols-3; card = div flex flex-col rounded-2xl border-2 border-slate-200 bg-surface p-6; the one recommended tier adds border-accent shadow-lg ring-2 ring-accent and span self-start rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-text; h3 name, p text-sm text-text-muted audience, p mt-4 text-5xl font-bold tabular-nums with child span text-base font-normal text-text-muted for the period, ul mt-6 grow-1 space-y-2 of li flex items-start gap-2 led by icon check size 20 shrink-0 text-success (grow-1 pushes the action to the card bottom; mt-auto does not exist), one action last, solid only on the recommended tier. No monthly/yearly toggle: two price lines instead. In rtl the currency follows the number.
FAQ: div mx-auto max-w-3xl; each div border-t-2 border-slate-200 py-6 with h3 text-lg font-semibold and p mt-2 text-text-muted leading-relaxed; elements cannot collapse — use accordion when present.`,
  references: {
    'checks/sections.md':
      'Card grids hold 3 or 6; numbers tabular-nums; one recommended pricing tier, price with period span, grow-1 list; testimonial has name and role; FAQ answers objections; registered block used when in catalog.',
  },
});

/**
 * Header, footer, contact, team, gallery and timeline recipes with real links
 * and RTL-safe timeline CSS. Phrase-form keywords ("site header", "contact
 * us") because bare "header"/"footer"/"contact"/"team" fire on ordinary edit
 * requests such as "update the contact email".
 */
const STRUCTURE_RECIPES: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.structure-recipes',
  name: 'Structure section recipes',
  description:
    'Exact class recipes for header, footer, contact, team, gallery and timeline sections, with real links and the RTL-safe timeline CSS.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 55,
  activation: {
    mode: 'auto',
    keywords: [
      'site header',
      'header section',
      'navbar',
      'navigation bar',
      'site footer',
      'page footer',
      'footer section',
      'contact section',
      'contact page',
      'contact us',
      'get in touch',
      'our team',
      'team section',
      'team page',
      'gallery',
      'timeline',
      'ترويسة',
      'شريط التنقل',
      'تذييل',
      'قسم تواصل',
      'تواصل معنا',
      'اتصل بنا',
      'فريق العمل',
      'فريقنا',
      'معرض صور',
      'جدول زمني',
      'مسار زمني',
    ],
  },
  tags: ['chrome', 'composition', 'sections'],
  instructions: `Recipes; the wrapper is the manual's region shell. Use the registered block instead when its type is in the catalog (pageHeader, navLinks, pageFooter, contact, formSection, team, gallery, portfolioGrid).
HEADER: header sticky top-0 z-40 border-b-2 border-slate-200 bg-white > div mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8: span text-lg font-bold tracking-tight (brand), nav aria-label="Main" hidden md:flex gap-8 text-sm font-medium of <a href="#section-id"> (give each target section that id), one action. Phones see brand + action only; say so in followUp.
FOOTER: footer border-t-2 border-slate-200 bg-slate-50 > div mx-auto max-w-6xl px-4 py-12 md:px-8 > grid gap-8 md:grid-cols-4: brand column (span font-bold + p text-sm text-text-muted) plus three columns of h3 text-sm font-semibold uppercase tracking-wide (Arabic: no uppercase/tracking) and ul mt-4 space-y-2 text-sm text-text-muted of <a href>; then div mt-12 border-t-2 border-slate-200 pt-6 text-xs text-text-muted with small for the copyright.
CONTACT: grid gap-8 md:grid-cols-2; column A: h2, p, ul space-y-4 of li flex items-center gap-3 with icon mail / phone / map-pin / clock size 20 text-accent and <a href="mailto:…"> / <a href="tel:…"> or plain text for the address; hours as ul of li flex justify-between tabular-nums. Column B: the contact or formSection block when present, else an img of the place or div rounded-2xl bg-surface p-6 with directions. Never draw a fake form from div/span; no map embed (iframe is refused).
TEAM: grid grid-cols-2 md:grid-cols-4 gap-8 text-center; img aspect-square w-full rounded-2xl object-cover (alt = name), p mt-4 font-semibold, p text-sm text-text-muted.
GALLERY: grid grid-cols-2 md:grid-cols-3 gap-4 of img aspect-square w-full rounded-xl object-cover; the lead image adds col-span-2 row-span-2.
TIMELINE: ol space-y-8; each li relative ps-8 ck-tl with span absolute start-0 top-1 h-4 w-4 rounded-full bg-accent ring-4 ring-surface, time text-sm font-medium text-accent with datetime, h3, p; css .ck-tl::before{content:"";position:absolute;inset-inline-start:7px;top:1.5rem;bottom:-2rem;width:2px;background:var(--t-accent);opacity:.3}`,
  references: {
    'checks/chrome.md':
      'Nav links are <a href="#id"> to real section ids; footer has copyright line; contact values linked with mailto:/tel:; no fake form, no iframe; team photos square and one size; timeline uses inset-inline-start.',
  },
});

/**
 * One named visual direction applied everywhere: five palette recipes,
 * contrast pairs, four type sizes, one spacing scale and restyle rules. Auto
 * on restyle intent only; adjectives ("elegant", "simple", "ألوان") were
 * deliberately not adopted because they appear in unrelated requests.
 */
const DESIGN_DIRECTION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.design-direction',
  name: 'Coherent design direction',
  description:
    'One named visual direction applied everywhere: five palette recipes, contrast pairs, four type sizes, one spacing scale, restyle rules.',
  version: '2.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 50,
  activation: {
    mode: 'auto',
    keywords: [
      'design system',
      'visual direction',
      'redesign',
      'restyle',
      'look and feel',
      'colour scheme',
      'color scheme',
      'colour palette',
      'color palette',
      'dark mode',
      'dark theme',
      'هوية بصرية',
      'إعادة تصميم',
      'ألوان الموقع',
      'لوحة الألوان',
      'غيّر التصميم',
      'غير التصميم',
      'ثيم داكن',
      'الوضع الداكن',
      'نمط الصفحة',
      'darker',
      'lighter',
      'background colour',
      'background color',
      'أغمق',
      'أفتح',
      'لون الخلفية',
    ],
  },
  tags: ['colour', 'design', 'typography', 'visual'],
  instructions: `Pick one direction, name it in the rationale in ≤6 words, apply it identically in every region you touch.
A THEME (default when no hue is named): bg-surface text-text; muted text-text-muted; cards bg-surface border-2 border-slate-200; accent bg-accent text-accent-text; dark band bg-surface-inverse text-text-inverse — re-themes with the site. Under colourPolicy 'tokens' the palette is refused: A only.
B EDITORIAL: bg-white text-slate-900; muted text-slate-600; accent indigo-600; rounded-lg; border-2 border-slate-200, shadow-none; headings text-5xl tracking-tight; headline font via css .ck-serif{font-family:var(--t-font-family-serif)}.
C SOFT PRODUCT: bg-slate-50; cards bg-white rounded-2xl shadow-sm; accent violet-600 or emerald-600; one gradient only, on the hero or final action: bg-gradient-to-br from-violet-600 to-indigo-700 text-white.
D DARK TECH: bg-slate-950 text-slate-100; muted text-slate-400; cards bg-slate-900 border-2 border-slate-800; text-sky-400 for accent text and icons, bg-sky-500 text-white for the action; one glow: div absolute h-64 w-64 rounded-full bg-sky-500 opacity-20 blur-3xl inside relative isolate overflow-hidden, content relative z-10.
E WARM: bg-stone-50 text-stone-900; muted text-stone-600; accent orange-600; rounded-3xl; cards bg-white border-2 border-stone-200.
CONTRAST: on white or *-50, body text is *-600 or darker and headings *-900; on *-900/*-950, body is *-300 or lighter and headings white; never *-400/*-500 for body text; text over a photo needs a darkening layer via ck- css background: linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url(https://…) center/cover (bg-black/50 does not exist).
TYPE, exactly: display text-4xl md:text-6xl font-bold leading-tight; h2 text-3xl md:text-4xl font-semibold; h3 text-xl font-semibold; body text-base md:text-lg leading-relaxed; caption text-sm text-text-muted. tracking-tight only on Latin display text.
SPACING: section py-12 md:py-16, gutter px-4 md:px-8, columns gap-8, card p-6 md:p-8, inside a card gap-4. SURFACES: one radius for cards, one for actions; one shadow at rest; hover is one shade step (hover:bg-indigo-700 on bg-indigo-600), hover:opacity-90, or hover:scale-105 transition-transform duration-200 — hover:shadow-* does not exist.
MODE: no dark: variant; a page is one mode — a requested dark mode is D, or pageCss @media (prefers-color-scheme: dark) rules on ck- classes. Fonts: font-sans/serif/mono do not exist; set font-family in css from var(--t-font-family-sans|serif|mono); @font-face with url(https://…) in pageCss; @import is refused.
RESTYLE: one setProp of tree per region keeping text, ids and node order, changing only className values; page-wide rules once in pageCss as .ck- classes.`,
  references: {
    'checks/consistency.md':
      'Direction named once, never mixed; same treatment for the same role everywhere; four type sizes only; spacing on the one scale; one radius, one rest shadow; one accent fill per section; contrast pairs from the table; no absent utilities (hover:shadow, py-24, /opacity, bare border-t, dark:).',
  },
});

/**
 * Headline, action and body copy rules in Arabic and English. Mostly reached
 * as a dependency of the page archetypes; its own keywords cover copy-only
 * asks ("rewrite the text", "صياغة") without pulling in a page plan.
 */
const COPYWRITING: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.copywriting',
  name: 'Headlines, actions and body copy',
  description:
    'Headline, call-to-action and body copy rules in Arabic and English; placeholders, never invented facts.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 45,
  activation: {
    mode: 'auto',
    keywords: [
      'headline',
      'tagline',
      'slogan',
      'call to action',
      'call-to-action',
      'copywriting',
      'microcopy',
      'rewrite the text',
      'write the copy',
      'عنوان رئيسي',
      'شعار',
      'صياغة',
      'نص إعلاني',
      'دعوة لاتخاذ',
      'زر الإجراء',
    ],
  },
  tags: ['arabic', 'content', 'copy'],
  instructions: `Real copy in the language of the request (match the page's existing language when it differs); never lorem ipsum.
HEADLINE: the visitor's outcome in ≤8 English / ≤7 Arabic words, a concrete verb or noun; no "Welcome to" / "مرحباً بكم"; no exclamation mark; no uppercase class. Subhead: one sentence ≤20 words — who it is for and what changes.
ACTION: verb first, 2–4 words naming the result ("Start free trial", "Book a call", "ابدأ التجربة المجانية", "احجز استشارتك"); never "Learn more", "Submit", "اضغط هنا", "المزيد" alone. One primary action per section, the identical label wherever it repeats; a secondary action is an <a> with an arrow icon in reading direction.
BODY: paragraphs ≤3 sentences; sentence case in English; one idea per card; "you get X", not "we offer X"; numbers as digits; a claim with a number needs a source line or is dropped.
FACTS: never invent names, prices, phones, emails, addresses or reviews — write "[Customer name]" / "[اسم العميل]" placeholders and list them in followUp.
ARABIC: Modern Standard Arabic; one address form (أنتَ or أنتم); «،» and «؟»; correct hamza and taa marbuta (ة not ه); Arabic headings go one text-* step up rather than bolder; Latin product names in their own span.`,
  references: {
    'checks/copy.md':
      'Headline ≤8/7 words, outcome-led; one primary action label repeated verbatim; no "click here" / "اضغط هنا"; no invented facts (placeholders listed in followUp); Arabic punctuation «،؟», no «!»; no italic/uppercase/tracking on Arabic.',
  },
});

/**
 * Restrained motion the renderer can actually run: transition utilities,
 * keyframes in pageCss, reduced-motion guards. Auto on animation verbs; the
 * "animate" ⊂ "animated" substring hit is accepted as a true positive.
 */
const MOTION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.motion',
  name: 'Motion and interaction',
  description:
    'Restrained motion the renderer can run: transition and hover utilities, keyframes in pageCss, reduced-motion guards, CSS-only lift, reveal, marquee and glow.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 45,
  activation: {
    mode: 'auto',
    keywords: [
      'animate',
      'animation',
      'motion',
      'hover effect',
      'parallax',
      'keyframe',
      'transition',
      'scroll reveal',
      'marquee',
      'تحريك',
      'متحرك',
      'حركة',
      'أنيميشن',
      'تأثيرات',
    ],
  },
  tags: ['animation', 'interaction', 'motion'],
  instructions: `Motion budget: at most two moving things per screen, and nothing moves that the visitor did not cause except one ambient element.
TIMING: micro interactions transition-colors duration-200 ease-out; card lift duration-300; entrance reveal 0.6s ease-out; ambient loops 8s to 20s linear infinite.
HOVER on cards: transition-transform duration-300 hover:scale-105 motion-reduce:transform-none. Lift with shadow cannot be a utility (hover:shadow-* does not exist): class ck-lift transition-all duration-300 with css .ck-lift:hover{transform:translateY(-4px);box-shadow:var(--t-shadow-elevated)}.
KEYFRAMES live in pageCss on the page root (they pass scoping unchanged and are declared once): @keyframes ck-fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}. Apply from the region css: .ck-fade-up{animation:ck-fade-up .6s ease-out both}; stagger with .ck-d1{animation-delay:.1s} .ck-d2{animation-delay:.2s} .ck-d3{animation-delay:.3s}.
GUARD every animated rule in the same sheet: @media (prefers-reduced-motion:reduce){.ck-fade-up,.ck-marquee-track{animation:none}}.
SCROLL REVEAL without JavaScript: @supports (animation-timeline: view()){.ck-fade-up{animation-timeline:view();animation-range:entry 0% entry 40%}}; elsewhere it plays on load.
MARQUEE: prefer the marquee block when present; otherwise div overflow-hidden > div ck-marquee-track flex gap-12 whitespace-nowrap with the items duplicated once, css .ck-marquee-track{animation:ck-marquee 20s linear infinite} and keyframes translateX(0) to translateX(-50%) in pageCss.
GLOW: div absolute h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl animate-pulse inside a relative isolate overflow-hidden parent; the content sibling gets relative z-10.
HOVER REVEALS need no group class (it does not exist): .ck-card .ck-meta{opacity:0;transition:opacity .2s} .ck-card:hover .ck-meta{opacity:1}.
PARALLAX: in css, background-attachment:fixed on a background-image region only inside @media (min-width:768px); phones get a static image.
Never animate layout (width, height, margin); animate transform and opacity only.`,
  references: {
    'checks/motion.md':
      'At most two moving things per screen; keyframes in pageCss, applied from region css; prefers-reduced-motion guard present; transform/opacity only; no group class, no hover:shadow-*.',
  },
});

/**
 * Landmarks, heading order, naming, contrast pairs, motion and language rules
 * for assistive tech. Auto on accessibility vocabulary; "accessible" ⊂
 * "inaccessible" and "contrast" ⊂ "high-contrast" are accepted hits.
 */
const ACCESSIBILITY: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.accessibility-review',
  name: 'Accessible structure and contrast',
  description:
    'Landmarks, heading order, link and image naming, icon labelling, contrast pairs, motion and language rules for assistive tech.',
  version: '2.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 40,
  activation: {
    mode: 'auto',
    keywords: [
      'accessibility',
      'accessible',
      'a11y',
      'wcag',
      'screen reader',
      'contrast',
      'إمكانية الوصول',
      'سهولة الوصول',
      'قارئ الشاشة',
      'ذوي الإعاقة',
      'تباين',
      'easier to read',
      'readable',
      'legible',
      'أوضح',
      'مقروء',
      'سهل القراءة',
    ],
  },
  tags: ['accessibility', 'content', 'quality'],
  instructions: `Structure that a screen reader, a keyboard and a printer can all follow.
LANDMARKS: the page root is already <main>. Inside a region: header for the site head only, nav aria-label="…" around link groups, section aria-label="…" or a heading as its first child, footer, article for self-contained items (a job, a project, a testimonial), aside for tangents. Use the tag that exists instead of div: blockquote + figcaption for a testimonial, time datetime for dates, ol for ordered steps, figure/figcaption for captioned images.
HEADINGS: one h1 on the whole page (read every region already in the document); h2 per section, h3 per card, never skip a level, never pick a tag for its size; an sr-only h2 when a section needs a name without a visible heading.
NAMES: img alt = what it shows in ≤12 words, alt="" only for pure decoration; icon label only when it stands alone (role=img), omitted when text beside it says the same (aria-hidden), never both; aria-label on section/nav is a short noun phrase in the page language; no aria-label on div/span/p (ignored or harmful).
LINKS AND BUTTONS: link text names the destination ("See pricing", never "click here"); <a href> for anything with a destination; <button> only for an affordance the host will wire later — it does nothing yet, say so in followUp; target="_blank" only when the text says it opens elsewhere; clickable areas at least py-3 px-4.
CONTRAST: body text text-text or palette 700+ on 50/100 surfaces; text-text-muted only at ≥text-sm and never over bg-accent or photos; on bg-surface-inverse use text-text-inverse; white text only on palette 600+; never 300/400 palette text on white; never grey text on a gradient. State is never colour alone: pair it with an icon (circle-check, circle-alert) or a word.
MOTION: animate-* only on decoration; motion-reduce:transform-none on anything moved by transform; hover:scale-* on cards only, never on text; no animate-ping/bounce beside text people read.
LANGUAGE: page prop lang set ('ar', 'en'); dir matches it; no text-justify; leading-relaxed in paragraphs; max-w-prose for reading columns.`,
  references: {
    'checks/accessibility.md':
      'No nested main; one h1, no skipped levels; alt on every img; icon label xor neighbouring text; aria-label only on section/nav/article; link text names destination; contrast pairs from the table; motion-reduce on transforms; lang and dir set.',
  },
});

/**
 * The always-on floor: region shell, links, direction, type, structure and the
 * refused-class traps every plan trips over without it. It is the single
 * "always" skill, so it is mandatory on every request and its size is capped
 * (see builtins.test.ts): a mandatory skill over budget throws instead of
 * being omitted, which would fail every run before the provider is called.
 */
const CRAFT_MANUAL: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.craft-manual',
  name: 'Craft manual',
  description:
    'Always-on floor: region shell, links and actions, direction, type, structure, refused-class traps.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  activation: { mode: 'always' },
  tags: ['composition', 'craft', 'rtl', 'traps'],
  instructions: `REGIONS: one customCode per section, inserted into the page root; section py-12 md:py-16 > div mx-auto max-w-6xl px-4 md:px-8. Columns: grid gap-6/gap-8 + md:grid-cols-N (md:flex-row does not exist). No <main> tag.
LINKS: <a href> takes https, mailto:, tel:, #id or /path (javascript: is dropped). Action: the button block when in the catalog, else <a class="inline-block rounded-full bg-accent px-8 py-3 font-semibold text-accent-text">. <button> has no behaviour.
DIRECTION: Arabic copy on an ltr document needs setDocMeta {dir:'rtl'} + setProp page lang 'ar'. Only ps-/pe-/ms-/me-, start-/end-, text-start/text-end; never pl-/pr-/ml-/mr-/text-left/text-right. Forward icon: arrow-right in ltr, arrow-left in rtl.
TYPE: one h1 per page, h2 opens a section, h3 a card; size with text-*, not a bigger tag. Arabic: leading-relaxed; no italic, uppercase, tracking-*, text-justify.
STRUCTURE: img has alt; an icon beside text has no label; ul/ol show no bullets: lead each li with an icon.
REFUSED: bare border-t/border-b (use -2), bare grow/shrink (use -1), group, hover:text-white, hover:shadow-*, py-20/24, gap-16, h-5, font-sans, list-disc, xl:, dark:, bg-black/50, -mt-4, md:text-center.`,
  references: {},
});

/**
 * Reviewed, data-only defaults, ordered by priority descending. Hosts opt in
 * by constructing this registry; the registry itself re-sorts by id.
 */
export const CRAFTKIT_AI_SKILL_DEFINITIONS: readonly AiSkillDefinitionV1[] = Object.freeze([
  PRECISE_EDIT,
  CV_PAGE,
  OCCASION_PAGE,
  PAGE_COMPOSITION,
  ARABIC_RTL,
  CONVERSION_RECIPES,
  STRUCTURE_RECIPES,
  DESIGN_DIRECTION,
  COPYWRITING,
  MOTION,
  ACCESSIBILITY,
  CRAFT_MANUAL,
]);

export function createCraftkitAiSkillRegistry(
  additionalSkills: readonly AiSkillDefinitionV1[] = [],
): AiSkillRegistry {
  return createAiSkillRegistry([...CRAFTKIT_AI_SKILL_DEFINITIONS, ...additionalSkills]);
}
