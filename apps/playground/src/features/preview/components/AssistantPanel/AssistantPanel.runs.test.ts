import * as builder from '@craftkit/builder';
import {
  AiBuildRevertError,
  createCraftkitAiSkillRegistry,
  type AiBuildTaskReport,
  type BuilderKernel,
} from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import type { PlanTurn, Turn } from './AssistantPanel.turns';
import {
  activatesBuildArchetype,
  lastDropped,
  lastFollowUp,
  ownsRun,
  PLAN_MODE_SKILL_ID,
  requestPath,
  retrySkippedRequest,
  revertRefusalOf,
  routeRequest,
  skillsForMode,
} from './AssistantPanel.runs';

const you = (id: string): Turn => ({ id, from: 'you', text: 'أضف قسم أسعار' });

const plan = (id: string, overrides: Partial<PlanTurn> = {}): Turn => ({
  id,
  from: 'assistant',
  kind: 'plan',
  plan: { rationale: 'r', commands: [] },
  applied: false,
  ...overrides,
});

const thinking = (id: string): Turn => ({
  id,
  from: 'assistant',
  kind: 'thinking',
  subject: 'the page',
  run: { stages: [], startedAt: 0, stageSince: null, failedAt: null },
});

const dropped = [{ step: 2, command: 'insertNode', reason: 'unregistered block' }];

describe('ownsRun', () => {
  it('is false with no lease at all', () => {
    expect(ownsRun(null, 'run-1')).toBe(false);
  });

  it('is true only for the run that holds the lease', () => {
    const lease = { runId: 'run-1', controller: new AbortController() };
    expect(ownsRun(lease, 'run-1')).toBe(true);
    expect(ownsRun(lease, 'run-2')).toBe(false);
  });
});

describe('skillsForMode', () => {
  it('leaves the host’s own selection alone outside Plan', () => {
    expect(skillsForMode('ask', ['craftkit.landing-page'])).toEqual(['craftkit.landing-page']);
    expect(skillsForMode('auto', undefined)).toBeUndefined();
  });

  it('adds the plan skill in Plan mode, keeping what the host pinned', () => {
    expect(skillsForMode('plan', ['craftkit.landing-page'])).toEqual([
      'craftkit.landing-page',
      PLAN_MODE_SKILL_ID,
    ]);
  });

  it('never adds it twice', () => {
    expect(skillsForMode('plan', [PLAN_MODE_SKILL_ID])).toEqual([PLAN_MODE_SKILL_ID]);
  });

  it('turns an empty selection into exactly the plan skill', () => {
    expect(skillsForMode('plan', undefined)).toEqual([PLAN_MODE_SKILL_ID]);
  });
});

describe('retrySkippedRequest', () => {
  it('names the skipped sections and nothing else', () => {
    const request = retrySkippedRequest(['Pricing', 'FAQ']);
    expect(request).toContain('“Pricing”, “FAQ”');
    expect(request).toContain('change nothing else');
  });

  it('never names a page, so a retry cannot scaffold a second one', () => {
    expect(retrySkippedRequest(['Pricing'])).not.toMatch(/landing page/i);
  });
});

describe('lastFollowUp', () => {
  it('finds nothing in an empty conversation', () => {
    expect(lastFollowUp([])).toBeUndefined();
  });

  it('reads the follow-up of the NEWEST answer', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'old' } }),
      you('b'),
      plan('c', { plan: { rationale: 'r', commands: [], followUp: 'new' } }),
    ];
    expect(lastFollowUp(turns)).toBe('new');
  });

  it('stops at the newest answer even when that one has none', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'old' } }),
      plan('c'),
    ];
    expect(lastFollowUp(turns)).toBeUndefined();
  });

  it('reads past a thinking bubble, so the strip does not go blank mid-sentence', () => {
    const turns = [
      plan('a', { plan: { rationale: 'r', commands: [], followUp: 'keep me' } }),
      thinking('b'),
    ];
    expect(lastFollowUp(turns)).toBe('keep me');
  });
});

describe('lastDropped', () => {
  it('finds nothing in an empty conversation', () => {
    expect(lastDropped([])).toBeUndefined();
  });

  it('finds nothing when the newest answer salvaged nothing', () => {
    expect(lastDropped([plan('a')])).toBeUndefined();
  });

  it('reads the steps the NEWEST answer lost', () => {
    expect(lastDropped([plan('a', { salvaged: { kept: 3, dropped } })])).toEqual(dropped);
  });

  it('lets a stale salvage go once a newer answer arrives', () => {
    const turns = [plan('a', { salvaged: { kept: 3, dropped } }), you('b'), plan('c')];
    expect(lastDropped(turns)).toBeUndefined();
  });

  it('reads past a thinking bubble, exactly as the follow-up does', () => {
    const turns = [plan('a', { salvaged: { kept: 3, dropped } }), thinking('b')];
    expect(lastDropped(turns)).toEqual(dropped);
  });

  it('ignores what the person wrote — only an answer can salvage', () => {
    expect(lastDropped([plan('a', { salvaged: { kept: 3, dropped } }), you('b')])).toEqual(dropped);
  });
});

/*
  ROUTING — the panel's one question before a run: build a page, or not?

  It used to be answered by keyword substrings over the skill registry, and the
  audit measured what that cost (agent-audit §2 P0-1, P1-5; `routing.mjs`,
  2026-09-28): "change the wedding date to June 12" scaffolded a whole page,
  while "Build a website for my bakery" never reached the build at all.
*/
describe('activatesBuildArchetype', () => {
  const registry = createCraftkitAiSkillRegistry();

  it('keeps an edit out of the build, however page-like its words (P0-1)', () => {
    for (const request of [
      'change the wedding date to June 12',
      'غيّر تاريخ الزفاف إلى ١٢ يونيو',
      'make the landing page darker',
      'update the homepage hero title to Hello',
      'fix spacing in the portfolio section',
      'add an invite friends button',
      'translate the about me section to Arabic',
      'change the resume download link',
    ]) {
      expect(activatesBuildArchetype(registry, request)).toBe(false);
    }
  });

  it('builds a page ask the keywords never matched (P1-5)', () => {
    for (const request of [
      'Build a website for my bakery',
      'سوي لي موقع لمطعم شاورما في عمان',
      'اعمل صفحه هبوط لتطبيق توصيل',
      'I need a web page for my restaurant',
      'اعمل موقع من 4 صفحات: الرئيسية، من نحن، الخدمات، تواصل',
    ]) {
      expect(activatesBuildArchetype(registry, request)).toBe(true);
    }
  });

  it('keeps the request the panel’s build tests send on the build', () => {
    expect(
      activatesBuildArchetype(registry, 'build me a landing page for my ceramics studio'),
    ).toBe(true);
  });

  it('reads the page when it is handed one: an empty page takes a bare subject as its brief', () => {
    const empty = createPlaygroundKernel({ fixture: 'empty' });
    const landing = createPlaygroundKernel({ fixture: 'landing' });
    expect(activatesBuildArchetype(registry, 'مطعم شاورما في عمان', { kernel: empty })).toBe(true);
    expect(activatesBuildArchetype(registry, 'مطعم شاورما في عمان', { kernel: landing })).toBe(
      false,
    );
  });
});

describe('routeRequest', () => {
  const skeleton = (): BuilderKernel => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    for (const label of ['Hero', 'Pricing', 'FAQ']) {
      kernel.dispatch('insertNode', {
        type: 'customCode',
        parentId: 'root',
        props: {
          label,
          tree: {
            kind: 'root',
            children: [
              {
                kind: 'element',
                tag: 'section',
                children: [{ kind: 'element', tag: 'h2', text: label }],
              },
            ],
          },
        },
      });
    }
    return kernel;
  };

  it('owns an empty page', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(routeRequest('Build a website for my bakery', { kernel })).toMatchObject({
      kind: 'build-page',
      target: 'replace',
    });
  });

  it('puts a page ask on the landing workspace beside it, not under it (P1-15)', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('اعمل صفحة هبوط لمقهى', { kernel })).toMatchObject({
      kind: 'build-page',
      target: 'new-page',
    });
    expect(routeRequest('make the landing page darker', { kernel }).kind).toBe('edit');
  });

  it('reads a skeleton nobody filled as a page to build', () => {
    expect(
      routeRequest('make me a landing page for my cafe', { kernel: skeleton() }),
    ).toMatchObject({ kind: 'build-page', target: 'replace' });
  });

  it('never lets the Built card’s retry rebuild the page it is filling', () => {
    const route = routeRequest(retrySkippedRequest(['Pricing', 'FAQ']), { kernel: skeleton() });
    expect(route.kind).toBe('edit');
  });

  it('reads the canvas selection as pointing at a block', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app', { kernel }).kind).toBe('build-page');
    kernel.setSelection(['hero']);
    expect(routeRequest('landing for my app', { kernel }).kind).toBe('edit');
  });

  it('prefers the selection it is handed over the kernel’s', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app', { kernel, selection: ['hero'] }).kind).toBe('edit');
  });

  it('reads an @mention as pointing, exactly as the run does', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app @hero', { kernel }).kind).toBe('edit');
  });

  it('does not count the page itself as a pointed-at block', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    kernel.setSelection([kernel.getDocument().rootId]);
    expect(routeRequest('a bakery in Amman', { kernel }).kind).toBe('build-page');
  });

  it('routes on the words alone when it is handed no page', () => {
    expect(routeRequest('Build a website for my bakery')).toMatchObject({
      kind: 'build-page',
      target: 'new-page',
    });
  });
});

/*
  What the panel DOES with a route (2026-09-28). The router decides what a
  request is for; this is the one place that turns that into a path the panel
  can take today — which is not always the one the words asked for, and when it
  is not, the build carries a notice saying so rather than quietly doing
  something else.
*/
describe('requestPath', () => {
  const route = (
    kind: builder.IntentRoute['kind'],
    target?: builder.IntentTarget,
  ): builder.IntentRoute => ({
    kind,
    confidence: 0.85,
    reason: 'test',
    ...(target === undefined ? {} : { target }),
  });
  const EMPTY = { holdsContent: false, canStartOver: true };
  const FULL = { holdsContent: true, canStartOver: true };
  /*
    The playground's own provider (planProviderFromEnv → retrying/caching) has
    no \`proposePagePlan\`, so every build it runs takes the SCAFFOLD path — and
    that path lays its skeleton after what is there whatever the target says
    (wave-2 verifier, scaffold-replace.mjs, 2026-09-28: "start over" over one
    region left the page "Existing, Hero, Proof, Pricing").
  */
  const FULL_SCAFFOLD_ONLY = { holdsContent: true, canStartOver: false };

  it('builds a page where the router put it, with nothing to confess', () => {
    expect(requestPath(route('build-page', 'replace'), EMPTY)).toEqual({
      path: 'build',
      target: 'replace',
      notices: [],
      confirm: false,
    });
    expect(requestPath(route('build-page', 'append'), FULL)).toEqual({
      path: 'build',
      target: 'append',
      notices: [],
      confirm: false,
    });
  });

  it('builds BELOW the page when a new page was asked for, and says so', () => {
    /*
      The panel is handed one page lens and no site: App passes
      `siteKernel.page(currentPage)`, so there is no page it could open. Building
      under the content is the honest fallback only while the card says it.
    */
    expect(requestPath(route('build-page', 'new-page'), FULL)).toEqual({
      path: 'build',
      target: 'append',
      notices: ['new-page-appended'],
      confirm: false,
    });
  });

  it('builds a site ask as ONE page, and says so', () => {
    expect(requestPath(route('build-site', 'replace'), EMPTY)).toEqual({
      path: 'build',
      target: 'replace',
      notices: ['site-as-one-page'],
      confirm: false,
    });
    expect(requestPath(route('build-site', 'new-page'), FULL)).toEqual({
      path: 'build',
      target: 'append',
      notices: ['site-as-one-page', 'new-page-appended'],
      confirm: false,
    });
  });

  it('answers a question with words and no write', () => {
    expect(requestPath(route('question'), FULL)).toEqual({ path: 'answer' });
  });

  it('keeps ONE new section on the one-call path', () => {
    /*
      The router's add-section is "one new section". A build needs two to split
      and falls back to this same one call after paying for a scaffold first —
      a second model call in front of every "add a pricing section".
    */
    expect(requestPath(route('add-section', 'append'), FULL)).toEqual({ path: 'run' });
    expect(requestPath(route('edit'), FULL)).toEqual({ path: 'run' });
  });

  it('never builds without a target: an unknown one appends, the old default', () => {
    expect(requestPath(route('build-page'), EMPTY)).toEqual({
      path: 'build',
      target: 'append',
      notices: [],
      confirm: false,
    });
  });

  it('ASKS before a build that starts a page with content over — in every writing mode', () => {
    /*
      The engine's PagePlan path removes the page's children in the skeleton's
      own transaction on 'replace' (2026-09-28). The router says 'replace' over
      content only for "start over"-like words — at 0.5 for "start over" alone —
      and a misread there must never wipe a page without a question, Auto included.
    */
    expect(requestPath(route('build-page', 'replace'), FULL)).toEqual({
      path: 'build',
      target: 'replace',
      notices: ['starts-over'],
      confirm: true,
    });
  });

  it('never asks extra on an empty page: there is nothing to lose', () => {
    expect(requestPath(route('build-page', 'replace'), EMPTY)).toMatchObject({ confirm: false });
  });

  it('never promises a start-over the build cannot do: it appends, says so, and asks nothing', () => {
    /*
      Asking "start over?" and then appending was the defect: the person
      confirmed a removal that never happened, and the card promised that
      "anything replaced comes back with one Undo" when nothing was replaced.
      Nothing will be removed, so there is nothing to confirm.
    */
    expect(requestPath(route('build-page', 'replace'), FULL_SCAFFOLD_ONLY)).toEqual({
      path: 'build',
      target: 'append',
      notices: ['appended-not-replaced'],
      confirm: false,
    });
  });

  it('keeps an empty page’s build as it was when the build cannot start over — nothing is there', () => {
    expect(
      requestPath(route('build-page', 'replace'), { holdsContent: false, canStartOver: false }),
    ).toEqual({ path: 'build', target: 'replace', notices: [], confirm: false });
  });
});

/*
  Suggestions phrased as questions (wave-2 verifier, route-probe.mjs,
  2026-09-28): the router read "how about…", "what if…", "why not…", "what
  about…", "is it possible to…" and "ليش ما…" as interrogatives at 0.9, so the
  panel sent them to a words-only answer with no Apply — where the one-call run
  had made the edit before the router existed. The router's lexicon now reads
  them as requests (its owner, 09:00 the same morning); these pin that at the
  panel's boundary, through the scene the panel routes with, because the panel
  sends every 'question' to a run that cannot write.
*/
describe('routeRequest — a suggestion is a request', () => {
  const landing = (): BuilderKernel => createPlaygroundKernel({ fixture: 'landing' });

  it.each([
    ['how about making the button blue?', 'edit'],
    ['what if the hero said Welcome home?', 'edit'],
    ['why not add a pricing section?', 'add-section'],
    ['what about a darker background?', 'edit'],
    ['is it possible to change the font to Inter?', 'edit'],
    ["why don't you add a testimonials section?", 'add-section'],
    ['ليش ما تضيف قسم آراء العملاء؟', 'add-section'],
    ['ليش لا تغير لون الزر؟', 'edit'],
  ] as const)('reads “%s” as a request (%s), not a question', (request, kind) => {
    expect(routeRequest(request, { kernel: landing() }).kind).toBe(kind);
  });

  it('keeps a real question a question', () => {
    const kernel = landing();
    expect(routeRequest('how do I change the font on this page?', { kernel }).kind).toBe(
      'question',
    );
    expect(routeRequest('what is a hero section?', { kernel }).kind).toBe('question');
    expect(routeRequest('why is the page so slow?', { kernel }).kind).toBe('question');
  });

  it('never turns a suggestion into a whole-page build: “what about SEO?” on an empty page is asked, not built', () => {
    /*
      On an empty page the router reads any bare phrase as the brief for a page
      (0.6). A suggestion is at most an edit or a section; a guessed build from
      one would spend minutes answering a question.
    */
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(routeRequest('what about SEO?', { kernel }).kind).toBe('question');
  });
});

/*
  Why a section was not put back, as the card says it. The engine's
  'not-landed' covers two different facts (build-revert.ts): a section that
  never landed, and one that landed with nothing recorded before it — a region
  a PagePlan skeleton wrote in full. Said as "never landed", the second is
  false: the section is on the page (wave-2 verifier, 2026-09-28).
*/
describe('revertRefusalOf', () => {
  const reportOf = (status: AiBuildTaskReport['status'], attempts: number): AiBuildTaskReport => ({
    id: 'r1',
    title: 'Footer',
    status,
    attempts,
  });

  it('says a LANDED section with nothing to put back was written with the layout', () => {
    const cause = new AiBuildRevertError('not-landed', 'no recorded value');
    expect(revertRefusalOf(cause, reportOf('applied', 0))).toBe('no-earlier-version');
  });

  it('keeps "not landed" for a section that really did not', () => {
    const cause = new AiBuildRevertError('not-landed', 'never landed');
    expect(revertRefusalOf(cause, reportOf('skipped', 2))).toBe('not-landed');
  });

  it('passes the engine’s other reasons through', () => {
    expect(
      revertRefusalOf(new AiBuildRevertError('changed-since', 'x'), reportOf('applied', 1)),
    ).toBe('changed-since');
    expect(
      revertRefusalOf(new AiBuildRevertError('region-missing', 'x'), reportOf('applied', 1)),
    ).toBe('region-missing');
  });

  it('reads anything else as the door refusing the write', () => {
    expect(revertRefusalOf(new Error('site/structural-violation'), reportOf('applied', 1))).toBe(
      'refused',
    );
  });
});

describe('the intent router through the facade', () => {
  it('reaches the app from @craftkit/builder, as ADR 0003 requires', () => {
    expect(typeof builder.routeIntent).toBe('function');
    expect(typeof builder.summarizeDocumentForIntent).toBe('function');
    expect(typeof builder.normalizeIntentText).toBe('function');
    expect(builder.isBuildIntent(builder.routeIntent({ request: 'build a site' }))).toBe(true);
  });
});
