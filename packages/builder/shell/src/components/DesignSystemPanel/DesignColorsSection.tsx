import { useId, useState } from 'react';

import { COLOR_TOKENS, type DesignSystem, type SiteLibrary, type TokenName } from '@craftkit/builder-schema';

import { PaletteRampEditor } from '../PaletteRampEditor/PaletteRampEditor';
import type { PaletteRampEditorLabels } from '../PaletteRampEditor/PaletteRampEditor.labels';
import { TokenSwatchGrid } from '../TokenSwatchGrid';
import type { DesignSystemPanelLabels } from './DesignSystemPanel.labels';
import { PaletteList } from './PaletteList';
import type { SiteCommit, SiteCommitResult } from './site-door';
import { TokenDraftField } from './TokenDraftField';

export interface DesignColorsSectionProps {
  readonly system: DesignSystem;
  readonly library?: SiteLibrary | undefined;
  readonly labels: DesignSystemPanelLabels;
  readonly rampLabels?: PaletteRampEditorLabels | undefined;
  readonly commitToken: (token: TokenName, value: string) => void;
  readonly commit?: SiteCommit | undefined;
  readonly onResult?: ((result: SiteCommitResult) => void) | undefined;
  /** Door refusals to tie to the colour field (announced by the panel). */
  readonly invalid?: boolean | undefined;
  readonly issuesId?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

/**
 * The nine colour roles, then the site palette and its shade generator.
 *
 * A role edit goes through `setDesignToken`, where the door refuses a value
 * that would make a declared pairing unreadable; the panel announces the
 * refusal. Palette colours are free (`--ck-c-<id>`), for agent trees and the
 * style panel's "Site palette" swatches.
 */
export function DesignColorsSection({
  system,
  library,
  labels,
  rampLabels,
  commitToken,
  commit,
  onResult,
  invalid = false,
  issuesId,
  disabled = false,
  dir,
}: DesignColorsSectionProps) {
  const [selected, setSelected] = useState<TokenName>('accent');
  const fieldId = useId();
  const committed = system.tokens[selected];

  return (
    <div className="bldr-design-system__section">
      <div className="bldr-design-system__edit">
        <label className="bldr-design-system__label" htmlFor={fieldId}>
          {selected}
        </label>
        <div className="bldr-design-system__edit-row">
          <span className="bldr-design-system__swatch" style={{ background: committed }} aria-hidden />
          <TokenDraftField
            id={fieldId}
            className="bldr-design-system__field"
            value={committed}
            disabled={disabled}
            invalid={invalid}
            describedBy={invalid ? issuesId : undefined}
            onCommit={(value) => {
              commitToken(selected, value);
            }}
          />
        </div>
      </div>
      <h3 className="bldr-design-system__group">{labels.colours}</h3>
      <TokenSwatchGrid
        tokens={system.tokens}
        names={COLOR_TOKENS}
        label={labels.colourTokens}
        selected={selected}
        onSelect={setSelected}
        columns={3}
      />
      {commit === undefined ? null : (
        <>
          <PaletteList
            palette={library?.palette ?? []}
            commit={commit}
            labels={labels}
            disabled={disabled}
            onResult={onResult}
          />
          <PaletteRampEditor
            commit={(steps, label) => {
              const result = commit(steps, label);
              onResult?.(result);
              return result;
            }}
            existingIds={(library?.palette ?? []).map((color) => color.id)}
            contrastColumns={[
              { name: labels.token('surface'), css: system.tokens.surface },
              { name: labels.token('text'), css: system.tokens.text },
            ]}
            labels={rampLabels}
            disabled={disabled}
            dir={dir}
          />
        </>
      )}
    </div>
  );
}
