// ── block-parts (2026-10-06) ──
/*
  The words a person names a REGISTERED section block by (block-parts fix
  pass): «الهيرو», «الواجهة الرئيسية», "the hero". The composed-page outline
  only knows labelled regions and the root's direct children, so on the
  landing page — where the hero sits inside an aurora background — «لون
  العنوان في الهيرو» found no section and the zero-token part path never ran.

  Keys are normalised block types (lower case, letters and digits only, the
  key shell `i18n/block-names.ts` uses). Values are the Arabic display name
  the chrome shows (mirrored from BLOCK_NAMES_AR, which the AI package cannot
  import) plus the everyday words people type for it, each one a whole name. English names come from
  the type itself (`logoCloud` → "logo cloud").
*/

export const BLOCK_SECTION_WORDS_AR: Readonly<Record<string, readonly string[]>> = {
  announcementbar: ['شريط إعلان', 'الإعلان'],
  bentogrid: ['شبكة بينتو', 'بينتو'],
  bloggrid: ['شبكة المدونة', 'المدونة', 'المقالات'],
  carousel: ['عارض شرائح', 'الشرائح', 'السلايدر'],
  comparisontable: ['جدول مقارنة', 'المقارنة'],
  contentsection: ['قسم محتوى'],
  cta: ['دعوة إلى إجراء'],
  faq: ['الأسئلة الشائعة', 'الأسئلة'],
  features: ['المزايا', 'المميزات', 'الميزات'],
  formsection: ['قسم النموذج', 'النموذج'],
  hero: ['واجهة رئيسية', 'الواجهة', 'الهيرو', 'البانر'],
  logocloud: ['شعارات العملاء', 'الشعارات'],
  marquee: ['شريط متحرك'],
  newsletter: ['النشرة البريدية', 'النشرة', 'الاشتراك'],
  portfolio: ['الأعمال', 'معرض الأعمال'],
  pricing: ['الأسعار', 'الباقات'],
  productgrid: ['المنتجات'],
  stats: ['إحصاءات', 'الإحصائيات', 'الأرقام'],
  team: ['الفريق'],
  testimonials: ['شهادات العملاء', 'الآراء', 'التقييمات'],
};

/** `bento-grid` / `bentoGrid` → `bentogrid`; a namespaced `ext:hero` keys by its leaf. */
export function blockSectionKey(type: string): string {
  const leaf = type.split(/[:/.]/u).at(-1) ?? type;
  return leaf.replace(/[^a-zA-Z0-9]/gu, '').toLowerCase();
}

/** The Arabic names a block type answers to, each one a whole name; empty when none is known. */
export function blockSectionWordsAr(type: string): readonly string[] {
  const key = blockSectionKey(type);
  return Object.hasOwn(BLOCK_SECTION_WORDS_AR, key) ? (BLOCK_SECTION_WORDS_AR[key] ?? []) : [];
}
// ── /block-parts ──
