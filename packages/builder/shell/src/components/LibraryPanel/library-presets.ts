import type { CustomCodeNode } from '@craftkit/builder-schema';

/*
  The Library's Elements tab (style-manager DESIGN.md §E): twenty starting
  points, each an ordinary custom-code node — so once inserted it is a widget
  like any other (every Design sector, the quick bar, Layers, the agent).

  Classes are logical (`ps-6`, `text-start`) so Arabic pages need nothing
  extra, and colours are theme TOKENS (`bg-accent`, `text-accent-text`,
  `border-text/15`) so a preset follows the site's design system. Copy is
  per language because a placeholder in the wrong script is the first thing a
  person deletes.
*/

export type LibraryLanguage = 'en' | 'ar';

export interface LibraryElementPreset {
  readonly id: string;
  readonly labels: { readonly en: string; readonly ar: string };
  /** Extra search words in both languages. */
  readonly keywords: string;
  readonly node: (language: LibraryLanguage) => CustomCodeNode;
}

const t = (language: LibraryLanguage, en: string, ar: string): string => (language === 'ar' ? ar : en);

const IMAGE_SRC = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
const MAP_SRC =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.215!2d-73.9878!3d40.7484!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1';
const VIDEO_EMBED_SRC = 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ';
const VIDEO_SRC = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const paragraph = (text: string, className = 'text-base leading-relaxed'): CustomCodeNode => ({
  kind: 'element',
  tag: 'p',
  className,
  text,
});

const column = (language: LibraryLanguage, n: number): CustomCodeNode => ({
  kind: 'element',
  tag: 'div',
  className: 'flex flex-col gap-3 rounded-xl border border-text/15 p-6',
  children: [
    { kind: 'element', tag: 'h3', className: 'text-xl font-semibold', text: t(language, `Column ${String(n)}`, `العمود ${String(n)}`) },
    paragraph(t(language, 'A short line of supporting text.', 'سطر قصير من النص الداعم.'), 'text-sm text-text-muted'),
  ],
});

export const LIBRARY_ELEMENT_PRESETS: readonly LibraryElementPreset[] = Object.freeze([
  {
    id: 'heading',
    labels: { en: 'Heading', ar: 'عنوان' },
    keywords: 'title h2 headline عنوان رئيسي',
    node: (l) => ({ kind: 'element', tag: 'h2', className: 'text-3xl font-bold tracking-tight', text: t(l, 'A clear heading', 'عنوان واضح') }),
  },
  {
    id: 'text',
    labels: { en: 'Text', ar: 'نص' },
    keywords: 'paragraph body copy فقرة',
    node: (l) =>
      paragraph(
        t(l, 'Write a sentence or two that says what this part of the page is for.', 'اكتب جملة أو اثنتين تقول ما الغرض من هذا الجزء من الصفحة.'),
        'text-base leading-relaxed text-text-muted',
      ),
  },
  {
    id: 'button',
    labels: { en: 'Button', ar: 'زر' },
    keywords: 'cta action call زر إجراء',
    node: (l) => ({
      kind: 'element',
      tag: 'a',
      className:
        'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-text transition hover:opacity-90',
      attributes: { href: '#' },
      text: t(l, 'Get started', 'ابدأ الآن'),
    }),
  },
  {
    id: 'link',
    labels: { en: 'Link', ar: 'رابط' },
    keywords: 'anchor url href رابط',
    node: (l) => ({
      kind: 'element',
      tag: 'a',
      className: 'font-medium text-accent underline underline-offset-4',
      attributes: { href: '#' },
      text: t(l, 'Learn more', 'اعرف المزيد'),
    }),
  },
  {
    id: 'image',
    labels: { en: 'Image', ar: 'صورة' },
    keywords: 'photo picture img صورة',
    node: (l) => ({
      kind: 'element',
      tag: 'img',
      className: 'aspect-video w-full rounded-xl object-cover',
      attributes: { src: IMAGE_SRC, alt: t(l, 'Hills under a morning sky', 'تلال تحت سماء الصباح'), loading: 'lazy' },
    }),
  },
  {
    id: 'video',
    labels: { en: 'Video', ar: 'فيديو' },
    keywords: 'movie clip mp4 فيديو',
    node: () => ({
      kind: 'element',
      tag: 'video',
      className: 'aspect-video w-full rounded-xl bg-text',
      attributes: { src: VIDEO_SRC, controls: '', muted: '', playsinline: '', preload: 'metadata' },
    }),
  },
  {
    id: 'icon',
    labels: { en: 'Icon', ar: 'أيقونة' },
    keywords: 'symbol glyph lucide tabler أيقونة رمز',
    node: () => ({ kind: 'icon', name: 'sparkles', size: 32, className: 'text-accent' }),
  },
  {
    id: 'divider',
    labels: { en: 'Divider', ar: 'فاصل' },
    keywords: 'hr rule line separator فاصل خط',
    node: () => ({ kind: 'element', tag: 'hr', className: 'my-8 border-t border-text/15' }),
  },
  {
    id: 'spacer',
    labels: { en: 'Spacer', ar: 'مسافة' },
    keywords: 'gap space blank مسافة فراغ',
    node: () => ({ kind: 'element', tag: 'div', className: 'h-16', attributes: { 'aria-hidden': 'true' } }),
  },
  {
    id: 'container',
    labels: { en: 'Container', ar: 'حاوية' },
    keywords: 'box div wrapper stack حاوية صندوق',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'flex flex-col gap-4 rounded-xl p-6',
      children: [paragraph(t(l, 'Put anything inside.', 'ضع أي شيء بداخلها.'))],
    }),
  },
  {
    id: 'columns',
    labels: { en: 'Columns', ar: 'أعمدة' },
    keywords: 'two columns split row أعمدة عمودان',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'grid gap-6 md:grid-cols-2',
      children: [column(l, 1), column(l, 2)],
    }),
  },
  {
    id: 'grid',
    labels: { en: 'Grid', ar: 'شبكة' },
    keywords: 'three cards tiles شبكة بطاقات',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
      children: [column(l, 1), column(l, 2), column(l, 3)],
    }),
  },
  {
    id: 'card',
    labels: { en: 'Card', ar: 'بطاقة' },
    keywords: 'panel tile feature بطاقة',
    node: (l) => ({
      kind: 'element',
      tag: 'article',
      className: 'flex flex-col gap-3 rounded-2xl border border-text/15 bg-surface p-6 shadow-soft',
      children: [
        { kind: 'icon', name: 'star', size: 28, className: 'text-accent' },
        { kind: 'element', tag: 'h3', className: 'text-xl font-semibold', text: t(l, 'Card title', 'عنوان البطاقة') },
        paragraph(t(l, 'Two lines that explain the idea.', 'سطران يشرحان الفكرة.'), 'text-sm text-text-muted'),
        {
          kind: 'element',
          tag: 'a',
          className: 'mt-2 font-medium text-accent',
          attributes: { href: '#' },
          text: t(l, 'Read more', 'اقرأ المزيد'),
        },
      ],
    }),
  },
  {
    id: 'list',
    labels: { en: 'List', ar: 'قائمة' },
    keywords: 'bullets ul items قائمة نقاط',
    node: (l) => ({
      kind: 'element',
      tag: 'ul',
      className: 'list-disc space-y-2 ps-6',
      children: [1, 2, 3].map((n) => ({
        kind: 'element' as const,
        tag: 'li' as const,
        text: t(l, `Point ${String(n)}`, `النقطة ${String(n)}`),
      })),
    }),
  },
  {
    id: 'form',
    labels: { en: 'Form', ar: 'نموذج' },
    keywords: 'contact whatsapp message نموذج تواصل',
    node: (l) => ({
      kind: 'element',
      tag: 'form',
      className: 'flex flex-col gap-4 rounded-xl border border-text/15 p-6',
      attributes: { 'data-ck-behavior': 'whatsapp-form', 'data-ck-phone': '15550000000' },
      children: [
        {
          kind: 'element',
          tag: 'label',
          className: 'flex flex-col gap-1 text-sm font-medium',
          text: t(l, 'Your name', 'اسمك'),
          attributes: { for: 'ck-form-name' },
        },
        {
          kind: 'element',
          tag: 'input',
          className: 'rounded-lg border border-text/20 px-3 py-2',
          attributes: { id: 'ck-form-name', type: 'text', name: 'name', required: '' },
        },
        {
          kind: 'element',
          tag: 'label',
          className: 'flex flex-col gap-1 text-sm font-medium',
          text: t(l, 'Message', 'الرسالة'),
          attributes: { for: 'ck-form-message' },
        },
        {
          kind: 'element',
          tag: 'textarea',
          className: 'rounded-lg border border-text/20 px-3 py-2',
          attributes: { id: 'ck-form-message', name: 'message', rows: '4' },
        },
        {
          kind: 'element',
          tag: 'button',
          className: 'rounded-lg bg-accent px-5 py-3 font-semibold text-accent-text',
          attributes: { type: 'submit' },
          text: t(l, 'Send on WhatsApp', 'أرسل عبر واتساب'),
        },
      ],
    }),
  },
  {
    id: 'input',
    labels: { en: 'Input', ar: 'حقل إدخال' },
    keywords: 'field text box email حقل',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'flex flex-col gap-1',
      children: [
        {
          kind: 'element',
          tag: 'label',
          className: 'text-sm font-medium',
          text: t(l, 'Email', 'البريد الإلكتروني'),
          attributes: { for: 'ck-input-email' },
        },
        {
          kind: 'element',
          tag: 'input',
          className: 'rounded-lg border border-text/20 px-3 py-2',
          attributes: { id: 'ck-input-email', type: 'email', name: 'email', placeholder: 'name@example.com' },
        },
      ],
    }),
  },
  {
    id: 'map',
    labels: { en: 'Map embed', ar: 'خريطة مضمّنة' },
    keywords: 'google maps location address خريطة موقع',
    node: (l) => ({
      kind: 'element',
      tag: 'iframe',
      className: 'aspect-video w-full rounded-xl border-0',
      attributes: { src: MAP_SRC, title: t(l, 'Map to our place', 'خريطة الوصول إلينا'), loading: 'lazy' },
    }),
  },
  {
    id: 'video-embed',
    labels: { en: 'Video embed', ar: 'فيديو مضمّن' },
    keywords: 'youtube vimeo embed يوتيوب',
    node: (l) => ({
      kind: 'element',
      tag: 'iframe',
      className: 'aspect-video w-full rounded-xl border-0',
      attributes: { src: VIDEO_EMBED_SRC, title: t(l, 'Our story on video', 'قصتنا بالفيديو'), loading: 'lazy' },
    }),
  },
  {
    id: 'accordion',
    labels: { en: 'Accordion', ar: 'أكورديون' },
    keywords: 'faq details collapse questions أسئلة طي',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'flex flex-col divide-y divide-text/15 rounded-xl border border-text/15',
      children: [1, 2].map((n) => ({
        kind: 'element' as const,
        tag: 'details' as const,
        className: 'group p-4',
        children: [
          {
            kind: 'element' as const,
            tag: 'summary' as const,
            className: 'cursor-pointer font-medium',
            text: t(l, `Question ${String(n)}`, `السؤال ${String(n)}`),
          },
          paragraph(t(l, 'The answer, in a sentence or two.', 'الإجابة في جملة أو اثنتين.'), 'pt-3 text-sm text-text-muted'),
        ],
      })),
    }),
  },
  {
    id: 'tabs',
    labels: { en: 'Tabs', ar: 'تبويبات' },
    keywords: 'tabbed panels switch تبويب',
    node: (l) => ({
      kind: 'element',
      tag: 'div',
      className: 'flex flex-col gap-4',
      attributes: { 'data-ck-behavior': 'tabs' },
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'flex gap-2 border-b border-text/15',
          children: [1, 2].map((n) => ({
            kind: 'element' as const,
            tag: 'button' as const,
            className: 'px-4 py-2 font-medium',
            attributes: { type: 'button' },
            text: t(l, `Tab ${String(n)}`, `التبويب ${String(n)}`),
          })),
        },
        paragraph(t(l, 'What the first tab shows.', 'ما يعرضه التبويب الأول.')),
        paragraph(t(l, 'What the second tab shows.', 'ما يعرضه التبويب الثاني.')),
      ],
    }),
  },
] satisfies LibraryElementPreset[]);
