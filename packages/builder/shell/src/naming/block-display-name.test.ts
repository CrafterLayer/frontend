import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { blockDisplayName } from './block-display-name';

const NullRender: BlockRenderComponent = () => null;

function kernelFor(
  type: string,
  registered: boolean,
  props: Record<string, unknown> = {},
): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type, props: props as never } },
  };
  const extension: TrustedExtensionManifest = {
    tier: 1,
    name: `naming-${type}`,
    version: '1.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type,
            description:
              'Long catalogue prose describes authoring intent, configuration, and usage details.',
            props: z.object({ label: z.string().max(80).default('') }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };

  return createBuilder({
    document,
    extensions: registered ? [extension] : [],
    ports: { clock: fixedClock(), ids: seededIds(`name-${type}`) },
  });
}

describe('blockDisplayName', () => {
  it('derives a short display name from a known registered type', () => {
    expect(blockDisplayName(kernelFor('heroBanner', true), 'root')).toBe('Hero Banner');
  });

  it('preserves a known acronym in a registered type', () => {
    expect(blockDisplayName(kernelFor('cta', true), 'root')).toBe('CTA');
  });

  it('keeps an unregistered type raw for diagnostic fidelity', () => {
    expect(blockDisplayName(kernelFor('partner-widget', false), 'root')).toBe('partner-widget');
  });

  it('uses the requested id when the node is missing', () => {
    expect(blockDisplayName(kernelFor('hero', true), 'removed-node')).toBe('removed-node');
  });

  describe('instance labels', () => {
    it('prefers a node own label over its type name', () => {
      // Four freely composed regions must not all read "Custom Code".
      const kernel = kernelFor('customCode', true, { label: 'CV header' });

      expect(blockDisplayName(kernel, 'root')).toBe('CV header');
    });

    it('falls back to the type name when the label is empty or whitespace', () => {
      expect(blockDisplayName(kernelFor('heroBanner', true, { label: '' }), 'root')).toBe(
        'Hero Banner',
      );
      expect(blockDisplayName(kernelFor('heroBanner', true, { label: '   ' }), 'root')).toBe(
        'Hero Banner',
      );
    });

    it('ignores a label that is not a string', () => {
      expect(blockDisplayName(kernelFor('heroBanner', true, { label: 42 }), 'root')).toBe(
        'Hero Banner',
      );
    });

    it('elides a long label so the row keeps room for the node id', () => {
      const long = 'A label far longer than any single layers row can show at once';

      const shown = blockDisplayName(kernelFor('heroBanner', true, { label: long }), 'root');

      expect(shown).toHaveLength(32);
      expect(shown.endsWith('…')).toBe(true);
    });

    it('trims surrounding whitespace rather than showing it', () => {
      expect(blockDisplayName(kernelFor('heroBanner', true, { label: '  Intro  ' }), 'root')).toBe(
        'Intro',
      );
    });

    it('still keeps an unregistered type raw, label or not', () => {
      // The diagnostic value of the raw key outranks a prettier name.
      const kernel = kernelFor('partner-widget', false, { label: 'Anything' });

      expect(blockDisplayName(kernel, 'root')).toBe('partner-widget');
    });
  });
});
