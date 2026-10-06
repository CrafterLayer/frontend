import { useCallback, useState } from 'react';

import type {
  InspectorFocusRequest,
  InspectorStyleContext,
  StyleSectorId,
} from '@craftkit/builder';

export interface InspectorFocus {
  /** The place the Inspector should show next (undefined once it has). */
  readonly request: InspectorFocusRequest | undefined;
  readonly onRequestHandled: (nonce: number) => void;
  /** Quick bar "More" (and a group's "open in panel"): Design at that sector. */
  readonly openStyleSector: (sector: StyleSectorId) => void;
  /** Quick bar "Animate": the Interactions tab. */
  readonly animate: () => void;
  /** The element panel's open sector and forced state, handed to the canvas. */
  readonly styleContext: InspectorStyleContext;
  readonly onStyleContextChange: (context: InspectorStyleContext) => void;
}

const NO_CONTEXT: InspectorStyleContext = { sector: null, state: 'default' };

/**
 * The Inspector's tab and sector, lifted into the app (fix pass, style-manager
 * DESIGN.md §A.6): before, "More" and "Animate" only opened the aside and the
 * Content tab stayed selected. `reveal` opens the aside first, so the panel
 * that receives the request is on screen.
 */
export function useInspectorFocus(reveal: () => void): InspectorFocus {
  const [request, setRequest] = useState<InspectorFocusRequest | undefined>(undefined);
  const [styleContext, setStyleContext] = useState<InspectorStyleContext>(NO_CONTEXT);
  const [nonce, setNonce] = useState(0);
  const ask = useCallback(
    (next: Omit<InspectorFocusRequest, 'nonce'>) => {
      reveal();
      const at = nonce + 1;
      setNonce(at);
      setRequest({ ...next, nonce: at });
    },
    [reveal, nonce],
  );
  const openStyleSector = useCallback(
    (sector: StyleSectorId) => {
      ask({ tab: 'design', sector });
    },
    [ask],
  );
  const animate = useCallback(() => {
    ask({ tab: 'interactions' });
  }, [ask]);
  const onRequestHandled = useCallback((handled: number) => {
    setRequest((current) => (current?.nonce === handled ? undefined : current));
  }, []);
  const onStyleContextChange = useCallback((next: InspectorStyleContext) => {
    setStyleContext((current) =>
      current.sector === next.sector && current.state === next.state ? current : next,
    );
  }, []);
  return { request, onRequestHandled, openStyleSector, animate, styleContext, onStyleContextChange };
}
