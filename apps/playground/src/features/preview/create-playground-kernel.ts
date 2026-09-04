import {
  blocksMarketing,
  builderAceternity,
  builderCustomCode,
  builderMagicUi,
  builderPrimitives,
  builderShadcn,
  codeViewExtension,
  createBuilder,
  defaultBlocks,
  emptyDocument,
  marketingTemplates,
  richTextExtension,
  type BuilderDocument,
  type BuilderKernel,
  type ContentDirection,
  type CreateBuilderOptions,
  type Node,
  type TrustedExtensionManifest,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { demoExtension } from './demo-extension';

export type PlaygroundFixture = 'code-view' | 'empty' | 'landing' | 'inline';

/** The playground's own marketing landing document (real vocabulary, ar+en). */
export function marketingLanding(dir: ContentDirection = 'ltr'): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'CraftKit Landing' },
      slots: {
        default: [
          'announcement',
          'aurora',
          'carousel',
          'logos',
          'marquee',
          'about',
          'rich-story',
          'showcase',
          'bento',
          'stats',
          'features',
          'pricing',
          'quotes',
          'faq',
          'form',
          'spotlight-promo',
          'newsletter',
        ],
      },
    },
    announcement: {
      id: 'announcement',
      type: 'announcementBar',
      props: {
        label: 'New',
        message: 'Professional page templates are now available in the builder.',
        linkLabel: 'Explore the library',
        href: '#templates',
        emphasis: 'inverse',
        layout: 'inline',
        density: 'compact',
        align: 'center',
        tone: 'dark',
        spacing: 'none',
        width: 'wide',
      },
    },
    hero: {
      id: 'hero',
      type: 'hero',
      props: {
        /* Content, not a ground — the aurora it sits in owns both. */
        tone: 'transparent',
        align: 'center',
        variant: 'centered',
        eyebrow: 'The professional website builder',
        heading: 'Build pages your kernel can prove',
        body: 'Design a complete, production-ready experience from premium blocks while every change stays validated and reversible.',
        trustLine: 'Original templates · Responsive by default · RTL ready',
        /*
          Motion, as a NAMED STEP rather than a duration. The stylesheet decides
          what 'normal' is worth, so re-pointing one theme value retimes every
          animation on the site — the same bargain the spacing and colour scales
          already make.
        */
        motion: { reveal: 'fade-up', duration: 'normal', easing: 'ease-out' },
        /* Edge to edge. Impossible while the gutter was a stylesheet constant. */
        gutter: 'none',
        width: 'full',
      },
      /*
        Still on a phone. Motion is a real per-breakpoint choice, and a hero
        that slides on a small screen mostly reads as jank.
      */
      responsive: { mobile: { align: 'start', motion: { reveal: 'none' } } },
      slots: { actions: ['cta-start', 'cta-docs'] },
    },
    logos: {
      id: 'logos',
      type: 'logoCloud',
      props: {
        eyebrow: 'Built for ambitious teams',
        heading: 'A dependable foundation from first concept to global launch',
        body: 'Product, studio, and commerce teams share the same professional design vocabulary.',
        variant: 'minimal',
        columns: '5',
        align: 'center',
        tone: 'transparent',
        spacing: 'md',
        width: 'wide',
        items: [
          { name: 'Northstar', descriptor: 'Product' },
          { name: 'Arcform', descriptor: 'Design' },
          { name: 'Meridian', descriptor: 'Commerce' },
          { name: 'Canopy', descriptor: 'Operations' },
          { name: 'Fieldwork', descriptor: 'Research' },
        ],
      },
    },
    marquee: {
      id: 'marquee',
      type: 'marquee',
      props: {
        label: 'Professional capabilities',
        presentation: 'compact',
        direction: 'forward',
        speed: 'slow',
        edgeFade: true,
        items: [
          { title: 'Responsive', meta: 'Container-aware' },
          { title: 'Accessible', meta: 'Semantic by default' },
          { title: 'RTL-ready', meta: 'Logical layout' },
          { title: 'Token-bound', meta: 'Fully themeable' },
          { title: 'Atomic', meta: 'Reliable undo' },
          { title: 'AI-ready', meta: 'Validated commands' },
        ],
      },
    },
    /*
      Aceternity's aurora, adapted to this project's tokens.

      Upstream hard-codes Tailwind's palette into the gradient, so every site
      would have carried the same blue effect at the top of the page. Rewritten
      against --t-*, it follows whatever palette the design system generated.
      `className` here is arbitrary Tailwind, checked at the door.

      The hero inside is `tone: 'transparent'`, and that is the whole
      arrangement rather than a detail: an aurora is a BACKGROUND, so a child
      painting its own opaque ground hides it completely. This document shipped
      with a dark hero inside a dark aurora and the effect was invisible — the
      block looked broken to anyone who opened the page. The aurora owns the
      ground and the ink now; the hero is content.
    */
    aurora: {
      id: 'aurora',
      type: 'auroraBackground',
      props: {
        tone: 'dark',
        intensity: 'bold',
        animate: true,
        minHeight: 'half',
      },
      slots: { default: ['hero'] },
    },
    carousel: {
      id: 'carousel',
      type: 'carousel',
      props: {
        eyebrow: 'A complete visual system',
        heading: 'Move from a strong first frame to a complete story',
        body: 'Each slide is responsive, accessible, editable, and safe to publish.',
        variant: 'split',
        mediaPosition: 'end',
        mediaAspect: 'wide',
        autoplay: false,
        showControls: true,
        showIndicators: true,
        items: [
          {
            label: '01 · Compose',
            title: 'Start with a professional structure',
            body: 'Use complete sections and templates instead of rebuilding the same page skeleton.',
            imageSrc: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1400&q=85',
            imageAlt: 'A product team composing a launch plan together',
            action: { label: 'Explore templates', href: '#templates' },
          },
          {
            label: '02 · Customize',
            title: 'Shape every block through explicit controls',
            body: 'Typography, spacing, layout, colour roles, motion, media, and content stay inspectable.',
            imageSrc: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1400&q=85',
            imageAlt: 'A designer refining a responsive interface system',
            action: { label: 'See customization', href: '#customization' },
          },
          {
            label: '03 · Prove',
            title: 'Publish from a document the kernel can validate',
            body: 'Atomic changes, safe URLs, and deterministic composition keep quality in the architecture.',
            imageSrc: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=85',
            imageAlt: 'A product analytics view showing a successful launch',
            action: { label: 'Read the architecture', href: '#architecture' },
          },
        ],
      },
    },
    /*
      The scroll-zoom demonstration.

      `scale-on-scroll` is a NAMED STEP in the closed motion vocabulary, not a
      transform anyone wrote here. It compiles to a real `@keyframes` on an
      `animation-timeline: view()`, so the zoom is driven by scroll position on
      the compositor — no JavaScript, no observer, and nothing loaded to make it
      happen. The document holds the word, never the transform.
    */
    showcase: {
      id: 'showcase',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-1618477247222-acbdb0e159b3?w=1600&q=80',
        alt: 'A grid of coloured panels seen from directly above.',
        width: 'wide',
        ratio: 'wide',
        radius: 'md',
        motion: { scroll: 'scale-on-scroll', duration: 'slow' },
      },
    },
    about: {
      id: 'about',
      type: 'content-section',
      props: {
        eyebrow: 'Designed as a system',
        heading: 'Move fast without trading away quality or control',
        body: 'CraftKit combines a curated design vocabulary with a deterministic editing kernel. The result is a builder that stays expressive, inspectable, and safe as the site grows.',
        layout: 'editorial',
        highlights: [
          {
            title: 'One validated door',
            body: 'Every edit becomes a transparent transaction with reliable undo.',
          },
          {
            title: 'A real design language',
            body: 'Responsive spacing, typography, surfaces, and motion stay token-bound.',
          },
        ],
        link: { label: 'See the architecture', href: '#architecture' },
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
    },
    'rich-story': {
      id: 'rich-story',
      type: 'richText',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Why it holds' }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Every edit is ' },
                { type: 'text', text: 'one transaction', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' through a ' },
                {
                  type: 'text',
                  text: 'validated door',
                  marks: [{ type: 'link', attrs: { href: '#architecture' } }],
                },
                {
                  type: 'text',
                  text: ', so design freedom never creates a second mutation path.',
                },
              ],
            },
          ],
        },
      },
    },
    'cta-start': { id: 'cta-start', type: 'cta', props: { label: 'Get started' } },
    'cta-docs': {
      id: 'cta-docs',
      type: 'cta',
      props: { label: 'اقرأ التوثيق', emphasis: 'ghost' },
    },
    bento: {
      id: 'bento',
      type: 'bento-grid',
      props: {
        eyebrow: 'Everything works together',
        heading: 'A professional building system, not a pile of disconnected widgets',
        body: 'Compose rich sections, preserve design coherence, and keep the document portable.',
        layout: 'mosaic',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            kicker: 'Vocabulary',
            title: '32 production-ready marketing blocks',
            body: 'From sliders, banners, galleries, and video to products, forms, comparisons, and editorial content.',
            metric: '32',
            size: 'featured',
            emphasis: 'inverse',
          },
          {
            kicker: 'Templates',
            title: 'Complete pages in one action',
            body: 'Start with a coherent layout and then refine every block independently.',
            metric: '4',
            size: 'tall',
            emphasis: 'accent',
          },
          {
            kicker: 'Safety',
            title: 'Atomic changes',
            body: 'Validation happens before the document changes.',
            size: 'small',
            emphasis: 'neutral',
          },
          {
            kicker: 'Reach',
            title: 'Responsive and RTL-ready',
            body: 'Logical properties and container queries adapt without fragile overrides.',
            size: 'wide',
            emphasis: 'neutral',
          },
        ],
      },
    },
    stats: {
      id: 'stats',
      type: 'stats',
      props: {
        eyebrow: 'Quality you can inspect',
        heading: 'A stronger starting point for every launch',
        body: 'The library is designed to reduce repetitive setup while keeping every decision editable.',
        variant: 'cards',
        columns: '4',
        headerLayout: 'split',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          { value: '32', label: 'Marketing blocks', detail: 'Across the full customer journey' },
          { value: '4', label: 'Page templates', detail: 'Inserted as one transaction' },
          { value: '100%', label: 'Token-bound', detail: 'No theme-breaking magic values' },
          { value: 'RTL', label: 'Native direction', detail: 'The same document model' },
        ],
      },
    },
    features: {
      id: 'features',
      type: 'features',
      props: {
        eyebrow: 'Built for real work',
        heading: 'Why CraftKit',
        body: 'The core guarantees stay invisible when you design—and dependable when you ship.',
        variant: 'cards',
        columns: '3',
        items: [
          {
            kicker: 'Predictable',
            icon: '01',
            title: 'Deterministic',
            body: 'Same seed, same history — bit for bit.',
          },
          {
            kicker: 'Protected',
            icon: '02',
            title: 'Sealed',
            body: 'One validated door; no second mutation path.',
          },
          {
            kicker: 'Global',
            icon: '03',
            title: 'ثنائي الاتجاه',
            body: 'RTL و LTR بنفس المستند.',
          },
        ],
      },
    },
    /*
      Composed, not configured.

      The plans used to be an array of data on this node, which meant a card
      could hold a feature list and nothing else — no button, no badge, no
      note. They are `pricingPlan` NODES now, and each one holds whatever a
      person puts inside it. The call-to-action inside the featured card is the
      whole point, and it was impossible to author before.
    */
    pricing: {
      id: 'pricing',
      type: 'pricing',
      props: {
        heading: 'Pricing',
        columns: '2',
        align: 'center',
        spacing: 'lg',
        /*
          Full-bleed, and customised from the document.

          `gutter: 'none'` was not expressible at all until the side padding
          stopped being a constant in the stylesheet. `className` is arbitrary
          Tailwind, validated at the door: `p-4` is allowed because it means
          four steps of the site's rhythm, `bg-blue-500` and `p-[17px]` are
          refused because the design system cannot reach either.
        */
        gutter: 'none',
        className: 'rounded-base',
      },
      slots: { default: ['plan-solo', 'plan-team'] },
    },
    'plan-solo': {
      id: 'plan-solo',
      type: 'pricingPlan',
      props: { name: 'Solo', price: '$9', period: 'month' },
      slots: { default: ['plan-solo-body'] },
    },
    'plan-solo-body': {
      id: 'plan-solo-body',
      type: 'richText',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'One project, and everything to publish it.' }],
            },
          ],
        },
      },
    },
    'plan-team': {
      id: 'plan-team',
      type: 'pricingPlan',
      props: {
        name: 'Team',
        price: '$29',
        period: 'month',
        emphasis: 'featured',
        // Arbitrary Tailwind on one card only, stored in the document.
        className: 'lg:scale-105 ring-2 ring-accent/30',
      },
      slots: { default: ['plan-team-body', 'plan-team-cta'] },
    },
    'plan-team-body': {
      id: 'plan-team-body',
      type: 'richText',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Unlimited projects and priority support.' }],
            },
          ],
        },
      },
    },
    'plan-team-cta': {
      id: 'plan-team-cta',
      type: 'cta',
      props: { label: 'Choose Team', emphasis: 'primary', width: 'full' },
    },
    quotes: {
      id: 'quotes',
      type: 'testimonials',
      props: {
        eyebrow: 'What teams notice',
        heading: 'Loved by teams',
        body: 'A builder can feel fast without becoming careless.',
        variant: 'spotlight',
        items: [
          {
            quote: 'أفضل تجربة بناء صفحات جربناها. أخيرًا السرعة والجودة في نفس المكان.',
            author: 'سارة',
            role: 'مؤسِّسة',
            company: 'مدار',
            rating: 5,
          },
          {
            quote:
              'We moved from a rough idea to a coherent launch page without fighting the system.',
            author: 'Maya Chen',
            role: 'Product lead',
            company: 'Northstar',
            rating: 5,
          },
        ],
      },
    },
    faq: {
      id: 'faq',
      type: 'faq',
      props: {
        eyebrow: 'Answers, upfront',
        heading: 'Everything you need before you start building',
        body: 'Straight answers about templates, customization, and document safety.',
        layout: 'columns',
        variant: 'cards',
        openFirst: true,
        showNumbers: false,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          {
            question: 'Can I customize every template?',
            answer:
              'Yes. A template inserts ordinary registered blocks, so every supported property remains editable.',
          },
          {
            question: 'Does inserting a template create many undo steps?',
            answer:
              'No. The complete composition is validated and inserted as one atomic transaction.',
          },
          {
            question: 'Will the sections work on mobile?',
            answer:
              'Each professional block uses responsive, container-aware layouts and logical spacing.',
          },
          {
            question: 'Can the same page be used in Arabic?',
            answer:
              'Yes. The document direction can switch to RTL without maintaining a separate component set.',
          },
        ],
      },
    },
    form: {
      id: 'form',
      type: 'formSection',
      props: {
        eyebrow: 'Build something consequential',
        heading: 'Start with the outcome you want to create',
        body: 'A flexible native form for enquiries, applications, bookings, and custom workflows.',
        fields: [
          {
            id: 'name',
            name: 'name',
            type: 'text',
            label: 'Name',
            autoComplete: 'name',
            required: true,
            width: 'half',
          },
          {
            id: 'email',
            name: 'email',
            type: 'email',
            label: 'Work email',
            autoComplete: 'email',
            required: true,
            width: 'half',
          },
          {
            id: 'website-type',
            name: 'website_type',
            type: 'select',
            label: 'What are you building?',
            placeholder: 'Choose a website type',
            required: true,
            width: 'half',
            options: [
              { label: 'Product or SaaS', value: 'saas' },
              { label: 'Commerce', value: 'commerce' },
              { label: 'Portfolio or studio', value: 'portfolio' },
              { label: 'Professional services', value: 'services' },
            ],
          },
          {
            id: 'timeline',
            name: 'timeline',
            type: 'date',
            label: 'Ideal launch date',
            width: 'half',
          },
          {
            id: 'brief',
            name: 'brief',
            type: 'textarea',
            label: 'What must this website achieve?',
            helper: 'A few direct sentences are enough.',
            required: true,
            width: 'full',
            rows: 5,
          },
        ],
        submitLabel: 'Send the brief',
        footerNote: 'Every field, label, action, and visual treatment remains editable.',
        action: '/project-enquiry',
        variant: 'split',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
    },
    'spotlight-promo': {
      id: 'spotlight-promo',
      type: 'spotlightSurface',
      props: {
        variant: 'dual',
        position: 'center',
        intensity: 'balanced',
        tone: 'dark',
        minHeight: 'auto',
        animate: true,
      },
      slots: { default: ['promo'] },
    },
    promo: {
      id: 'promo',
      type: 'promoBanner',
      props: {
        label: 'Ready when the page matters',
        headline: 'Begin with a complete professional system, then make it unmistakably yours',
        body: 'Choose a template or compose from the full block catalog. Every part stays editable and every change remains reversible.',
        actions: [
          { label: 'Open templates', href: '#templates', emphasis: 'primary' },
          { label: 'Browse all blocks', href: '#blocks', emphasis: 'secondary' },
        ],
        showMedia: false,
        variant: 'centered',
        panelStyle: 'surface',
        padding: 'spacious',
        radius: 'xl',
        align: 'center',
        tone: 'transparent',
        spacing: 'md',
        width: 'wide',
      },
    },
    newsletter: {
      id: 'newsletter',
      type: 'newsletter',
      props: {
        eyebrow: 'Product notes',
        heading: 'Build the next version with us',
        body: 'A concise note about new blocks, templates, and the decisions behind them.',
        emailLabel: 'Work email',
        placeholder: 'name@company.com',
        buttonLabel: 'Join the list',
        privacy: 'No noise. Unsubscribe in one click.',
        action: '/subscribe',
        variant: 'split',
        formLayout: 'row',
        align: 'start',
        tone: 'dark',
        spacing: 'lg',
        width: 'wide',
      },
    },
  };
  return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
}

/**
 * The B3c inline-editing fixture: one block with an inline-editable STRING
 * prop (the announcement's message) and one with an inline-editable RICH prop
 * (the story's content) — the smallest document that walks select → edit in
 * place → format via the bubble → act via the block action bar.
 */
export function inlineEditing(dir: ContentDirection = 'ltr'): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Inline editing' },
      slots: { default: ['note', 'tale'] },
    },
    note: { id: 'note', type: 'announcement', props: { message: 'Edit me in place' } },
    tale: {
      id: 'tale',
      type: 'story',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Select this line and make it bold.' }],
            },
          ],
        },
      },
    },
  };
  return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
}

/** The smallest registry-valid page that proves scoped code editing and refusal. */
export function codeViewEditing(dir: ContentDirection = 'ltr'): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Code view editing' },
      slots: { default: ['hero'] },
    },
    hero: {
      id: 'hero',
      type: 'hero',
      props: {
        tone: 'dark',
        align: 'center',
        heading: 'Build pages your kernel can prove',
        body: 'كل تعديل يمر من باب واحد — وقابل للتراجع.',
      },
      responsive: { mobile: { align: 'start' } },
      slots: { actions: ['cta-start', 'cta-docs'] },
    },
    'cta-start': { id: 'cta-start', type: 'cta', props: { label: 'Get started' } },
    'cta-docs': {
      id: 'cta-docs',
      type: 'cta',
      props: { label: 'اقرأ التوثيق', emphasis: 'ghost' },
    },
  };
  return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
}

/**
 * The DOCUMENT a fixture names.
 *
 * Split out of `createPlaygroundKernel` because the vault opens its documents
 * through `openDocument`, which builds the kernel itself: the fixture is what a
 * vault seeds a never-before-stored document with, and the two paths must not
 * disagree about what "the landing page" is.
 */
export function playgroundDocument(
  fixture: PlaygroundFixture,
  dir: ContentDirection = 'ltr',
): BuilderDocument {
  return fixture === 'landing'
    ? marketingLanding(dir)
    : fixture === 'code-view'
      ? codeViewEditing(dir)
      : fixture === 'inline'
        ? inlineEditing(dir)
        : emptyDocument('site', dir);
}

/**
 * Every extension a playground session registers, in registration order.
 *
 * `openDocument` runs `kernel.validate()` INTERNALLY, before the caller can
 * touch the kernel it returns — so a document opened with a narrower extension
 * list than the one that wrote it refuses to open at all (`doc/unknown-type`).
 * That is precisely why this list is one function rather than two copies: the
 * fixture path and the vault path must register the same vocabulary or a stored
 * page becomes unopenable.
 */
export function playgroundExtensions(fixture: PlaygroundFixture): TrustedExtensionManifest[] {
  const shared = [
    defaultBlocks,
    blocksMarketing,
    builderPrimitives,
    builderAceternity,
    builderMagicUi,
    builderCustomCode,
    builderShadcn,
    richTextExtension,
    codeViewExtension,
  ];
  // The inline fixture's document HOLDS the demo blocks, so their schemas must
  // be live at creation; landing and empty keep the FR-013 story — registration
  // happens at runtime through <RegisterDemoExtension/>.
  return fixture === 'inline' ? [...shared, demoExtension] : shared;
}

/**
 * The deterministic ports every playground session runs on — and the answer to
 * the one hazard a REOPENED session has that a fresh one does not.
 *
 * `seededIds('pg')` restarts at `pg-0001` every time a kernel is created. A
 * fixture never claims those names, so nothing collides on a fresh boot; a
 * document read back out of the vault DOES claim them, and the next insert
 * would otherwise hand out an id the document already uses. Consulting the LIVE
 * document (rather than a snapshot taken at open) also covers ids that arrive
 * mid-session — a restore from the snapshot shelf carries an older session's
 * ids straight back into the document.
 */
export function playgroundPorts(
  live: () => Readonly<BuilderDocument> | undefined,
): NonNullable<CreateBuilderOptions['ports']> {
  const ids = seededIds('pg');
  return {
    clock: fixedClock(),
    ids: {
      newId() {
        let id = ids.newId();
        while (Object.hasOwn(live()?.nodes ?? {}, id)) {
          id = ids.newId();
        }
        return id;
      },
    },
  };
}

/**
 * Tier-2 compositions, hydrated AFTER the kernel exists. Templates are not
 * block types, so validation never needs them — which is what lets the vault
 * call this on the kernel `openDocument` hands back, having already validated.
 */
export function hydratePlaygroundTemplates(kernel: BuilderKernel): void {
  kernel.extensions.hydrateDeclarative(marketingTemplates);
}

export function createPlaygroundKernel(
  options: { fixture?: PlaygroundFixture; dir?: ContentDirection } = {},
): BuilderKernel {
  const dir = options.dir ?? 'ltr';
  const fixture = options.fixture ?? 'landing';

  /*
    Deterministic by construction; zero backend, zero network (FR-014). The id
    port reads the kernel it is being built for, which is legal only because
    ids are issued by a dispatch and nothing dispatches before this call
    returns — a licence, not a guarantee.

    So the read goes through `kernel?.` exactly as the vault's does
    (use-vault.ts): a `const` read inside its own initialiser is a TDZ
    ReferenceError, not an undefined, and a future extension or manifest setup
    hook that asked for one id during `createBuilder` would take the whole boot
    down instead of degrading. The two call sites of `playgroundPorts` must
    agree about whether the kernel can be absent, and this is the answer that
    survives being wrong.
  */
  // A box rather than a `let`: the port reads it from inside the very call that
  // produces it, and a `let` assigned exactly once is a `const` to the linter.
  const opened: { current?: BuilderKernel } = {};
  const kernel = createBuilder({
    document: playgroundDocument(fixture, dir),
    extensions: playgroundExtensions(fixture),
    ports: playgroundPorts(() => opened.current?.getDocument()),
  });
  opened.current = kernel;
  hydratePlaygroundTemplates(kernel);
  return kernel;
}
