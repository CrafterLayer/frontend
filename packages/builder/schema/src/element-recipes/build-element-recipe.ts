import type { CustomCodeElement, CustomCodeNode } from '../custom-code/custom-code-tree';
import { buildDataTable } from './build-data-table';
import type { ElementRecipeContent, ElementRecipeId, ElementRecipePalette } from './catalog';

/** Existing page-kit classes preserve a planned page's palette; otherwise use the site tokens. */
export function buildElementRecipe(
  id: ElementRecipeId,
  locale: 'en' | 'ar',
  content: ElementRecipeContent = {},
  palette: ElementRecipePalette = 'site',
): CustomCodeElement {
  const t = (en: string, ar: string) => locale === 'ar' ? ar : en;
  const card = palette === 'page' ? 'ck-card' : 'rounded-2xl border border-text/15 bg-surface text-text';
  const accent = palette === 'page' ? 'ck-accent-ink' : 'text-accent';
  const muted = palette === 'page' ? 'ck-muted' : 'text-text-muted';
  const el = (tag: CustomCodeElement['tag'], className: string, text?: string, children?: CustomCodeNode[]): CustomCodeElement => ({
    kind: 'element', tag, className,
    ...(text === undefined ? {} : { text }),
    ...(children === undefined ? {} : { children }),
  });
  const icon = (name: string): CustomCodeNode => ({ kind: 'icon', name, size: 24, className: `shrink-0 ${accent}` });
  const heading = (fallback: string) => el('h3', 'text-xl font-semibold leading-snug break-words', content.title ?? fallback);
  const copy = (fallback: string) => el('p', `text-sm leading-relaxed break-words ${muted}`, content.text ?? fallback);
  const action = (): CustomCodeNode[] => content.href === undefined ? [] : [{
    ...el('a', `inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4 break-words ${accent}`, content.label ?? t('Get in touch', 'تواصل معنا')),
    attributes: { href: content.href },
  }];
  const items = content.items ?? [
    { title: t('A clear first step', 'خطوة أولى واضحة'), text: t('Explain what happens and what to expect.', 'وضّح ما سيحدث وما يمكن توقعه.') },
    { title: t('Built around your needs', 'مصمم حول احتياجاتك'), text: t('Describe the practical benefit in one sentence.', 'اشرح الفائدة العملية في جملة واحدة.') },
    { title: t('A thoughtful finish', 'نتيجة مدروسة'), text: t('Show the next action without making unsupported claims.', 'وضّح الخطوة التالية دون ادعاءات غير موثقة.') },
  ];
  const itemCopy = (item: (typeof items)[number]): CustomCodeNode[] => [
    el('h3', 'text-base font-semibold leading-snug break-words', item.title),
    ...(item.text === undefined ? [] : [el('p', `mt-2 text-sm leading-relaxed break-words ${muted}`, item.text)]),
  ];
  switch (id) {
    case 'feature-card':
      return el('article', `min-w-0 w-full p-6 flex flex-col gap-4 ${card}`, undefined, [
        icon('sparkles'), heading(t('A useful feature', 'ميزة مفيدة')), copy(t('Explain how this makes life easier.', 'وضّح كيف تجعل هذه الميزة التجربة أسهل.')), ...action(),
      ]);
    case 'metric-card':
      return el('div', `min-w-0 w-full p-6 ${card}`, undefined, [
        el('dl', 'flex flex-col gap-3', undefined, [
          el('dt', `text-sm font-medium ${muted}`, content.title ?? t('Your key metric', 'المؤشر الأهم لديك')),
          el('dd', `m-0 text-4xl font-bold leading-snug tabular-nums break-words ${accent}`, content.value ?? '—'),
        ]),
        el('p', `mt-3 text-sm leading-relaxed ${muted}`, content.text ?? t('Add a verified number and its context.', 'أضف رقمًا موثقًا مع توضيح سياقه.')),
      ]);
    case 'quote-card':
      return el('figure', `m-0 min-w-0 w-full p-6 flex flex-col gap-5 ${card}`, undefined, [
        icon('quote'),
        el('blockquote', 'm-0 text-lg leading-relaxed break-words', content.text ?? t('Add a real quote here, with permission to publish.', 'أضف اقتباسًا حقيقيًا هنا، مع إذن نشره.')),
        el('figcaption', `text-sm font-semibold ${muted}`, content.title ?? t('Quote attribution', 'اسم صاحب الاقتباس')),
      ]);
    case 'notice':
      return el('aside', `min-w-0 w-full flex items-start gap-4 p-4 ${card}`, undefined, [
        icon('info'), el('div', 'min-w-0 flex-1 flex flex-col gap-2', undefined, [
          heading(t('A useful update', 'تحديث يهمك')), copy(t('Keep your announcement short and specific.', 'اجعل الإعلان مختصرًا ومحددًا.')), ...action(),
        ]),
      ]);
    case 'checklist':
      return el('div', `min-w-0 w-full p-6 flex flex-col gap-5 ${card}`, undefined, [
        heading(t('What is included', 'ما الذي يشمله')), el('ul', 'm-0 p-0 list-none flex flex-col gap-4', undefined,
          items.map((item) => el('li', 'flex items-start gap-3', undefined, [icon('check'), el('div', 'min-w-0', undefined, itemCopy(item))]))),
      ]);
    case 'process-steps':
      return el('ol', 'm-0 p-0 w-full min-w-0 list-none grid grid-cols-3 gap-4 max-md:grid-cols-1', undefined,
        items.map((item, index) => el('li', `min-w-0 p-5 flex flex-col gap-4 ${card}`, undefined, [
          { ...el('span', `text-2xl font-bold tabular-nums ${accent}`, String(index + 1).padStart(2, '0')), attributes: { 'aria-hidden': 'true' } },
          el('div', 'min-w-0', undefined, itemCopy(item)),
        ])));
    case 'contact-card':
      return el('aside', `min-w-0 w-full p-6 flex flex-col gap-4 ${card}`, undefined, [
        icon('message-circle'), heading(t('Let us talk', 'لنبدأ الحديث')), copy(t('Add your actual contact details and availability.', 'أضف بيانات التواصل الفعلية وأوقات التوفر.')), ...action(),
      ]);
    case 'bento-grid':
      return el('div', 'min-w-0 w-full grid grid-cols-2 gap-4 max-md:grid-cols-1', undefined,
        items.map((item, index) => el('article', `min-w-0 p-6 flex flex-col gap-4 ${card}${index === 0 ? ' col-span-2 max-md:col-span-1' : ''}`, undefined, [
          icon(index === 0 ? 'sparkles' : 'check'), el('div', 'min-w-0', undefined, itemCopy(item)),
        ])));
    case 'data-table':
      return buildDataTable(locale, content, palette);
  }
}
