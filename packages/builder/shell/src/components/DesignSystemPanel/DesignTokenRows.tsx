import { useId } from 'react';

import type { Theme, TokenName } from '@craftkit/builder-schema';

import { TokenDraftField } from './TokenDraftField';
import { TokenPreview } from './TokenPreview';
import type { TokenRowSpec } from './token-groups';

export interface DesignTokenRowsProps {
  /** The group's heading, which also names the list. */
  readonly title: string;
  readonly rows: readonly TokenRowSpec[];
  readonly tokens: Theme;
  readonly onCommit: (token: TokenName, value: string) => void;
  readonly tokenLabel: (token: TokenName) => string;
  readonly disabled?: boolean | undefined;
}

/**
 * One group of measurement tokens — the type scale, radii, shadows, spacing,
 * widths — each a draft field beside a live preview. Every commit is one
 * token, one transaction; every element bound to the token repaints, because
 * token utilities and `var(--t-…)` references are live.
 */
export function DesignTokenRows({
  title,
  rows,
  tokens,
  onCommit,
  tokenLabel,
  disabled = false,
}: DesignTokenRowsProps) {
  const base = useId();
  return (
    <section className="bldr-token-rows" aria-label={title}>
      <h3 className="bldr-design-system__group">{title}</h3>
      <ul className="bldr-token-rows__list">
        {rows.map(({ token, preview }) => {
          const id = `${base}-${token}`;
          return (
            <li key={token} className="bldr-token-rows__row">
              <label className="bldr-token-rows__label" htmlFor={id}>
                {tokenLabel(token)}
              </label>
              <TokenDraftField
                id={id}
                className="bldr-token-rows__field"
                value={tokens[token]}
                disabled={disabled}
                onCommit={(value) => {
                  onCommit(token, value);
                }}
              />
              <TokenPreview kind={preview} value={tokens[token]} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
