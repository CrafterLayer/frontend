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
import { createReferenceCodePageFixture } from './code-page-fixture';
import { hydratePlaygroundTemplates } from './playground-templates';
// blocks-polish additions (2026-10-08)
import { landingCopy } from './landing-copy';
// end blocks-polish additions

export type PlaygroundFixture = 'code-page' | 'code-view' | 'empty' | 'landing' | 'inline';

// blocks-polish additions (2026-10-08): the landing reads its words from landing-copy.ts.
/**
 * The playground's own marketing landing document (real vocabulary, ar+en).
 *
 * The words come from `LANDING_COPY` by direction: English for `ltr`, Arabic
 * for `rtl` (landing-copy.ts). The structure and every node id stay here —
 * other tests address the nodes by id (landing-fixture.test.ts pins the list).
 */
export function marketingLanding(dir: ContentDirection = 'ltr'): BuilderDocument {
  const copy = landingCopy(dir);
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: copy.title },
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
        label: copy.announcement.label,
        message: copy.announcement.message,
        linkLabel: copy.announcement.linkLabel,
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
        eyebrow: copy.hero.eyebrow,
        heading: copy.hero.heading,
        body: copy.hero.body,
        trustLine: copy.hero.trustLine,
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
        that slides on a small screen mostly reads as jank. Edge to edge is a
        desktop choice too: on a 390px screen the heading and the actions keep
        the site gutter, so nothing touches the glass.
      */
      responsive: { mobile: { align: 'start', motion: { reveal: 'none' }, gutter: 'md' } },
      slots: { actions: ['cta-start', 'cta-docs'] },
    },
    logos: {
      id: 'logos',
      type: 'logoCloud',
      props: {
        eyebrow: copy.logos.eyebrow,
        heading: copy.logos.heading,
        body: copy.logos.body,
        variant: 'minimal',
        columns: '5',
        align: 'center',
        tone: 'transparent',
        spacing: 'md',
        width: 'wide',
        items: copy.logos.items.map((item) => ({ ...item })),
      },
    },
    marquee: {
      id: 'marquee',
      type: 'marquee',
      props: {
        label: copy.marquee.label,
        presentation: 'compact',
        direction: 'forward',
        speed: 'slow',
        edgeFade: true,
        items: copy.marquee.items.map((item) => ({ ...item })),
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
        eyebrow: copy.carousel.eyebrow,
        heading: copy.carousel.heading,
        body: copy.carousel.body,
        variant: 'split',
        mediaPosition: 'end',
        mediaAspect: 'wide',
        autoplay: false,
        showControls: true,
        showIndicators: true,
        items: [
          {
            label: copy.carousel.items[0]?.label ?? '',
            title: copy.carousel.items[0]?.title ?? '',
            body: copy.carousel.items[0]?.body ?? '',
            imageSrc: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1400&q=85',
            imageAlt: copy.carousel.items[0]?.imageAlt ?? '',
            action: { label: copy.carousel.items[0]?.action ?? '', href: '#templates' },
          },
          {
            label: copy.carousel.items[1]?.label ?? '',
            title: copy.carousel.items[1]?.title ?? '',
            body: copy.carousel.items[1]?.body ?? '',
            imageSrc: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1400&q=85',
            imageAlt: copy.carousel.items[1]?.imageAlt ?? '',
            action: { label: copy.carousel.items[1]?.action ?? '', href: '#customization' },
          },
          {
            label: copy.carousel.items[2]?.label ?? '',
            title: copy.carousel.items[2]?.title ?? '',
            body: copy.carousel.items[2]?.body ?? '',
            imageSrc: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=85',
            imageAlt: copy.carousel.items[2]?.imageAlt ?? '',
            action: { label: copy.carousel.items[2]?.action ?? '', href: '#architecture' },
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
        alt: copy.showcaseAlt,
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
        eyebrow: copy.about.eyebrow,
        heading: copy.about.heading,
        body: copy.about.body,
        layout: 'editorial',
        highlights: copy.about.highlights.map((highlight) => ({ ...highlight })),
        link: { label: copy.about.link, href: '#architecture' },
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
      },
    },
    /* The prose sits on the shared wide column now (RichTextBlock), so its edge lines up. */
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
              content: [{ type: 'text', text: copy.story.heading }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: copy.story.before },
                { type: 'text', text: copy.story.bold, marks: [{ type: 'bold' }] },
                { type: 'text', text: copy.story.between },
                {
                  type: 'text',
                  text: copy.story.link,
                  marks: [{ type: 'link', attrs: { href: '#architecture' } }],
                },
                { type: 'text', text: copy.story.after },
              ],
            },
          ],
        },
      },
    },
    'cta-start': { id: 'cta-start', type: 'cta', props: { label: copy.ctaStart } },
    'cta-docs': {
      id: 'cta-docs',
      type: 'cta',
      props: { label: copy.ctaDocs, emphasis: 'ghost' },
    },
    bento: {
      id: 'bento',
      type: 'bento-grid',
      props: {
        eyebrow: copy.bento.eyebrow,
        heading: copy.bento.heading,
        body: copy.bento.body,
        layout: 'mosaic',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          { ...copy.bento.items[0], size: 'featured', emphasis: 'inverse' },
          { ...copy.bento.items[1], size: 'tall', emphasis: 'accent' },
          { ...copy.bento.items[2], size: 'small', emphasis: 'neutral' },
          { ...copy.bento.items[3], size: 'wide', emphasis: 'neutral' },
        ],
      },
    },
    stats: {
      id: 'stats',
      type: 'stats',
      props: {
        eyebrow: copy.stats.eyebrow,
        heading: copy.stats.heading,
        body: copy.stats.body,
        variant: 'cards',
        columns: '4',
        headerLayout: 'split',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: copy.stats.items.map((item) => ({ ...item })),
      },
    },
    features: {
      id: 'features',
      type: 'features',
      props: {
        eyebrow: copy.features.eyebrow,
        heading: copy.features.heading,
        body: copy.features.body,
        variant: 'cards',
        columns: '3',
        width: 'wide',
        items: copy.features.items.map((item) => ({ ...item })),
      },
    },
    /*
      Composed, not configured.

      The plans used to be an array of data on this node, which meant a card
      could hold a feature list and nothing else — no button, no badge, no
      note. They are `pricingPlan` NODES now, and each one holds whatever a
      person puts inside it. Every plan carries its own call to action.

      The section keeps the shared wide column and the site gutter: edge to
      edge with a scaled card ran 18px past a 1440px screen (audit 2026-10-08).
    */
    pricing: {
      id: 'pricing',
      type: 'pricing',
      props: {
        eyebrow: copy.pricing.eyebrow,
        heading: copy.pricing.heading,
        body: copy.pricing.body,
        columns: '2',
        align: 'center',
        spacing: 'lg',
        width: 'wide',
        /*
          `className` is arbitrary Tailwind, validated at the door: `rounded-base`
          is allowed because it reads the site's radius token, `bg-blue-500` and
          `p-[17px]` are refused because the design system cannot reach either.
        */
        className: 'rounded-base',
      },
      // On a phone the plans keep the site gutter, so a card never meets the glass.
      responsive: { mobile: { gutter: 'md' } },
      slots: { default: ['plan-solo', 'plan-team'] },
    },
    'plan-solo': {
      id: 'plan-solo',
      type: 'pricingPlan',
      props: {
        name: copy.pricing.solo.name,
        price: copy.pricing.solo.price,
        period: 'month',
        periodLabel: copy.pricing.solo.period,
      },
      slots: { default: ['plan-solo-body', 'plan-solo-cta'] },
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
              content: [{ type: 'text', text: copy.pricing.solo.body }],
            },
          ],
        },
      },
    },
    'plan-solo-cta': {
      id: 'plan-solo-cta',
      type: 'cta',
      props: { label: copy.pricing.solo.cta, emphasis: 'secondary', width: 'full' },
    },
    'plan-team': {
      id: 'plan-team',
      type: 'pricingPlan',
      props: {
        name: copy.pricing.team.name,
        price: copy.pricing.team.price,
        period: 'month',
        periodLabel: copy.pricing.team.period,
        badge: copy.pricing.team.badge,
        emphasis: 'featured',
        // Arbitrary Tailwind on one card only, stored in the document. No scale: it overflowed.
        className: 'ring-2 ring-accent/30',
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
              content: [{ type: 'text', text: copy.pricing.team.body }],
            },
          ],
        },
      },
    },
    'plan-team-cta': {
      id: 'plan-team-cta',
      type: 'cta',
      props: { label: copy.pricing.team.cta, emphasis: 'primary', width: 'full' },
    },
    quotes: {
      id: 'quotes',
      type: 'testimonials',
      props: {
        eyebrow: copy.quotes.eyebrow,
        heading: copy.quotes.heading,
        body: copy.quotes.body,
        variant: 'spotlight',
        width: 'wide',
        items: copy.quotes.items.map((item) => ({ ...item, rating: 5 })),
      },
    },
    faq: {
      id: 'faq',
      type: 'faq',
      props: {
        eyebrow: copy.faq.eyebrow,
        heading: copy.faq.heading,
        body: copy.faq.body,
        layout: 'columns',
        variant: 'cards',
        openFirst: true,
        showNumbers: false,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: copy.faq.items.map((item) => ({ ...item })),
      },
    },
    form: {
      id: 'form',
      type: 'formSection',
      props: {
        eyebrow: copy.form.eyebrow,
        heading: copy.form.heading,
        body: copy.form.body,
        fields: [
          {
            id: 'name',
            name: 'name',
            type: 'text',
            label: copy.form.name,
            autoComplete: 'name',
            required: true,
            width: 'half',
          },
          {
            id: 'email',
            name: 'email',
            type: 'email',
            label: copy.form.email,
            autoComplete: 'email',
            required: true,
            width: 'half',
          },
          {
            id: 'website-type',
            name: 'website_type',
            type: 'select',
            label: copy.form.websiteType,
            placeholder: copy.form.websitePlaceholder,
            required: true,
            width: 'half',
            options: [
              { label: copy.form.options[0], value: 'saas' },
              { label: copy.form.options[1], value: 'commerce' },
              { label: copy.form.options[2], value: 'portfolio' },
              { label: copy.form.options[3], value: 'services' },
            ],
          },
          {
            id: 'timeline',
            name: 'timeline',
            type: 'date',
            label: copy.form.timeline,
            width: 'half',
          },
          {
            id: 'brief',
            name: 'brief',
            type: 'textarea',
            label: copy.form.brief,
            helper: copy.form.briefHelper,
            required: true,
            width: 'full',
            rows: 5,
          },
        ],
        submitLabel: copy.form.submitLabel,
        footerNote: copy.form.footerNote,
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
        label: copy.promo.label,
        headline: copy.promo.headline,
        body: copy.promo.body,
        actions: [
          { label: copy.promo.primary, href: '#templates', emphasis: 'primary' },
          { label: copy.promo.secondary, href: '#blocks', emphasis: 'secondary' },
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
        eyebrow: copy.newsletter.eyebrow,
        heading: copy.newsletter.heading,
        body: copy.newsletter.body,
        emailLabel: copy.newsletter.emailLabel,
        placeholder: copy.newsletter.placeholder,
        buttonLabel: copy.newsletter.buttonLabel,
        privacy: copy.newsletter.privacy,
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
// end blocks-polish additions

// blocks-polish additions (2026-10-08): one language per fixture, chosen by direction.
/**
 * The B3c inline-editing fixture: one block with an inline-editable STRING
 * prop (the announcement's message) and one with an inline-editable RICH prop
 * (the story's content) — the smallest document that walks select → edit in
 * place → format via the bubble → act via the block action bar.
 */
export function inlineEditing(dir: ContentDirection = 'ltr'): BuilderDocument {
  const copy = landingCopy(dir).inline;
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: copy.title },
      slots: { default: ['note', 'tale'] },
    },
    note: { id: 'note', type: 'announcement', props: { message: copy.message } },
    tale: {
      id: 'tale',
      type: 'story',
      props: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: copy.story }],
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
  const all = landingCopy(dir);
  const copy = all.codeView;
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: copy.title },
      slots: { default: ['hero'] },
    },
    hero: {
      id: 'hero',
      type: 'hero',
      props: {
        tone: 'dark',
        align: 'center',
        heading: copy.heading,
        body: copy.body,
      },
      responsive: { mobile: { align: 'start' } },
      slots: { actions: ['cta-start', 'cta-docs'] },
    },
    'cta-start': { id: 'cta-start', type: 'cta', props: { label: all.ctaStart } },
    'cta-docs': {
      id: 'cta-docs',
      type: 'cta',
      props: { label: all.ctaDocs, emphasis: 'ghost' },
    },
  };
  return { schemaVersion: 1, surface: 'site', dir, rootId: 'root', nodes };
}
// end blocks-polish additions

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
    : fixture === 'code-page'
      ? createReferenceCodePageFixture().page.document
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
  // At once when the templates have loaded (`withPlaygroundTemplates` awaits them), else on arrival.
  hydratePlaygroundTemplates(kernel);
  return kernel;
}
