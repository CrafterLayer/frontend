import {
  buildCompare,
  buildGallery,
  buildMapFacade,
  buildPricingToggle,
  buildSceneSection,
  buildVideoFacade,
  buildVideoPlayer,
  buildVideoSection,
  isMediaRecipeError,
  mediaRecipeNode,
  type CustomCodeNode,
  type GalleryLayout,
  type MediaImage,
  type MediaRecipeResult,
} from '@craftkit/builder-schema';

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
  /** Region CSS the node's own `ck-` hooks need (media-motion (2026-10-06): masonry, bento, carousel). */
  readonly css?: ((language: LibraryLanguage) => string) | undefined;
}

const t = (language: LibraryLanguage, en: string, ar: string): string => (language === 'ar' ? ar : en);

const IMAGE_SRC = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
// A complete "Share → Embed a map" address: the `pb` blob declares 18 parts (`!1m18`), and the
// earlier one stopped after 12, which Google answers with HTTP 400 ("rejected your request").
const MAP_SRC =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.6175843!2d-73.98784!3d40.74844!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus';
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

// media-motion (2026-10-06) additions — helpers for the media presets below.
/*
  The media presets (media-motion DESIGN D10) are built ONLY by the schema's
  media recipes, the same pure builders the agent's `media.add` calls, so a
  gallery inserted by hand and one the agent adds are the same tree. Each is
  element-level where the recipe allows it (a gallery, a player, a facade, a
  widget lands inside the current section); a background video and a scene
  are whole hero sections because their layer needs its host. Images are the
  Library's own placeholder photo (the catalog lives in the AI package, which
  the shell cannot import); the compare preset shows it in black and white
  before and in colour after.
*/

const VIDEO_YOUTUBE_ID = 'aqz-KE-bpKQ';

/** The recipe's one element; a preset's fixed inputs never fail, so a refusal is a programming error. */
function recipeNode(result: MediaRecipeResult): CustomCodeNode {
  if (isMediaRecipeError(result)) throw new Error(`media preset: ${result.error}`);
  return mediaRecipeNode(result);
}

function recipeCss(result: MediaRecipeResult): string {
  return isMediaRecipeError(result) ? '' : result.css;
}

function placeholderImages(language: LibraryLanguage, count: number): MediaImage[] {
  return Array.from({ length: count }, (_, at) => ({
    src: IMAGE_SRC,
    alt: t(language, `Hills under a morning sky, photo ${String(at + 1)}`, `تلال تحت سماء الصباح، الصورة ${String(at + 1)}`),
    width: 1200,
    height: 800,
  }));
}

function galleryPreset(language: LibraryLanguage, layout: GalleryLayout): MediaRecipeResult {
  return buildGallery({
    layout,
    images: placeholderImages(language, 6),
    locale: language,
    captions: layout === 'masonry',
    standalone: false,
  });
}

function galleryEntry(
  id: string,
  layout: GalleryLayout,
  labels: LibraryElementPreset['labels'],
  keywords: string,
): LibraryElementPreset {
  return {
    id,
    labels,
    keywords,
    node: (l) => recipeNode(galleryPreset(l, layout)),
    css: (l) => recipeCss(galleryPreset(l, layout)),
  };
}

function mediaPresets(): LibraryElementPreset[] {
  return [
    galleryEntry('gallery-grid', 'grid', { en: 'Photo gallery', ar: 'معرض صور' }, 'معرض صور gallery photos grid lightbox شبكة'),
    galleryEntry(
      'gallery-masonry',
      'masonry',
      { en: 'Masonry gallery', ar: 'معرض صور متداخل' },
      'معرض صور متداخل gallery masonry pinterest',
    ),
    galleryEntry(
      'gallery-carousel',
      'carousel',
      { en: 'Gallery carousel', ar: 'معرض صور منزلق' },
      'معرض صور سلايدر منزلق gallery carousel slider',
    ),
    {
      id: 'video-player',
      labels: { en: 'Video player', ar: 'مشغل فيديو' },
      keywords: 'فيديو مشغل video player mp4 controls',
      node: (l) =>
        recipeNode(
          buildVideoPlayer(l, {
            src: VIDEO_SRC,
            type: 'video/mp4',
            poster: IMAGE_SRC,
            title: t(l, 'A flower opens', 'زهرة تتفتح'),
          }),
        ),
    },
    {
      id: 'video-youtube',
      labels: { en: 'YouTube video', ar: 'فيديو يوتيوب' },
      keywords: 'فيديو يوتيوب video youtube vimeo facade',
      node: (l) =>
        recipeNode(
          buildVideoFacade(l, {
            video: { kind: 'youtube', id: VIDEO_YOUTUBE_ID },
            poster: IMAGE_SRC,
            title: t(l, 'Our story on video', 'قصتنا بالفيديو'),
          }),
        ),
    },
    {
      id: 'bg-video-hero',
      labels: { en: 'Background video hero', ar: 'واجهة بفيديو خلفي' },
      keywords: 'فيديو خلفية هيرو background video hero loop',
      node: (l) =>
        recipeNode(
          buildVideoSection(l, {
            mode: 'background',
            url: VIDEO_SRC,
            poster: IMAGE_SRC,
            title: t(l, 'A clear headline', 'عنوان واضح'),
            text: t(l, 'One line that says what you offer.', 'سطر واحد يقول ما تقدمه.'),
          }),
        ),
    },
    {
      id: 'scene-particles',
      labels: { en: 'Animated background', ar: 'خلفية متحركة' },
      keywords: 'خلفية متحركة جزيئات animated background particles pixi',
      node: (l) =>
        recipeNode(
          buildSceneSection({
            scene: 'particles',
            locale: l,
            title: t(l, 'A clear headline', 'عنوان واضح'),
            text: t(l, 'One line that says what you offer.', 'سطر واحد يقول ما تقدمه.'),
          }),
        ),
    },
    {
      id: 'scene-mural',
      labels: { en: 'Moving mural', ar: 'جدارية متحركة' },
      keywords: 'خلفية متحركة جدارية mural pixi animated wall',
      node: (l) =>
        recipeNode(
          buildSceneSection({
            scene: 'mural',
            images: placeholderImages(l, 3),
            locale: l,
            title: t(l, 'A clear headline', 'عنوان واضح'),
          }),
        ),
    },
    {
      id: 'compare',
      labels: { en: 'Before and after', ar: 'قبل وبعد' },
      keywords: 'قبل وبعد compare before after slider',
      node: (l) =>
        recipeNode(
          buildCompare({
            locale: l,
            standalone: false,
            before: {
              src: `${IMAGE_SRC}&sat=-100`,
              alt: t(l, 'Before: the hills in black and white', 'قبل: التلال بالأبيض والأسود'),
              width: 1200,
              height: 800,
            },
            after: {
              src: IMAGE_SRC,
              alt: t(l, 'After: the hills in colour', 'بعد: التلال بالألوان'),
              width: 1200,
              height: 800,
            },
          }),
        ),
    },
    {
      id: 'pricing-toggle',
      labels: { en: 'Pricing (monthly / yearly)', ar: 'أسعار (شهري / سنوي)' },
      keywords: 'أسعار شهري سنوي pricing monthly yearly plans toggle',
      node: (l) =>
        recipeNode(
          buildPricingToggle({
            locale: l,
            standalone: false,
            plans: [
              { name: t(l, 'Starter', 'أساسي'), a: '$9', b: '$90', features: [t(l, 'One site', 'موقع واحد')] },
              { name: t(l, 'Pro', 'احترافي'), a: '$29', b: '$290', features: [t(l, 'Five sites', 'خمسة مواقع')] },
            ],
          }),
        ),
    },
    {
      id: 'map-facade',
      labels: { en: 'Map (loads on click)', ar: 'خريطة (تُحمَّل عند النقر)' },
      keywords: 'خريطة map location address privacy موقع عنوان',
      node: (l) =>
        recipeNode(
          buildMapFacade(t(l, 'Empire State Building, New York', 'مبنى إمباير ستيت، نيويورك'), {
            locale: l,
            standalone: false,
          }),
        ),
    },
  ];
}
// ── end media-motion (2026-10-06) additions ──

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
      className: 'grid grid-cols-2 gap-6 max-md:grid-cols-1',
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
      className: 'grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1',
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
  // media-motion (2026-10-06) additions: galleries, video, scenes and widgets from the schema media recipes.
  ...mediaPresets(),
] satisfies LibraryElementPreset[]);
