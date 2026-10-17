/**
 * A site in several languages, on the playground's own landing and extensions: the host adds
 * a page per language through the site kernel's door, writes the reciprocal alternates, the
 * links and the switcher in one transaction, and keeps the site valid.
 */
import { createSiteBuilder, pageContext, siteFromDocument } from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { marketingLanding, playgroundExtensions } from '../../preview/create-playground-kernel';
import { createLanguageVersions } from './language-versions';

function arabicSite() {
  return createSiteBuilder({
    site: siteFromDocument(marketingLanding('rtl')),
    extensions: playgroundExtensions('landing'),
    ports: { clock: fixedClock(), ids: seededIds('language-versions') },
  });
}

function rootProps(siteKernel: ReturnType<typeof arabicSite>, address: string) {
  const page = siteKernel.getSite().pages.find((entry) => entry.address === address);
  const document = page?.document;
  return document === undefined ? {} : (document.nodes[document.rootId]?.props ?? {});
}

describe('createLanguageVersions', () => {
  it('adds an English version of an Arabic site: a page, alternates both ways, one Undo', () => {
    const siteKernel = arabicSite();
    const port = createLanguageVersions(siteKernel);
    const result = port.add({ languages: ['ar', 'en'], scope: 'site' });

    expect(result.source).toBe('ar');
    expect(result.created.map(({ address, lang }) => `${lang} ${address}`)).toEqual(['en /en']);
    const english = siteKernel.getSite().pages.find(({ address }) => address === '/en');
    expect(english?.title).toContain('English');
    const alternates = [
      { lang: 'ar', path: '/' },
      { lang: 'en', path: '/en' },
    ];
    expect(rootProps(siteKernel, '/')['seo']).toMatchObject({ alternates });
    expect(rootProps(siteKernel, '/en')['seo']).toMatchObject({ alternates });
    expect(siteKernel.validate().ok).toBe(true);
    const last = siteKernel.transactions().at(-1);
    expect(last?.author).toBe('ai');
  });

  it('gives the version its own direction once it is English, while the site stays rtl', () => {
    const siteKernel = arabicSite();
    const [version] = createLanguageVersions(siteKernel).add({
      languages: ['en'],
      scope: 'page',
    }).created;
    if (version === undefined) throw new Error('No version was made.');
    const root = version.kernel.getDocument().rootId;
    version.kernel.dispatch('setProp', { id: root, key: 'lang', value: 'en' });
    expect(pageContext(version.kernel).locale).toEqual({ lang: 'en', dir: 'ltr' });
    expect(siteKernel.getSite().dir).toBe('rtl');
    expect(siteKernel.validate().ok).toBe(true);
  });

  it('adds only what is missing when asked again, and lists only source pages', () => {
    const siteKernel = arabicSite();
    const port = createLanguageVersions(siteKernel);
    port.add({ languages: ['en'], scope: 'site' });
    const again = port.add({ languages: ['en', 'fr'], scope: 'site' });
    expect(again.existing.map(({ address }) => address)).toEqual(['/en']);
    expect(again.created.map(({ address }) => address)).toEqual(['/fr']);
    expect(rootProps(siteKernel, '/en')['seo']).toMatchObject({
      alternates: [
        { lang: 'ar', path: '/' },
        { lang: 'en', path: '/en' },
        { lang: 'fr', path: '/fr' },
      ],
    });
    expect(port.pages().map(({ address }) => address)).toEqual(['/']);
  });

  it('shows a version on the canvas when asked', () => {
    const siteKernel = arabicSite();
    const [version] = createLanguageVersions(siteKernel).add({
      languages: ['en'],
      scope: 'site',
    }).created;
    version?.show();
    expect(siteKernel.currentPage()).toBe(version?.pageId);
  });
});
