/**
 * The links a location section builds from plain text: a `tel:` number, a
 * WhatsApp chat, an OpenStreetMap search or pin, and the OpenStreetMap embed.
 *
 * Pure and React-free. Every address is OpenStreetMap's own: no API key, no
 * tracking parameters, and nothing loads from a third party unless the person
 * turns the embed on. A value that cannot make a safe link makes none
 * (`undefined`), so a half-typed number never becomes a broken href.
 */

const OSM = 'https://www.openstreetmap.org';

/** `+966 11 456-7890` → `tel:+966114567890`; `undefined` without enough digits. */
export function telHref(phone: string | undefined): string | undefined {
  if (phone === undefined) return undefined;
  const digits = phone.replace(/[^0-9]/gu, '');
  if (digits.length < 3) return undefined;
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/** `name@example.com` → `mailto:name@example.com`; `undefined` for anything else. */
export function mailHref(email: string | undefined): string | undefined {
  if (email === undefined) return undefined;
  const address = email.trim();
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/u.test(address) ? `mailto:${address}` : undefined;
}

/**
 * A WhatsApp chat (`https://wa.me/<digits>`), with an optional first message.
 * wa.me takes the number in international form without the plus.
 */
export function whatsappHref(number: string | undefined, message?: string): string | undefined {
  if (number === undefined) return undefined;
  const digits = number.replace(/[^0-9]/gu, '');
  if (digits.length < 6) return undefined;
  const text = message?.trim() ?? '';
  return `https://wa.me/${digits}${text === '' ? '' : `?text=${encodeURIComponent(text)}`}`;
}

function hasCoordinates(latitude?: number, longitude?: number): latitude is number {
  return (
    latitude !== undefined &&
    longitude !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** The "Open in Maps" link: a pin at the coordinates when given, else a search for the address. */
export function mapsHref(address: string, latitude?: number, longitude?: number): string {
  if (hasCoordinates(latitude, longitude) && longitude !== undefined) {
    const lat = String(latitude);
    const lon = String(longitude);
    return `${OSM}/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }
  return `${OSM}/search?query=${encodeURIComponent(address.replace(/\s+/gu, ' ').trim())}`;
}

/**
 * The OpenStreetMap embed around a pin, about 800 m across; `undefined`
 * without coordinates — an embed cannot search an address.
 */
export function mapEmbedSrc(latitude?: number, longitude?: number): string | undefined {
  if (!hasCoordinates(latitude, longitude) || longitude === undefined) return undefined;
  const round = (value: number) => String(Number(value.toFixed(6)));
  const bbox = [longitude - 0.005, latitude - 0.003, longitude + 0.005, latitude + 0.003].map(
    round,
  );
  return `${OSM}/export/embed.html?bbox=${bbox.join('%2C')}&layer=mapnik&marker=${round(latitude)}%2C${round(longitude)}`;
}
