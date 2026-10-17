import { createContext, useContext } from 'react';

/**
 * Rewrites an element's or icon's stored `className` just before it renders.
 *
 * The default is the identity. A host provides a transform to EXPAND what the
 * stored classes only name — a named style marker `ck-s-<id>` becomes the
 * style's utilities merged under the element's own (style-manager DESIGN D6),
 * so editing a style once updates every element on the canvas and in the
 * export. The stored document never changes; only what renders does.
 *
 * It must be pure and cheap: it runs for every element of every region on
 * every render. It receives the stored string and returns the one to render.
 */
export type CustomCodeClassTransform = (className: string) => string;

const identity: CustomCodeClassTransform = (className) => className;

/** The transform `CustomCode` applies to every element and icon className. */
export const CustomCodeClassTransformContext = createContext<CustomCodeClassTransform>(identity);

/** The transform in effect here (the identity when no host provides one). */
export function useCustomCodeClassTransform(): CustomCodeClassTransform {
  return useContext(CustomCodeClassTransformContext);
}
