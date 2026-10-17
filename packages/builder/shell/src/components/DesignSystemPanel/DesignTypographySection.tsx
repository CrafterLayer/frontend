import { useId, useState } from 'react';

import type { DesignSystem, SiteFont, SiteLibrary, TokenName } from '@craftkit/builder-schema';

import { FontPicker } from '../FontPicker/FontPicker';
import type { FontPickerLabels } from '../FontPicker/FontPicker.labels';
import { firstFamily, fontStack, weightsToLoad, type CatalogueFont, type FontRole } from '../FontPicker/font-catalogue';
import { withSiteFont } from '../FontPicker/font-upload';
import type { DesignSystemPanelLabels } from './DesignSystemPanel.labels';
import { DesignTokenRows } from './DesignTokenRows';
import type { SiteCommit, SiteCommitResult } from './site-door';
import { FONT_ROLE_TOKENS, TYPE_SCALE_ROWS } from './token-groups';

export interface DesignTypographySectionProps {
  readonly system: DesignSystem;
  readonly library?: SiteLibrary | undefined;
  readonly labels: DesignSystemPanelLabels;
  readonly fontLabels?: FontPickerLabels | undefined;
  readonly commitToken: (token: TokenName, value: string) => void;
  /** Absent ⇒ a pick only changes the role token (no font is loaded, no upload). */
  readonly commit?: SiteCommit | undefined;
  readonly onResult?: ((result: SiteCommitResult) => void) | undefined;
  readonly loadPreviews?: boolean | undefined;
  readonly arabicFirst?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

const ROLES = ['sans', 'serif', 'mono'] as const;

/**
 * Family per role and the type scale (style-manager DESIGN.md §G).
 *
 * Picking a family is ONE transaction of two steps: the font joins the
 * library's font list (so the canvas and the export load it) and the role's
 * token names it first in its stack — one Undo restores both.
 */
export function DesignTypographySection({
  system,
  library,
  labels,
  fontLabels,
  commitToken,
  commit,
  onResult,
  loadPreviews,
  arabicFirst,
  disabled = false,
  dir,
}: DesignTypographySectionProps) {
  const [role, setRole] = useState<FontRole>('sans');
  const roleName = useId();
  const token = FONT_ROLE_TOKENS[role];
  const current = firstFamily(system.tokens[token]);

  const pick = (font: CatalogueFont): void => {
    const value = fontStack(font.family, role);
    if (commit === undefined) {
      commitToken(token, value);
      return;
    }
    const uploaded = (library?.fonts ?? []).some(
      (entry) => entry.source === 'upload' && entry.family === font.family,
    );
    const hosted: SiteFont = {
      family: font.family,
      source: 'google',
      weights: weightsToLoad(font),
      scripts: font.arabic ? ['arabic', 'latin'] : ['latin'],
    };
    onResult?.(
      commit(
        [
          ...(uploaded
            ? []
            : [{ command: 'setSiteFonts', args: { fonts: withSiteFont(library?.fonts, hosted) } }]),
          { command: 'setDesignToken', args: { token, value } },
        ],
        labels.commitFont(labels.roles[role], font.family),
      ),
    );
  };

  const upload = (font: SiteFont): void => {
    if (commit === undefined) return;
    onResult?.(
      commit(
        [{ command: 'setSiteFonts', args: { fonts: withSiteFont(library?.fonts, font) } }],
        labels.commitUpload(font.family),
      ),
    );
  };

  return (
    <div className="bldr-design-system__section">
      <fieldset className="bldr-design-system__roles" disabled={disabled}>
        <legend className="bldr-design-system__group">{labels.fontRole}</legend>
        {ROLES.map((id) => (
          <label key={id} className="bldr-design-system__role">
            <input
              type="radio"
              name={roleName}
              value={id}
              checked={role === id}
              onChange={() => {
                setRole(id);
              }}
            />
            {labels.roles[id]}
          </label>
        ))}
      </fieldset>
      <FontPicker
        value={current}
        onPick={pick}
        onUpload={commit === undefined ? undefined : upload}
        uploadedFonts={library?.fonts}
        loadPreviews={loadPreviews}
        arabicFirst={arabicFirst}
        disabled={disabled}
        labels={fontLabels}
        dir={dir}
      />
      <DesignTokenRows
        title={labels.typeScale}
        rows={TYPE_SCALE_ROWS}
        tokens={system.tokens}
        onCommit={commitToken}
        tokenLabel={labels.token}
        disabled={disabled}
      />
    </div>
  );
}
