import { describe, expect, it } from 'vitest';

import { pageSeoSchema, siteSeoSchema } from './schema';

describe('pageSeoSchema / siteSeoSchema', () => {
  it('accepts an Arabic café home page with site settings', () => {
    const parsed = pageSeoSchema.parse({
      keyword: 'مقهى مختص في عمّان',
      pageKind: 'home',
      alternates: [{ lang: 'en', path: '/en' }],
      schemaKinds: ['FAQPage', 'Menu'],
      samples: ['+962 7 9000 0000'],
      site: {
        origin: 'https://qahwa.example',
        titleTemplate: '%s | قهوة',
        business: {
          type: 'CafeOrCoffeeShop',
          name: 'قهوة',
          address: { city: 'عمّان', country: 'JO' },
          openingHours: ['Sa-Th 08:00-23:00'],
        },
      },
    });
    expect(parsed.site?.business?.type).toBe('CafeOrCoffeeShop');
  });

  it('refuses http origins, templates without %s, lowercase countries and long keywords (en)', () => {
    expect(siteSeoSchema.safeParse({ origin: 'http://shop.example' }).success).toBe(false);
    expect(siteSeoSchema.safeParse({ origin: 'https://user:pw@shop.example' }).success).toBe(false);
    expect(siteSeoSchema.safeParse({ titleTemplate: 'Shop' }).success).toBe(false);
    expect(
      siteSeoSchema.safeParse({
        business: { type: 'Store', name: 'Shop', address: { city: 'Leeds', country: 'gb' } },
      }).success,
    ).toBe(false);
    expect(pageSeoSchema.safeParse({ keyword: 'k'.repeat(81) }).success).toBe(false);
    expect(pageSeoSchema.safeParse({ canonicalPath: 'no-slash' }).success).toBe(false);
    expect(pageSeoSchema.safeParse({ alternates: [{ lang: 'not a tag', path: '/' }] }).success).toBe(false);
  });
});
