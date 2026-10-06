import {
  SECTION_KITS,
  instantiateKit,
  type LibrarySectionEntry,
  type SectionKit,
  type SectionKitSlot,
} from '@craftkit/builder';

/*
  The Library's Sections tab (fix pass): the section kits the agent builds
  from, offered to the person too. Each kit is filled once with neutral
  placeholder content in the editor's language, through the SAME
  `instantiateKit` the agent's kit tools use, so a dropped section is exactly
  what the agent would have produced — then the person edits its words.
*/

const WORDS = {
  en: { title: 'Your headline here', body: 'A short sentence that says what this part of the page is for.', action: 'Learn more', item: 'Feature' },
  ar: { title: 'عنوانك هنا', body: 'جملة قصيرة تشرح الغرض من هذا الجزء من الصفحة.', action: 'اعرف المزيد', item: 'ميزة' },
} as const;

const PHOTOS = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
] as const;

const ICONS = ['star', 'zap', 'shield-check', 'heart'] as const;

function placeholder(slot: SectionKitSlot, name: string, lang: 'en' | 'ar', seed: number): unknown {
  const words = WORDS[lang];
  switch (slot.kind) {
    case 'text': {
      if (name === 'href') return `#section-${String(seed)}`;
      if (name === 'initials') return lang === 'ar' ? 'م ع' : 'AB';
      const long = (slot.max ?? 200) > 80;
      const text = long ? words.body : /title|heading|name/iu.test(name) ? words.title : `${words.item} ${String(seed)}`;
      return text.slice(0, Math.max(1, slot.max ?? 200)).trim();
    }
    case 'icon':
      return ICONS[seed % ICONS.length];
    case 'link':
      return { label: words.action, href: '#contact' };
    case 'image':
      return { src: PHOTOS[seed % PHOTOS.length], alt: words.title };
    case 'list': {
      const count = Math.min(slot.max ?? 3, 3);
      return Array.from({ length: count }, (_unused, index) => placeholders(slot.item ?? {}, lang, index + 1));
    }
  }
}

function placeholders(
  slots: Readonly<Record<string, SectionKitSlot>>,
  lang: 'en' | 'ar',
  seed = 0,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot], index) => [name, placeholder(slot, name, lang, seed + index)]),
  );
}

const ROLE_NAMES: Readonly<Record<SectionKit['role'], { readonly en: string; readonly ar: string }>> = {
  header: { en: 'Header', ar: 'الترويسة' },
  hero: { en: 'Hero', ar: 'الواجهة' },
  features: { en: 'Features', ar: 'المزايا' },
  proof: { en: 'Proof', ar: 'الثقة' },
  offer: { en: 'Offer', ar: 'العرض' },
  media: { en: 'Media', ar: 'الوسائط' },
  closing: { en: 'Closing', ar: 'الخاتمة' },
  footer: { en: 'Footer', ar: 'التذييل' },
};

/** Every kit that fills cleanly, as a Library section in the editor's language. */
export function librarySections(lang: 'en' | 'ar'): LibrarySectionEntry[] {
  return SECTION_KITS.flatMap((kit): LibrarySectionEntry[] => {
    const filled = instantiateKit(kit, placeholders(kit.slots, lang), {
      id: `section-${kit.id}`,
      heading: 'h2',
      locale: { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' },
    });
    if (!filled.ok) return [];
    const role = ROLE_NAMES[kit.role];
    return [
      {
        id: `kit-${kit.id}`,
        name: `${role.en} · ${kit.summary}`,
        nameAr: `${role.ar} · ${kit.summary}`,
        group: lang === 'ar' ? role.ar : role.en,
        tree: filled.tree as unknown as LibrarySectionEntry['tree'],
        ...(filled.css === '' ? {} : { css: filled.css }),
      },
    ];
  });
}
