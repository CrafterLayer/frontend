import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { parseTreeMarkup } from '../../plan/tree-markup';
import { agentToolsFixtureBlocks, fixtureDocument, fixtureKernel } from './agent-tools.fixtures';
import { tryDirectTool } from './direct-tool';

describe('tryDirectTool — the zero-token lexicon', () => {
  it('reads an Arabic colour request, voweled or not', () => {
    for (const request of ['غيّر اللون إلى الأخضر', 'غير اللون للاخضر', 'بدل لون الموقع إلى أحمر']) {
      const direct = tryDirectTool(request, fixtureKernel({ locale: 'ar' }));
      expect(direct?.plan.commands[0]).toMatchObject({ command: 'setProp', args: { id: 'root', key: 'pageCss' } });
      expect(direct?.label).toBe('تغيير لون الصفحة');
    }
  });

  it('reads English colour, font, menu and direction requests', () => {
    const kernel = fixtureKernel();
    expect(tryDirectTool('Change the colour to green', kernel)?.label).toBe('Change the page colour');
    expect(tryDirectTool('use font Fraunces', kernel)?.label).toBe('Use the Fraunces font');
    expect(tryDirectTool('sync the menu', kernel)?.label).toBe('Sync the menu');
    expect(tryDirectTool('make the page RTL', kernel)?.plan.commands.some(({ command }) => command === 'setDocMeta')).toBe(true);
  });

  it('deletes and moves sections by their label (Arabic article folded)', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    expect(tryDirectTool('احذف قسم الأسعار', kernel)?.plan.commands[0]).toMatchObject({ command: 'removeNode', args: { id: 'r-menu' } });
    expect(tryDirectTool('انقل قصتنا فوق الأسعار', kernel)?.plan.commands[0]).toMatchObject({
      command: 'moveNode',
      args: { id: 'r-story', toIndex: 2 },
    });
  });

  it('falls through on anything it does not read in full', () => {
    const kernel = fixtureKernel();
    expect(tryDirectTool('make the hero feel warmer and more premium', kernel)).toBeUndefined();
    expect(tryDirectTool('change the colour to a nice sunset', kernel)).toBeUndefined();
    expect(tryDirectTool('use font Comic Sans', kernel)).toBeUndefined();
    expect(tryDirectTool('delete the pricing section', kernel)).toBeUndefined();
    // A Latin-only face on an Arabic page does not expand, so the model decides.
    expect(tryDirectTool('خط Fraunces', fixtureKernel({ locale: 'ar' }))).toBeUndefined();
  });

  it('«حسّن السيو» runs the full safe pass: FAQPage schema from FAQ details, and reports what is left', () => {
    const document = fixtureDocument({ locale: 'ar' });
    const story = document.nodes['r-story'];
    if (story === undefined) throw new Error('r-story');
    const faq =
      "<section id='story' class='py-16'><h2 class='text-3xl'>أسئلة</h2><details><summary>هل توصلون؟</summary><p>نعم، داخل عمّان.</p></details></section>";
    const root = document.nodes['root'];
    if (root === undefined) throw new Error('root');
    const kernel = createBuilder({
      document: {
        ...document,
        nodes: {
          ...document.nodes,
          root: {
            ...root,
            props: {
              ...root.props,
              seo: { site: { business: { type: 'Restaurant', name: 'بُن' } } },
            },
          },
          'r-story': { ...story, props: { ...story.props, tree: parseTreeMarkup(faq) as never } },
        },
      },
      extensions: [agentToolsFixtureBlocks],
      ports: { clock: fixedClock(1), ids: seededIds('direct-seo') },
    });
    const direct = tryDirectTool('حسّن السيو', kernel);
    const seoStep = direct?.plan.commands.find(
      ({ command, args }) => command === 'setProp' && (args as { key?: string }).key === 'seo',
    );
    expect((seoStep?.args as { value?: { schemaKinds?: string[] } } | undefined)?.value?.schemaKinds).toEqual([
      'FAQPage',
    ]);
    // A Restaurant with no city is the owner's to answer, and the person is told.
    expect(direct?.remaining?.some((message) => message.includes('city'))).toBe(true);
    expect(direct?.plan.rationale).toContain('يبقى لك');
  });
});
