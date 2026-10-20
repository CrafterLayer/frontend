import { blockPartProps, type Node } from '@craftkit/builder-schema';
import { advancedExamples } from '../advanced-examples';
import type { AdvancedChartType } from '../advanced-contract';
import type { Drawing } from '../chart-drawing';
import { chartSchema } from '../schema';

/** Deterministic component catalog/test fixtures, never imported by product rendering. */
export function exampleDrawing(
  kind: AdvancedChartType,
  overrides: Record<string, unknown> = {},
  isCanvas = false,
): Drawing {
  const found = advancedExamples.find(
    (entry) => (entry.node as { props: { chartType: string } }).props.chartType === kind,
  );
  const props = chartSchema.props.parse({
    ...(found?.node as { props: Record<string, unknown> }).props,
    ...overrides,
  });
  const node: Node = { id: 'advanced-chart-example', type: 'chart', props: {} };
  return {
    props,
    part: blockPartProps({ node, props, isCanvas }, chartSchema.parts),
    svgLabel: { role: 'img', 'aria-label': props.title ?? kind },
    ring: 'stroke-surface',
    muted: 'text-text-muted',
    isCanvas,
  };
}
