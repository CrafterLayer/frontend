import { describe, expect, it } from 'vitest';

import { mailHref, mapEmbedSrc, mapsHref, telHref, whatsappHref } from './location-links';

describe('location links', () => {
  it('dials the digits, keeping one leading plus', () => {
    expect(telHref('+966 11 456-7890')).toBe('tel:+966114567890');
    expect(telHref('(020) 7946 0958')).toBe('tel:02079460958');
    expect(telHref('12')).toBeUndefined();
    expect(telHref(undefined)).toBeUndefined();
  });

  it('mails a plausible address and nothing else', () => {
    expect(mailHref(' hello@example.com ')).toBe('mailto:hello@example.com');
    expect(mailHref('not an email')).toBeUndefined();
    expect(mailHref('a@b')).toBeUndefined();
    expect(mailHref(undefined)).toBeUndefined();
  });

  it('opens a WhatsApp chat in international form, with an optional first message', () => {
    expect(whatsappHref('+966 50 123 4567')).toBe('https://wa.me/966501234567');
    expect(whatsappHref('+966 50 123 4567', ' مرحبًا، أود الطلب ')).toBe(
      `https://wa.me/966501234567?text=${encodeURIComponent('مرحبًا، أود الطلب')}`,
    );
    expect(whatsappHref('+966 50 123 4567', '   ')).toBe('https://wa.me/966501234567');
    expect(whatsappHref('12345')).toBeUndefined();
    expect(whatsappHref(undefined)).toBeUndefined();
  });

  it('searches OpenStreetMap for the address, or pins the coordinates', () => {
    expect(mapsHref('7 Rue des Fleurs,\n69002 Lyon')).toBe(
      `https://www.openstreetmap.org/search?query=${encodeURIComponent('7 Rue des Fleurs, 69002 Lyon')}`,
    );
    expect(mapsHref('anything', 50.7989, -1.0912)).toBe(
      'https://www.openstreetmap.org/?mlat=50.7989&mlon=-1.0912#map=17/50.7989/-1.0912',
    );
    /* Half a coordinate, or one out of range, is no pin. */
    expect(mapsHref('Lyon', 45.76)).toContain('/search?query=Lyon');
    expect(mapsHref('Lyon', 95, 4)).toContain('/search?query=Lyon');
    expect(mapsHref('Lyon', 45, Number.NaN)).toContain('/search?query=Lyon');
  });

  it('embeds only around coordinates', () => {
    expect(mapEmbedSrc(50.7989, -1.0912)).toBe(
      'https://www.openstreetmap.org/export/embed.html?bbox=-1.0962%2C50.7959%2C-1.0862%2C50.8019&layer=mapnik&marker=50.7989%2C-1.0912',
    );
    expect(mapEmbedSrc()).toBeUndefined();
    expect(mapEmbedSrc(10)).toBeUndefined();
    expect(mapEmbedSrc(10, 200)).toBeUndefined();
  });
});
