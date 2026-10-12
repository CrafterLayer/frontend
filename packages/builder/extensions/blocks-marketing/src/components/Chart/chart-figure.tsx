import type { ReactNode } from 'react';

import type { Drawing } from './chart-drawing';
import { funnelFigure } from './chart-funnel';
import { gaugeFigure } from './chart-gauge';
import { hbarFigure } from './chart-hbar';
import { drawnType } from './chart-kind';
import { cartesianModel, pieModel } from './chart-model';
import { pieFigure } from './chart-pie';
import { cartesianFigure } from './chart-plot';
import { gaugeModel, radarModel } from './chart-polar';
import { radarFigure } from './chart-radar';
import { funnelModel, hbarModel } from './chart-rows';
import { scatterModel } from './chart-scatter';
import { sparkRows } from './chart-spark';
import { sparklineFigure } from './chart-sparkline';

/**
 * The plot for a chart that has data: the figure its (drawn) type calls for.
 * Shared with the Report block, which draws its chart with these same figures.
 */
export function chartPlot(drawing: Drawing): ReactNode {
  const { props } = drawing;
  switch (drawnType(props)) {
    case 'pie':
    case 'donut':
      return pieFigure(pieModel(props), drawing);
    case 'hbar':
      return hbarFigure(hbarModel(props), drawing);
    case 'funnel':
      return funnelFigure(funnelModel(props), drawing);
    case 'radar':
      return radarFigure(radarModel(props), drawing);
    case 'gauge':
      return gaugeFigure(gaugeModel(props), drawing);
    case 'sparkline':
      return sparklineFigure(sparkRows(props), drawing);
    case 'scatter':
      return cartesianFigure(scatterModel(props), drawing);
    default:
      /* A radar outside three to twelve categories draws as bars. */
      return cartesianFigure(cartesianModel({ ...props, chartType: drawnType(props) }), drawing);
  }
}
