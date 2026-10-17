import { z } from 'zod';

/** Platform-owned recipes, shared by the insert library and AI tools. No dependencies or scripts. */
export const ELEMENT_RECIPE_IDS = [
  'feature-card', 'metric-card', 'quote-card', 'notice',
  'checklist', 'process-steps', 'contact-card', 'bento-grid', 'data-table',
] as const;
export type ElementRecipeId = (typeof ELEMENT_RECIPE_IDS)[number];
export type ElementRecipePalette = 'site' | 'page';

const text = z.string().trim().min(1).max(500);
const safeHref = (value: string): boolean =>
  !/[\s\u0000-\u0020\u007f-\u00a0\u200b-\u200f\u202a-\u202e\\]/u.test(value)
  && !value.startsWith('//')
  && /^(?:https:\/\/|mailto:|tel:|[/.#?])/iu.test(value);
export const elementRecipeContentSchema = z.strictObject({
  title: text.optional(),
  text: text.optional(),
  value: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  href: z.string().trim().min(1).max(2_000).refine(safeHref, 'Use an https, mailto, tel or relative link.').optional(),
  items: z.array(z.strictObject({ title: text, text: text.optional() })).min(1).max(8).optional(),
});
export type ElementRecipeContent = z.infer<typeof elementRecipeContentSchema>;

export const ELEMENT_RECIPE_CATALOG = [
  { id: 'feature-card', labels: { en: 'Feature card', ar: 'بطاقة ميزة' }, description: { en: 'An icon, a clear benefit and supporting copy.', ar: 'أيقونة وفائدة واضحة ونص داعم.' }, keywords: 'benefit service feature ميزة خدمة فائدة' },
  { id: 'metric-card', labels: { en: 'Metric card', ar: 'بطاقة إحصائية' }, description: { en: 'A real number with its label and context.', ar: 'رقم حقيقي مع عنوانه وسياقه.' }, keywords: 'stat metric number kpi إحصائية رقم مؤشر' },
  { id: 'quote-card', labels: { en: 'Quote card', ar: 'بطاقة اقتباس' }, description: { en: 'A quote with attribution, without invented ratings.', ar: 'اقتباس مع اسم صاحبه، دون تقييمات وهمية.' }, keywords: 'quote testimonial review اقتباس رأي شهادة' },
  { id: 'notice', labels: { en: 'Notice', ar: 'شريط تنبيه' }, description: { en: 'A concise announcement with an optional real link.', ar: 'إعلان مختصر مع رابط حقيقي اختياري.' }, keywords: 'announcement alert notice banner إعلان تنبيه شريط' },
  { id: 'checklist', labels: { en: 'Checklist', ar: 'قائمة مزايا' }, description: { en: 'Scannable benefits with check icons.', ar: 'مزايا سهلة القراءة مع علامات صح.' }, keywords: 'benefits checklist included مزايا قائمة يشمل' },
  { id: 'process-steps', labels: { en: 'Process steps', ar: 'خطوات العمل' }, description: { en: 'An ordered process that stacks on phones.', ar: 'خطوات مرتبة تتحول إلى عمود على الهاتف.' }, keywords: 'steps process how works خطوات عملية كيف' },
  { id: 'contact-card', labels: { en: 'Contact card', ar: 'بطاقة تواصل' }, description: { en: 'Contact details and an optional verified action.', ar: 'تفاصيل التواصل وإجراء موثوق اختياري.' }, keywords: 'contact booking email phone تواصل حجز بريد هاتف' },
  { id: 'bento-grid', labels: { en: 'Bento grid', ar: 'شبكة بنتو' }, description: { en: 'A featured benefit and a responsive supporting grid.', ar: 'ميزة بارزة وشبكة داعمة متجاوبة.' }, keywords: 'bento grid features cards بنتو شبكة بطاقات ميزات' },
  { id: 'data-table', labels: { en: 'Data table', ar: 'جدول بيانات' }, description: { en: 'A captioned table with row and column headers that scrolls on phones.', ar: 'جدول بعنوان ورؤوس للصفوف والأعمدة يتمرّر أفقيًا على الهاتف.' }, keywords: 'table data prices hours specs comparison جدول بيانات أسعار مواعيد مواصفات' },
] as const satisfies readonly {
  id: ElementRecipeId;
  labels: { en: string; ar: string };
  description: { en: string; ar: string };
  keywords: string;
}[];
