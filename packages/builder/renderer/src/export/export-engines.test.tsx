/*
  gsap-pixi (2026-10-08), runtime contract item 9: the export needs nothing new for engines on
  REGISTERED blocks. A section's `motion.scene` / `motion.timeline` (motionAttributes) and a part's
  `partStyles[key].timeline` (blockPartProps) land in the static markup as the same markers a
  customCode tree writes, and those already drive `pageEngines` / `hasBehaviors`: the page gets
  the engines pack in ck-behaviors.js, the engine assets and the `link[data-ck-engine]` locators.
*/
import { describe, expect, it } from 'vitest';

import { fixtureBlocks } from '@craftkit/builder-core/testing';
import {
  blockPartProps,
  LATEST_SCHEMA_VERSION,
  type BlockParts,
  type BlockRenderProps,
  type BuilderDocument,
  type JsonValue,
  type MotionSpec,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { CustomCode } from '../components/CustomCode';
import { motionAttributes } from '../motion';
import { exportStaticSite } from './export-static-site';

const anySchema =
  (fixtureBlocks.contributes?.blocks ?? []).find(({ schema }) => schema.type === 'hero')?.schema ??
  raise();

function raise(): never {
  throw new Error('Fixture is missing the "hero" block.');
}

const HERO_PARTS: BlockParts = {
  heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
};

function PageRoot({ slots }: BlockRenderProps) {
  return <main>{slots['default']}</main>;
}

/*
  A registered section the way the marketing blocks render one: motion on the root, parts inside.
  It reads the stored props (the fixture schema it borrows does not declare motion or partStyles).
*/
function Hero({ node, isCanvas }: BlockRenderProps) {
  const props = node.props;
  const part = blockPartProps({ node, props, isCanvas }, HERO_PARTS);
  const { class: motionClass, ...motionData } = motionAttributes(
    props['motion'] as MotionSpec | undefined,
  );
  const heading = props['heading'];
  return (
    <section
      className={['relative isolate overflow-hidden', motionClass].filter(Boolean).join(' ')}
      {...motionData}
    >
      <h1 {...part('heading')}>{typeof heading === 'string' ? heading : ''}</h1>
    </section>
  );
}

function Code({ node }: BlockRenderProps) {
  return <CustomCode hostId={node.id} tree={node.props['tree']} />;
}

const registry: Record<string, RegisteredBlock> = {
  page: { schema: anySchema, render: PageRoot as NonNullable<RegisteredBlock['render']> },
  hero: { schema: anySchema, render: Hero as NonNullable<RegisteredBlock['render']> },
  code: { schema: anySchema, render: Code as NonNullable<RegisteredBlock['render']> },
};

function page(type: 'hero' | 'code', props: Record<string, JsonValue>): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'الرئيسية', lang: 'ar' },
        slots: { default: ['s'] },
      },
      s: { id: 's', type, props },
    },
  };
}

async function exportPages(pages: { address: string; document: BuilderDocument }[]) {
  const { files } = await exportStaticSite({
    pages: pages.map(({ address, document }, at) => ({
      pageId: `p${String(at)}`,
      address,
      document,
    })),
    blocks: (type: string) => registry[type],
    compileCss: () => Promise.resolve(''),
  });
  return (path: string) => files.find((candidate) => candidate.path === path)?.content;
}

describe('exportStaticSite — engines on registered blocks (gsap-pixi 2026-10-08)', () => {
  it('a Hero with motion.scene + a part timeline ships the engines pack, ck-scene.js, ck-timeline.js and both locators', async () => {
    const { SCENE_SOURCE } = await import('../engines/scene-source');
    const file = await exportPages([
      {
        address: '/',
        document: page('hero', {
          heading: 'مطبخ الياسمين',
          motion: {
            scene: 'particles',
            sceneDensity: 'low',
            scenePalette: 'accent',
            timeline: 'fade-in',
            scrub: false,
          },
          partStyles: { heading: { timeline: 'split-reveal', scrub: true } },
        }),
      },
    ]);
    const home = file('index.html') ?? '';
    expect(home).toMatch(/<section[^>]*data-ck-scene="particles"/u);
    expect(home).toMatch(/<section[^>]*data-ck-density="low"/u);
    expect(home).toMatch(/<section[^>]*data-ck-palette="accent"/u);
    expect(home).toMatch(/<section[^>]*data-ck-timeline="fade-in"/u);
    expect(home).toMatch(/<h1[^>]*data-ck-timeline="split-reveal"/u);
    expect(home).toMatch(/<h1[^>]*data-ck-scrub="true"/u);
    expect(home).toContain(
      '<link rel="ck-engine" href="assets/ck-timeline.js" data-ck-engine="timeline">',
    );
    expect(home).toContain(
      '<link rel="ck-engine" href="assets/ck-scene.js" data-ck-engine="scene">',
    );
    expect(home).toContain('<script defer src="assets/ck-behaviors.js"></script>');
    expect(file('assets/ck-behaviors.js')).toContain('function mountEngines(');
    expect(file('assets/ck-behaviors.css')).toContain(
      '[data-ck-scene][data-ck-ready]:not([data-ck-scene-host]) > img',
    );
    expect(file('assets/ck-scene.js')).toBe(SCENE_SOURCE);
    expect(file('assets/ck-timeline.js') ?? '').not.toBe('');
    expect(file('assets/ck-lottie.js')).toBeUndefined();
  });

  it('a customCode section hosting a scene, with a timeline on a part, exports the same way', async () => {
    const tree: JsonValue = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-24',
          attributes: { 'data-ck-scene': 'mesh-gradient' },
          children: [
            {
              kind: 'element',
              tag: 'h2',
              text: 'قصتنا',
              attributes: { 'data-ck-timeline': 'slide-in' },
            },
          ],
        },
      ],
    };
    const file = await exportPages([{ address: '/', document: page('code', { tree }) }]);
    const home = file('index.html') ?? '';
    expect(home).toMatch(/<section[^>]*data-ck-scene="mesh-gradient"/u);
    expect(home).toMatch(/<h2[^>]*data-ck-timeline="slide-in"/u);
    expect(home).toContain('data-ck-engine="scene"');
    expect(home).toContain('data-ck-engine="timeline"');
    expect(file('assets/ck-behaviors.js')).toContain('function mountEngines(');
    expect(file('assets/ck-scene.js') ?? '').not.toBe('');
    expect(file('assets/ck-timeline.js') ?? '').not.toBe('');
  });

  it('a Hero without engine motion ships no engine', async () => {
    const file = await exportPages([
      { address: '/', document: page('hero', { heading: 'هدوء', motion: { reveal: 'fade-up' } }) },
    ]);
    expect(file('index.html')).not.toContain('data-ck-engine');
    expect(file('assets/ck-scene.js')).toBeUndefined();
    expect(file('assets/ck-timeline.js')).toBeUndefined();
  });
});
