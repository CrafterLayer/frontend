import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { TemplateCardInfo } from '../TemplateCard';
import { Palette } from './Palette';
import { PALETTE_LABELS_AR } from './Palette.labels';

/*
  library-playground (agent-script DESIGN §B.5): compositions with a host card
  render as photo TemplateCards — the page's content language first, the rest
  under "Other language", nothing hidden; one without a card keeps the abstract
  preview. Search matches the names in both languages.
*/

afterEach(cleanup);

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'palette-template-cards',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({ lang: z.string().max(12).default('') }),
          slots: { default: { allow: ['section'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'section',
          description: 'Section',
          props: z.object({}),
          slots: { default: { allow: ['text'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({ type: 'text', description: 'Text', props: z.object({}), examples: [] }),
        render: NullRender,
      },
    ],
  },
};

const composition = (id: string, name: string) => ({
  id,
  name,
  version: 1,
  surfaces: ['site'],
  rootId: `${id}-section`,
  nodes: {
    [`${id}-section`]: { id: `${id}-section`, type: 'section', props: {}, slots: { default: [`${id}-text`] } },
    [`${id}-text`]: { id: `${id}-text`, type: 'text', props: {} },
  },
});

const card = (id: string, lang: 'en' | 'ar'): TemplateCardInfo => ({
  id,
  templateKey: 'restaurant',
  lang,
  category: 'restaurant',
  name: { en: 'Restaurant', ar: 'مطعم بيت الزيتون' },
  description: { en: 'Menu, gallery and table booking.', ar: 'قائمة طعام ومعرض وحجز طاولة.' },
  sections: 10,
  thumbnail: { src: `https://images.example/${id}.jpg`, alt: lang === 'ar' ? 'مائدة' : 'A table' },
});

const CARDS = [card('restaurant', 'en'), card('restaurant-ar', 'ar')];

function makeKernel(dir: 'ltr' | 'rtl', lang = '') {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { lang }, slots: { default: [] } } },
  };
  const kernel = createBuilder({ document, extensions: [VOCAB], ports: { clock: fixedClock(), ids: seededIds('pt') } });
  kernel.extensions.hydrateDeclarative({
    tier: 2,
    name: 'palette-template-compositions',
    version: '1.0.0',
    contributes: {
      compositions: [
        composition('restaurant', 'Restaurant'),
        composition('restaurant-ar', 'مطعم بيت الزيتون'),
        composition('plain', 'Plain template'),
      ],
    },
  });
  return kernel;
}

const ids = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[data-content-lang]')?.getAttribute('data-content-lang') ?? 'plain');

describe('Palette — template cards', () => {
  it('an LTR page lists the English card first, the plain preview, then the Arabic card under "Other language"', async () => {
    const user = userEvent.setup();
    render(<Palette kernel={makeKernel('ltr')} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates 3' }));
    const lists = screen.getAllByRole('list');
    expect(ids(lists[0]!)).toEqual(['en', 'plain']);
    const other = screen.getByRole('region', { name: 'Other language' });
    expect(ids(within(other).getByRole('list'))).toEqual(['ar']);
    // The plain composition keeps today's abstract preview.
    expect(screen.getByRole('button', { name: /Plain template/u }).querySelector('.bldr-palette__template-preview')).not.toBeNull();
  });

  it('an RTL page (or a root lang of ar) puts the Arabic card first', async () => {
    const user = userEvent.setup();
    const view = render(<Palette kernel={makeKernel('rtl')} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates 3' }));
    expect(ids(screen.getAllByRole('list')[0]!)).toEqual(['ar', 'plain']);
    expect(ids(within(screen.getByRole('region', { name: 'Other language' })).getByRole('list'))).toEqual(['en']);
    view.unmount();

    render(<Palette kernel={makeKernel('ltr', 'ar-JO')} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates 3' }));
    expect(ids(screen.getAllByRole('list')[0]!)).toEqual(['ar', 'plain']);
  });

  it('search matches either language; a click inserts the composition as one transaction', async () => {
    const user = userEvent.setup();
    const kernel = makeKernel('ltr');
    render(<Palette kernel={kernel} templateCards={CARDS} />);
    await user.click(screen.getByRole('tab', { name: 'Templates 3' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'الزيتون');
    expect(screen.getAllByRole('button', { name: 'Insert template Restaurant' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Plain template/u })).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Insert template Restaurant' })[0]!);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(1);
  });

  it('the Arabic editor names cards in Arabic and heads the other group «لغة أخرى»', async () => {
    const user = userEvent.setup();
    render(<Palette kernel={makeKernel('ltr')} templateCards={CARDS} labels={PALETTE_LABELS_AR} />);
    await user.click(screen.getByRole('tab', { name: 'القوالب 3' }));
    expect(screen.getAllByRole('button', { name: 'إدراج القالب مطعم بيت الزيتون' })).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'لغة أخرى' })).toBeInTheDocument();
  });

  it('without cards every composition keeps the abstract preview (no group heading)', async () => {
    const user = userEvent.setup();
    render(<Palette kernel={makeKernel('ltr')} />);
    await user.click(screen.getByRole('tab', { name: 'Templates 3' }));
    expect(document.querySelectorAll('.bldr-template-card')).toHaveLength(0);
    expect(document.querySelectorAll('.bldr-palette__template-preview')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Other language' })).toBeNull();
  });
});
