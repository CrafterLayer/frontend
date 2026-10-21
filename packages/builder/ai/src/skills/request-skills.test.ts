import { describe, expect, it } from 'vitest';

import { fittingSkillIds } from '../agent/page-plan-context';
import { pixiSkillIdsFor } from './creative/pixi-selection';
import {
  CRAFTKIT_DEFAULT_SKILLS,
  DEFAULT_AI_SKILL_MAX_ACTIVE,
  DEFAULT_AI_SKILL_TOKEN_BUDGET,
  REQUEST_SKILL_MAX_ADDITIONS,
  REQUEST_SKILL_TOKEN_CAP,
  SECTION_SKILL_TOKEN_CAP,
  createCraftkitAiSkillRegistry,
  requestSkillIdsFor,
  withoutRequestLaneSkillIds,
  type RequestSkillLane,
} from './index';

/*
  requestSkillIdsFor (2026-10-14): the fixed intent → skill table for steps that name their
  skills. Rows are EN / AR / dialect × lane; "never" lists what a row must not carry.
*/

const BUILT_INS = createCraftkitAiSkillRegistry();
const FULL = createCraftkitAiSkillRegistry([...CRAFTKIT_DEFAULT_SKILLS]);
const PIXI_STORY_TRIO = ['craftkit.pixi-games', 'craftkit.pixi-stories', 'craftkit.pixi-dialogue'];

function cost(ids: readonly string[]): number {
  const floor = FULL.prepare({ request: '', auto: false }).totalTokens;
  return FULL.prepare({ request: '', selectedSkillIds: ids, auto: false }).totalTokens - floor;
}

interface Row {
  readonly request: string;
  readonly lane: RequestSkillLane;
  readonly contract?: string;
  readonly role?: string;
  readonly has: readonly string[];
  readonly never?: readonly string[];
}

const ROWS: readonly Row[] = [
  ...['host', 'page-plan'].flatMap((lane) =>
    ['اصنع cv احترافيه', 'Build a résumé', 'صمم سيرة ذاتية', 'Create my photography portfolio'].map(
      (request): Row => ({ request, lane: lane as RequestSkillLane, has: ['craftkit.cv-page'] }),
    ),
  ),
  ...['hero', 'band', 'cta'].map((role): Row => ({
    request: 'Create a professional CV for an engineer',
    lane: 'section',
    role,
    contract: 'Experience, qualifications and contact',
    has: ['craftkit.cv-page'],
    never: [
      'craftkit.pro-max-landing',
      'craftkit.conversion-recipes',
      'craftkit.structure-recipes',
    ],
  })),
  {
    request: 'Create an architecture portfolio',
    lane: 'section',
    role: 'hero',
    contract: 'Selected work and process',
    has: ['craftkit.cv-page'],
    never: ['craftkit.pro-max-landing'],
  },
  {
    request: 'Build a page for CVS pharmacy',
    lane: 'page-plan',
    has: [],
    never: ['craftkit.cv-page'],
  },
  { request: 'Change the CV title', lane: 'edit', has: [], never: ['craftkit.cv-page'] },
  ...[
    'Waterfall of operating cash flows',
    'Heatmap of team deliveries',
    'Histogram of durations',
    'Boxplot of response times',
    'مخطط شموع للاسعار',
  ].map((contract): Row => ({
    request: 'Build the report',
    contract,
    lane: 'section',
    role: 'band',
    has: ['craftkit.data-viz'],
  })),
  // Reports and dashboards.
  { request: 'Build a sales dashboard page', lane: 'host', has: ['craftkit.data-viz'] },
  { request: 'سويلي لوحة تحكم للمبيعات', lane: 'host', has: ['craftkit.data-viz'] },
  { request: 'سويلي داشبورد للمبيعات', lane: 'page-plan', has: ['craftkit.data-viz'] },
  {
    request: 'Make a monthly report page for my shop',
    lane: 'page-plan',
    has: ['craftkit.data-viz'],
  },
  { request: 'اعملي ريبورت شهري', lane: 'edit', has: ['craftkit.data-viz'] },
  {
    request: 'Build a sales dashboard page',
    lane: 'section',
    role: 'band',
    contract: 'Revenue chart shows the quarter',
    has: ['craftkit.data-viz'],
  },
  {
    request: 'Build a sales dashboard page',
    lane: 'section',
    role: 'band',
    contract: 'About the team behind the shop',
    has: [],
    never: ['craftkit.data-viz'],
  },
  { request: 'ضيف جدول أسعار بثلاث باقات', lane: 'host', has: [], never: ['craftkit.data-viz'] },
  {
    request: 'ضيف جدول أسعار بثلاث باقات',
    lane: 'section',
    role: 'band',
    contract: 'جدول أسعار بثلاث باقات',
    has: ['craftkit.conversion-recipes', 'craftkit.pro-max-landing'],
    never: ['craftkit.data-viz'],
  },
  // Logos, characters and illustrations.
  { request: 'Add our client logos: Visa, Stripe', lane: 'host', has: ['craftkit.art-names'] },
  { request: 'ضيف شعارات العملاء', lane: 'edit', has: ['craftkit.art-names'] },
  {
    request: 'Add a team section with cartoon characters',
    lane: 'host',
    has: ['craftkit.art-names'],
    never: ['craftkit.pixi-animation', 'craftkit.pixi-director'],
  },
  {
    request: 'Build a page for our agency',
    lane: 'section',
    role: 'band',
    contract: 'Team with cartoon characters for each member',
    has: ['craftkit.art-names', 'craftkit.structure-recipes'],
    never: ['craftkit.pixi-animation'],
  },
  {
    request: 'Build a page for our agency',
    lane: 'section',
    role: 'band',
    contract: 'Client logos strip: Visa, Stripe',
    has: ['craftkit.art-names', 'craftkit.trust-proof'],
  },
  // The person's own logo.
  { request: 'Design a logo for my coffee brand', lane: 'host', has: ['craftkit.logo-design'] },
  { request: 'سويلي لوجو لشركتي', lane: 'host', has: ['craftkit.logo-design'] },
  {
    request: 'صمم لي شعار لمقهى وموقع',
    lane: 'section',
    role: 'header',
    contract: 'Header with the brand and links',
    has: ['craftkit.logo-design', 'craftkit.pro-max-ux'],
  },
  // Bilingual in English words.
  {
    request: 'Build a bilingual Arabic and English website for my law firm',
    lane: 'host',
    has: ['craftkit.arabic-rtl'],
  },
  {
    request: 'A site in two languages for my clinic',
    lane: 'page-plan',
    has: ['craftkit.arabic-rtl'],
  },
  {
    request: 'Build a website for my law firm',
    lane: 'host',
    has: [],
    never: ['craftkit.arabic-rtl'],
  },
  // Creative: the pixi set, unchanged.
  { request: 'سويلي لعبة تجمع فيها نجوم', lane: 'host', has: ['craftkit.pixi-games'] },
  { request: 'اعمل لي لعبة تجمع فيها نجوم', lane: 'page-plan', has: ['craftkit.pixi-games'] },
  {
    request: 'Make a game where you catch falling stars',
    lane: 'host',
    has: ['craftkit.pixi-games'],
  },
  {
    request: 'Make a parallax mural of a desert at night',
    lane: 'host',
    has: ['craftkit.pixi-murals'],
    never: PIXI_STORY_TRIO,
  },
  {
    request: 'اعملي جدارية لصحراء بالليل',
    lane: 'page-plan',
    has: ['craftkit.pixi-murals', 'craftkit.pixi-page-shapes'],
    never: PIXI_STORY_TRIO,
  },
  {
    request: 'Make a parallax mural of a desert at night',
    lane: 'section',
    role: 'hero',
    contract: 'Hero A parallax mural of a desert at night',
    has: ['craftkit.pixi-murals', 'craftkit.pro-max-design'],
    never: PIXI_STORY_TRIO,
  },
  // Section defaults by role and contract.
  {
    request: 'Build a landing page for my SaaS app',
    lane: 'section',
    role: 'hero',
    contract: 'Hero states the outcome',
    has: ['craftkit.pro-max-design', 'craftkit.pro-max-landing'],
    never: ['craftkit.natural-copy', 'craftkit.trust-proof'],
  },
  {
    request: 'Build a landing page for my SaaS app',
    lane: 'section',
    role: 'band',
    contract: 'What customers say: testimonials',
    has: ['craftkit.conversion-recipes', 'craftkit.trust-proof'],
    never: ['craftkit.pro-max-design'],
  },
  {
    request: 'اعملي صفحة لعيادة أسنان',
    lane: 'section',
    role: 'band',
    contract: 'تواصل معنا واحجز موعدك',
    has: ['craftkit.structure-recipes', 'craftkit.forms-convert'],
  },
  {
    request: 'Build a landing page for my SaaS app',
    lane: 'section',
    role: 'cta',
    contract: 'Start your free trial today',
    has: ['craftkit.pro-max-landing'],
  },
  {
    request: 'Build a landing page for my SaaS app',
    lane: 'section',
    role: 'band',
    contract: 'About us: our story and mission',
    has: ['craftkit.natural-copy'],
  },
];

describe('requestSkillIdsFor — rows', () => {
  it.each(ROWS)('$lane: $request $contract', ({ request, lane, contract, role, has, never }) => {
    const ids = requestSkillIdsFor(FULL, request, lane, {
      ...(contract === undefined ? {} : { contractText: contract }),
      ...(role === undefined ? {} : { role }),
    });
    expect(ids).toEqual(expect.arrayContaining([...has]));
    for (const id of never ?? []) expect(ids).not.toContain(id);
  });

  it.each(['Add our client logos: Visa, Stripe', 'ضيف شعارات العملاء'])(
    'reaches the edit lane through registry.prepare: %s',
    (request) => {
      const ids = FULL.prepare({ request, intent: 'edit' }).active.map(({ id }) => id);
      expect(ids).toContain('craftkit.art-names');
    },
  );

  it('gives the creative set exactly as pixiSkillIdsFor does', () => {
    for (const request of ['سويلي لعبة تجمع فيها نجوم', 'Make an interactive bedtime story']) {
      expect(requestSkillIdsFor(FULL, request, 'host')).toEqual(pixiSkillIdsFor(FULL, request));
      expect(requestSkillIdsFor(FULL, request, 'page-plan')).toEqual(
        pixiSkillIdsFor(FULL, request, 'page-plan'),
      );
    }
  });
});

describe('requestSkillIdsFor — limits', () => {
  const MANY = 'Build a bilingual sales dashboard with client logos and a logo for my brand';

  it('adds at most two non-creative skills within the token cap', () => {
    for (const lane of ['host', 'page-plan', 'edit'] as const) {
      const ids = requestSkillIdsFor(FULL, MANY, lane);
      expect(ids.length).toBeLessThanOrEqual(REQUEST_SKILL_MAX_ADDITIONS);
      expect(cost(ids)).toBeLessThanOrEqual(REQUEST_SKILL_TOKEN_CAP);
    }
    const section = requestSkillIdsFor(FULL, MANY, 'section', {
      role: 'hero',
      contractText: `Hero ${MANY} with pricing and testimonials`,
    });
    expect(section.length).toBeLessThanOrEqual(REQUEST_SKILL_MAX_ADDITIONS);
    expect(cost(section)).toBeLessThanOrEqual(SECTION_SKILL_TOKEN_CAP);
  });

  it('never returns an id the registry lacks, the person excluded, or the step holds', () => {
    expect(requestSkillIdsFor(undefined, MANY, 'host')).toEqual([]);
    // Built-ins only: no default skills to return.
    const hero = requestSkillIdsFor(BUILT_INS, 'Build a landing page', 'section', { role: 'hero' });
    expect(hero).toEqual([]);
    const excluded = requestSkillIdsFor(
      FULL,
      'Add our client logos and a sales dashboard',
      'host',
      {
        excluded: ['craftkit.art-names'],
      },
    );
    expect(excluded).toEqual(['craftkit.data-viz']);
    const present = requestSkillIdsFor(FULL, 'Build a bilingual sales dashboard', 'host', {
      present: ['craftkit.data-viz'],
    });
    expect(present).toEqual(['craftkit.arabic-rtl']);
    const games = requestSkillIdsFor(FULL, 'سويلي لعبة تجمع فيها نجوم', 'host', {
      excluded: ['craftkit.pixi-effects'],
    });
    expect(games).toContain('craftkit.pixi-games');
    expect(games).not.toContain('craftkit.pixi-effects');
  });

  it('returns the additions alone with creative: false', () => {
    const ids = requestSkillIdsFor(FULL, 'Make a game with cartoon characters', 'host', {
      creative: false,
    });
    expect(ids).toEqual(['craftkit.art-names']);
  });

  it('keeps personal-page teaching within the same discovery caps and respects exclusions', () => {
    const request = 'Build a bilingual professional CV with contact links';
    for (const lane of ['host', 'page-plan', 'section'] as const) {
      const context = { role: 'hero', contractText: 'Identity and qualifications' };
      const ids = requestSkillIdsFor(FULL, request, lane, context);
      expect(ids).toContain('craftkit.cv-page');
      expect(ids.length).toBeLessThanOrEqual(REQUEST_SKILL_MAX_ADDITIONS);
      expect(cost(ids)).toBeLessThanOrEqual(
        lane === 'section' ? SECTION_SKILL_TOKEN_CAP : REQUEST_SKILL_TOKEN_CAP,
      );
      expect(
        requestSkillIdsFor(FULL, request, lane, {
          ...context,
          excluded: ['craftkit.cv-page'],
        }),
      ).not.toContain('craftkit.cv-page');
      expect(
        requestSkillIdsFor(FULL, request, lane, {
          ...context,
          present: ['craftkit.cv-page'],
        }),
      ).not.toContain('craftkit.cv-page');
    }
  });

  it('keeps the person’s own skills and the creative set when a writer drops page-level ids', () => {
    expect(
      withoutRequestLaneSkillIds([
        'user.brand-voice',
        'craftkit.pixi-games',
        'craftkit.pro-max-design',
        'craftkit.data-viz',
        'craftkit.trust-proof',
      ]),
    ).toEqual(['user.brand-voice', 'craftkit.pixi-games']);
  });
});

describe('requestSkillIdsFor — per-lane budgets', () => {
  const ARABIC_CREATIVE = [
    'سويلي لعبة تجمع فيها نجوم مع داشبورد للنتائج',
    'بدي قصة تفاعلية للأطفال عن أرنب بشخصيات كرتونية',
    'اعمل لعبة منصات فيها فيزياء ومقلاع وأعداء وموسيقى',
    'اعملي جدارية بالتمرير لصحراء بالليل مع شعارات الرعاة',
    'بدي رواية مرئية فيها حوار تفاعلي وخريطة عالم',
  ];

  /*
    The page plan with kits (the default planner): measured 2026-10-14, the worst is the
    platformer at 14,433 tokens / 15 skills, unchanged by the table (it adds nothing there); the
    largest addition is data-viz to the star game, 10,434 → 11,533.
  */
  it('keeps the worst Arabic creative page plan, with its additions, within 16,000 tokens', () => {
    for (const request of ARABIC_CREATIVE) {
      const ids = [
        'craftkit.direction-deck',
        'craftkit.copywriting',
        'craftkit.arabic-rtl',
        ...requestSkillIdsFor(FULL, request, 'page-plan'),
      ];
      const prepared = FULL.prepare({ request, selectedSkillIds: ids, auto: false });
      expect(prepared.totalTokens, request).toBeLessThanOrEqual(DEFAULT_AI_SKILL_TOKEN_BUDGET);
      expect(prepared.active.length, request).toBeLessThanOrEqual(DEFAULT_AI_SKILL_MAX_ACTIVE);
    }
  });

  /*
    A writer offers its own skills before the table's additions, so a writer that does not fit
    sheds the additions first (fittingSkillIds drops from the end) and never loses a creative,
    variants or photo skill to them.
  */
  it('keeps a creative hero writer within 16 skills, its own set never displaced', () => {
    const required = ['craftkit.build-fill', 'craftkit.copywriting', 'craftkit.arabic-rtl'];
    for (const request of ARABIC_CREATIVE) {
      const contractText = `Hero ${request}`;
      const own = [
        ...pixiSkillIdsFor(FULL, contractText),
        'craftkit.section-variants',
        'craftkit.photo-direction',
      ];
      const additions = requestSkillIdsFor(FULL, request, 'section', {
        role: 'hero',
        contractText,
        present: required,
        creative: false,
      });
      const before = fittingSkillIds(FULL, undefined, required, own);
      const after = fittingSkillIds(FULL, undefined, required, [...own, ...additions]);
      expect(after.slice(0, before.length), request).toEqual(before);
      const prepared = FULL.prepare({ request: '', selectedSkillIds: after, auto: false });
      expect(prepared.active.length, request).toBeLessThanOrEqual(DEFAULT_AI_SKILL_MAX_ACTIVE);
      expect(prepared.totalTokens, request).toBeLessThanOrEqual(DEFAULT_AI_SKILL_TOKEN_BUDGET);
    }
  });
});
