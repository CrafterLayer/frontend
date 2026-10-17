import { describe, expect, it, vi } from 'vitest';

import type { AiPlanProvider, AiSitePlanProposal } from '../../types';
import { AI_SITE_MAX_PAGES, planAiSite, sitePlanFromRequest, validateSitePlan } from './index';

function titles(request: string): readonly string[] | null {
  return sitePlanFromRequest(request)?.pages.map(({ title }) => title) ?? null;
}

describe('sitePlanFromRequest — the pages a request names or counts', () => {
  it.each<readonly [string, readonly string[]]>([
    [
      'Build a 4-page website: home, about, services, contact',
      ['Home', 'About', 'Services', 'Contact'],
    ],
    [
      'Create a website for my bakery with about, menu and contact pages',
      ['Home', 'About', 'Menu', 'Contact'],
    ],
    [
      'A website with pages: About us, Services and Contact us',
      ['Home', 'About us', 'Services', 'Contact us'],
    ],
    ['Build a 3-page site: about, services, contact', ['About', 'Services', 'Contact']],
    ['Build a 4-page website for my studio', ['Home', 'About', 'Services', 'Contact']],
    ['Make a five page website', ['Home', 'About', 'Services', 'Contact', 'Portfolio']],
    ['I need a multi-page website for my clinic', ['Home', 'About', 'Services', 'Contact']],
    ['Build a 3-page website with a pricing page', ['Home', 'Pricing', 'About']],
    ['Build a 4-page website: modern, clean and fast', ['Home', 'About', 'Services', 'Contact']],
    ['Build a site with contact, home and faq pages', ['Home', 'Contact', 'FAQ']],
    // T230c: the languages a bilingual site is asked in are not pages.
    [
      'Build a 3-page website: home, about, contact, in English and Arabic',
      ['Home', 'About', 'Contact'],
    ],
    [
      'Build a website with home, about and contact pages in Arabic and English',
      ['Home', 'About', 'Contact'],
    ],
  ])('%s', (request, expected) => {
    expect(titles(request)).toEqual(expected);
  });

  it.each<readonly [string, readonly string[]]>([
    [
      'اعمل موقع من 4 صفحات: الرئيسية، من نحن، الخدمات، تواصل',
      ['الرئيسية', 'من نحن', 'الخدمات', 'تواصل'],
    ],
    ['اعمل موقع لمخبزي من 4 صفحات', ['الرئيسية', 'من نحن', 'الخدمات', 'تواصل معنا']],
    ['سوي موقع فيه صفحة رئيسية ومن نحن وخدماتنا وتواصل', ['رئيسية', 'من نحن', 'خدماتنا', 'تواصل']],
    ['اعمل موقع من صفحتين: من نحن والخدمات', ['من نحن', 'الخدمات']],
    [
      'اعمل موقع من 3 صفحات: الرئيسية، من نحن، تواصل بالعربي والإنجليزي',
      ['الرئيسية', 'من نحن', 'تواصل'],
    ],
    ['أريد موقعًا من ثلاث صفحات لعيادتي', ['الرئيسية', 'من نحن', 'الخدمات']],
    ['صمم موقع بصفحات الرئيسية والوظائف والمدونة', ['الرئيسية', 'الوظائف', 'المدونة']],
  ])('%s', (request, expected) => {
    expect(titles(request)).toEqual(expected);
  });

  it('caps a site at eight pages, home first', () => {
    const many = titles('Build a 12-page website for my agency');
    expect(many).toHaveLength(AI_SITE_MAX_PAGES);
    expect(many?.[0]).toBe('Home');
    const named = titles(
      'Build a website with pages: home, about, services, contact, blog, pricing, team, gallery, careers, news',
    );
    expect(named).toHaveLength(AI_SITE_MAX_PAGES);
  });

  it("plans the owner's four when the router already read a site the words do not count", () => {
    expect(sitePlanFromRequest('Build a website with pages for my shop')).toBeNull();
    expect(
      sitePlanFromRequest('Build a website with pages for my shop', {
        assumeSite: true,
      })?.pages.map(({ title }) => title),
    ).toEqual(['Home', 'Shop', 'About', 'Services']);
    expect(sitePlanFromRequest('Build a one-page website', { assumeSite: true })).toBeNull();
  });

  it.each([
    'Build a landing page for my bakery',
    'Build a one-page website for my bakery',
    'اعمل صفحة واحدة لمطعمي',
    'Build me a homepage',
    'Make the hero blue',
  ])('one page is not a site: %s', (request) => {
    expect(sitePlanFromRequest(request)).toBeNull();
  });

  it('gives each page its own brief, in the request language, carrying the site', () => {
    const english = sitePlanFromRequest(
      'Build a 4-page website for my bakery «Crumbs»: home, about, services, contact',
    );
    expect(english?.locale).toBe('en');
    expect(english?.source).toBe('words');
    expect(english?.pages[1]?.request).toBe(
      "The About page of a 4-page website. The site: Build a website for my bakery «Crumbs». Its pages: Home, About, Services, Contact. Build only this page, in the site's own brand and style.",
    );
    const arabic = sitePlanFromRequest(
      'اعمل موقع لمخبز كرمز من 4 صفحات: الرئيسية، من نحن، الخدمات، تواصل',
    );
    expect(arabic?.locale).toBe('ar');
    expect(arabic?.pages[1]?.request).toBe(
      'صفحة «من نحن» من موقع من 4 صفحات. الموقع: اعمل موقع لمخبز كرمز. صفحاته: الرئيسية، من نحن، الخدمات، تواصل. ابنِ هذه الصفحة وحدها، بهوية الموقع وأسلوبه.',
    );
    // The first page is the home page, said when its name does not say so.
    expect(
      sitePlanFromRequest('Build a 3-page site: about, services, contact')?.pages[0]?.request,
    ).toContain('The About page (the home page)');
  });
});

describe('validateSitePlan', () => {
  const page = (title: string): { title: string; request: string } => ({
    title,
    request: `The ${title} page of the bakery site.`,
  });

  it('keeps titled, briefed pages, drops repeats and blanks, caps at eight', () => {
    const result = validateSitePlan({
      pages: [
        page('Home'),
        page('home'),
        { title: '', request: 'x' },
        { title: 'About', request: '  ' },
        ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(page),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pages.map(({ title }) => title)).toEqual([
      'Home',
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
    ]);
  });

  it('refuses fewer than two pages, and anything that is no plan', () => {
    expect(validateSitePlan({ pages: [page('Home')] }).ok).toBe(false);
    expect(validateSitePlan({ pages: 'Home, About' }).ok).toBe(false);
    expect(validateSitePlan(null).ok).toBe(false);
  });
});

describe('planAiSite', () => {
  const REQUEST = 'Build a 4-page website: home, about, services, contact';

  function siteProvider(answer: () => Promise<AiSitePlanProposal>): AiPlanProvider {
    return {
      propose: () => Promise.reject(new Error('A site plan asks no plan.')),
      proposeSitePlan: answer,
    };
  }

  it("uses the provider's plan when it validates", async () => {
    const proposeSitePlan = vi.fn(() =>
      Promise.resolve({
        pages: [
          { title: 'Welcome', request: 'The bakery home page.' },
          { title: 'Our bread', request: 'The bakery bread page.' },
        ],
      }),
    );
    const plan = await planAiSite({ request: REQUEST, provider: siteProvider(proposeSitePlan) });
    expect(plan?.source).toBe('model');
    expect(plan?.pages.map(({ title }) => title)).toEqual(['Welcome', 'Our bread']);
    expect(proposeSitePlan).toHaveBeenCalledTimes(1);
  });

  it('falls back to the words when the provider fails or answers badly', async () => {
    for (const answer of [
      () => Promise.reject(new Error('The server is down.')),
      () => Promise.resolve({ pages: [] }),
    ]) {
      const plan = await planAiSite({ request: REQUEST, provider: siteProvider(answer) });
      expect(plan?.source).toBe('words');
      expect(plan?.pages.map(({ title }) => title)).toEqual([
        'Home',
        'About',
        'Services',
        'Contact',
      ]);
    }
    const plain = await planAiSite({
      request: REQUEST,
      provider: { propose: () => Promise.reject(new Error('unused')) },
    });
    expect(plain?.source).toBe('words');
  });

  it('a Stop is a Stop, never a plan from the words', async () => {
    const stop = new AbortController();
    const provider = siteProvider(() => {
      stop.abort();
      const error = new Error('aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });
    await expect(
      planAiSite({ request: REQUEST, provider, signal: stop.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
