import { describe, expect, it } from 'vitest';

import { fivePageSite } from '@craftkit/builder-schema/testing';

import { projectPageRoutes, resolvePageHref, resolvePageLinks } from './resolve-page-links';

describe('page link resolution', () => {
  it('resolves identity against the current address without changing source', () => {
    const site = fivePageSite();
    site.pages[0]!.document.nodes['intro']!.props['cta'] = {
      kind: 'page',
      pageId: 'about',
      fragment: 'our team',
    };
    expect(resolvePageLinks(site).pages[0]?.document.nodes['intro']?.props['cta']).toBe(
      '/about#our%20team',
    );
    expect(site.pages[0]?.document.nodes['intro']?.props['cta']).toEqual({
      kind: 'page',
      pageId: 'about',
      fragment: 'our team',
    });
    site.pages.find((page) => page.id === 'about')!.address = '/studio';
    expect(resolvePageLinks(site).pages[0]?.document.nodes['intro']?.props['cta']).toBe(
      '/studio#our%20team',
    );
  });

  it('resolves nested and responsive links but leaves literal URLs alone', () => {
    const site = fivePageSite();
    const home = site.pages.find((page) => page.id === 'home')!;
    home.document.nodes['intro']!.props = {
      external: 'https://example.com/about',
      links: [{ label: 'Work', destination: { kind: 'page', pageId: 'work' } }],
    };
    home.document.nodes['intro']!.responsive = {
      mobile: { destination: { kind: 'page', pageId: 'contact' } },
    };
    const projected = resolvePageLinks(site);
    expect(
      projected.pages.find((page) => page.id === 'home')?.document.nodes['intro']?.props,
    ).toEqual({
      external: 'https://example.com/about',
      links: [{ label: 'Work', destination: '/work' }],
    });
    expect(
      projected.pages.find((page) => page.id === 'home')?.document.nodes['intro']?.responsive
        ?.mobile,
    ).toEqual({ destination: '/contact' });
  });

  it('fails closed for a missing identity', () => {
    expect(() => resolvePageHref(fivePageSite(), { kind: 'page', pageId: 'removed' })).toThrow(
      /does not exist/,
    );
  });

  it('projects reserved-looking ids without inherited object fields', () => {
    const site = fivePageSite();
    site.pages[0]!.id = 'constructor';
    const routes = projectPageRoutes(site);
    expect(Object.getPrototypeOf(routes)).toBeNull();
    expect(routes.constructor).toEqual({ pageId: 'constructor', address: '/work' });
  });

  it('retains site identity when no page links exist', () => {
    const site = fivePageSite();
    expect(resolvePageLinks(site)).toBe(site);
  });
});
