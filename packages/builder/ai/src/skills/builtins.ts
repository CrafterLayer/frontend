import { DIRECTION_DECK_SKILL } from './direction-deck';
import { CLINIC_PAGE_SKILL } from './industry/clinic-page';
import { MENU_PAGE_SKILL } from './industry/menu-page';
import { PAGE_INTENTS } from './industry/shared';
import { PROPERTY_PAGE_SKILL } from './industry/property-page';
import { SHOP_PAGE_SKILL } from './industry/shop-page';
import { PHOTO_DIRECTION_SKILL } from './photo-direction';
import { ART_SKILLS } from './art-names';
import { DATA_VIZ_SKILL } from './data-viz';
import { MOTION_SKILL } from './motion';
import { createAiSkillRegistry } from './registry';
import { CREATIVE_ENGINE_SKILLS } from './creative/creative-engines';
import { PIXI_CREATIVE_SKILLS } from './creative/pixi-creative';
import { SECTION_VARIANTS_SKILL } from './section-variants';
import type { AiSkillDefinitionV1, AiSkillRegistry } from './types';
// design-code additions (2026-09-28)
import { DESIGN_CODE_SKILL } from './design-code';
import { DESIGN_QUALITY_TEACHING, TAILWIND_PLUGIN_TEACHING } from './design-libraries';
import { SITE_BEHAVIOR_TEACHING } from './site-behaviors';
// pixi-skills additions (2026-10-10): PixiJS v8 guides rewritten as skills — see creative/PIXI_SOURCES.md.
import {
  PIXI_V8_CORE_SKILL,
  PIXI_V8_EFFECTS_SKILL,
  PIXI_V8_GRAPHICS_SKILL,
  PIXI_V8_INTERACTION_PERF_SKILL,
  PIXI_V8_TEXT_ASSETS_SKILL,
} from './creative/pixi-v8';

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
  version: '2.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 100,
  activation: { mode: 'explicit' },
  tags: ['content', 'precision', 'safe-edit'],
  conflicts: [
    'craftkit.conversion-recipes',
    'craftkit.cv-page',
    'craftkit.page-composition',
    'craftkit.scroll-cinematic',
    'craftkit.structure-recipes',
    'craftkit.visual-direction',
  ],
  restrictToCommands: ['setBinding', 'setProp', 'setResponsive'],
  instructions: `The smallest change that fully satisfies the request; nothing else moves.
TARGET: resolve it from the selection first, then by matching the quoted or described text in the document; if two nodes match, edit the selected one or the first in reading order and name the ambiguity in the rationale.
REGISTERED BLOCKS: change only the named prop with setProp, or the named breakpoint with setResponsive.
CUSTOMCODE REGIONS: change a region with editTree — quote the exact markup to change from the document and give its replacement ({"command":"editTree","args":{"id":"<region id>","edits":[{"find":"…","replace":"…"}]}}); each find unique in that region. Never re-emit the whole tree for a small change; keep the label and css unless asked. A text edit keeps the tag, classes and the language's punctuation («،؟» in Arabic); a colour edit swaps one class for one class; an alignment edit uses text-start/text-end.
RESPONSIVE: an "on mobile" request is setResponsive on a declared prop of a registered block, or a sm:/md:/lg: class inside the tree — never a second copy of the content.
NOT HERE: adding, moving, deleting or reordering nodes, restyling neighbours, fixing things not asked about, changing dir or lang. If the request needs those, say so in followUp instead of approximating.`,
  references: {
    'checks/precision.md':
      'Target confirmed from selection or text match; a region edited with editTree quotes, never re-emitted whole; only the named property changed; no cosmetic cleanup; ambiguity stated in rationale.',
  },
});

/**
 * The FIRST half of a split build: put the whole page's skeleton down in one
 * transaction, and decide the direction once for every section that follows.
 *
 * Explicit-only, because the orchestrator selects it — no phrasing of a
 * request should ever land a person in a scaffold run by accident. The
 * command policy for the run is set by the caller (`policy.allowedCommands`),
 * not by `restrictToCommands` here: skill restrictions INTERSECT, so a second
 * active skill with a different list would collapse the run to nothing.
 */
const BUILD_SCAFFOLD: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.build-scaffold',
  name: 'Build: the page skeleton',
  description:
    'One transaction that inserts every section as an empty labelled region, in order, and fixes the direction the whole page will follow.',
  version: '2.3.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 95,
  activation: { mode: 'explicit' },
  tags: ['build', 'composition', 'scaffold'],
  instructions: `You are laying a SKELETON, not writing the page. Every section is inserted empty; another run fills each one.
COUNT AND ORDER: choose 1–12 coherent regions from the brief's content and reading order. One region may hold the complete page composition. Preserve every requested detail without inventing sections to meet a template; group related details when the layout calls for it.
ONE insertNode PER REGION, all into the page root, in reading order, its tree written as markup: {"command":"insertNode","args":{"type":"customCode","parentId":"<the document's rootId>","props":{"label":"<unique, concise label>","tree":"<section><h2>THE REGION TITLE</h2></section>"}}}. This is an empty semantic placeholder, not the finished layout; the writer supplies its custom geometry and styling.
The label is how the next runs find this region: it must be UNIQUE and must not change afterwards.
ROLES, marked in the placeholder: the opening content region writes its heading as h1 instead of h2 — the page's one h1. A requested site header uses header, a footer uses footer; neither is mandatory. Other content regions carry their required heading. The roles describe semantics, never fixed dimensions, columns or actions.
ONE setProp FOR THE PAGE: {"command":"setProp","args":{"id":"<rootId>","key":"pageCss","value":"…"}} carrying only what the WHOLE page shares — a web font @import from fonts.googleapis.com or fonts.bunny.net, @keyframes, and ck- classes used by more than one section. Never a section's own styling.
THE DIRECTION, in the rationale: the subject and audience; palette and faces; visual concept; each region's layout and reading order. Name the site theme (bg-surface, text-text, bg-accent) only when requested. Optional variants such as "1 Hero[split]" may describe useful inspiration, never override a bespoke layout. Every writer receives this direction, so decide the coherent page composition here. Keep it under 100 words.
NOT HERE: body copy, images, buttons, links, per-section CSS, setDocMeta or the page lang (the build sets direction and language itself from the words you write), and any command other than the inserts and the one page setProp.`,
  references: {
    'checks/scaffold.md':
      'One insertNode per coherent region, 1–12 in reading order; a whole-page region is valid; unique labels, semantic placeholders and one opening h1; chrome only when requested; one pageCss for shared rules; rationale conveys the content-led layout and design; no filled content, setDocMeta or lang.',
  },
});

/**
 * The SECOND half: one section, filled in place, under a direction it did not
 * choose. Explicit-only for the same reason as the scaffold, and deliberately
 * narrow — the orchestrator restricts the run to `setProp`, so the only thing
 * this skill has to get right is WHAT to write into the one tree it may touch.
 */
const BUILD_FILL: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.build-fill',
  name: 'Build: fill one section',
  description:
    'Replace exactly one region tree with the finished section, obeying a direction decided for the whole page.',
  version: '3.7.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 94,
  activation: { mode: 'explicit' },
  tags: ['build', 'composition', 'fill'],
  instructions: `ONE setProp for the tree, written as markup: {"command":"setProp","args":{"id":"<the region id you were given>","key":"tree","value":"<section class='…'>…</section>"}} — and, only when the markup uses ck- classes, a SECOND setProp on the same id with key "css" and the region stylesheet as its value. Never a css key inside the first; no other node, no page-level change.
THE DIRECTION WAS ALREADY DECIDED and is in the request. Obey it exactly: the palette, the faces, the signature element, the rhythm. Do not re-decide, do not "improve" it, and do not introduce a colour or a face it does not name — a page whose sections each chose their own look is the failure this split exists to prevent. Every accent, glow, ring, gradient and action fill is drawn from the direction's palette as its named classes or hex, and a recipe's {accent} is its accent hue; the role classes (bg-accent, text-accent, var(--t-accent)) only when the direction names the site theme as its palette.
LAYOUT: follow the brief's design concept and this region's layout. A named variant is optional inspiration unless the brief explicitly requests that exact recipe. Bespoke composition may use semantic markup and scoped CSS; no kit, card grid, container width or section order is mandatory.
THE WHOLE TREE, ONCE: setProp on the tree prop REPLACES it, so write the finished section in full. Other regions arrive described rather than quoted ("filled · 34 nodes · …"); that is deliberate. Do not try to edit them and do not repeat their content.
ROLE AND SEMANTICS: the opening region holds the page's one h1; other content keeps the required heading text and sensible heading hierarchy. Header/footer roles use their semantic elements, without adding unwanted navigation, columns or calls to action. Geometry, spacing, density and visual hierarchy follow the contract and content. A region may hold a cohesive whole-page composition when assigned that scope; do not invent sibling regions or content to fill a template.
FINISHED, NOT DRAFTED: a published page never shows "[price]" or "[اسم العميل]". When the request does not give a business fact the section needs — menu items and prices, a customer's quote and name, opening hours, an address — write a realistic, specific sample that fits the business, its city and its language: prices in the local currency, names usual in that locale, quotes that sound like real customers. List every sample fact in followUp so the owner can replace it. Phone and email follow the same rule in an obviously generic form (info@ the brand's name, a local-format number of zeros). A person's own facts (a CV's employers and dates, an invitation's names and date) are never invented: they stay bracketed and listed in followUp, as the copywriting rules say.
SIZE: write only the assigned region and required content, within the door's actual limits. Use the smallest semantic tree that fulfills its layout; node count is not a design goal.
${DESIGN_QUALITY_TEACHING}\n${TAILWIND_PLUGIN_TEACHING}\n${SITE_BEHAVIOR_TEACHING}`,
  references: {
    'checks/fill.md':
      "Only the named region's tree and css changed; its design concept, layout and required heading preserved; one h1 in the opening region; every colour and face from the given direction, role classes only for a site-theme direction; no other node touched or repeated; content determines geometry; a person's own facts stay truthful.",
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
    'Truthful, recruiter-readable CVs and work-led portfolios, with a distinct brief-specific composition and usable print, mobile and RTL layouts.',
  version: '1.3.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 90,
  activation: {
    mode: 'auto',
    // A whole page: "change the resume download link" is an edit (see PAGE_INTENTS).
    intents: PAGE_INTENTS,
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
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: ['craftkit.page-composition'],
  instructions: `PURPOSE: distinguish a résumé/CV (qualifications for a role) from a portfolio (selected work and process). Read the person's profession, audience, supplied content and requested visual direction before choosing geometry. No fixed section order, wrapper width, card grid, palette, portrait shape or marketing chrome. Use semantic markup and scoped CSS for a bespoke composition; one cohesive region is valid when the plan assigns it.
COMPOSITION: make an explicit content-led choice: a researcher's publication hierarchy, an engineer's concise evidence and project links, or an art director's visual case studies need different density and emphasis. These are possibilities, not templates. A sidebar, asymmetric editorial layout, quiet single column or another structure must earn its place. When changing the look, change hierarchy and spatial composition, not only colour. Preserve the chosen page contract when writing one region.
CV CONTENT: identity, role and real contact links are easy to find; experience has company, role and consistent dates, normally newest first; education, skills and relevant projects appear when supplied. Impact statements use only supported results; no invented percentages or proficiency bars. A portfolio prioritizes selected work with context and meaningful project links; it need not follow the CV's emphasis.
TRUTH: a person's own facts are never invented. Omit missing optional content; visibly label essential missing details such as "[your email]" / "[بريدك]" and list them in followUp. Never attach mailto:, tel: or external URLs to placeholders. No fictional employers, dates, metrics, portrait or credentials. Only show a person's photo or project image when supplied or explicitly requested as a labelled illustration.
READABILITY: one h1 for identity, meaningful headings and semantic lists; links show their actual destinations or purpose. Mobile reading order must match the content order, with wrapping contacts and no clipping. RTL uses logical alignment and spacing; keep dates and Latin contact values readable without reversing the page's language.
PRINT: add scoped @media print rules where needed: readable foreground/background, no clipped content, sensible margins, and break-inside:avoid for short job/project entries. Hide interaction-only controls, never qualifications or contact details. A web layout need not pretend a PDF download exists.`,
  references: {
    'checks/cv.md':
      'Composition serves the profession and supplied content; CV and portfolio priorities differ; no prescribed recipe; all facts supported; placeholder contacts are not links; semantic headings, responsive reading order, RTL and readable print; no fake download or invented metrics.',
  },
});

/**
 * The occasion page: invitation, farewell, greeting, condolence. The request
 * that motivated it ("بانر وداع سامر ووسيم مع خلفية سفر") got no archetype at
 * all and came back as a generic marketing band. Auto on occasion nouns in
 * both languages; conflicts with the other page archetypes because a page is
 * one of them; depends on copywriting because the message IS the page. Eid
 * keywords are whole phrases: when the resolver matched substrings, a bare
 * "عيد" fired inside "سعيد" and "eid al" inside "Reid Allen" (2026-09-28);
 * it matches whole words now, and "عيد" alone is still "repeat". Words that
 * are an occasion only beside another — "دعوة" (also "call to action"),
 * "engagement" (also marketing's word) — are listed with their co-terms.
 */
const OCCASION_PAGE: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.occasion-page',
  name: 'Invitation, farewell and greeting page',
  description:
    'One-feeling page for a wedding, invitation, farewell, congratulation, condolence or celebration: names, date, place, message, one reply action.',
  version: '1.2.3',
  source: 'builtin',
  trust: 'builtin',
  priority: 85,
  activation: {
    mode: 'auto',
    /*
      A page, or its one-region banner ("Add a farewell banner…" is a section);
      never an edit — "change the wedding date to June 12" loaded the whole
      invitation playbook into an edit (agent-audit P0-1).
    */
    intents: ['add-section', ...PAGE_INTENTS],
    keywords: [
      'invitation',
      /*
        Not a bare 'invite': it is marketing's verb too, and its -ing form
        reached it — "add a section inviting visitors to sign up" loaded this
        playbook and visual-direction, 2,724 tokens (probed 2026-09-28).
      */
      'party invite',
      'dinner invite',
      'invite card',
      'wedding',
      /*
        Not a bare 'engagement': "add a section on customer engagement" loaded
        this playbook and visual-direction, 2,724 tokens (wave-2 verifier).
      */
      'engagement party',
      'engagement ceremony',
      'engagement announcement',
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
      /*
        Whole words since 2026-09-28: 'eid al' no longer fires inside "Reid
        Allen", so a bare 'eid' is safe again — and needed: "an Eid page for
        our shop" found no occasion once substrings went (wave-2 verifier).
      */
      'eid',
      'eid mubarak',
      'eid al',
      'eid greeting',
      // router-3 additions (2026-09-28): Ramadan through its co-terms — see 'رمضان كريم' below.
      'ramadan kareem',
      'ramadan mubarak',
      'ramadan greeting',
      'ramadan card',
      'ramadan page',
      'celebration',
      /*
        Not a bare 'دعوة': it is also the Arabic of "call to action", and "أضف
        قسم دعوة لاتخاذ إجراء" loaded this playbook and visual-direction, 3,333
        tokens (wave-2 verifier). An invitation is named with what it invites to.
      */
      'بطاقة دعوة',
      'دعوة زفاف',
      'دعوة عرس',
      'دعوة حفل',
      'دعوة لحضور',
      'دعوة عشاء',
      'دعوة غداء',
      'دعوة افتتاح',
      'دعوة خطوبة',
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
      /*
        Not a bare 'عيد': in the Levantine this product's first users type it is
        "redo" ("عيد تصميم الصفحة"), and "بعيد" ("far") peels to it. The Eid
        named on its own is found through what it sits beside.
      */
      'العيد',
      'بطاقة عيد',
      'صفحة عيد',
      'تهنئة عيد',
      'عيد سعيد',
      'معايدة',
      'عيدية',
      'عيد الفطر',
      'عيد الأضحى',
      'عيد الاضحى',
      'عيد مبارك',
      'عيد الأم',
      'عيد الام',
      /*
        router-3 additions (2026-09-28). Not a bare 'رمضان' / 'ramadan': it is
        the season of shop OFFERS as often as a greeting, and "أضف قسم عروض
        رمضان" (add a Ramadan offers section) loaded this playbook with
        copywriting and visual-direction, 3,333 tokens against the 1,073
        floor (wave-2 verifier). A Ramadan greeting is named with its words.
      */
      'رمضان كريم',
      'رمضان مبارك',
      'تهنئة رمضان',
      'بطاقة رمضان',
      'صفحة رمضان',
      'دعوة إفطار',
      'دعوة افطار',
      'حفل',
      'دعاء',
    ],
  },
  tags: ['composition', 'occasion', 'invitation'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: ['craftkit.page-composition', 'craftkit.cv-page'],
  instructions: `One page, one feeling, read in ten seconds on a phone: the occasion, who, when, where, and one way to reply. setProp page contentWidth "narrow" for a card, "standard" when there is a gallery. Three to five regions, one block each, in this order:
1 CARD: section relative overflow-hidden rounded-3xl px-4 py-12 text-center md:px-8 md:py-16. Background: a photo only when the request gives or names one — img absolute inset-0 h-full w-full object-cover (alt describes the scene: "airport departures board" for a travel farewell) under div absolute inset-0 bg-black/60, text in text-white; otherwise bg-gradient-to-br from-rose-50 via-amber-50 to-white with text-stone-900. Content: div relative mx-auto max-w-2xl space-y-4 holding icon heart / plane / gift / sparkles / party-popper / cake size 48 mx-auto (the one that fits), p text-sm font-semibold uppercase tracking-wide (the occasion: "You are invited" / "وداعاً" — Arabic drops uppercase and tracking), h1 text-4xl font-bold leading-tight text-balance md:text-6xl (the names, exactly as given), p text-lg md:text-xl (date · place on one line).
2 MESSAGE: div mx-auto max-w-2xl px-4 py-12 text-center with h2 text-2xl font-semibold and p text-lg leading-relaxed text-text-muted. Duas, verses and quotes are reproduced verbatim, never paraphrased; otherwise the writer's own words, ≤3 sentences, second person, warm and forward-looking.
3 DETAILS: div grid gap-6 text-center md:grid-cols-3 of div rounded-2xl p-6 ring-1 ring-black/5 with icon calendar / clock / map-pin size 24 mx-auto text-{accent}, h3 mt-2 font-semibold, p text-text-muted; time datetime='YYYY-MM-DD' for the date; the place as <a href='https://…' class='text-{accent} underline'> when a map link is given.
4 GALLERY (only for photo URLs the request gives): div grid grid-cols-2 gap-4 md:grid-cols-3 of img aspect-square w-full rounded-xl object-cover, alt per photo.
5 REPLY: exactly one action — <a href='mailto:…'> / <a href='tel:…'> / <a href='https://wa.me/…'> styled inline-flex items-center gap-2 rounded-full bg-{accent} px-8 py-3 font-semibold text-{on-accent}, text naming the act ("RSVP by 12 June" / "أكّد حضورك"); never a form.
Names, dates and places come only from the request — they are a person's own facts, never invented; unknowns become "[date]" / "[التاريخ]" placeholders listed in followUp. Condolences: bg-white, text-stone-900, no gradients, no party icons, no exclamation marks. Bilingual pages carry each language in its own p, never slash-separated. A banner (one region requested) is region 1 alone with the reply link inside it.`,
  references: {
    'checks/occasion.md':
      "h1 is the names as given; occasion label above it; one reply action, a link not a form; date as time datetime; photo background only when a URL or scene was given and then bg-black/60 with text-white; verbatim duas and quotes; placeholders only for the person's own facts the request did not give, listed in followUp; condolence pages plain.",
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
  version: '2.3.1',
  source: 'builtin',
  trust: 'builtin',
  priority: 80,
  activation: {
    mode: 'auto',
    intents: PAGE_INTENTS,
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
      // Loanwords (2026-10-14): «اعملي لاندنج بيج».
      'لاندنج',
      'لاندنغ',
      'لاندينج',
    ],
  },
  tags: ['composition', 'design', 'page'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  instructions: `Plan from the primary visitor outcome: name it in the rationale, then build these sections in order, one region each, dropping any the request gives no material for.
1 HERO: h1 text-4xl md:text-6xl font-bold leading-tight text-balance (Arabic: leading-snug), p text-lg md:text-xl text-text-muted max-w-2xl text-pretty, div flex flex-wrap gap-4 with one primary action and one secondary <a>, ul flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted of 3 proof facts, each li flex items-center gap-2 led by icon circle-check size 16 text-success. With a photo from PHOTOS YOU MAY USE or the request: grid md:grid-cols-2 items-center gap-8, img aspect-4/3 w-full rounded-3xl object-cover shadow-2xl AFTER the text; without one, a type-led hero: mx-auto max-w-3xl text-center.
2 PROOF: grid grid-cols-2 md:grid-cols-4 gap-6 text-center; p text-4xl font-extrabold tabular-nums text-{accent} + p text-sm text-text-muted.
3 BENEFITS: h2 + p mx-auto max-w-2xl text-center text-text-muted, then one lead item and two to five supporting ones in grid gap-4 md:grid-cols-3, the lead md:col-span-2 md:row-span-2; card = div rounded-3xl bg-surface p-6 md:p-8 ring-1 ring-black/5 with icon size 28 text-{accent}, h3 text-xl font-semibold, p text-text-muted leading-relaxed. A benefit names what changes for the visitor, with a number, example or mechanism.
4 HOW IT WORKS: ol grid gap-8 md:grid-cols-3; li opens with div h-10 w-10 rounded-full bg-{accent} text-{on-accent} flex items-center justify-center font-bold holding the number, then h3 + p.
5 TESTIMONIALS or PRICING when asked for or the business lives on them — realistic samples listed in followUp (recipes in the conversion skill).
6 FAQ: div mx-auto max-w-3xl divide-y; 4–6 pairs, each div py-6 with h3 font-semibold + p mt-2 text-text-muted, answering unanswered objections.
7 FINAL ACTION: section bg-surface-inverse text-text-inverse py-16 text-center: h2 restating the promise, one p, the SAME primary action label as the hero.
8 FOOTER: footer border-t border-black/10 py-12 > grid gap-8 md:grid-cols-4: brand column plus three ul space-y-2 text-sm of <a href='#section-id'> (give each section its id), then small for the copyright.
RHYTHM: ground, card and band from the direction's palette; one dark band besides the hero at most; exactly one h1; every section opens with h2 text-balance; one lead item, never three identical cards as the second section; at most 10 insertNode per plan — sections 1–6 first, the rest in followUp; setProp page title and description when empty; use hero/features/pricing/testimonials/faq/cta/pageHeader/pageFooter blocks when in the catalog.`,
  references: {
    'checks/page-quality.md':
      'One h1; hero states an outcome, not a welcome; h1, action and proof fit the first phone screen; every action names its destination; mobile order = DOM order; primary action label identical in hero and final band; only logical spacing (ps-/pe-); pointing icons match doc.dir; every parentId is the page root.',
  },
});

/** Arabic and RTL depth beyond the manual's floor: Arabic script or the English asks. */
const ARABIC_RTL: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.arabic-rtl',
  name: 'Arabic and right-to-left composition',
  description:
    'Direction switch, logical layout, mirrored icons, Arabic typography and mixed-run isolation for Arabic or bilingual pages.',
  version: '1.3.0',
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
LAYOUT: flex and grid already flow from the right in rtl: keep DOM order = reading order (icon before text, arrow after action text); never fake mirroring with flex-row-reverse or order-* (a zigzag's md:order-last alternates, it does not mirror). Side accents: rounded-s-* and border-s-2 mirror by themselves, as does a shape anchored with start-0.
ICONS: mirror meaning only: arrow-left, chevron-left, arrow-up-left for "next/forward"; back is arrow-right; mail, phone, map-pin, check, star stay. The button block's "arrow" icon is a literal → that does not mirror: use icon "none" on Arabic pages.
TYPE: the Arabic pair the direction names — without one, IBM Plex Sans Arabic — loads in pageCss by @import from fonts.googleapis.com or fonts.bunny.net, then font-family on a ck- class. Never a Latin display face on Arabic text. Changa, Lemonada and Reem Kufi headings carry no tashkeel; body set in Markazi Text, Beiruti or Amiri goes one text-* step up. Body text-lg leading-relaxed; headings leading-snug; never italic, uppercase, capitalize, tracking-* (letter-spacing breaks the connected script) or text-justify. Reading column max-w-prose. Arabic headings ≤7 words.
MIXED RUNS: Western digits with tabular-nums; phones, emails, URLs, prices with currency codes and Latin product names each in their own span whitespace-nowrap so the bidi algorithm cannot flip them.
PUNCTUATION: «،» «؛» «؟», no «!», quotations with «».`,
  references: {
    'checks/rtl.md':
      "setDocMeta dir + page lang when needed; logical utilities only; pointing icons mirrored by name, button icon none; no italic/uppercase/tracking/justify; digits, emails, phones, URLs in their own spans; the direction's Arabic pair loaded; Arabic punctuation; one direction per page.",
  },
});

/**
 * Exact class recipes for cards, stats, steps, testimonials, pricing and FAQ.
 * Priority 60 sits below the page archetypes so it layers on top of them when
 * a landing request also names pricing or testimonials. Section nouns only:
 * bare "feature"/"card" are excluded because they name parts of any page.
 */
const CONVERSION_RECIPES: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.conversion-recipes',
  name: 'Conversion section recipes',
  description:
    'Exact class recipes for cards, stats, steps, testimonials, pricing and FAQ sections.',
  version: '1.2.2',
  source: 'builtin',
  trust: 'builtin',
  priority: 60,
  activation: {
    mode: 'auto',
    keywords: [
      'pricing',
      'testimonial',
      'faq',
      // router-3 additions (2026-09-28): a three-letter keyword takes no endings now; plural listed.
      'faqs',
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
      /*
        router-3 additions (2026-09-28): testimonials only with their customers.
        Bare 'شهادات' is certificates as often — «تغيير عنوان قسم التعليم
        والشهادات إلى مرحبا», a title edit on a CV page, carried these recipes:
        1,832 tokens against the 1,073 floor + rtl (router-3 probe).
      */
      'شهادات العملاء',
      'شهادات عملاء',
      'شهادات الزبائن',
      'أسئلة شائعة',
      'إحصائيات',
      'ميزات',
      'خطوات',
    ],
  },
  tags: ['cards', 'composition', 'sections'],
  instructions: `Recipes; the wrapper is the manual's region shell. Use the registered block instead when its type is in the catalog (features, pricing, testimonials, faq, stats, processSteps, accordion).
CARD: div rounded-2xl bg-white p-6 md:p-8 ring-1 ring-black/5 transition-shadow hover:shadow-lg > div mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-{accent} text-{on-accent} with one icon size 24, h3 mb-2 text-xl font-semibold, p text-text-muted leading-relaxed. Grid gap-6 md:grid-cols-2 lg:grid-cols-3, one lead card spanning md:col-span-2; never three identical cards as a page's second section.
STATS: grid grid-cols-2 md:grid-cols-4 gap-8 text-center; p text-4xl md:text-5xl font-extrabold tabular-nums tracking-tight text-{accent} + p mt-2 text-sm text-text-muted.
STEPS: ol grid gap-8 md:grid-cols-3; each li opens with div mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-{accent} font-bold text-{on-accent} holding the number, then h3 + p.
TESTIMONIAL: figure rounded-2xl bg-white p-8 ring-1 ring-black/5: icon quote size 28 text-{accent}, blockquote mt-4 text-lg leading-relaxed text-pretty, figcaption mt-6 flex items-center gap-4 with the initials monogram span flex size-12 shrink-0 items-center justify-center rounded-full bg-{accent} font-bold text-{on-accent} — never a stock face beside an invented name — then p font-semibold, p text-sm text-text-muted. Grid gap-6 md:grid-cols-3.
PRICING: div grid items-stretch gap-6 md:grid-cols-3; card = div flex flex-col rounded-2xl bg-surface p-6 ring-1 ring-black/10; the one recommended tier adds shadow-lg ring-2 ring-{accent} and span self-start rounded-full bg-{accent} px-3 py-1 text-xs font-semibold text-{on-accent}; h3 name, p text-sm text-text-muted audience, p mt-4 text-5xl font-bold tabular-nums with child span text-base font-normal text-text-muted for the period, ul mt-6 grow-1 space-y-2 of li flex items-start gap-2 led by icon check size 20 shrink-0 text-success (grow-1 pushes the action to the card bottom), one action last, solid only on the recommended tier. No monthly/yearly toggle: two price lines instead. In rtl the currency follows the number.
FAQ: div mx-auto max-w-3xl; each div border-t border-black/10 py-6 with h3 text-lg font-semibold and p mt-2 text-text-muted leading-relaxed; elements cannot collapse — use accordion when present.`,
  references: {
    'checks/sections.md':
      'One lead card, never three identical cards as the second section; numbers tabular-nums; one recommended pricing tier, price with period span, grow-1 list; testimonial has name, role and an initials monogram, never a stock photo; FAQ answers objections; registered block used when in catalog.',
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
  version: '1.2.0',
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
HEADER: header sticky top-0 z-40 border-b border-black/10 bg-white > div mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8: span text-lg font-bold tracking-tight (brand), nav aria-label='Main' hidden md:flex gap-8 text-sm font-medium of <a href='#section-id'> (give each target section that id), one action. Phones see brand + action only; say so in followUp.
FOOTER: footer border-t border-black/10 > div mx-auto max-w-6xl px-4 py-12 md:px-8 > grid gap-8 md:grid-cols-4: brand column (span font-bold + p text-sm text-text-muted) plus three columns of h3 text-sm font-semibold and ul mt-4 space-y-2 text-sm text-text-muted of <a href>; then div mt-12 border-t border-black/10 pt-6 text-xs text-text-muted with small for the copyright.
CONTACT: grid gap-8 md:grid-cols-2; column A: h2, p, ul space-y-4 of li flex items-center gap-3 with icon message-circle / phone / mail / map-pin / clock size 20 text-{accent} and <a href='https://wa.me/…'> first for a local business, then <a href='tel:…'>, <a href='mailto:…'>, the address as <a href='https://maps.google.com/?q=…'>; hours as ul of li flex justify-between tabular-nums. Column B: the contact or formSection block when it is in the catalog (<ck-component type='contact' props='{}'></ck-component>), else an img of the place or div rounded-2xl bg-surface p-6 with directions. Never draw a fake form from div/span; no map embed (iframe is refused).
TEAM: grid grid-cols-2 md:grid-cols-4 gap-8 text-center; img aspect-square w-full rounded-2xl object-cover object-top (alt = name) only for a photo the request gives, else a square tile with the initials; p mt-4 font-semibold, p text-sm text-text-muted.
GALLERY: grid grid-cols-2 md:grid-cols-3 gap-4 of img aspect-square w-full rounded-xl object-cover; the lead image adds col-span-2 row-span-2.
TIMELINE: ol space-y-8; each li relative ps-8 ck-tl with span absolute start-0 top-1 h-4 w-4 rounded-full bg-{accent} ring-4 ring-surface, time text-sm font-medium text-{accent} with datetime, h3, p; css .ck-tl::before{content:"";position:absolute;inset-inline-start:7px;top:1.5rem;bottom:-2rem;width:2px;background:<the accent's hex>;opacity:.3}`,
  references: {
    'checks/chrome.md':
      "Nav links are <a href='#id'> to real section ids; footer has copyright line; contact values linked with wa.me/tel:/mailto: and a maps search; no fake form, no iframe; team photos only when given, else initials; timeline uses inset-inline-start.",
  },
});

/**
 * One named visual direction applied everywhere: five palette recipes,
 * contrast pairs, four type sizes, one spacing scale and restyle rules. Auto
 * on restyle intent only; adjectives ("elegant", "simple", "ألوان") were
 * deliberately not adopted because they appear in unrelated requests.
 */
/**
 * Design leadership, not template filling.
 *
 * Adapted for this agent from Anthropic's `frontend-design` skill
 * (github.com/anthropics/skills, Apache-2.0): the anti-template calibration,
 * the subject-first grounding, hero-as-thesis, one signature element, and the
 * remove-one-accessory discipline. Everything it says about writing files,
 * taking screenshots or planning in two passes is dropped — this agent emits
 * one plan — and every mechanism is restated in what the door actually
 * accepts: the site vocabulary, `ck-` classes and the two allowed font hosts.
 *
 * A DEPENDENCY of all three page archetypes, because a page composed without a
 * point of view is the exact failure the skill exists to prevent; its own
 * keywords cover "make it distinctive" asks on an existing page.
 */
const VISUAL_DIRECTION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.visual-direction',
  name: 'Distinctive visual direction',
  description:
    'Design leadership: ground the page in its subject, avoid the five AI defaults, pair type deliberately, spend the boldness on one signature element.',
  version: '1.1.1',
  source: 'builtin',
  trust: 'builtin',
  priority: 52,
  activation: {
    mode: 'auto',
    /*
      "You are the design lead. This page must not be mistakable…" is a page's
      brief, not an edit's: "make the hero stand out" routes to an edit, and
      "فريد" is as often a name (Farid) as "unique".
    */
    intents: PAGE_INTENTS,
    keywords: [
      'distinctive',
      'not generic',
      'stand out',
      'memorable design',
      'unique design',
      'art direction',
      'تصميم مميز',
      'شكل مميز',
      'فريد',
      'إبداعي',
      'ابداعي',
      'يلفت النظر',
      'مش عادي',
      'مو عادي',
    ],
  },
  tags: ['design', 'identity', 'typography', 'visual'],
  instructions: `You are the design lead. This page must not be mistakable for any other page you have made.
SUBJECT FIRST: before choosing anything, name in the rationale (≤12 words) the subject, its audience and the page's ONE job. Palette, words and imagery come from that subject's own world — its materials, tools, artefacts, vocabulary. A bakery and a security audit must not share a palette.
THE FIVE DEFAULTS, avoid unless the request names one: (1) cream ground (bg-stone-50) + serif display + amber or orange accent; (2) bg-slate-950 + one acid lime-400 or rose-500 accent; (3) hairline broadsheet rules, rounded-none, dense columns; (4) the SaaS kit — identical cards, one radius, one soft shadow, gradient washes, purple into indigo; (5) template chrome — an uppercase eyebrow over every heading, "A · B · C" meta strings, an arrow on every link. Each arrives by habit; if you land on one, change one axis and say which in the rationale.
HERO IS A THESIS: open with the most characteristic thing in the subject's world — the real headline, the real artefact, one real number in its context. Big stat + gradient + two buttons is the template answer.
TYPE CARRIES THE PERSONALITY: pair a display face with a body face on purpose — the pair the direction names when there is one. Load them in pageCss — @import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@600&display=swap"); or fonts.bunny.net, those two hosts only — then .ck-display{font-family:'Fraunces',var(--t-font-family-serif)}. Arabic: the pair the direction names, never Cairo by habit; never a Latin face on Arabic text.
STRUCTURE IS INFORMATION: eyebrows, dividers, numbers must encode something true. 01/02/03 only when the content really is a sequence.
ONE SIGNATURE: exactly one element carries the boldness — an oversized type lockup, a full-bleed photo, an overlapping card, a diagonal split — and everything around it stays quiet; never a glow, blob or gradient circle behind the headline.
COMPLEXITY MATCHES THE VISION: elegance is executing the chosen vision, not adding to it.
BEFORE YOU FINISH: remove one accessory — the decoration that survives only because you made it. Floor, always: responsive at sm/md/lg, alt on every image, visible focus, motion-reduce on anything that moves.`,
  references: {
    'checks/direction.md':
      "Subject, audience and the page's one job named in the rationale; palette and type derived from the subject rather than from the five defaults; hero opens with the characteristic thing; display and body faces paired and loaded from an allowed host; numbering only for real sequences; exactly one signature element; one decoration removed; responsive, alt text, visible focus, motion-reduce.",
  },
});

const DESIGN_DIRECTION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.design-direction',
  name: 'Coherent design direction',
  description:
    'One named visual direction applied everywhere: five palette recipes, contrast pairs, four type sizes, one spacing scale, restyle rules.',
  version: '2.3.0',
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
  instructions: `Pick one direction, name it in the rationale in ≤6 words, apply it identically in every region you touch. With no hue named, the subject picks among B–E, or a palette from its own world.
A SITE THEME, only when the request asks for the site's or brand's own colours (or under colourPolicy 'tokens', where the palette is refused): bg-surface text-text; muted text-text-muted; cards bg-surface ring-1 ring-black/5; accent bg-accent text-accent-text; dark band bg-surface-inverse text-text-inverse — it re-themes with the site.
B EDITORIAL: bg-white text-slate-900; muted text-slate-600; accent indigo-600; rounded-lg; border border-black/10, shadow-none; headings text-5xl tracking-tight; headline font via css .ck-serif{font-family:var(--t-font-family-serif)}.
C SOFT PRODUCT: bg-slate-50; cards bg-white rounded-2xl ring-1 ring-black/5; accent emerald-700 or sky-700; the bold surface is one solid band in the accent on the final action, never a purple gradient.
D DARK TECH: bg-slate-950 text-slate-100; muted text-slate-400; cards bg-slate-900 ring-1 ring-white/10; text-sky-400 for accent text and icons, bg-sky-400 text-slate-950 for the action; the signature is type or one framed photo, never a glow.
E WARM: bg-white text-stone-900; muted text-stone-600; accent red-800, terracotta rather than amber on cream; rounded-3xl; cards bg-orange-50 ring-1 ring-black/5.
CONTRAST: on white or *-50, body text is *-600 or darker and headings *-900; on *-900/*-950, body is *-300 or lighter and headings white; never *-400/*-500 for body text; text over a photo needs a darkening layer via ck- css background: linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url(https://…) center/cover, or an absolute inset-0 bg-black/50 layer over the image.
TYPE, exactly: display text-4xl md:text-6xl font-bold leading-tight; h2 text-3xl md:text-4xl font-semibold; h3 text-xl font-semibold; body text-base md:text-lg leading-relaxed; caption text-sm text-text-muted. tracking-tight only on Latin display text.
SPACING: section py-16 md:py-24 (the hero py-24 md:py-32), gutter px-4 md:px-8, columns gap-8, card p-6 md:p-8, inside a card gap-4. SURFACES: one radius for cards, one for actions; one shadow at rest; hover is one shade step (hover:bg-indigo-700 on bg-indigo-600), hover:opacity-90, hover:shadow-xl, or hover:-translate-y-1 transition duration-200.
MODE: no dark: variant; a page is one mode — a requested dark mode is D, or pageCss @media (prefers-color-scheme: dark) rules on ck- classes. Fonts: font-sans follows the site face; a display face is font-family in css from var(--t-font-family-sans|serif|mono) or a loaded family; @font-face with url(https://…) in pageCss; @import only from fonts.googleapis.com or fonts.bunny.net (every other host is refused).
RESTYLE an existing region with editTree, never a rewrite: quote each class attribute that changes and replace only its values, keeping text, ids and node order; page-wide rules once in pageCss as .ck- classes.`,
  references: {
    'checks/consistency.md':
      'Direction named once, never mixed; same treatment for the same role everywhere; four type sizes only; spacing on the one scale; one radius, one rest shadow; one accent fill per section; contrast pairs from the table; no dark: variant; an existing region restyled with editTree, its text and order untouched.',
  },
});

/**
 * The repeated thing, built once.
 *
 * Adapted for this agent from wshobson's `tailwind-design-system` skill
 * (github.com/wshobson/agents, MIT): the token hierarchy (brand → semantic →
 * component) and the component ladder (base → variants → sizes → states). Its
 * Tailwind v4 mechanism is NOT reproduced, because none of it exists on this
 * wire: there is no `@theme`, no config file, no build step the agent can
 * reach. The layers are restated as this product's own — `--t-*` roles, the
 * fixed utility vocabulary, `ck-` classes — and the v4 features are listed as
 * refusals so the model stops reaching for them.
 */
const DESIGN_TOKENS: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.design-tokens',
  name: 'Tokens, components and variants',
  description:
    'Build the repeated thing once: role tokens before palette before ck- classes, one base class with variants, and the Tailwind config features that do not exist here.',
  version: '1.4.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 48,
  activation: {
    mode: 'auto',
    keywords: [
      'component library',
      'reusable component',
      'reusable components',
      'design tokens',
      'style guide',
      'consistent components',
      'same style everywhere',
      'variants',
      'مكتبة مكونات',
      'مكونات متكررة',
      'دليل الأنماط',
      'توكنز',
      'متغيرات التصميم',
      'نمط موحد',
      'تنسيق موحد',
    ],
  },
  tags: ['components', 'design', 'system', 'tokens'],
  instructions: `Build the repeated thing once, then reuse it verbatim — a system, not twenty hand-styled boxes.
THREE LAYERS, in this order. 1 ROLE, the site's own: bg-surface, bg-surface-inverse, text-text, text-text-muted, text-text-inverse, bg-accent, text-accent, text-accent-text, border-text/10 — these resolve through var(--t-*) and re-theme with the site, so a page that follows the site theme builds everything structural from them. 2 PALETTE, fixed hues (slate-900, indigo-600, emerald-500…): a page with its own palette uses these instead, everywhere; they never re-theme. 3 COMPONENT, this page only: a ck- class in the region's css, or in pageCss when two regions share it — after the plugin classes that already wear the roles: prose for long text, form-input / form-select / form-checkbox for fields, animate-in for an entrance.
NOT AVAILABLE HERE — never emit: @theme, @apply, tailwind.config, @custom-variant, or the dark: variant. Which utility classes this page can generate is stated in the context; a class it cannot generate is removed before the page is written.
COMPONENT LADDER, one class per rung. BASE .ck-card{border-radius:var(--t-radius-lg);background:#fff} holds everything shared. VARIANT .ck-card--quiet / .ck-card--loud declares only what differs. SIZE is utilities on the element (p-4, p-6 md:p-8), never a second base class. STATE comes last: :hover, :focus-visible, [aria-current], [data-state]. A variant that redefines the base is a second component — rename it.
REUSE: the same role gets the same treatment everywhere — one radius for cards, one for actions, one rest shadow, one hover step. Repeat the className string byte-for-byte rather than inventing a near-miss; a card that differs by one shade reads as a bug, not as variety.
STATES ARE NOT OPTIONAL: every interactive element declares rest, hover, focus-visible and disabled. Focus may be recoloured, never removed: .ck-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px}.
RESPONSIVE: one base, then sm:/md:/lg: only where the layout actually changes — grid-cols-1 md:grid-cols-3 beats three copies of a section.`,
  references: {
    'checks/system.md':
      'Roles only for a page that follows the site theme, else the palette, then ck- classes; no @theme, @apply, tailwind.config or dark:; an arbitrary value only where the context says this page compiles one, else a ck- class; one base class per component with variants that only declare differences; sizes as utilities; rest, hover, focus-visible and disabled all declared; the same role styled identically in every region; responsive prefixes only where the layout changes.',
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
    'Headline, call-to-action and body copy rules in Arabic and English; finished copy with realistic sample facts, listed for the owner.',
  version: '2.2.0',
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
ACTION: verb first, 2–4 words naming the result ("Start free trial", "Book a call", "ابدأ التجربة المجانية", "احجز استشارتك"); never "Get started", "Learn more", "Submit", "اضغط هنا", "المزيد" alone. One primary action per section, the identical label wherever it repeats; a secondary action is an <a> with an arrow icon in reading direction. A local business acts by WhatsApp (https://wa.me/<digits>?text=…), then tel:, a maps link, its hours.
BODY: paragraphs ≤3 sentences; sentence case in English; one idea per card; "you get X", not "we offer X"; numbers as digits; a claim with a number needs a source line or is dropped. Cut filler — «نرتقي بـ»، «حلول متكاملة»، «تجربة فريدة من نوعها»، «في عالم…»، «لا مثيل لها», elevate, seamless, unleash — and name the thing.
FACTS: a page ships finished, never with "[Customer name]" / "[اسم العميل]" brackets. What the request did not give about the BUSINESS — prices, menu items, reviews and their names, hours, an address — is a realistic sample for its trade, city and language, listed in followUp; phone and email stay obviously generic (info@ the brand, a local number of zeros). A PERSON's own facts — a CV's employers, dates and contacts, an invitation's names, date and venue — are never invented: they stay "[your email]" / "[التاريخ]" brackets, listed in followUp.
ARABIC: Modern Standard Arabic; one address form (أنتَ or أنتم); «،» and «؟»; correct hamza and taa marbuta (ة not ه); Arabic headings go one text-* step up rather than bolder.`,
  references: {
    'checks/copy.md':
      'Headline ≤8/7 words, outcome-led; one primary label repeated verbatim; no "click here" / "اضغط هنا"; business facts are listed samples, only a person\'s own facts stay bracketed; «،؟», no «!»; no filler.',
  },
});

/**
 * Landmarks, heading order, naming, contrast pairs, motion and language rules
 * for assistive tech. Auto on accessibility vocabulary; "high-contrast" is
 * the words "high contrast", and "inaccessible" — a hit the substring matcher
 * gave for free — is listed now that keywords are whole words.
 */
const ACCESSIBILITY: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.accessibility-review',
  name: 'Accessible structure and contrast',
  description:
    'Landmarks, heading order, link and image naming, icon labelling, contrast pairs, motion and language rules for assistive tech.',
  version: '2.2.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 40,
  activation: {
    mode: 'auto',
    keywords: [
      'accessibility',
      'accessible',
      'inaccessible',
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
LANDMARKS: the page root is already <main>. Inside a region: header for the site head only, nav aria-label='…' around link groups, section aria-label='…' or a heading as its first child, footer, article for self-contained items (a job, a project, a testimonial), aside for tangents. Use the tag that exists instead of div: blockquote + figcaption for a testimonial, time datetime for dates, ol for ordered steps, figure/figcaption for captioned images.
HEADINGS: one h1 on the whole page (read every region already in the document); h2 per section, h3 per card, never skip a level, never pick a tag for its size; an sr-only h2 when a section needs a name without a visible heading.
NAMES: img alt = what it shows in ≤12 words, alt='' only for pure decoration; icon label only when it stands alone (role=img), omitted when text beside it says the same (aria-hidden), never both; aria-label on section/nav is a short noun phrase in the page language; no aria-label on div/span/p (ignored or harmful).
LINKS AND BUTTONS: link text names the destination ("See pricing", never "click here"); <a href> for anything with a destination; <button> only for an affordance the host will wire later — it does nothing yet, say so in followUp; target='_blank' only when the text says it opens elsewhere; clickable areas at least py-3 px-4.
CONTRAST: body text text-text or palette 700+ on 50/100 surfaces; text-text-muted only at ≥text-sm and never over an {accent} fill or a photo; on bg-surface-inverse use text-text-inverse; white text only on palette 600+; never 300/400 palette text on white; never grey text on a gradient. State is never colour alone: pair it with an icon (circle-check, circle-alert) or a word.
MOTION: animate-spin/ping/pulse/bounce only on decoration; an animate-in entrance ends at rest and carries motion-reduce:animate-none; motion-reduce:transform-none on anything moved by transform; hover:scale-* on cards only, never on text; no animate-ping/bounce beside text people read.
LANGUAGE: page prop lang set ('ar', 'en'); dir matches it; no text-justify; leading-relaxed in paragraphs; max-w-prose for reading columns, or prose around long text.`,
  references: {
    'checks/accessibility.md':
      'No nested main; one h1, no skipped levels; alt on every img; icon label xor neighbouring text; aria-label only on section/nav/article; link text names destination; contrast pairs from the table; motion-reduce on transforms; lang and dir set.',
  },
});

/**
 * Scroll-driven narrative pages, adapted from oso95's published `scroll-world`
 * Skill (github.com/oso95/scroll-world) — credited, not copied.
 *
 * The original builds a scroll-scrubbed film: Higgsfield-generated camera
 * flights, ffmpeg encoding, and a JavaScript engine mapping scroll position to
 * video currentTime. None of that exists here — this agent emits a JSON tree
 * and CSS, it generates no media and runs no script — so what transfers is the
 * part that survives the mechanism: the journey structure, the shared style
 * preamble that makes scenes read as one world, and per-scene pacing. The
 * impossible half is named as a refusal for the same reason the tokens skill
 * names `@theme`: a model told only what to do reaches for the rest.
 */
const SCROLL_CINEMATIC: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.scroll-cinematic',
  name: 'Scroll journey pages',
  description:
    'One continuous scroll narrative: ordered scenes, pinned stages, scroll-linked reveals, shared look, and the film-only parts named as out of scope.',
  version: '1.1.1',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  activation: {
    mode: 'auto',
    /*
      A journey is a page. "Fix horizontal scrolling on mobile" and "غير سعر
      الرحلة" name a scroll or a trip and are edits; "5-7 scenes, one journey"
      has no place in either (2026-09-28).
    */
    intents: PAGE_INTENTS,
    keywords: [
      'scroll',
      'scrollytelling',
      'cinematic',
      'storytelling',
      'immersive',
      'سكرول',
      'تمرير',
      'سينمائي',
      'قصة بصرية',
      'رحلة',
    ],
  },
  tags: ['composition', 'narrative', 'scroll'],
  instructions: `A scroll page is ONE journey, not a stack of bands: 5-7 scenes in the subject's own order — source, making, place, delivery, people, the product — and the last scene carries the action.
SCENE SHELL: one customCode region per scene. section relative isolate overflow-hidden py-12 md:py-16 > div mx-auto max-w-6xl px-4 md:px-8. A photographic scene sets background-image: url(https://…) with background-size:cover on a ck- class, then lays a readable wash over it: div absolute inset-0 bg-surface opacity-80, with the copy in a relative z-10 sibling.
PINNED STAGE, which is what makes it feel like scrolling through a world: grid md:grid-cols-2 gap-8, the media column div sticky top-0 h-screen flex items-center, and the scene copy flowing past it in the other column. Phones get no pinning: picture, then words.
SCENE COPY: an eyebrow (text-sm font-semibold text-{accent}), one h2 line, two or three lines of text-text-muted leading-relaxed, at most three tags. The same three parts in every scene — that repetition IS the film.
CONTINUITY: one palette, one type scale and one image treatment across every scene; vary only a per-scene accent on the eyebrow. A scene that looks like a different site ends the journey.
REVEAL: @keyframes ck-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}} in pageCss, applied from the region css as @supports (animation-timeline: view()){.ck-rise{animation-timeline:view();animation-range:entry 0% entry 40%}}, guarded by @media (prefers-reduced-motion:reduce){.ck-rise{animation:none}}. Where view() is unsupported it simply plays on load; never leave a scene stuck invisible.
PACING: the opening and closing scenes hold longest (more copy, py-16); transit scenes stay brief.
NOT POSSIBLE HERE: generated film, a scroll-scrubbed video timeline, and JavaScript of any kind. This agent emits a tree and CSS. Build the journey from pinned stages, scroll-linked reveals and imagery the person already has, and say plainly that a rendered video version is out of scope rather than promising it.`,
  references: {
    'checks/scroll-journey.md':
      'Scenes ordered as one journey with the action last; one shared look with only the accent varying; pinned stage on desktop and stacked on phones; reveals guarded for reduced motion and never leaving content invisible; no promise of generated video or script.',
  },
});

/**
 * Delivery-quality rules, adapted from nextlevelbuilder's `ui-ux-pro-max`
 * Skill (github.com/nextlevelbuilder/ui-ux-pro-max-skill) — credited, not
 * copied.
 *
 * The original is a searchable corpus (CSV catalogues of styles, palettes and
 * font pairings) driven by Python scripts, across thirteen stacks. A Skill here
 * is reviewed data with no tools and no filesystem, so the catalogues and their
 * search cannot come: what transfers is its prioritised rule set and
 * pre-delivery checklist, rewritten against this vocabulary — the `--t-*`
 * roles, the utilities the door admits, and the one Lucide set. It stays out of
 * the page archetypes' way by activating on review vocabulary rather than on
 * "design".
 */
const UI_UX_PRO: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.ui-ux-pro',
  name: 'Delivery-quality UI review',
  description:
    'The polish checklist: pointer and touch affordances, reading type, contrast both ways, focus and feedback, container discipline, restrained motion.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 38,
  activation: {
    mode: 'auto',
    keywords: [
      'ui ux',
      'ux review',
      'design review',
      'design system',
      'usability',
      'polish',
      'تجربة المستخدم',
      'قابلية الاستخدام',
      'نظام تصميم',
      'مراجعة التصميم',
    ],
  },
  tags: ['quality', 'review', 'ux'],
  instructions: `Polish is a checklist, not a feeling — run it before calling a page finished.
POINTER AND TOUCH: every clickable card or row carries cursor-pointer, and an interactive thing with no hover change reads as dead. Hover moves colour, border or shadow (transition-colors duration-200 ease-out), never a size that shoves its neighbours. Keep a tap target near h-12 w-12 even when the mark drawn inside it is smaller.
TYPE FOR READING: paragraphs at text-base or larger on phones — text-sm belongs to eyebrows and captions, never body — with leading-relaxed and a measure of roughly 65-75 characters (max-w-prose on a column; class prose sets it for long text and styles its headings, lists and quotes in the site's colours). One h1 per page; a bigger heading is text-4xl md:text-6xl, never a smaller tag dressed up.
CONTRAST BOTH WAYS: secondary copy stops at text-text-muted and goes no lighter, and body text holds 4.5:1 against whatever sits behind it. A translucent panel needs real fill (bg-surface opacity-80, not opacity-10) and a border that survives a light background (border-2, not a hairline).
STATE AND FEEDBACK: never remove the focus outline, because keyboard users navigate by it; an action drawn as a mark with no words needs a label so it is announced; an error message belongs beside its own field, not stacked at the top of the page.
LAYOUT DISCIPLINE: one container width for the whole page (max-w-6xl), not a new one per section. Content under a fixed bar needs padding past that bar's height, and a floating bar sits inset from the edges (top-4 start-4 end-4) rather than glued to them. Read the page at 375, 768, 1024 and 1440 wide: nothing scrolls sideways, nothing hides under a bar.
MARKS AND IMAGES: never an emoji standing in for a drawn mark; take marks from the one Lucide set at one size beside text, and give every meaningful img an alt.
MOTION RESTRAINT: 150-300ms on state changes, transform and opacity only, and every animated rule guarded by @media (prefers-reduced-motion:reduce).`,
  references: {
    'checks/delivery.md':
      'cursor-pointer on every clickable; hover feedback that does not move layout; body at text-base with a 65-75 character measure; secondary copy no lighter than the muted role; visible focus; labelled mark-only actions; one container width; nothing under a fixed bar; no sideways scroll at 375/768/1024/1440; no emoji marks; reduced-motion guard present.',
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
    'Always-on floor: region shell, links and actions, colour, direction, type, structure, refused-class traps.',
  version: '1.3.0',
  source: 'builtin',
  trust: 'builtin',
  activation: { mode: 'always' },
  tags: ['composition', 'craft', 'rtl', 'traps'],
  instructions: `REGIONS: customCode stores semantic markup and scoped CSS; one cohesive page or independent regions as the contract needs. Follow its layout, spacing and hierarchy; no fixed shell or kit. No <main> tag.
LINKS: <a href> takes https, mailto:, tel:, #id or /path (javascript: is dropped). Links need a real destination; buttons need native behaviour or a permitted handler. Action styling follows the design.
COLOUR: one palette per page; a recipe's {accent} is its accent hue (bg-{accent} → bg-teal-700, text-{on-accent} → text-white). Roles — bg-accent, text-accent, var(--t-accent), bg-surface, text-text, text-text-muted — are the site theme: as written only on a page that follows the site theme, else the palette's equivalent.
DIRECTION: Arabic copy needs setDocMeta {dir:'rtl'} + setProp page lang 'ar' (a split build sets both itself). Only ps-/pe-/ms-/me-, start-/end-, text-start/text-end; never pl-/pr-/ml-/mr-/text-left/text-right. Forward icon: arrow-right in ltr, arrow-left in rtl.
TYPE: one h1 per page and semantic heading levels; size with text-*, not a bigger tag. Arabic: readable line height; no forced uppercase, letter spacing or justification.
STRUCTURE: img has alt; decorative marks need no label; choose list markers and density for the content.
IDS: name only a node the document already lists. A node this plan INSERTS gets its id from the kernel after the plan is written, so no later step can name it — put its props inside its own insertNode.`,
  references: {},
});

/**
 * PLAN MODE: think out loud, and write nothing.
 *
 * The product has had a Plan mode for a while and it did not plan. It sent a
 * request byte-identical to Ask's, was excluded from the build path, and — worst
 * — could still write from the tail of a preview conversation. So a person who
 * chose "Plan" got an answer that was sometimes prose, sometimes an edit, and
 * never a plan.
 *
 * Two things make this one different, and only one of them is prose.
 *
 * `restrictToCommands: []` is the structural half. Skill restrictions INTERSECT
 * (see `effectiveRestriction`), so an empty list intersects every other active
 * skill down to nothing: a run carrying this skill has NO command it is allowed
 * to emit, whatever else is loaded and whatever the model proposes. "Plan must
 * never apply" stops being a flag the host remembers to pass.
 *
 * The instructions are the other half: a shape a person can act on — what they
 * asked for in their own words, the steps in order, what else was possible and
 * why it was not chosen, and what could go wrong. `followUp` is required
 * because the complaint that started this was as much "gives no suggestions" as
 * "does not plan": a plan whose last line is silence leaves the person to work
 * out what to type next.
 */
const PLAN_MODE: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.plan-mode',
  name: 'Plan without building',
  description:
    'Answer with a plan a person can act on — goal, ordered steps, alternatives considered, risks — and emit no commands at all.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 120,
  activation: { mode: 'explicit' },
  tags: ['planning', 'read-only'],
  /*
    Nothing. Not "only safe commands" — none. Intersecting to the empty set is
    what makes a plan unable to write even when a build playbook is also active.
  */
  restrictToCommands: [],
  instructions: `You are PLANNING, not building. Emit no commands: this run cannot apply anything, and proposing an edit only wastes the person's turn.
Answer in exactly four labelled parts, in the request's own language, and never longer than the plan needs.
GOAL: what they asked for, restated in their words, plus the one thing you had to assume to proceed. If the request could reasonably mean two different pages, say which one you planned and what the other would change.
OUTLINE: the steps, in the order they would happen, one line each, each naming the SECTION or BLOCK it touches and what it would say or do. A step a person cannot picture is not a step. Count them: a page is usually four to seven.
ALTERNATIVES: one or two other shapes this page could take, each with the reason it was NOT chosen. "None" is an acceptable answer only when the request already fixes the structure.
RISK: what could come out wrong — copy you had to invent, an image nobody has, a section whose content depends on facts you were not given, a length that will overflow on a phone. Name what you would need from them to remove each one.
NEVER: apologising for not building, restating the catalog, describing what a hero is, or promising something the outline does not contain.
followUp: ONE sentence they could say next, phrased as they would say it, and it should be the one that starts the build. One, not a list: the field is a single string and a UI shows it as a single chip, so three options crammed into it arrive as one unreadable line.`,
  references: {
    'checks/plan.md':
      'Four labelled parts present; every outline step names a section and its content; alternatives carry reasons; risks name what is missing; zero commands emitted; followUp is ONE sentence that starts the build.',
  },
});

/*
  The page-power skills (2026-09-28) live in their own modules because their
  text is RENDERED from data — the deck's rows, the variants' recipes — that
  page-power.test.ts checks field by field: contrast per palette pair, every
  font weight against what the family ships, every recipe class against the
  vocabulary. Frozen here like every other built-in.
*/
const DIRECTION_DECK = builtin(DIRECTION_DECK_SKILL);
const PHOTO_DIRECTION = builtin(PHOTO_DIRECTION_SKILL);
const SECTION_VARIANTS = builtin(SECTION_VARIANTS_SKILL);
const MENU_PAGE = builtin(MENU_PAGE_SKILL);
const PROPERTY_PAGE = builtin(PROPERTY_PAGE_SKILL);
const CLINIC_PAGE = builtin(CLINIC_PAGE_SKILL);
const SHOP_PAGE = builtin(SHOP_PAGE_SKILL);
const DATA_VIZ = builtin(DATA_VIZ_SKILL);
// everyday site behaviours (2026-10-13): the motion skill moved to its own module (motion.ts).
const MOTION = builtin(MOTION_SKILL);
// design-code additions (2026-09-28): explicit, for section writers and the page plan.
const DESIGN_CODE = builtin(DESIGN_CODE_SKILL);
// pixi-skills additions (2026-10-10): free-code scene scripts in PixiJS v8; the core is every other one's dependency.
const PIXI_V8_CORE = builtin(PIXI_V8_CORE_SKILL);
const PIXI_V8_GRAPHICS = builtin(PIXI_V8_GRAPHICS_SKILL);
const PIXI_V8_TEXT_ASSETS = builtin(PIXI_V8_TEXT_ASSETS_SKILL);
const PIXI_V8_EFFECTS = builtin(PIXI_V8_EFFECTS_SKILL);
const PIXI_V8_INTERACTION_PERF = builtin(PIXI_V8_INTERACTION_PERF_SKILL);

/** Reviewed, data-only defaults by priority, descending (the registry re-sorts by id); hosts opt in. */
export const CRAFTKIT_AI_SKILL_DEFINITIONS: readonly AiSkillDefinitionV1[] = Object.freeze([
  PLAN_MODE,
  PRECISE_EDIT,
  DIRECTION_DECK,
  BUILD_SCAFFOLD,
  BUILD_FILL,
  PHOTO_DIRECTION,
  SECTION_VARIANTS,
  // design-code additions (2026-09-28): priority 91, between section-variants and cv-page.
  DESIGN_CODE,
  CV_PAGE,
  MENU_PAGE,
  PROPERTY_PAGE,
  CLINIC_PAGE,
  OCCASION_PAGE,
  SHOP_PAGE,
  PAGE_COMPOSITION,
  ARABIC_RTL,
  CONVERSION_RECIPES,
  STRUCTURE_RECIPES,
  VISUAL_DIRECTION,
  DESIGN_DIRECTION,
  DESIGN_TOKENS,
  // art (2026-10-14): logo-design and art-names, priority 47.
  ...ART_SKILLS.map(builtin),
  DATA_VIZ,
  COPYWRITING,
  MOTION,
  SCROLL_CINEMATIC,
  ...PIXI_CREATIVE_SKILLS.map(builtin),
  // creative agent (2026-10-12): director, animation, effects, dialogue/Ink and tile worlds; priority 44.
  ...CREATIVE_ENGINE_SKILLS.map(builtin),
  // pixi-skills additions (2026-10-10): priorities 43-41, between scroll-cinematic and accessibility.
  PIXI_V8_CORE,
  PIXI_V8_GRAPHICS,
  PIXI_V8_TEXT_ASSETS,
  PIXI_V8_EFFECTS,
  PIXI_V8_INTERACTION_PERF,
  // end pixi-skills additions
  ACCESSIBILITY,
  UI_UX_PRO,
  CRAFT_MANUAL,
]);

export function createCraftkitAiSkillRegistry(
  additionalSkills: readonly AiSkillDefinitionV1[] = [],
): AiSkillRegistry {
  return createAiSkillRegistry([...CRAFTKIT_AI_SKILL_DEFINITIONS, ...additionalSkills]);
}
