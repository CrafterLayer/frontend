import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { dataFixtureBlocks } from './data-show.fixtures';

/*
  Test-only (2026-10-14): report.page over the real door — the data.show fixture's chart and
  report, plus a stats block, a rich-text block and an interactive table declaring the props
  (and limits) the marketing blocks declare, so every section the page inserts is judged.
*/

const NullRender: BlockRenderComponent = () => null;
const words = (fallback: string, max: number) => z.string().min(1).max(max).default(fallback);
const [, chartBlock, reportBlock] = dataFixtureBlocks.contributes?.blocks ?? [];

export const reportPageBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'report-page-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({
            title: z.string().max(120).default(''),
            lang: z.string().max(12).default(''),
          }),
          slots: {
            default: { allow: ['chart', 'report', 'table', 'stats', 'richText', 'pageFooter'] },
          },
          examples: [],
        }),
        render: NullRender,
      },
      ...(chartBlock === undefined || reportBlock === undefined ? [] : [chartBlock, reportBlock]),
      {
        schema: defineBlockSchema({
          type: 'stats',
          description: 'Key numbers.',
          props: z.object({
            eyebrow: words('Measured impact', 40),
            heading: words('Results', 90),
            body: words('Clear outcomes.', 200),
            items: z
              .array(
                z.object({
                  value: z.string().min(1).max(24),
                  label: z.string().min(1).max(56),
                  detail: z.string().min(1).max(100).optional(),
                  change: z.string().min(1).max(40).optional(),
                  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
                  trend: z.array(z.number()).min(2).max(24).optional(),
                  progress: z.number().min(0).max(100).optional(),
                  progressLabel: z.string().min(1).max(80).optional(),
                }),
              )
              .max(8)
              .default([]),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'richText',
          description: 'Prose.',
          props: z.object({ content: richText().default(emptyRichText() as never) }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'table',
          description: 'A data table with sorting, search and pages.',
          props: z.object({
            title: z.string().min(1).max(90).optional(),
            caption: z.string().min(1).max(160).optional(),
            columns: z
              .array(
                z.object({
                  label: z.string().min(1).max(60),
                  align: z.enum(['start', 'center', 'end']).default('start'),
                  sortAs: z.enum(['auto', 'text', 'number', 'date']).default('auto'),
                }),
              )
              .max(8)
              .default([]),
            rows: z
              .array(z.object({ cells: z.array(z.string().max(160)).max(8).default([]) }))
              .max(50)
              .default([]),
            sortable: z.boolean().default(false),
            searchable: z.boolean().default(false),
            pageSize: z.number().int().min(0).max(50).default(0),
            stickyHeader: z.boolean().default(false),
            scrollLabel: words('Scrollable table', 80),
            searchLabel: words('Search the table', 60),
            searchPlaceholder: words('Type to filter rows', 80),
            countLabel: words('{shown} of {total} rows', 80),
            noResultsLabel: words('No matching rows', 120),
            previousLabel: words('Previous', 40),
            nextLabel: words('Next', 40),
            pageLabel: words('Page {page} of {pages}', 60),
            paginationLabel: words('Table pages', 80),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'pageFooter',
          description: 'The footer.',
          props: z.object({ note: z.string().max(90).default('') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

/** A page with one intro table and the footer, in English or Arabic. */
export function reportKernel(lang: 'en' | 'ar' = 'en'): BuilderKernel {
  const document = {
    schemaVersion: 1,
    surface: 'site',
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Data', lang },
        slots: { default: ['intro-1', 'footer-1'] },
      },
      'intro-1': { id: 'intro-1', type: 'table', props: { columns: [{ label: 'X' }], rows: [] } },
      'footer-1': { id: 'footer-1', type: 'pageFooter', props: { note: '©' } },
    },
  } as unknown as BuilderDocument;
  return createBuilder({
    document,
    extensions: [reportPageBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('report-page') },
  });
}
