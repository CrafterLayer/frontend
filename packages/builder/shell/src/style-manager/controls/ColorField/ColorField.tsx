import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import type { StyleMode, StyleValue } from '@craftkit/builder-schema';

import { useThemeScope } from '../../../fields/use-theme-scope';
import {
  contrastOf,
  MIN_CONTRAST,
  resolveColor,
  splitOpacity,
  StyleColorControl,
  type ColorSwatch,
  type StyleColorControlLabels,
} from '../StyleColorControl';
import { COLOR_FIELD_LABELS_EN, type ColorFieldLabels } from './ColorField.labels';

import './ColorField.css';

export interface ColorFieldProps {
  /** The property's name: "Background colour". */
  readonly label: string;
  readonly value: StyleValue | undefined;
  readonly mode: StyleMode;
  readonly tokens: readonly ColorSwatch[];
  readonly palette?: readonly ColorSwatch[] | undefined;
  /** The colour this one is read against; present ⇒ a contrast check runs. */
  readonly contrastWith?: string | undefined;
  readonly onCommit: (value: StyleValue | null) => void;
  readonly onPreview?: ((value: StyleValue | null) => void) | undefined;
  readonly mixed?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly labels?: ColorFieldLabels | undefined;
  readonly controlLabels?: StyleColorControlLabels | undefined;
}

/** What the trigger reads: a token's name (with its opacity), a palette name, or the hex. */
function valueText(
  value: StyleValue | undefined,
  tokens: readonly ColorSwatch[],
  palette: readonly ColorSwatch[],
): string | undefined {
  if (value === undefined) return undefined;
  switch (value.kind) {
    case 'token': {
      const parts = splitOpacity(value.token);
      const name = tokens.find((swatch) => swatch.id === parts.base)?.name ?? parts.base;
      return parts.opacity === undefined ? name : `${name} · ${String(parts.opacity)}%`;
    }
    case 'palette':
      return palette.find((swatch) => swatch.id === value.id)?.name ?? value.id;
    case 'raw':
      return value.css;
    case 'keyword':
      return value.keyword;
  }
}

/**
 * The side panel's colour row (style-manager panel design): one compact field
 * — a swatch over a checkerboard and the value's name — that opens a popover
 * holding the full colour control: design-system token chips, the site
 * palette, and (free mode) an inline react-colorful picker with a hex field.
 *
 * Everything the control writes still goes through its one-write-per-gesture
 * rules; the field only frames it. A colour that fails the contrast check
 * marks the closed field, so the warning is never hidden behind a click.
 */
export function ColorField({
  label,
  value,
  mode,
  tokens,
  palette = [],
  contrastWith,
  onCommit,
  onPreview,
  mixed = false,
  disabled = false,
  dir = 'ltr',
  labels = COLOR_FIELD_LABELS_EN,
  controlLabels,
}: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { attach, scope } = useThemeScope();
  const shown = mixed ? undefined : resolveColor(value, tokens, palette);
  const text = mixed ? labels.mixed : (valueText(value, tokens, palette) ?? labels.unset);
  const ratio = mixed ? undefined : contrastOf(shown, contrastWith);
  const lowContrast = ratio !== undefined && ratio < MIN_CONTRAST;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={attach}
          type="button"
          className="bldr-color-field"
          aria-label={
            lowContrast ? `${labels.trigger(label, text)}, ${labels.lowContrast}` : labels.trigger(label, text)
          }
          data-mixed={mixed ? '' : undefined}
          data-unset={value === undefined && !mixed ? '' : undefined}
          disabled={disabled}
        >
          <span className="bldr-color-field__swatch" aria-hidden="true">
            <span
              className="bldr-color-field__fill"
              style={shown === undefined ? undefined : { backgroundColor: shown }}
            />
          </span>
          <span
            className="bldr-color-field__text"
            aria-hidden="true"
            /* A typed colour is Latin code: isolated left to right, so an Arabic
               panel shows "#ffffff", never "ffffff#" (fix pass 2026-10-06). */
            dir={!mixed && value?.kind === 'raw' ? 'ltr' : undefined}
          >
            {text}
          </span>
          {lowContrast ? (
            <svg
              className="bldr-color-field__warning"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <title>{labels.lowContrast}</title>
              <path d="M8 2.5 14 13H2z" />
              <path d="M8 6.5v3" />
              <path d="M8 11.25v.01" />
            </svg>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={scope}>
        <Popover.Content
          className="bldr-color-field__popover"
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          ref={contentRef}
          onEscapeKeyDown={() => {
            /* Escape closes the popover the way a click outside does: a hex
               still being typed is committed first (fix pass 2026-10-06). The
               blur runs the field's own commit before the content unmounts. */
            const content = contentRef.current;
            const active = content?.ownerDocument.activeElement;
            if (active instanceof HTMLElement && content?.contains(active) === true) active.blur();
          }}
        >
          <StyleColorControl
            label={label}
            value={value}
            mode={mode}
            tokens={tokens}
            palette={palette}
            contrastWith={contrastWith}
            onCommit={onCommit}
            onPreview={onPreview}
            mixed={mixed}
            disabled={disabled}
            dir={dir}
            picker="inline"
            labels={controlLabels}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
