import { describe, expect, it } from 'vitest';

import { safeCustomCodeUrl } from '@craftkit/builder-schema';

import { parseArtSpec, resolveArtImageIn } from './art-spec';
import { brandLogoUrl, characterUrl, hexColour, illustrationUrl } from './art-url';
import { buildArtCatalog } from './catalog';
import { loadArtCatalog, planNamesArt } from './load';
import { artKindOfUrl, isArtSpec, isVerifiedArtUrl, resolveArtImage } from './runtime';
import { isVerifiedArtUrlIn } from './verify-url';

const catalog = buildArtCatalog();
const en = { locale: 'en' };
const ar = { locale: 'ar' };

function resolved(spec: string, options: { locale: string; alt?: string } = en) {
  const result = resolveArtImageIn(catalog, spec, options);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function refusal(spec: string, options: { locale: string; alt?: string } = en): string {
  const result = resolveArtImageIn(catalog, spec, options);
  if (result.ok) throw new Error(`${spec} resolved to ${result.value.src}`);
  return result.error;
}

/*
  The page side of an address: what the door (safeCustomCodeUrl) and the
  blocks' safeImageSourceSchema accept, and what an attribute may carry.
  blocks-marketing tests the same shapes against its own schema.
*/
function pageSafe(url: string): boolean {
  return (
    url.length <= 2_000 &&
    url.startsWith('https://') &&
    safeCustomCodeUrl(url) === url &&
    !/[\s"'<>\\`]/u.test(url)
  );
}

describe('art URLs', () => {
  it('builds each host’s address from verified names only', () => {
    expect(brandLogoUrl('stripe')).toBe('https://cdn.simpleicons.org/stripe');
    expect(brandLogoUrl('visa', 'white')).toBe('https://cdn.simpleicons.org/visa/ffffff');
    expect(characterUrl('notionists', 'Sara')).toBe(
      'https://api.dicebear.com/9.x/notionists/svg?seed=Sara',
    );
    expect(illustrationUrl('hot-beverage')).toBe(
      'https://api.iconify.design/fluent-emoji-flat/hot-beverage.svg',
    );
    expect(() => brandLogoUrl('../evil')).toThrow();
    expect(() => illustrationUrl('a/b')).toThrow();
    expect(() => characterUrl('notionists', '')).toThrow();
  });

  it('percent-encodes a seed, Arabic names and query characters included', () => {
    expect(characterUrl('lorelei', 'سارة أحمد')).toBe(
      'https://api.dicebear.com/9.x/lorelei/svg?seed=%D8%B3%D8%A7%D8%B1%D8%A9%20%D8%A3%D8%AD%D9%85%D8%AF',
    );
    expect(characterUrl('lorelei', 'a&b=c#d', 'F4E3D7')).toBe(
      'https://api.dicebear.com/9.x/lorelei/svg?seed=a%26b%3Dc%23d&backgroundColor=f4e3d7',
    );
  });

  it('accepts only white, black or a 3/6-digit hex as a colour', () => {
    expect(hexColour('#FFF')).toBe('ffffff');
    expect(hexColour('0a0B0c')).toBe('0a0b0c');
    expect(hexColour('black')).toBe('000000');
    for (const bad of ['red', '#12345', 'fffffff', 'ff ff ff', 'url(x)'])
      expect(hexColour(bad), bad).toBeUndefined();
    expect(() => brandLogoUrl('visa', 'red')).toThrow();
  });

  it('tells which host an address is on', () => {
    expect(artKindOfUrl('https://cdn.simpleicons.org/visa')).toBe('logo');
    expect(artKindOfUrl('https://api.dicebear.com/9.x/notionists/svg?seed=a')).toBe('character');
    expect(artKindOfUrl('https://api.iconify.design/fluent-emoji-flat/rocket.svg')).toBe(
      'illustration',
    );
    expect(artKindOfUrl('https://images.pexels.com/photos/1/a.jpeg')).toBeUndefined();
  });
});

describe('art specs', () => {
  it('recognises the three prefixes and nothing else', () => {
    for (const spec of ['logo:stripe', 'Character:sara', 'illustration: doctor'])
      expect(isArtSpec(spec), spec).toBe(true);
    for (const value of [
      'https://x.test/a.png',
      'catalog:cafe',
      '/uploads/logo.png',
      'logos',
      42,
    ]) {
      expect(isArtSpec(value), String(value)).toBe(false);
    }
  });

  it('reads a style, a seed and a background', () => {
    expect(parseArtSpec('character:sara')).toEqual({
      ok: true,
      value: { kind: 'character', seed: 'sara' },
    });
    expect(parseArtSpec('character:Lorelei:Sara:f4e3d7')).toEqual({
      ok: true,
      value: { kind: 'character', style: 'lorelei', seed: 'Sara', background: 'f4e3d7' },
    });
    expect(parseArtSpec('logo:visa/white')).toEqual({
      ok: true,
      value: { kind: 'logo', brand: 'visa', colour: 'white' },
    });
  });

  it('refuses a malformed spec with the shape it should have', () => {
    const error = (spec: string) => {
      const parsed = parseArtSpec(spec);
      return parsed.ok ? '' : parsed.error;
    };
    expect(error('logo:')).toContain("'logo:stripe'");
    expect(error('logo:visa/red')).toContain('white, black or a hex');
    expect(error(`character:notionists:${'x'.repeat(65)}`)).toContain('1-64');
    expect(parseArtSpec('character:notionists:sara:pink')).toMatchObject({ ok: false });
    expect(parseArtSpec('illustration:')).toMatchObject({ ok: false });
  });
});

describe('resolveArtImage — logos', () => {
  it('names the brand in the page language and keeps the brand colour unless asked', () => {
    expect(resolved('logo:stripe')).toEqual({
      kind: 'logo',
      src: 'https://cdn.simpleicons.org/stripe',
      alt: 'Stripe logo',
      width: 256,
      height: 256,
    });
    expect(resolved('logo:Visa/white', ar)).toMatchObject({
      src: 'https://cdn.simpleicons.org/visa/ffffff',
      alt: 'شعار Visa',
    });
    // A logo's alt is the brand's own name, whatever the call wrote.
    expect(resolved('logo:paypal', { locale: 'en', alt: 'Our partner' }).alt).toBe('PayPal logo');
  });

  it('refuses a brand the catalog does not hold, asking for the person’s own logo', () => {
    const error = refusal('logo:Acme Widgets of Amman');
    expect(error).toContain('no verified logo for "Acme Widgets of Amman"');
    expect(error).toContain('upload their logo');
    expect(refusal('logo:paypa')).toContain('did you mean PayPal');
    expect(refusal('logo:mercedes')).toContain('upload their logo');
  });
});

describe('resolveArtImage — characters', () => {
  it('draws the same person for the same seed, in the default no-credit style', () => {
    const sara = resolved('character:Sara');
    expect(sara.src).toBe('https://api.dicebear.com/9.x/notionists/svg?seed=Sara');
    expect(resolved('character:Sara').src).toBe(sara.src);
    expect(sara.alt).toBe('Cartoon avatar');
    expect(
      resolved('character:open-peeps:Omar', { locale: 'ar', alt: 'عمر، مدير المشروع' }),
    ).toMatchObject({
      src: 'https://api.dicebear.com/9.x/open-peeps/svg?seed=Omar',
      alt: 'عمر، مدير المشروع',
    });
    expect(resolved('character:x', ar).alt).toBe('صورة رمزية كرتونية');
  });

  it('refuses a CC BY style (no credit line) and an unknown one, naming the styles to use', () => {
    const credit = refusal('character:adventurer:Sara');
    expect(credit).toContain('CC BY 4.0');
    expect(credit).toContain('Lisa Wischofsky');
    expect(credit).toContain('notionists, lorelei, open-peeps');
    expect(refusal('character:anime:Sara')).toContain('is not a character style');
  });
});

describe('resolveArtImage — illustrations', () => {
  it('finds the picture from English or Arabic words and writes its alt', () => {
    expect(resolved('illustration:doctor')).toMatchObject({
      kind: 'illustration',
      src: 'https://api.iconify.design/fluent-emoji-flat/health-worker.svg',
      alt: 'Health worker',
    });
    expect(resolved('illustration:قهوة', ar)).toMatchObject({
      src: 'https://api.iconify.design/fluent-emoji-flat/hot-beverage.svg',
      alt: 'قهوة',
    });
    expect(resolved('illustration:woman-health-worker-medium-dark').src).toBe(
      'https://api.iconify.design/fluent-emoji-flat/woman-health-worker-medium-dark.svg',
    );
  });

  it('asks for alt on an Arabic page when it has no Arabic words for the picture', () => {
    expect(refusal('illustration:kite', ar)).toContain('needs "alt"');
    expect(resolved('illustration:kite', { locale: 'ar', alt: 'طائرة ورقية' }).alt).toBe(
      'طائرة ورقية',
    );
    expect(resolved('illustration:pizza', ar).alt).toBe('بيتزا');
  });

  it('refuses words that match nothing, with plainer ones to try', () => {
    expect(refusal('illustration:xyzzy')).toContain('name a plainer thing');
  });
});

describe('every produced address is page-safe', () => {
  it('passes the door and the image-source rule for each kind', () => {
    const specs = [
      'logo:stripe',
      'logo:visa/white',
      'logo:Coca-Cola/000',
      'character:Sara',
      'character:lorelei:سارة أحمد:f4e3d7',
      'character:bottts:"><script>',
      'illustration:doctor',
      'illustration:سيارة',
      'illustration:woman-teacher-light',
    ];
    for (const spec of specs) {
      const image = resolved(spec, { locale: 'en', alt: 'x' });
      expect(pageSafe(image.src), `${spec} → ${image.src}`).toBe(true);
      expect(artKindOfUrl(image.src)).toBe(image.kind);
    }
  });

  it('holds for every brand and every illustration in the catalog', () => {
    for (const brand of catalog.brands)
      expect(pageSafe(brandLogoUrl(brand.slug)), brand.slug).toBe(true);
    for (const entry of catalog.emoji)
      expect(pageSafe(illustrationUrl(entry.name)), entry.name).toBe(true);
    for (const style of catalog.offeredStyles)
      expect(pageSafe(characterUrl(style.id, 'seed')), style.id).toBe(true);
  });
});

describe('the lazy load', () => {
  it('spots a plan that names art, and only then', () => {
    expect(
      planNamesArt({ commands: [{ args: { input: { images: [{ src: 'logo:stripe' }] } } }] }),
    ).toBe(true);
    expect(planNamesArt({ commands: [{ args: { value: 'illustration: doctor' } }] })).toBe(true);
    expect(
      planNamesArt({
        commands: [{ args: { value: { name: 'Stripe', logo: 'https://x.test/a.svg' } } }],
      }),
    ).toBe(false);
    expect(planNamesArt({ commands: [{ args: { images: 'catalog:cafe' } }] })).toBe(false);
    expect(planNamesArt(undefined)).toBe(false);
  });

  it('refuses before the load, then resolves after it', async () => {
    const before = resolveArtImage('logo:stripe', en);
    expect(before).toEqual({
      ok: false,
      error: 'the art catalog is still loading; send the same step again.',
    });
    expect(isVerifiedArtUrl('https://cdn.simpleicons.org/stripe')).toBe(false);
    const loaded = await loadArtCatalog();
    expect(await loadArtCatalog()).toBe(loaded);
    expect(resolveArtImage('logo:stripe', en)).toMatchObject({ ok: true });
    expect(isVerifiedArtUrl('https://cdn.simpleicons.org/stripe')).toBe(true);
  });
});

describe('isVerifiedArtUrl — only what the catalog would write', () => {
  it('admits a resolved address of every kind', () => {
    const specs = [
      'logo:stripe',
      'logo:visa/white',
      'character:lorelei:سارة:f4e3d7',
      'illustration:doctor',
      'illustration:woman-teacher-dark',
    ];
    for (const spec of specs)
      expect(isVerifiedArtUrlIn(catalog, resolved(spec).src), spec).toBe(true);
    // A tree written as markup may carry its query's ampersand escaped.
    expect(
      isVerifiedArtUrlIn(
        catalog,
        'https://api.dicebear.com/9.x/notionists/svg?seed=a&amp;backgroundColor=ffffff',
      ),
    ).toBe(true);
  });

  it('refuses a host-shaped address the catalog never wrote', () => {
    for (const url of [
      'https://cdn.simpleicons.org/acmewidgets',
      'https://cdn.simpleicons.org/stripe/red',
      'https://api.dicebear.com/9.x/adventurer/svg?seed=Sara',
      'https://api.dicebear.com/9.x/notionists/svg?seed=Sara&radius=50',
      'https://api.dicebear.com/7.x/notionists/svg?seed=Sara',
      'https://api.iconify.design/fluent-emoji-flat/not-an-emoji.svg',
      'https://api.iconify.design/mdi/home.svg',
      'https://images.pexels.com/photos/1/a.jpeg',
    ]) {
      expect(isVerifiedArtUrlIn(catalog, url), url).toBe(false);
    }
  });
});
