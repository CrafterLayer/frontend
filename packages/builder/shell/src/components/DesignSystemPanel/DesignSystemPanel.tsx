import { useId, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

import type { DesignSystem, SiteLibrary, TokenName } from '@craftkit/builder-schema';

import { ChromeButton } from '../ChromeButton';
import type { FontPickerLabels } from '../FontPicker/FontPicker.labels';
import type { PaletteRampEditorLabels } from '../PaletteRampEditor/PaletteRampEditor.labels';
import { DesignColorsSection } from './DesignColorsSection';
import {
  DESIGN_SYSTEM_PANEL_LABELS_EN,
  type DesignSystemPanelLabels,
} from './DesignSystemPanel.labels';
import { DesignTokenRows } from './DesignTokenRows';
import { DesignTypographySection } from './DesignTypographySection';
import type { SiteCommit, SiteCommitResult } from './site-door';
import { RADIUS_ROWS, SHADOW_ROWS, SPACING_ROWS, WIDTH_ROWS } from './token-groups';
import '../../styles/visually-hidden.css';
import './DesignSystemPanel.css';

export type DesignSystemSection = 'colours' | 'typography' | 'shape' | 'spacing';

export interface DesignSystemPanelProps {
  /** The site's system, as it stands. The panel never owns it. */
  readonly system: DesignSystem;
  /**
   * Commits ONE token. Called on commit, never per keystroke. Used when
   * `onCommit` is absent; with it, token edits go through `onCommit` too,
   * labelled "Design token · <name>".
   */
  readonly onChangeToken: (token: TokenName, value: string) => void;
  /** The site library (palette, fonts). */
  readonly library?: SiteLibrary | undefined;
  /**
   * Sends steps as ONE labelled transaction (`siteCommitFor(siteKernel)`).
   * Absent ⇒ the palette, the shade generator and font loading/upload are
   * not offered (a token-only host).
   */
  readonly onCommit?: SiteCommit | undefined;
  /** Absent ⇒ the action is not offered. */
  readonly onRegenerate?: (() => void) | undefined;
  /** A run owns the panel: the fields are closed and nothing may be committed. */
  readonly busy?: boolean | undefined;
  /**
   * What the door refused, in the door's own words. Announced, because a person
   * who has just typed a colour is looking at the field, not at a banner.
   */
  readonly issues?: readonly string[] | undefined;
  readonly defaultSection?: DesignSystemSection | undefined;
  readonly labels?: DesignSystemPanelLabels | undefined;
  readonly fontLabels?: FontPickerLabels | undefined;
  readonly rampLabels?: PaletteRampEditorLabels | undefined;
  /** Load font previews from Google (off in tests and offline hosts). */
  readonly loadFontPreviews?: boolean | undefined;
  /** The editor UI's direction (Radix arrow keys and the layout follow it). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

/**
 * A site's design system, sectioned (style-manager DESIGN.md §G): colours
 * (roles, palette, shade generator, contrast), typography (family per role,
 * Google picker with an Arabic filter, upload, type scale), radius and
 * shadows, spacing and widths — each with a live preview.
 *
 * ## One edit, one transaction
 *
 * Every field holds a draft while a person types and commits once, on blur
 * or Enter; an external write (a generation, an undo) discards the draft.
 * Each commit is one `setDesignToken` or one library command group, so it is
 * one Undo, and every bound element repaints because token utilities and
 * palette `var()` references are live.
 *
 * ## Why the failures are announced rather than drawn
 *
 * The door owns legibility (FR-014) and refuses a token that would make a
 * pairing unreadable. A person who has just typed one is looking at the field,
 * so the refusal goes into a live region and is tied to the field.
 */
export function DesignSystemPanel({
  system,
  onChangeToken,
  library,
  onCommit,
  onRegenerate,
  busy = false,
  issues,
  defaultSection = 'colours',
  labels = DESIGN_SYSTEM_PANEL_LABELS_EN,
  fontLabels,
  rampLabels,
  loadFontPreviews = true,
  dir,
}: DesignSystemPanelProps) {
  const [section, setSection] = useState<DesignSystemSection>(defaultSection);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const issuesId = useId();

  const onResult = (result: SiteCommitResult): void => {
    setRefusal(result.ok ? undefined : result.message);
  };
  const commitToken = (token: TokenName, value: string): void => {
    if (onCommit === undefined) {
      onChangeToken(token, value);
      return;
    }
    onResult(
      onCommit([{ command: 'setDesignToken', args: { token, value } }], labels.commitToken(labels.token(token))),
    );
  };

  const shown = [...(issues ?? []), ...(refusal === undefined ? [] : [refusal])];
  const invalid = shown.length > 0;

  return (
    <section className="bldr-design-system" aria-label={labels.region} dir={dir}>
      <header className="bldr-design-system__head">
        <h2 className="bldr-design-system__title">{labels.systemName(system.name)}</h2>
        {onRegenerate === undefined ? null : (
          <ChromeButton variant="quiet" size="sm" disabled={busy} onClick={onRegenerate}>
            {labels.regenerate}
          </ChromeButton>
        )}
      </header>

      <p className="bldr-visually-hidden" role="status">
        {shown.join(' ')}
      </p>
      {invalid ? (
        <ul id={issuesId} className="bldr-design-system__issues">
          {shown.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {/*
        Every section stays mounted (hidden when not chosen): a draft typed in
        one section survives a look at another, and the whole system is one
        region an audit can walk. Font previews load only while Typography is
        open, so opening the panel costs no font requests.
      */}
      <Tabs.Root
        className="bldr-design-system__tabs"
        value={section}
        onValueChange={(value) => {
          setSection(value as DesignSystemSection);
        }}
        dir={dir}
      >
        <Tabs.List className="bldr-design-system__tablist" aria-label={labels.sections}>
          <Tabs.Trigger className="bldr-design-system__tab" value="colours">
            {labels.colours}
          </Tabs.Trigger>
          <Tabs.Trigger className="bldr-design-system__tab" value="typography">
            {labels.typography}
          </Tabs.Trigger>
          <Tabs.Trigger className="bldr-design-system__tab" value="shape">
            {labels.shape}
          </Tabs.Trigger>
          <Tabs.Trigger className="bldr-design-system__tab" value="spacing">
            {labels.spacing}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content
          className="bldr-design-system__panel"
          value="colours"
          forceMount
          hidden={section !== 'colours'}
        >
          <DesignColorsSection
            system={system}
            library={library}
            labels={labels}
            rampLabels={rampLabels}
            commitToken={commitToken}
            commit={onCommit}
            onResult={onResult}
            invalid={invalid}
            issuesId={issuesId}
            disabled={busy}
            dir={dir}
          />
        </Tabs.Content>
        <Tabs.Content
          className="bldr-design-system__panel"
          value="typography"
          forceMount
          hidden={section !== 'typography'}
        >
          <DesignTypographySection
            system={system}
            library={library}
            labels={labels}
            fontLabels={fontLabels}
            commitToken={commitToken}
            commit={onCommit}
            onResult={onResult}
            loadPreviews={loadFontPreviews && section === 'typography'}
            arabicFirst={dir === 'rtl'}
            disabled={busy}
            dir={dir}
          />
        </Tabs.Content>
        <Tabs.Content
          className="bldr-design-system__panel"
          value="shape"
          forceMount
          hidden={section !== 'shape'}
        >
          <DesignTokenRows
            title={labels.radius}
            rows={RADIUS_ROWS}
            tokens={system.tokens}
            onCommit={commitToken}
            tokenLabel={labels.token}
            disabled={busy}
          />
          <DesignTokenRows
            title={labels.shadows}
            rows={SHADOW_ROWS}
            tokens={system.tokens}
            onCommit={commitToken}
            tokenLabel={labels.token}
            disabled={busy}
          />
        </Tabs.Content>
        <Tabs.Content
          className="bldr-design-system__panel"
          value="spacing"
          forceMount
          hidden={section !== 'spacing'}
        >
          <DesignTokenRows
            title={labels.spacingScale}
            rows={SPACING_ROWS}
            tokens={system.tokens}
            onCommit={commitToken}
            tokenLabel={labels.token}
            disabled={busy}
          />
          <DesignTokenRows
            title={labels.widths}
            rows={WIDTH_ROWS}
            tokens={system.tokens}
            onCommit={commitToken}
            tokenLabel={labels.token}
            disabled={busy}
          />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
