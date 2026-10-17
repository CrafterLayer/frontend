import { z } from 'zod';

import { isHttpsUrl, isLangTag } from './text';

/*
  SEO data (DESIGN D.1). Page settings live on the page root's `seo` prop;
  SITE settings (origin, name, business) live on the HOME page root's
  `seo.site`, and other pages inherit them. Every write is therefore an
  ordinary `setProp` through the door — no site-kernel command, no Law M
  migration. Strict objects: an unknown key is a model mistake the repair
  round should see, not data to carry silently.
*/

export const SEO_BUSINESS_TYPES = [
  'Restaurant',
  'CafeOrCoffeeShop',
  'Bakery',
  'Dentist',
  'MedicalClinic',
  'LegalService',
  'Store',
  'BeautySalon',
  'LocalBusiness',
  'Organization',
] as const;
export type SeoBusinessType = (typeof SEO_BUSINESS_TYPES)[number];

export const SEO_PAGE_KINDS = [
  'home',
  'menu',
  'product',
  'service',
  'about',
  'contact',
  'article',
  'landing',
] as const;
export type SeoPageKind = (typeof SEO_PAGE_KINDS)[number];

export const SEO_OG_TYPES = ['website', 'article', 'product'] as const;
export type SeoOgType = (typeof SEO_OG_TYPES)[number];

export const SEO_SCHEMA_KINDS = [
  'FAQPage',
  'Menu',
  'Product',
  'Service',
  'Article',
  'BreadcrumbList',
  'Event',
] as const;
export type SeoSchemaKind = (typeof SEO_SCHEMA_KINDS)[number];

const httpsUrl = z
  .string()
  .max(2000)
  .refine(isHttpsUrl, { message: 'Must be an absolute https:// URL (no credentials).' });

const routePath = z
  .string()
  .max(200)
  .refine((value) => value.startsWith('/') && !/\s/u.test(value) && !value.includes('//'), {
    message: 'A site path starting with "/", with no spaces and no "//".',
  });

const langTag = z
  .string()
  .max(35)
  .refine(isLangTag, { message: 'A BCP-47 language tag such as "ar" or "en-US".' });

export const seoAddressSchema = z.strictObject({
  street: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/u, 'An ISO 3166-1 alpha-2 country code such as "JO".'),
});

export const seoBusinessSchema = z.strictObject({
  type: z.enum(SEO_BUSINESS_TYPES),
  name: z.string().min(1).max(120),
  telephone: z.string().max(32).optional(),
  whatsapp: z.string().max(32).optional(),
  email: z.string().max(254).optional(),
  address: seoAddressSchema.optional(),
  geo: z
    .strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  /** schema.org openingHours text, e.g. 'Sa-Th 08:00-23:00'. Passed through. */
  openingHours: z.array(z.string().min(1).max(60)).max(14).optional(),
  priceRange: z.string().max(8).optional(),
  servesCuisine: z.array(z.string().min(1).max(60)).max(6).optional(),
  sameAs: z.array(httpsUrl).max(10).optional(),
  logo: httpsUrl.optional(),
});

export const siteSeoSchema = z.strictObject({
  origin: httpsUrl.optional(),
  siteName: z.string().max(60).optional(),
  titleTemplate: z
    .string()
    .max(80)
    .refine((value) => value.includes('%s'), {
      message: 'A title template must contain %s where the page title goes.',
    })
    .optional(),
  defaultImage: httpsUrl.optional(),
  business: seoBusinessSchema.optional(),
});

export const pageSeoSchema = z.strictObject({
  keyword: z.string().max(80).optional(),
  pageKind: z.enum(SEO_PAGE_KINDS).optional(),
  ogType: z.enum(SEO_OG_TYPES).optional(),
  canonicalPath: routePath.optional(),
  alternates: z
    .array(z.strictObject({ lang: langTag, path: routePath }))
    .max(8)
    .optional(),
  schemaKinds: z.array(z.enum(SEO_SCHEMA_KINDS)).max(6).optional(),
  /** Facts-ledger sample values. Never emitted as structured data. */
  samples: z.array(z.string().max(200)).max(30).optional(),
  /** Site settings; read from the HOME page (address '/'), inherited elsewhere. */
  site: siteSeoSchema.optional(),
});

export type SeoAddress = z.infer<typeof seoAddressSchema>;
export type SeoBusiness = z.infer<typeof seoBusinessSchema>;
export type SiteSeo = z.infer<typeof siteSeoSchema>;
export type PageSeo = z.infer<typeof pageSeoSchema>;
