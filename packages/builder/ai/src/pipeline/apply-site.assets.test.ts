import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createSiteBuilder } from '@craftkit/builder-core';
import {
  defaultDesignSystem,
  defineBlockSchema,
  emptyDocument,
  imagePropSchema,
  type AssetEntry,
  type BuilderSite,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applySiteCommands } from './apply-site';
import type { AssemblyStep } from './wire';

const NullRender = (): null => null;

/** A registry with a block that actually holds a picture, which the shared fixtures do not. */
const pictureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'picture-blocks',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Test page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['shot'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'shot',
          description: 'Test block carrying an image prop.',
          props: z.object({ asset: imagePropSchema.optional() }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const KILN: AssetEntry = {
  id: 'kiln',
  url: 'https://assets.example.test/kiln.jpg',
  description: 'A ceramics kiln glowing in a workshop',
  mood: ['warm'],
  palette: ['#c2410c'],
  alt: 'A kiln glowing orange in a dim ceramics workshop',
  width: 1600,
  height: 1067,
};

const seedSite = (): BuilderSite => ({
  siteVersion: 1,
  dir: 'ltr',
  pages: [
    {
      id: 'p-home',
      address: '/',
      title: 'Home',
      purpose: 'The page that was already here.',
      audience: 'anyone',
      document: emptyDocument('site', 'ltr'),
      regions: [],
    },
  ],
  sharedRegions: {},
  designSystem: defaultDesignSystem(),
  assets: {},
});

const kernelFor = (site: BuilderSite) => {
  const kernel = createSiteBuilder({ site });
  kernel.extensions.register(pictureBlocks);
  return kernel;
};

const placeAPicture = (assetId: string): readonly AssemblyStep[] => [
  {
    command: 'insertNode',
    args: {
      parentId: 'root',
      slot: 'default',
      type: 'shot',
      props: { asset: { assetId } },
    },
  },
];

describe('applySiteCommands — the site asset table (FR-045)', () => {
  it('registers a referenced picture BEFORE the command that uses it', () => {
    /*
      Order is the whole point. `validateSite` refuses a site whose reference
      does not resolve in its own table, so a picture registered afterwards
      would leave the site invalid for the length of one transaction — and any
      validation between the two would refuse a run that was about to be
      correct.
    */
    const kernel = kernelFor(seedSite());
    const result = applySiteCommands({
      kernel,
      commands: placeAPicture('kiln'),
      assets: { kiln: KILN },
    });

    if (!result.ok) throw new Error(result.refusal.reason);
    expect(kernel.getSite().assets['kiln']).toEqual(KILN);
    expect(kernel.validate().ok).toBe(true);
  });

  it('takes a COPY, which is why a deleted library picture does not break the site', () => {
    const kernel = kernelFor(seedSite());
    const library: Record<string, AssetEntry> = { kiln: KILN };

    applySiteCommands({ kernel, commands: placeAPicture('kiln'), assets: library });
    /* Someone tidies the library. The site is unmoved. */
    delete library['kiln'];

    expect(kernel.getSite().assets['kiln']).toEqual(KILN);
    expect(kernel.validate().ok).toBe(true);
  });

  it('registers a picture ONCE however many places use it', () => {
    const kernel = kernelFor(seedSite());
    const before = kernel.transactions().length;

    const result = applySiteCommands({
      kernel,
      commands: [...placeAPicture('kiln'), ...placeAPicture('kiln')],
      assets: { kiln: KILN },
    });

    expect(result.ok).toBe(true);
    /* Two inserts, one registration — not three transactions and not four. */
    expect(kernel.transactions().length - before).toBe(3);
  });

  it('does not re-register a picture the site already holds', () => {
    const kernel = kernelFor({ ...seedSite(), assets: { kiln: KILN } });
    const before = kernel.transactions().length;

    applySiteCommands({ kernel, commands: placeAPicture('kiln'), assets: { kiln: KILN } });

    expect(kernel.transactions().length - before).toBe(1);
  });

  it('REFUSES a reference the run was not given, rather than building a broken site', () => {
    /*
      The assembly stage has already refused any id outside the catalogue, so
      reaching here means the stage and the applier were handed different
      lists. Refusing loudly beats building a site whose reference resolves to
      nothing and discovering it at `validateSite`.
    */
    const kernel = kernelFor(seedSite());
    const before = kernel.transactions().length;

    const result = applySiteCommands({
      kernel,
      commands: placeAPicture('ghost'),
      assets: { kiln: KILN },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.refusal.reason).toContain('"ghost"');
    /* And it wrote nothing at all on the way to refusing. */
    expect(kernel.transactions().length).toBe(before);
    expect(kernel.getSite().assets).toEqual({});
  });

  it('leaves a picture-free run exactly as it was', () => {
    const kernel = kernelFor(seedSite());

    const result = applySiteCommands({
      kernel,
      commands: [
        {
          command: 'insertNode',
          args: { parentId: 'root', slot: 'default', type: 'shot', props: {} },
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(kernel.getSite().assets).toEqual({});
  });
});
