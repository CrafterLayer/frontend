import { useMemo } from 'react';

import { CustomCode, useSiteDesign } from '@craftkit/builder-renderer';
import { applySymbolOverrides, type BlockRenderProps } from '@craftkit/builder-schema';

import { scopeCustomCodeCss } from '../CustomCodeBlock/scope-css';
import type { SymbolInstanceBlockProps } from './schema';

/**
 * A symbol instance: the library master with this instance's overrides
 * applied, rendered by the shared custom-code renderer (the canvas makes its
 * elements focusable by path, exactly as in a region) and the master's
 * scoped CSS. A symbol the library no longer holds renders nothing on the
 * published page and says why on the canvas.
 */
export function SymbolInstanceBlock({ node, props, isCanvas }: BlockRenderProps<SymbolInstanceBlockProps>) {
  const { library } = useSiteDesign();
  const symbols = library?.symbols;
  const symbol =
    symbols !== undefined && Object.hasOwn(symbols, props.symbolId) ? symbols[props.symbolId] : undefined;
  const tree = useMemo(
    () => (symbol === undefined ? undefined : applySymbolOverrides(symbol.tree, props.overrides)),
    [symbol, props.overrides],
  );
  if (symbol === undefined || tree === undefined) {
    return isCanvas ? (
      <p className="bldr-unknown-block" role="note" data-symbol-missing={props.symbolId}>
        Symbol “{props.symbolId}” is not in this site’s library. Detach or delete this instance.
      </p>
    ) : null;
  }
  const css = scopeCustomCodeCss(symbol.css ?? '', node.id);
  return (
    <>
      {css === undefined ? null : <style>{css}</style>}
      <CustomCode tree={tree} hostId={node.id} isCanvas={isCanvas} />
    </>
  );
}
