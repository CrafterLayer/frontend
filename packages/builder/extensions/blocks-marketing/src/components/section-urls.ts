import { z } from 'zod';

/**
 * The link and image addresses a section may store (blocks 2026-10-13).
 *
 * Every older block spells its own copy of these two refinements; the eight
 * blocks added on 2026-10-13 share this one, so a scheme is allowed or refused
 * in one place. Schema-safe: zod only, so `schemas.ts` stays Node-loadable.
 */

/** A link: an anchor, a root-relative path, or an http(s), mailto: or tel: address. */
export const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      value.startsWith('#') ||
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^(https?:\/\/|mailto:|tel:)/iu.test(value),
    { message: 'Links must be relative or use http, https, mailto, or tel.' },
  );

/** An image: a root-relative path, an http(s) address, or a raster data URL. */
export const safeImageSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      /^https?:\/\//iu.test(value) ||
      /^data:image\/(?:avif|gif|jpeg|png|webp);/iu.test(value),
    {
      message:
        'Image sources must use http(s), a root-relative path, or a supported raster data URL.',
    },
  );

/** True for a same-origin path, where the `download` attribute is honoured. */
export function isSameOriginPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}
