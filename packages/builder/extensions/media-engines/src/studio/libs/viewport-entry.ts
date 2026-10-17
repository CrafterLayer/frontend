import { Viewport } from 'pixi-viewport';

import type { DesignZoomHost } from '../kit/design';
import { createZoomWorld } from './viewport/zoom-world';

export function createViewportLibrary() {
  return Object.freeze({
    Viewport,
    /** The kit's design-mode camera (`design: { zoom: true }`); scenes use s.world, not this. */
    zoomWorld(host: DesignZoomHost) {
      return createZoomWorld(Viewport, host);
    },
  });
}
