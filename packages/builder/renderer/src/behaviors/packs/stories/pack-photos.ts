/** Story data for the gallery and carousel pack stories: self-made tiles, captions in both locales. */
export type DemoLang = 'ar' | 'en';

const CAPTIONS: Readonly<Record<DemoLang, readonly string[]>> = {
  en: ['Morning light', 'Market street', 'Olive grove', 'Old city stairs', 'Spice stall', 'Evening tea'],
  ar: ['ضوء الصباح', 'شارع السوق', 'بستان الزيتون', 'درج البلدة القديمة', 'بسطة البهارات', 'شاي المساء'],
};

/** A self-made tile (no network in a story run): a coloured SVG with its number. */
export function tile(index: number, width = 600, height = 450): string {
  const hue = (index * 47 + 18) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><rect width="100%" height="100%" fill="hsl(${String(hue)} 50% 52%)"/><text x="50%" y="50%" font-size="72" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" fill="white">${String(index)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface DemoPhoto {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  readonly width: number;
  readonly height: number;
}

export function photos(lang: DemoLang, tall = false): DemoPhoto[] {
  return CAPTIONS[lang].map((caption, at) => {
    const height = tall && at % 3 === 1 ? 800 : 450;
    return {
      src: tile(at + 1, 600, height),
      alt: lang === 'ar' ? `صورة ${String(at + 1)}: ${caption}` : `Photo ${String(at + 1)}: ${caption}`,
      caption,
      width: 600,
      height,
    };
  });
}
