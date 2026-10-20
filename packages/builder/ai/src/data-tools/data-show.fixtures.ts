import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { CHART_TYPES } from './data-chart';
import { REPORT_CHART_TYPES } from './report-build';

/*
  Test-only (2026-10-12): data.show and report.build over the real door — a page whose chart,
  report and table blocks declare the props the marketing blocks declare (with their limits), a
  stats block that holds no data, a plan
  comparison (columns and rows, but not a table) and a footer.
*/

const NullRender: BlockRenderComponent = () => null;

export const dataFixtureBlocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'data-show-fixture',
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
            default: {
              allow: ['chart', 'report', 'table', 'stats', 'comparisonTable', 'pageFooter'],
            },
          },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'chart',
          description: 'A data chart.',
          props: z.object({
            title: z.string().min(1).max(90).optional(),
            description: z.string().min(1).max(240).optional(),
            chartType: z.enum(CHART_TYPES).default('bar'),
            categories: z.array(z.string().min(1).max(40)).max(24).default([]),
            series: z
              .array(
                z.object({
                  name: z.string().min(1).max(40),
                  values: z.array(z.number()).max(24).default([]),
                }),
              )
              .max(6)
              .default([]),
            valuePrefix: z.string().min(1).max(12).optional(),
            valueSuffix: z.string().min(1).max(12).optional(),
            maxValue: z.number().optional(),
            targetValue: z.number().optional(),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'report',
          description: 'One dataset as KPI cards, a chart and a table.',
          props: z.object({
            title: z.string().min(1).max(90).default('Report'),
            summary: z.string().min(1).max(320).optional(),
            dataNote: z.string().min(1).max(320).optional(),
            comparisonLabel: z.string().min(1).max(40).optional(),
            categories: z.array(z.string().min(1).max(40)).max(24).default([]),
            series: z
              .array(
                z.object({
                  name: z.string().min(1).max(40),
                  values: z.array(z.number()).max(24).default([]),
                }),
              )
              .max(6)
              .default([]),
            valuePrefix: z.string().min(1).max(12).optional(),
            valueSuffix: z.string().min(1).max(12).optional(),
            kpis: z
              .array(
                z.object({
                  label: z.string().min(1).max(40),
                  series: z.number().int().min(0).max(5).default(0),
                  measure: z
                    .enum(['last', 'total', 'average', 'max', 'min', 'median', 'count'])
                    .default('last'),
                  better: z.enum(['up', 'down']).default('up'),
                  comparisonValue: z.number().optional(),
                  target: z.number().optional(),
                  detail: z.string().max(120).optional(),
                }),
              )
              .max(8)
              .default([]),
            chartType: z.enum(REPORT_CHART_TYPES).default('bar'),
            showTrends: z.boolean().optional(),
            showTable: z.boolean().optional(),
            stacked: z.boolean().optional(),
            maxValue: z.number().optional(),
            targetValue: z.number().optional(),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'table',
          description: 'A data table.',
          props: z.object({
            title: z.string().min(1).max(90).optional(),
            caption: z.string().min(1).max(160).optional(),
            columns: z
              .array(
                z.object({
                  label: z.string().min(1).max(60),
                  align: z.enum(['start', 'center', 'end']).default('start'),
                }),
              )
              .max(8)
              .default([]),
            rows: z
              .array(z.object({ cells: z.array(z.string().max(160)).max(8).default([]) }))
              .max(50)
              .default([]),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'stats',
          description: 'Key numbers.',
          props: z.object({ heading: z.string().max(90).default('') }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'comparisonTable',
          description: 'Plans side by side.',
          props: z.object({
            columns: z.array(z.object({ name: z.string() })).default([]),
            rows: z.array(z.object({ feature: z.string() })).default([]),
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

/** The fixture page: stats, a chart, a table, a plan comparison and the footer. */
export function dataKernel(): BuilderKernel {
  const document = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Data', lang: 'en' },
        slots: { default: ['stats-1', 'chart-1', 'table-1', 'plans-1', 'footer-1'] },
      },
      'stats-1': { id: 'stats-1', type: 'stats', props: { heading: 'In numbers' } },
      'chart-1': {
        id: 'chart-1',
        type: 'chart',
        props: { chartType: 'area', categories: ['A'], series: [{ name: 'S', values: [1] }] },
      },
      'table-1': {
        id: 'table-1',
        type: 'table',
        props: { columns: [{ label: 'X', align: 'start' }], rows: [] },
      },
      'plans-1': { id: 'plans-1', type: 'comparisonTable', props: {} },
      'footer-1': { id: 'footer-1', type: 'pageFooter', props: { note: '©' } },
    },
  } as unknown as BuilderDocument;
  return createBuilder({
    document,
    extensions: [dataFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('data-show') },
  });
}
