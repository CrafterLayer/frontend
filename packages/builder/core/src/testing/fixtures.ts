import { z } from 'zod';

import {
  defineBlockSchema,
  LATEST_SCHEMA_VERSION,
  type BlockRenderComponent,
  type BuilderDocument,
  type Node,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

export { emptyDocument } from '../kernel/create-builder';

// Headless placeholder renderer: a valid function component that renders nothing.
// No React value import — components are plain functions until B1 mounts them.
const NullRender: BlockRenderComponent = () => null;

const CONTENT_TYPES = ['section', 'hero', 'button', 'text', 'box'];

/** The block vocabulary every kernel test builds with. */
export const fixtureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'fixture-blocks',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Test page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: CONTENT_TYPES } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'section',
          description: 'Test layout section.',
          props: z.object({ gap: z.enum(['sm', 'md', 'lg']).default('md') }),
          slots: { default: { allow: CONTENT_TYPES } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'hero',
          description: 'Test hero.',
          props: z.object({
            tone: z.enum(['light', 'dark']).default('light'),
            heading: z.string().min(1).max(80).default('Heading'),
          }),
          slots: { actions: { allow: ['button'], max: 2 } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'button',
          description: 'Test button.',
          props: z.object({
            label: z.string().min(1).default('Button'),
            emphasis: z.enum(['primary', 'ghost']).default('primary'),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'text',
          description: 'Test paragraph.',
          // `weight` exists for numeric-boundary tests (e.g. the -0 door);
          // optional with no default, so no existing fixture document changes.
          props: z.object({ content: z.string().default(''), weight: z.number().optional() }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'box',
          description: 'Test generic container.',
          props: z.object({ padding: z.enum(['none', 'tight', 'roomy']).default('none') }),
          slots: { default: { allow: CONTENT_TYPES } },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

/** A small realistic landing document (valid against `fixtureBlocks`). */
export function landingFixture(): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Landing' },
      slots: { default: ['hero1', 'sec1'] },
    },
    hero1: {
      id: 'hero1',
      type: 'hero',
      props: { tone: 'dark', heading: 'Build faster' },
      responsive: { mobile: { tone: 'light' } },
      slots: { actions: ['cta1', 'cta2'] },
    },
    cta1: { id: 'cta1', type: 'button', props: { label: 'Start', emphasis: 'primary' } },
    cta2: { id: 'cta2', type: 'button', props: { label: 'Docs', emphasis: 'ghost' } },
    sec1: {
      id: 'sec1',
      type: 'section',
      props: { gap: 'lg' },
      slots: { default: ['p1'] },
    },
    p1: { id: 'p1', type: 'text', props: { content: 'Welcome aboard.' } },
  };
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
  };
}

/**
 * Deterministic stress document: `total` nodes including the root, laid out as
 * sections of 20 text nodes each (the FR-019 / SC-006 fixture).
 */
export function stressDocument(total = 1000): BuilderDocument {
  const nodes: Record<string, Node> = {
    root: { id: 'root', type: 'page', props: { title: 'Stress' }, slots: { default: [] } },
  };
  const rootChildren = nodes['root']?.slots?.['default'];
  if (rootChildren === undefined) {
    throw new Error('unreachable: stress root initialises its default slot');
  }

  let remaining = total - 1;
  let sectionIndex = 0;
  while (remaining > 0) {
    sectionIndex += 1;
    const sectionId = `sec-${String(sectionIndex)}`;
    const section: Node = {
      id: sectionId,
      type: 'section',
      props: { gap: 'md' },
    };
    nodes[sectionId] = section;
    rootChildren.push(sectionId);
    remaining -= 1;

    const children: string[] = [];
    for (let textIndex = 1; textIndex <= 20 && remaining > 0; textIndex += 1) {
      const textId = `txt-${String(sectionIndex)}-${String(textIndex)}`;
      nodes[textId] = {
        id: textId,
        type: 'text',
        props: { content: `Paragraph ${String(sectionIndex)}.${String(textIndex)}` },
      };
      children.push(textId);
      remaining -= 1;
    }
    if (children.length > 0) {
      section.slots = { default: children };
    }
  }

  if (rootChildren.length === 0) {
    // Empty slot arrays are never stored — a size-1 stress doc is just the root.
    delete nodes['root']?.slots;
  }

  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
  };
}
