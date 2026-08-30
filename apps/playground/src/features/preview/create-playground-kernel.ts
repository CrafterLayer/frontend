import {
  blocksMarketing,
  builderAceternity,
  builderPrimitives,
  codeViewExtension,
  createBuilder,
  defaultBlocks,
  emptyDocument,
  richTextExtension,
  type BuilderDocument,
  type BuilderKernel,
  type ContentDirection,
  type Node,
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
        default: ['aurora', 'about', 'showcase', 'features', 'pricing', 'quotes', 'closing'],
      },
    },
    hero: {
      id: 'hero',
      type: 'hero',
      props: {
        tone: 'dark',
        align: 'center',
        heading: 'Build pages your kernel can prove',
        body: 'كل تعديل يمر من باب واحد — وقابل للتراجع.',
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
    /*
      Aceternity's aurora, adapted to this project's tokens.

      Upstream hard-codes Tailwind's palette into the gradient, so every site
      would have carried the same blue effect at the top of the page. Rewritten
      against --t-*, it follows whatever palette the design system generated.
      `className` here is arbitrary Tailwind, checked at the door.

      `minHeight: 'none'` and no radius, deliberately. The aurora CENTRES what
      it frames, so a half-screen band around an opaque dark hero drew the
      gradient only in the strips above and below it — read as unexplained
      space at the top of the page, and the rounded corners made the hero look
      like a card floating on the canvas rather than the page's opening. An
      aurora hugs its child; give the hero `tone: 'transparent'` if the
      gradient should be the hero's own ground and the band comes back.
    */
    aurora: {
      id: 'aurora',
      type: 'auroraBackground',
      props: {
        intensity: 'normal',
        animate: true,
        minHeight: 'none',
      },
      slots: { default: ['hero'] },
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
                  marks: [{ type: 'link', attrs: { href: 'https://example.com/laws' } }],
                },
                { type: 'text', text: '.' },
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
    features: {
      id: 'features',
      type: 'features',
      props: {
        heading: 'Why CraftKit',
        columns: '3',
        items: [
          { title: 'Deterministic', body: 'Same seed, same history — bit for bit.' },
          { title: 'Sealed', body: 'One validated door; no second mutation path.' },
          { title: 'ثنائي الاتجاه', body: 'RTL و LTR بنفس المستند.' },
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
        heading: 'Loved by teams',
        items: [{ quote: 'أفضل تجربة بناء صفحات جربناها.', author: 'سارة', role: 'مؤسِّسة' }],
      },
    },
    closing: { id: 'closing', type: 'cta', props: { label: 'Start free', note: '14-day trial' } },
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

export function createPlaygroundKernel(
  options: { fixture?: PlaygroundFixture; dir?: ContentDirection } = {},
): BuilderKernel {
  const dir = options.dir ?? 'ltr';
  const fixture = options.fixture ?? 'landing';
  const document =
    fixture === 'landing'
      ? marketingLanding(dir)
      : fixture === 'code-view'
        ? codeViewEditing(dir)
        : fixture === 'inline'
          ? inlineEditing(dir)
          : emptyDocument('site', dir);

  // Deterministic by construction; zero backend, zero network (FR-014).
  return createBuilder({
    document,
    // The inline fixture's document HOLDS the demo blocks, so their schemas
    // must be live at creation; landing and empty keep the FR-013 story —
    // registration happens at runtime through <RegisterDemoExtension/>.
    extensions:
      fixture === 'inline'
        ? [
            defaultBlocks,
            blocksMarketing,
            builderPrimitives,
            builderAceternity,
            richTextExtension,
            codeViewExtension,
            demoExtension,
          ]
        : [
            defaultBlocks,
            blocksMarketing,
            builderPrimitives,
            builderAceternity,
            richTextExtension,
            codeViewExtension,
          ],
    ports: { clock: fixedClock(), ids: seededIds('pg') },
  });
}
