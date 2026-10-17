import type { CSSProperties } from 'react';

import type { TokenPreviewKind } from './token-groups';

export interface TokenPreviewProps {
  readonly kind: TokenPreviewKind;
  readonly value: string;
  /** Sample text for the type previews ("Aa" by default). */
  readonly sample?: string | undefined;
}

function styleFor(kind: TokenPreviewKind, value: string): CSSProperties {
  switch (kind) {
    case 'font-size':
      return { fontSize: `min(${value}, 2.5rem)` };
    case 'font-weight':
      return { fontWeight: value };
    case 'line-height':
      return { lineHeight: value };
    case 'letter-spacing':
      return { letterSpacing: value };
    case 'radius':
      return { borderRadius: value };
    case 'border-width':
      return { borderWidth: value };
    case 'shadow':
      return { boxShadow: value };
    case 'length':
      return { inlineSize: `min(100%, ${value})` };
    case 'width':
      return { inlineSize: `min(100%, calc(${value} / 8))` };
  }
}

const TYPE_KINDS: ReadonlySet<TokenPreviewKind> = new Set([
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
]);

/**
 * A live picture of one token's value: a sample set in that size, a box with
 * that radius or shadow, a bar that long. Decoration beside the field (the
 * value is always readable as text), so it is hidden from assistive tech.
 */
export function TokenPreview({ kind, value, sample = 'Aa' }: TokenPreviewProps) {
  if (TYPE_KINDS.has(kind)) {
    return (
      <span className="bldr-token-preview bldr-token-preview--type" aria-hidden style={styleFor(kind, value)}>
        {kind === 'line-height' ? `${sample} ${sample}` : sample}
      </span>
    );
  }
  return (
    <span className="bldr-token-preview" data-kind={kind} aria-hidden>
      <span className="bldr-token-preview__shape" style={styleFor(kind, value)} />
    </span>
  );
}
