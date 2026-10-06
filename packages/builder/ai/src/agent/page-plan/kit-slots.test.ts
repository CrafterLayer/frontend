import { describe, expect, it } from 'vitest';

import { checkKitSlots } from '../../section-kit';
import { completeKitSlots, fillSlotPhotos, pagePhotoPlan, repairedHref } from './kit-slots';
import { planKit } from './kits';
import type { SectionContract } from './types';

/*
  Kit slots completed by code (quality pass 2026-10-05): every measure-v2 run
  spent a repair round on `kit "features-bento" needs slot "caption"`, and the
  Arabic page showed one stock photo in the hero and again in the features.
*/

function kit(id: string) {
  const found = planKit(id);
  if (found === undefined) throw new Error(`no kit ${id}`);
  return found;
}

const CONTRACT: Pick<SectionContract, 'title' | 'purpose' | 'mustSay' | 'images'> = {
  title: 'Why teams switch',
  purpose: 'Show the two things it does best.',
  mustSay: ['Ship in half the time'],
  images: [{ subject: 'tech', aspect: 'landscape', alt: 'A laptop on a desk' }],
};
const CTA = { label: 'Start free trial', href: '#pricing' };

describe('completeKitSlots', () => {
  it('fills the features-bento caption the writer left out, so the step instantiates without a repair', () => {
    const bento = kit('features-bento');
    const written = {
      title: 'Why teams switch',
      image: { subject: 'tech', alt: 'A laptop' },
      items: [
        { icon: 'zap', title: 'Fast', text: 'Quick.' },
        { icon: 'not-an-icon-at-all', title: 'Clear', text: 'Plain.' },
      ],
    };
    expect(checkKitSlots(bento, written).ok).toBe(false);
    const { slots, changes } = completeKitSlots(bento, written, { contract: CONTRACT, primaryCta: CTA });
    expect(slots['caption']).toBe('Ship in half the time');
    expect((slots['items'] as { icon: string }[])[1]?.icon).toBe('check');
    expect(changes.length).toBeGreaterThan(0);
    expect(checkKitSlots(bento, slots).ok).toBe(true);
  });

  it("gives a cta kit's missing required link the page's action, and drops a broken optional one", () => {
    const split = kit('cta-split');
    const { slots } = completeKitSlots(
      split,
      { title: 'Ready to ship', cta2: { label: 'Docs', href: 'javascript:alert(1)' } },
      { contract: CONTRACT, primaryCta: CTA },
    );
    expect(slots['cta']).toEqual(CTA);
    expect(slots).not.toHaveProperty('cta2');
    expect(checkKitSlots(split, slots).ok).toBe(true);
  });

  it('leaves a required list with no content for the repair round — the contract cannot write it', () => {
    const bento = kit('features-bento');
    const { slots } = completeKitSlots(bento, { title: 'x' }, { contract: CONTRACT, primaryCta: CTA });
    expect(slots).not.toHaveProperty('items');
    expect(checkKitSlots(bento, slots).ok).toBe(false);
  });

  it("puts the page's action first among a booking section's contact channels (measure-v2: a 6 s repair)", () => {
    const contact = kit('contact-split');
    const action = { label: 'احجز الآن', href: '#booking' };
    const written = {
      heading: 'احجز طاولتك الآن',
      channels: [
        { icon: 'phone', label: 'الهاتف', href: 'tel:+96264612750' },
        { icon: 'message-circle', label: 'واتساب', href: 'https://wa.me/96264612750' },
      ],
    };
    const { slots } = completeKitSlots(contact, written, {
      contract: { ...CONTRACT, title: 'احجز طاولتك الآن', role: 'cta' },
      primaryCta: action,
    });
    expect(slots['title']).toBe('احجز طاولتك الآن');
    expect((slots['channels'] as unknown[])[0]).toEqual({ label: 'احجز الآن', href: '#booking', icon: 'calendar' });
    expect(slots['channels']).toHaveLength(3);
    expect(checkKitSlots(contact, slots).ok).toBe(true);
    // A band is not asked to carry the action.
    const band = completeKitSlots(contact, written, { contract: { ...CONTRACT, role: 'band' }, primaryCta: action });
    expect(band.slots['channels']).toHaveLength(2);
  });

  it('gives a pricing tier whose button says href "#" the action address, keeping every tier (run 1 lost two)', () => {
    const tiers = kit('pricing-tiers');
    const tier = (name: string) => ({ name, price: '$29', features: ['A'], cta: { label: 'Start free trial', href: '#' } });
    const written = { title: 'Pricing', items: [tier('Starter'), tier('Pro'), tier('Team')] };
    const { slots } = completeKitSlots(tiers, written, { contract: CONTRACT, primaryCta: CTA });
    expect(slots['items']).toHaveLength(3);
    expect((slots['items'] as { cta: unknown }[])[1]?.cta).toEqual({ label: 'Start free trial', href: '#pricing' });
    expect(checkKitSlots(tiers, slots).ok).toBe(true);
    // An item missing its words is not dropped: the list stays as written for the repair round.
    const short = { title: 'Pricing', items: [tier('Starter'), { price: '$9', features: ['A'], cta: CTA }] };
    expect(completeKitSlots(tiers, short, { contract: CONTRACT, primaryCta: CTA }).slots['items']).toBe(short.items);
  });

  it('repairs an address one step from right instead of spending a repair round (measure-v3 run 2)', () => {
    expect(repairedHref('https://wa.me/962794612750?text=احجز طاولة')).toBe(
      `https://wa.me/962794612750?text=${encodeURIComponent('احجز')}%20${encodeURIComponent('طاولة')}`,
    );
    expect(repairedHref('wa.me/962794612750')).toBe('https://wa.me/962794612750');
    expect(repairedHref('+962 6 461 2750')).toBe('tel:+96264612750');
    expect(repairedHref('#')).toBeUndefined();
    const contact = kit('contact-split');
    const { slots } = completeKitSlots(
      contact,
      {
        title: 'احجز طاولة',
        channels: [{ icon: 'message-circle', label: 'واتساب', href: 'https://wa.me/962794612750?text=احجز طاولة' }],
      },
      { contract: CONTRACT },
    );
    expect(checkKitSlots(contact, slots).ok).toBe(true);
  });

  it('gives a required photo on a type-led contract the page’s best catalog subject', () => {
    const bento = kit('features-bento');
    const written = { title: 'أطباقنا', caption: 'مشاوي', items: [{ icon: 'flame', title: 'كباب' }] };
    const typeLed = { ...CONTRACT, title: 'أطباقنا', images: [] };
    expect(completeKitSlots(bento, written, { contract: typeLed }).slots).not.toHaveProperty('image');
    const { slots } = completeKitSlots(bento, written, { contract: typeLed, pageBrief: 'مطعم مشاوي في عمّان' });
    expect(slots['image']).toEqual({ subject: 'restaurant', alt: 'أطباقنا' });
  });

  it('returns the same object when nothing needs doing', () => {
    const split = kit('cta-split');
    const written = { title: 'Ready', cta: CTA };
    expect(completeKitSlots(split, written, { contract: CONTRACT }).slots).toBe(written);
  });
});

describe('photos: one catalog photo per image, never twice on a page', () => {
  const plan = {
    sections: [
      { key: 'hero', images: [{ subject: 'restaurant' as const, aspect: 'landscape' as const, alt: 'طاولة مشاوي' }] },
      { key: 'dishes', images: [{ subject: 'restaurant' as const, aspect: 'landscape' as const, alt: 'أطباق' }] },
      { key: 'menu' },
    ],
  };

  it('assigns two sections asking for the same subject two different photos', () => {
    const photos = pagePhotoPlan(plan);
    const hero = photos.bySection.get('hero')?.[0]?.url;
    const dishes = photos.bySection.get('dishes')?.[0]?.url;
    expect(hero).toBeDefined();
    expect(dishes).toBeDefined();
    expect(hero).not.toBe(dishes);
    expect(pagePhotoPlan(plan)).toBe(photos);
  });

  it("writes each section's assigned address into its image slots, keeping a person's own src", () => {
    const photos = pagePhotoPlan(plan);
    const overlay = kit('hero-overlay');
    const bento = kit('features-bento');
    const hero = fillSlotPhotos(overlay, { title: 't', image: { subject: 'restaurant', alt: 'a' } }, 'hero', photos, 'ar');
    const dishes = fillSlotPhotos(bento, { title: 't', image: { subject: 'restaurant', alt: 'b' } }, 'dishes', photos, 'ar');
    expect((hero['image'] as { src: string }).src).toBe(photos.bySection.get('hero')?.[0]?.url);
    expect((dishes['image'] as { src: string }).src).toBe(photos.bySection.get('dishes')?.[0]?.url);
    const own = { title: 't', image: { src: 'https://example.com/mine.jpg', alt: 'mine' } };
    expect(fillSlotPhotos(overlay, own, 'hero', photos, 'ar')).toBe(own);
  });

  it('a section with no assigned photo takes a free one, never one another section shows', () => {
    const photos = pagePhotoPlan(plan);
    const bento = kit('features-bento');
    const menu = fillSlotPhotos(bento, { image: { subject: 'restaurant', alt: 'c' } }, 'menu', photos, 'en');
    const src = (menu['image'] as { src: string }).src;
    expect(src).toMatch(/^https:\/\//u);
    expect(photos.used.has(src)).toBe(false);
  });
});
