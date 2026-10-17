/** Every string a template card shows or announces; the host picks one set by the EDITOR language. */
export interface TemplateCardLabels {
  /** The editor language: it picks the card's name and description. */
  readonly language: 'en' | 'ar';
  /** The card's accessible name: "Insert template SaaS launch". */
  readonly insert: (name: string) => string;
  /** "12 sections" under the description. */
  readonly sections: (count: number) => string;
  /** The content-language badge's glyph: `EN` / `ع`. */
  readonly badge: Readonly<Record<'en' | 'ar', string>>;
  /** What the badge means, for a screen reader and the tooltip. */
  readonly contentLanguage: Readonly<Record<'en' | 'ar', string>>;
}

export const TEMPLATE_CARD_LABELS_EN: TemplateCardLabels = {
  language: 'en',
  insert: (name) => `Insert template ${name}`,
  sections: (count) => `${String(count)} ${count === 1 ? 'section' : 'sections'}`,
  badge: { en: 'EN', ar: 'ع' },
  contentLanguage: { en: 'English page', ar: 'Arabic page' },
};

/** Arabic plural for a count of sections, digits kept Latin (the Palette's rule). */
function sectionsAr(count: number): string {
  if (count === 1) return 'قسم واحد';
  if (count === 2) return 'قسمان';
  if (count >= 3 && count <= 10) return `${String(count)} أقسام`;
  return `${String(count)} قسمًا`;
}

export const TEMPLATE_CARD_LABELS_AR: TemplateCardLabels = {
  language: 'ar',
  insert: (name) => `إدراج القالب ${name}`,
  sections: sectionsAr,
  badge: { en: 'EN', ar: 'ع' },
  contentLanguage: { en: 'صفحة إنجليزية', ar: 'صفحة عربية' },
};
