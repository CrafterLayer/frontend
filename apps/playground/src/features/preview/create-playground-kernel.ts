import {
  blocksMarketing,
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

export type PlaygroundFixture = 'empty' | 'landing';

/** The playground's own marketing landing document (real vocabulary, ar+en). */
export function marketingLanding(dir: ContentDirection = 'ltr'): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'CraftKit Landing' },
      slots: { default: ['hero', 'about', 'features', 'pricing', 'quotes', 'closing'] },
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
    pricing: {
      id: 'pricing',
      type: 'pricing',
      props: {
        heading: 'Pricing',
        plans: [
          { name: 'Solo', price: '$9', period: 'month', features: ['1 project'] },
          {
            name: 'Team',
            price: '$29',
            period: 'month',
            features: ['Unlimited projects', 'Priority support'],
            highlighted: true,
          },
        ],
      },
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

export function createPlaygroundKernel(
  options: { fixture?: PlaygroundFixture; dir?: ContentDirection } = {},
): BuilderKernel {
  const dir = options.dir ?? 'ltr';
  const document =
    (options.fixture ?? 'landing') === 'landing'
      ? marketingLanding(dir)
      : emptyDocument('site', dir);

  // Deterministic by construction; zero backend, zero network (FR-014).
  return createBuilder({
    document,
    extensions: [defaultBlocks, blocksMarketing, richTextExtension],
    ports: { clock: fixedClock(), ids: seededIds('pg') },
  });
}
