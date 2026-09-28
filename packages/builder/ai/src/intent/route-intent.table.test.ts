import { describe, expect, it } from 'vitest';

import {
  routeIntent,
  type IntentDocumentSummary,
  type IntentKind,
  type IntentTarget,
} from './route-intent';

/*
  THE ROUTING TABLE — the audit's phrasings, row for row.

  agent-audit §2 P0-1 and P1-5 ran every one of these through the old router
  (`activatesBuildArchetype`: keyword substrings over the skill registry,
  `routing.mjs`, 2026-09-28). The report's summary says "7 of 12 edits
  misrouted, 12 of 17 page asks missed"; the raw `measurements.txt` of the same
  run is harsher — 8 of the 12 edits went into a full-page build and 14 of the
  17 page asks took the single-call path. Whichever count is quoted, the target
  here is zero of either, and each row is its own test so a regression names
  the phrasing it broke.
*/

const EMPTY: IntentDocumentSummary = { nodeCount: 0, placeholderOnly: false, sectionLabels: [] };

/** The playground's default workspace, as the router sees it: 17 sections, 27 nodes. */
const LANDING: IntentDocumentSummary = {
  nodeCount: 27,
  placeholderOnly: false,
  sectionLabels: [
    'announcement bar',
    'aurora',
    'carousel',
    'logo cloud',
    'marquee',
    'about',
    'rich story',
    'showcase',
    'bento',
    'stats',
    'features',
    'pricing',
    'quotes',
    'faq',
    'form',
    'spotlight promo',
    'newsletter',
  ],
};

/** An Arabic page with content, whose sections are named in Arabic (wave-2 verifier's probe page). */
const CONTENT_AR: IntentDocumentSummary = {
  nodeCount: 12,
  placeholderOnly: false,
  sectionLabels: ['الرئيسية', 'الأسعار', 'الخدمات', 'تواصل معنا'],
};

/** A skeleton nobody filled — the page a Stop or a failed build leaves behind. */
const PLACEHOLDERS: IntentDocumentSummary = {
  nodeCount: 4,
  placeholderOnly: true,
  sectionLabels: ['Hero', 'Menu', 'Reviews', 'Contact'],
};

type BuildKind = Extract<IntentKind, 'build-page' | 'build-site'>;
type StayKind = Exclude<IntentKind, BuildKind>;

/** §2 P1-5 — whole-page asks. Every one must take a build. */
const PAGE_ASKS: readonly (readonly [string, BuildKind])[] = [
  ['سوي لي موقع لمطعم شاورما في عمان', 'build-page'],
  ['بدي موقع لشركة محاماة', 'build-page'],
  ['اعمل صفحه هبوط لتطبيق توصيل', 'build-page'],
  ['اعمل صفحة هبوط لتطبيق توصيل', 'build-page'],
  ['صمم لي صفحة لمقهى مختص', 'build-page'],
  ['موقع الكتروني لعيادة أسنان', 'build-page'],
  ['متجر إلكتروني للعطور', 'build-page'],
  ['ويبسايت لشركتي', 'build-page'],
  ['Build a website for my bakery', 'build-page'],
  ['Create a landing page for a SaaS analytics tool', 'build-page'],
  ['make me a one-page site for a yoga studio', 'build-page'],
  // Named SECTIONS of one page, not pages: no "page" word, no count.
  ['a site for my dental clinic with services, team, pricing and contact', 'build-page'],
  ['Design a startup homepage', 'build-page'],
  ['Build a 4-page website: home, about, services, contact', 'build-site'],
  ['اعمل موقع من 4 صفحات: الرئيسية، من نحن، الخدمات، تواصل', 'build-site'],
  ['I need a web page for my restaurant', 'build-page'],
  ['landing for my app', 'build-page'],
];

/** §2 P0-1 — edits on an existing page. None may take a build. */
const EDIT_ASKS: readonly (readonly [string, StayKind])[] = [
  ['change the wedding date to June 12', 'edit'],
  ['make the landing page darker', 'edit'],
  ['update the homepage hero title to Hello', 'edit'],
  ['fix spacing in the portfolio section', 'edit'],
  ['add a dua under the hero', 'edit'],
  ['غيّر تاريخ الزفاف إلى ١٢ يونيو', 'edit'],
  ['add an invite friends button', 'edit'],
  ['translate the about me section to Arabic', 'edit'],
  ['change the resume download link', 'edit'],
  ['اجعل الصفحة الرئيسية أغمق', 'edit'],
  ['أضف قسم أسعار', 'add-section'],
  ['add a pricing section', 'add-section'],
];

const isBuild = (kind: IntentKind): boolean => kind === 'build-page' || kind === 'build-site';

describe('the audit routing table — whole-page asks (P1-5)', () => {
  it.each(PAGE_ASKS)('builds “%s” on an empty page, owning the page', (request, kind) => {
    const route = routeIntent({ request, document: EMPTY });
    expect(route.kind).toBe(kind);
    expect(route.target).toBe('replace');
  });

  it.each(PAGE_ASKS)(
    'builds “%s” on a page with content as a NEW page, never under it (P1-15)',
    (request, kind) => {
      const route = routeIntent({ request, document: LANDING });
      expect(route.kind).toBe(kind);
      expect(route.target).toBe('new-page');
    },
  );

  it.each(PAGE_ASKS)('builds “%s” when the page is not known at all', (request, kind) => {
    expect(routeIntent({ request }).kind).toBe(kind);
  });

  it('misses none of the 17', () => {
    const missed = PAGE_ASKS.filter(
      ([request]) => !isBuild(routeIntent({ request, document: LANDING }).kind),
    );
    expect(missed).toEqual([]);
  });
});

describe('the audit routing table — edits (P0-1)', () => {
  it.each(EDIT_ASKS)('routes “%s” on a page with content to %s', (request, kind) => {
    const route = routeIntent({ request, document: LANDING });
    expect(route.kind).toBe(kind);
  });

  it.each(EDIT_ASKS)('never builds “%s”, even on an empty page', (request) => {
    expect(isBuild(routeIntent({ request, document: EMPTY }).kind)).toBe(false);
  });

  it('sends none of the 12 into a build', () => {
    const misrouted = EDIT_ASKS.filter(([request]) => isBuild(routeIntent({ request }).kind));
    expect(misrouted).toEqual([]);
  });
});

interface Row {
  readonly request: string;
  readonly document?: IntentDocumentSummary;
  readonly selection?: readonly string[];
  readonly kind: IntentKind;
  readonly target?: IntentTarget;
}

/** The cases the router was specified with, in both languages. */
const SPECIFIED: readonly Row[] = [
  // Several NAMED pages are a site.
  {
    request: 'موقع فيه صفحة من نحن وخدمات',
    document: EMPTY,
    kind: 'build-site',
    target: 'replace',
  },
  { request: 'website with about and services pages', document: EMPTY, kind: 'build-site' },
  {
    request: 'a website with an about page and a services page',
    document: LANDING,
    kind: 'build-site',
    target: 'new-page',
  },
  { request: 'اعمل موقع من ثلاث صفحات لمخبز', document: EMPTY, kind: 'build-site' },
  { request: 'three-page site for my clinic', document: EMPTY, kind: 'build-site' },
  { request: 'بدي موقع فيه صفحتين: الرئيسية وتواصل معنا', document: EMPTY, kind: 'build-site' },
  { request: 'اعمل موقع من ٤ صفحات لشركة', document: EMPTY, kind: 'build-site' },
  { request: 'add about and services pages', document: LANDING, kind: 'build-site' },
  // …unless the request pins ONE page, whatever it lists.
  {
    request: 'a one-page site with about, services and contact pages',
    document: EMPTY,
    kind: 'build-page',
  },
  { request: 'موقع صفحة واحدة فيه من نحن وخدمات وتواصل', document: EMPTY, kind: 'build-page' },

  // Questions are answered, not built.
  { request: 'how do I add a pricing section?', document: LANDING, kind: 'question' },
  { request: 'how does the build work', document: EMPTY, kind: 'question' },
  { request: 'why is the hero so dark', document: LANDING, kind: 'question' },
  { request: 'what is a landing page?', document: EMPTY, kind: 'question' },
  { request: 'is the page responsive?', document: LANDING, kind: 'question' },
  { request: 'كيف أغير لون الخلفية؟', document: LANDING, kind: 'question' },
  { request: 'ليش الصفحة بطيئة', document: LANDING, kind: 'question' },
  { request: 'هل الصفحة متجاوبة؟', document: LANDING, kind: 'question' },
  { request: 'شو يعني صفحة هبوط؟', document: EMPTY, kind: 'question' },
  { request: 'the hero looks off?', document: LANDING, kind: 'question' },
  { request: 'مرحبا', document: EMPTY, kind: 'question' },
  { request: 'hi', document: EMPTY, kind: 'question' },

  // A polite request with a question mark is still a request.
  { request: 'can you build me a website for my gym?', document: EMPTY, kind: 'build-page' },
  { request: 'ممكن تسويلي موقع لصالون؟', document: EMPTY, kind: 'build-page' },
  { request: 'could you make the hero darker?', document: LANDING, kind: 'edit' },
  { request: 'هل يمكنك إضافة قسم للأسعار؟', document: LANDING, kind: 'add-section' },
  { request: 'please add a testimonials section', document: LANDING, kind: 'add-section' },
  { request: 'يا أبو غضب سوي لي موقع لمطبعة', document: EMPTY, kind: 'build-page' },

  // An explicit start-over replaces the page it is on.
  {
    request: 'start over with a landing page for my bakery',
    document: LANDING,
    kind: 'build-page',
    target: 'replace',
  },
  {
    request: 'rebuild the page from scratch',
    document: LANDING,
    kind: 'build-page',
    target: 'replace',
  },
  {
    request: 'ابدأ من الصفر وصمم صفحة لمخبز',
    document: LANDING,
    kind: 'build-page',
    target: 'replace',
  },
  {
    request: 'أعد تصميم الصفحة بالكامل',
    document: LANDING,
    kind: 'build-page',
    target: 'replace',
  },
  // …but starting a SECTION over is an edit of that section.
  { request: 'rewrite the hero from scratch', document: LANDING, kind: 'edit' },
  { request: 'rebuild the pricing section', document: LANDING, kind: 'edit' },
  { request: 'اكتب العنوان من جديد', document: LANDING, kind: 'edit' },

  // An explicit new page is a new page.
  {
    request: 'add a new page for our services',
    document: LANDING,
    kind: 'build-page',
    target: 'new-page',
  },
  {
    request: 'أضف صفحة جديدة للخدمات',
    document: LANDING,
    kind: 'build-page',
    target: 'new-page',
  },
  { request: 'add a button to the new page', document: LANDING, kind: 'edit' },

  // Adding a SECTION is one section, not a page.
  { request: 'design a hero section for a landing page', document: LANDING, kind: 'add-section' },
  { request: 'ضيف سكشن للاسعار', document: LANDING, kind: 'add-section', target: 'append' },
  { request: 'I want a gallery section', document: LANDING, kind: 'add-section' },
  { request: 'add a hero', document: EMPTY, kind: 'add-section', target: 'append' },
  { request: 'create a button on the landing page', document: LANDING, kind: 'edit' },
  { request: 'I want the hero darker', document: LANDING, kind: 'edit' },

  // An empty page takes any substantive request as the page to build.
  { request: 'مطعم شاورما في عمان', document: EMPTY, kind: 'build-page', target: 'replace' },
  { request: 'a bakery in Amman', document: EMPTY, kind: 'build-page', target: 'replace' },
  { request: 'دعوة زفاف لسارة وعمر', document: EMPTY, kind: 'build-page' },
  { request: 'build my portfolio', document: EMPTY, kind: 'build-page' },
  // …so does a skeleton nobody filled.
  {
    request: 'make me a landing page for my cafe',
    document: PLACEHOLDERS,
    kind: 'build-page',
    target: 'replace',
  },
  { request: 'مطعم شاورما في عمان', document: PLACEHOLDERS, kind: 'build-page' },
  // A page with content takes the same words as an edit.
  { request: 'مطعم شاورما في عمان', document: LANDING, kind: 'edit' },
  { request: 'a bakery in Amman', document: LANDING, kind: 'edit' },
  { request: 'build my portfolio', document: LANDING, kind: 'edit' },
  // The retry the Built card sends (AssistantPanel.runs.ts `retrySkippedRequest`).
  {
    request:
      'Write the sections that were skipped: “Pricing”, “FAQ”. Keep the direction the rest of the page already follows, and change nothing else.',
    document: PLACEHOLDERS,
    kind: 'edit',
  },

  // Pointing at a block is editing it, unless the words explicitly ask for a page.
  { request: 'landing for my app', document: LANDING, selection: ['hero'], kind: 'edit' },
  {
    request: 'a pricing table with three tiers',
    document: PLACEHOLDERS,
    selection: ['placeholder-2'],
    kind: 'edit',
  },
  {
    request: 'Build a website for my bakery',
    document: LANDING,
    selection: ['hero'],
    kind: 'build-page',
    target: 'new-page',
  },

  // Normalisation: one route whatever the spelling.
  { request: 'مـوقـع لمطـعـم', document: EMPTY, kind: 'build-page' },
  { request: 'مَوْقِعٌ لِمَطْعَمٍ', document: EMPTY, kind: 'build-page' },
  { request: 'BUILD A WEBSITE FOR MY BAKERY', document: LANDING, kind: 'build-page' },
  { request: 'إنشاء متجر إلكتروني', document: LANDING, kind: 'build-page' },
  { request: 'انشاء متجر الكتروني', document: LANDING, kind: 'build-page' },
];

describe('the routing table — specified cases', () => {
  it.each(SPECIFIED)('routes “$request” to $kind', (row) => {
    const route = routeIntent({
      request: row.request,
      ...(row.document === undefined ? {} : { document: row.document }),
      ...(row.selection === undefined ? {} : { selection: row.selection }),
    });
    expect(route.kind).toBe(row.kind);
    if (row.target !== undefined) expect(route.target).toBe(row.target);
  });
});

/*
  PAST THE AUDIT'S TABLE — misroutes found by probing the router with ~90 more
  phrasings once every row above passed (2026-09-28). The first group is the
  P0-1 failure again in new words: an edit that MENTIONS pages, routed into a
  build that would scaffold over the page being edited. Each row failed before
  the fix beside it; the reason each one failed is in its group's comment.
*/
const FOUND_PAST_THE_TABLE: readonly Row[] = [
  /*
    Pages named in an EDIT are the site's existing pages, not a site to make.
    Before: build-site — the plural read as indefinite across "the about and
    services pages" (the determiner sits before the list, not the last noun),
    and "my website" counted as a site to build.
  */
  { request: 'fix the about and services pages on my website', document: LANDING, kind: 'edit' },
  { request: 'fix the about and services pages on my website', document: EMPTY, kind: 'edit' },
  {
    request: "the website's about page and services page need fixing",
    document: LANDING,
    kind: 'edit',
  },
  {
    request: 'translate the about and contact pages on the site to Arabic',
    document: LANDING,
    kind: 'edit',
  },
  // A count in an edit counts the person's own pages. Before: build-site.
  { request: 'translate my 3-page website to Arabic', document: LANDING, kind: 'edit' },
  /*
    "A new page" inside a prepositional phrase is where something POINTS, not
    what is asked for. Before: build-page at 0.85 — "new" + a page noun
    anywhere in the sentence was read as a new-page ask.
  */
  { request: 'add a link to a new page', document: LANDING, kind: 'edit' },
  { request: 'add a button that links to a new page', document: LANDING, kind: 'edit' },
  { request: 'move the pricing to a new page', document: LANDING, kind: 'edit' },
  { request: 'show new pages in the nav', document: LANDING, kind: 'edit' },
  { request: 'أضف رابط لصفحة جديدة', document: LANDING, kind: 'edit' },
  { request: 'اضف زر يروح الى صفحة جديدة', document: LANDING, kind: 'edit' },
  // …while the object of the verb, or the opening of the request, still is one.
  { request: 'my clinic wants a new site', document: LANDING, kind: 'build-page' },
  { request: 'new page for our team', document: LANDING, kind: 'build-page', target: 'new-page' },
  { request: 'ابي صفحة ثانية للمنيو', document: LANDING, kind: 'build-page', target: 'new-page' },

  /*
    A page NAMED "about" is still a page. Before: edit — "about" is also a
    preposition, so it ended the phrase before "page" was reached, and the
    landing workspace's own "about" section claimed the request.
  */
  { request: 'add an about page', document: LANDING, kind: 'build-page', target: 'new-page' },
  { request: 'add an about page', document: EMPTY, kind: 'build-page', target: 'replace' },
  { request: 'create an about us page', document: LANDING, kind: 'build-page' },
  // The preposition still ends a phrase that is not a page's name.
  { request: 'add a section about the page', document: LANDING, kind: 'add-section' },

  /*
    "Needs" and "wants" ask for something as surely as "need" and "want".
    Before: edit — the third person was no verb at all.
  */
  {
    request: 'My bakery needs a website',
    document: LANDING,
    kind: 'build-page',
    target: 'new-page',
  },
  { request: 'the website needs a contact form', document: LANDING, kind: 'edit' },
  { request: 'the page needs a pricing section', document: LANDING, kind: 'add-section' },

  /*
    A new page on a page with nothing to keep takes its place. Before: target
    new-page — leaving the empty page behind, beside the one just built.
  */
  {
    request: "I'd like a new website for my clinic",
    document: EMPTY,
    kind: 'build-page',
    target: 'replace',
  },
  {
    request: "I'd like a new website for my clinic",
    document: LANDING,
    kind: 'build-page',
    target: 'new-page',
  },
  { request: 'صفحة جديدة للعروض', document: PLACEHOLDERS, kind: 'build-page', target: 'replace' },

  /*
    "Home" among a site's named parts is a page — no page has a home SECTION.
    Before: build-page. Without "home" the names stay one page's sections (the
    audit's dental-clinic row, above).
  */
  { request: 'website with home, about and contact', document: EMPTY, kind: 'build-site' },
  {
    request: 'موقع لشركتي فيه الرئيسية ومن نحن والخدمات واتصل بنا',
    document: EMPTY,
    kind: 'build-site',
  },
  { request: 'the website home and about sections need work', document: LANDING, kind: 'edit' },

  /*
    Clearing the page to build another is a start-over. Before: new-page,
    leaving the content the person had just asked to delete.
  */
  {
    request: 'delete everything and build a website for my bakery',
    document: LANDING,
    kind: 'build-page',
    target: 'replace',
  },
  // Clearing alone builds nothing: there is no brief.
  { request: 'delete everything', document: LANDING, kind: 'edit' },
];

/*
  An empty page takes a BRIEF as the page to build — not every word typed on
  it. Before, each of these built a whole page on an empty canvas, or replaced
  the skeleton a stopped build left behind, with the words as its brief.
*/
const NOT_A_BRIEF: readonly (readonly [string, StayKind])[] = [
  // Steering the run or its history.
  ['undo', 'edit'],
  ['تراجع', 'edit'],
  ['continue', 'edit'],
  ['كمل', 'edit'],
  ['stop', 'edit'],
  ['retry', 'edit'],
  ['try again', 'edit'],
  // Changing what is (or is not yet) there: the object is what exists.
  ['get rid of the footer', 'edit'],
  ['make it pop', 'edit'],
  ['خليها احلى', 'edit'],
  ['duplicate this page', 'edit'],
  // Asking for an answer in words.
  ['summarize the page', 'question'],
  ['لخص الصفحة', 'question'],
  ['ممكن تشرح لي الصفحة؟', 'question'],
];

describe('the routing table — found past the audit’s table', () => {
  it.each(FOUND_PAST_THE_TABLE)('routes “$request” to $kind', (row) => {
    const route = routeIntent({
      request: row.request,
      ...(row.document === undefined ? {} : { document: row.document }),
      ...(row.selection === undefined ? {} : { selection: row.selection }),
    });
    expect(route.kind).toBe(row.kind);
    if (row.target !== undefined) expect(route.target).toBe(row.target);
  });

  it.each(NOT_A_BRIEF)('does not take “%s” as a brief on an empty page (%s)', (request, kind) => {
    for (const document of [EMPTY, PLACEHOLDERS]) {
      expect(routeIntent({ request, document }).kind).toBe(kind);
    }
  });

  it('still takes a bare subject, or “build it”, as the brief', () => {
    for (const request of ['build it', 'a bakery in Amman', 'مطعم شاورما في عمان']) {
      expect(routeIntent({ request, document: EMPTY }).kind).toBe('build-page');
    }
  });
});

/*
  THE WAVE-1 VERIFIER'S REGRESSIONS (2026-09-28), then adversarial phrasings
  of the same four classes written past them. Every row below routed wrong
  before the fix beside its group; the first rows of each group are the
  verifier's own words.
*/

/*
  A start-over aimed at a PART of the page. Before: build-page/replace@0.85 on
  every canvas — any page noun in the sentence made the start-over the
  page's, even one that only said WHERE the section is ("the hero section OF
  THE HOMEPAGE"), so a host honouring the target would have wiped the page to
  redo one section.
*/
const PART_START_OVER: readonly string[] = [
  'أعد تصميم قسم الأسعار في الصفحة',
  'start over on the hero of this page',
  'redesign the hero section of the homepage',
  'rewrite the hero on the landing page from scratch',
  // Past the verifier's rows.
  'redesign the pricing section on the landing page',
  'أعد تصميم الهيرو في الصفحة الرئيسية',
  'اعد كتابة الفوتر في الموقع من الصفر',
  'rebuild the footer of my website from scratch',
  'start fresh on the testimonials section of this page',
  'ابدأ من جديد في قسم الأسعار',
  'redesign the homepage hero from scratch',
  'scrap the gallery on the about page',
  /*
    The object is a PRONOUN pointing back at a part named in an earlier
    clause. Before (wave-2 verifier, 2026-09-28): build-page/replace@0.85 —
    the start-over's own clause named nothing, so it fell back to the page.
  */
  'the hero looks bad, redesign it from scratch',
  'take the pricing section and redesign it',
  'tear down the hero and rebuild it',
  'the footer is ugly. start over on it',
  'الهيدر سيء، أعد تصميمه من الصفر',
  // Past the verifier's rows.
  'I hate the footer — rebuild it from scratch',
  'the testimonials section feels flat; redo it from scratch',
  'the hero and the footer look dated, redo them from scratch',
  'look at the navbar and start over on it',
  'الفوتر مش حلو، أعد بناءه',
  'قسم الأسعار قديم، صممه من جديد',
  'الهيرو، أعد تصميمه بالكامل',
  'the pricing cards are cluttered. start fresh on them',
  /*
    An Arabic section named by a DEFINITE construct ("قسم الأسعار", the
    section of the prices) and restarted. Before: add-section/append@0.85,
    even on a page that has a الأسعار section — while the English "design the
    pricing section from scratch" routed edit.
  */
  'صمم قسم الأسعار من الصفر',
  'صمم قسم الخدمات من جديد',
  'design the pricing section from scratch',
];

/*
  Pages named as where LINKS go, inside something added. Before: build-site
  @0.8 — "plural pages + an add verb + two page names" read "a nav with links
  to home, about and contact pages" as three pages to make.
*/
const LINK_TARGETS: readonly string[] = [
  'add a nav with links to home, about and contact pages',
  'add a footer with links to about and contact pages',
  'أضف قائمة فيها روابط لصفحات من نحن والخدمات',
  // Past the verifier's rows.
  'create a footer with links to home, about and contact pages',
  'add a navbar linking to the about and services pages',
  'add buttons that go to the pricing and contact pages',
  'أضف شريط تنقل فيه روابط لصفحات الخدمات وتواصل معنا',
  'اضف روابط لصفحات من نحن والخدمات في الفوتر',
  'add a footer with links to all 4 pages',
  'put links to the about and contact pages in the header',
  // A page break is a break, not a page (wave-1 verifier's minor row).
  'add a page break',
  /*
    A SITE noun among the link targets ("blog", "shop"). Before (wave-2
    verifier): build-site@0.8 — any indefinite site noun anywhere counted as a
    site being asked for, which skipped the guard for a part's link list.
  */
  'add a nav with links to home, blog and contact',
  'add a navbar with home, about and blog pages',
  'add a nav with links to the home, pricing and blog pages',
  // Past the verifier's rows.
  'add a footer with links to the shop, blog and contact pages',
  'add a menu linking to home, store and about',
  'أضف قائمة فيها روابط للرئيسية والمدونة والمتجر',
  'put a navbar at the top with home, blog, shop and contact',
];

/*
  A start-over with NO brief. Still the page's start-over — but the words say
  nothing about what replaces it, so the route is below the confirm line
  (0.6) and a host asks before wiping a page with content. Before: 0.85, the
  same as "start over with a landing page for my bakery".
*/
const BARE_START_OVER: readonly string[] = [
  'start over',
  'من الصفر',
  'redesign the page',
  // Past the verifier's rows.
  'rebuild the whole website from scratch',
  'امسح كل شي وابدأ من جديد',
  'أعد تصميم الموقع بالكامل',
  'start again please',
  'scrap it and start fresh',
  'rebuild the page from scratch',
  'أعد تصميم الصفحة بالكامل',
  // Naming what to drop or keep is still no subject for the page that replaces it.
  'delete the hero and start over',
  'احذف الهيرو وابدأ من جديد',
  'start over, but keep the hero',
  /*
    Courtesy, fillers, vocatives, and clauses that only JUDGE the page. Before
    (wave-2 verifier): 0.85 — every word the no-subject sets did not list,
    anywhere in the request, counted as a brief ("let's", "ok", "لو سمحت",
    "I don't like it", "الصفحة سيئة").
  */
  "let's start over",
  'ok start over',
  'okay, redesign the page',
  'hmm, start from scratch',
  "I don't like it, start over",
  "start over please, I don't like it",
  'أعد بناء الصفحة لو سمحت',
  'أعد بناء الصفحة من فضلك',
  'ابدأ من الصفر يا أبو غضب',
  'ما عجبني، ابدأ من الصفر',
  'الصفحة سيئة، أعد تصميمها بالكامل',
  'حلو بس ابدأ من جديد',
  // Past the verifier's rows.
  'I think we should just start over',
  'honestly, scrap it and start again',
  'I really hate this design, start over',
  'the page is ugly, redesign it',
  'this looks terrible. start over.',
  'طيب، أعد تصميم الصفحة',
  'يلا ابدأ من جديد',
  'مش عاجبني التصميم، ابدأ من الصفر لو سمحت',
  'لازم تبدأ من الصفر',
  'خلينا نبدأ من جديد',
  // A page TYPE alone says as little as "start over with a portfolio" does.
  'rebuild it as a resume',
];

/* The same start-over WITH a brief keeps its confidence. */
const BRIEFED_START_OVER: readonly string[] = [
  'start over with a landing page for my bakery',
  'ابدأ من الصفر وصمم صفحة لمخبز',
  'start over with a landing page for my dental clinic',
  'أعد تصميم الصفحة لمطعم مشاوي في عمان',
  'redesign the page for a law firm',
  'from scratch: a portfolio for a wedding photographer',
  // "From scratch" restarts what came BEFORE it; "with a hero" is not its object.
  'build a landing page for my gym from scratch with a hero and pricing',
  // A judgment beside a real brief does not hide the brief.
  "I don't like it, start over with a landing page for my florist",
  'ما عجبني، ابدأ من الصفر وصمم صفحة لمخبز',
  'start over. make a page for my barber shop',
  'the page is ugly — rebuild it for a yoga studio',
];

/*
  On a page with nothing to keep, a change aimed at something that EXISTS is
  not a brief. Before: build-page — "make" and "needs" were read as asking
  for something new whatever their object was.
*/
const DEFINITE_CHANGES_ON_EMPTY: readonly string[] = [
  'make the title Hello',
  'اجعل لون الخلفية بلون القهوة',
  'the restaurant menu needs new prices',
  'make the hero text say Welcome',
];

/*
  An Arabic page named by a DEFINITE construct ("صفحة العيادة", the clinic's
  page) is the page that exists when a make verb or a comparative changes it.
  Before (wave-2 verifier): build-page/new-page@0.75 on a page with content,
  even with a block selected, and 0.9 replace on an empty page; the English
  "make the clinic page darker" routed edit.
*/
const DEFINITE_ARABIC_PAGES: readonly string[] = [
  'خلي صفحة العيادة أغمق',
  'اجعل صفحة المطعم أبسط',
  'خلي صفحة الهبوط أفتح',
  // Past the verifier's rows.
  'اجعل صفحة الخدمات أوضح',
  'خلي موقع الشركة أفخم',
  'اجعل قسم الأسعار أغمق',
];

/* …while the construct still NAMES a page or section to make, as Arabic speakers ask for one. */
const ARABIC_NAMING_CONSTRUCTS: readonly (readonly [string, IntentKind])[] = [
  ['اعمل صفحة الهبوط لتطبيق توصيل', 'build-page'],
  ['أضف صفحة الخدمات', 'build-page'],
  ['صمم قسم الأسعار', 'add-section'],
  ['سوي صفحة المطعم', 'build-page'],
  // "إلكتروني" folds to a word that opens with ال, and carries no article.
  ['اعمل موقع الكتروني لعيادة أسنان', 'build-page'],
  ['صمم موقع إلكتروني أبسط لمطعمي', 'build-page'],
  /*
    "دعوة لاتخاذ إجراء" is the Arabic of "call to action" — a section, not
    the invitation page "دعوة" alone names. Before: build-page@0.75.
  */
  ['صمم دعوة لاتخاذ إجراء', 'add-section'],
  ['أضف دعوة لاتخاذ إجراء في آخر الصفحة', 'add-section'],
];

/*
  SUGGESTIONS phrased as questions ask for the change they suggest. Before
  (wave-2 verifier's route-probe, 2026-09-28): question@0.9 — the opener
  ("how", "what", "why", "is", "ليش") was an interrogative, so the panel
  answered in words where the one-call run had made the edit.
*/
const SUGGESTIONS: readonly (readonly [string, IntentKind])[] = [
  ['how about making the button blue?', 'edit'],
  ['what if the hero said Welcome home?', 'edit'],
  ['why not add a pricing section?', 'add-section'],
  ['what about a darker background?', 'edit'],
  ['is it possible to change the font to Inter?', 'edit'],
  ["why don't you add a testimonials section?", 'add-section'],
  ['ليش لا تغير لون الزر؟', 'edit'],
  ['ليش ما تضيف قسم آراء العملاء؟', 'add-section'],
  // Past the probe's rows.
  ['شو رأيك تضيف قسم أسعار؟', 'add-section'],
  ['ما رأيك لو نغير الخط؟', 'edit'],
  ['would it be possible to make the header smaller?', 'edit'],
];

/* …while a question that suggests nothing is still a question. */
const STILL_QUESTIONS: readonly string[] = [
  'why not?',
  'what about the footer?',
  'ليش ما اشتغل؟',
  'what if it breaks on mobile?',
  'is it possible?',
];

describe('the routing table — the wave-1 verifier’s regressions and past them', () => {
  it.each(SUGGESTIONS)('reads the suggestion “%s” as the request it is (%s)', (request, kind) => {
    for (const document of [LANDING, undefined]) {
      const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
      expect({ request, kind: route.kind }).toEqual({ request, kind });
    }
  });

  it.each(STILL_QUESTIONS)('still answers “%s” in words', (request) => {
    expect(routeIntent({ request, document: LANDING }).kind).toBe('question');
  });

  it('says it read a suggestion, and what it read past it, for the logs', () => {
    const route = routeIntent({ request: 'why not add a pricing section?', document: LANDING });
    expect(route.kind).toBe('add-section');
    expect(route.reason).toMatch(/^a suggestion \(“why not”\), asks for a new section/u);
    expect(routeIntent({ request: 'ليش ما تضيف قسم آراء العملاء؟' }).reason).toMatch(
      /^a suggestion \(“ليش ما”\)/u,
    );
  });

  it.each(PART_START_OVER)('edits the part “%s” names, on any page, never a build', (request) => {
    for (const document of [LANDING, CONTENT_AR, EMPTY, undefined]) {
      const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
      expect({ request, kind: route.kind }).toEqual({ request, kind: 'edit' });
    }
    const pointed = routeIntent({ request, document: LANDING, selection: ['hero'] });
    expect({ request, kind: pointed.kind }).toEqual({ request, kind: 'edit' });
  });

  it.each(DEFINITE_ARABIC_PAGES)('edits the page or part “%s” names, never a build', (request) => {
    for (const document of [LANDING, CONTENT_AR, EMPTY, PLACEHOLDERS, undefined]) {
      const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
      expect({ request, kind: route.kind }).toEqual({ request, kind: 'edit' });
    }
    const pointed = routeIntent({ request, document: LANDING, selection: ['hero'] });
    expect({ request, kind: pointed.kind }).toEqual({ request, kind: 'edit' });
  });

  it.each(ARABIC_NAMING_CONSTRUCTS)('still reads “%s” as %s', (request, kind) => {
    for (const document of [LANDING, EMPTY]) {
      expect({ request, kind: routeIntent({ request, document }).kind }).toEqual({ request, kind });
    }
  });

  it.each(LINK_TARGETS)('never reads the link targets in “%s” as pages to make', (request) => {
    for (const document of [LANDING, CONTENT_AR, EMPTY, undefined]) {
      const route = routeIntent({ request, ...(document === undefined ? {} : { document }) });
      expect({ request, build: isBuild(route.kind) }).toEqual({ request, build: false });
    }
  });

  it.each(BARE_START_OVER)(
    'replaces the page on “%s”, but below the confirm line (<0.6)',
    (request) => {
      const route = routeIntent({ request, document: LANDING });
      expect(route).toMatchObject({ kind: 'build-page', target: 'replace' });
      expect(route.confidence).toBeLessThan(0.6);
    },
  );

  it.each(BRIEFED_START_OVER)('replaces the page on “%s” with confidence', (request) => {
    const route = routeIntent({ request, document: LANDING });
    expect(route).toMatchObject({ kind: 'build-page', target: 'replace' });
    expect(route.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('lets a pointed block own a start-over that names no page', () => {
    for (const request of ['redesign it from scratch', 'أعد تصميمه من الصفر']) {
      expect(routeIntent({ request, document: LANDING, selection: ['hero'] }).kind).toBe('edit');
    }
    // …and not one that names the page.
    expect(
      routeIntent({
        request: 'rebuild the page from scratch',
        document: LANDING,
        selection: ['hero'],
      }),
    ).toMatchObject({ kind: 'build-page', target: 'replace' });
  });

  it.each(DEFINITE_CHANGES_ON_EMPTY)(
    'does not take “%s” as a brief on an empty page',
    (request) => {
      for (const document of [EMPTY, PLACEHOLDERS]) {
        expect({ request, kind: routeIntent({ request, document }).kind }).toEqual({
          request,
          kind: 'edit',
        });
      }
    },
  );

  it('still reads a make or a need whose object is a page as the page ask', () => {
    for (const request of ['make me a landing page for my cafe', 'My bakery needs a website']) {
      expect(isBuild(routeIntent({ request, document: EMPTY }).kind)).toBe(true);
    }
  });

  it('still counts pages that ARE what is added', () => {
    for (const request of [
      'add about and services pages',
      'add 3 pages: about, services and contact',
      'add an about page and a services page to the site',
      'أضف صفحات من نحن والخدمات',
    ]) {
      expect({ request, kind: routeIntent({ request, document: LANDING }).kind }).toEqual({
        request,
        kind: 'build-site',
      });
    }
  });
});
