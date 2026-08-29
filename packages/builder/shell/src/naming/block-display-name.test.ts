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

function kernelFor(type: string, registered: boolean): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type, props: {} } },
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
            props: z.object({}),
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
});
