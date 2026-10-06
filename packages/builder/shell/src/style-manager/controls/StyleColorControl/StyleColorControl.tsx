import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HexAlphaColorPicker, HexColorInput } from 'react-colorful';

import type { StyleMode, StyleValue } from '@craftkit/builder-schema';

import { useThemeScope } from '../../../fields/use-theme-scope';
import { focusRadioAt, rovingIndex } from '../../roving';
import {
  accessibleColor,
  accessibleToken,
  contrastOf,
  MIN_CONTRAST,
  normalizeHex,
  resolveColor,
  splitOpacity,
  type ColorSwatch,
} from './color-math';
import {
  STYLE_COLOR_CONTROL_LABELS_EN,
  type StyleColorControlLabels,
} from './StyleColorControl.labels';

import './StyleColorControl.css';

export interface StyleColorControlProps {
  /** The property's name: "Text colour". */
  readonly label: string;
  readonly value: StyleValue | undefined;
  /** `free` adds the site palette and a free picker; `tokens` keeps to theme colours. */
  readonly mode: StyleMode;
  /** Theme colour tokens (`accent`, `text-muted`…) with resolved swatches. */
  readonly tokens: readonly ColorSwatch[];
  /** Site-library palette colours (free mode only: they are CSS variables). */
  readonly palette?: readonly ColorSwatch[] | undefined;
  /**
   * The colour this one is read against (the effective background for text,
   * the text colour for a background). Present ⇒ a contrast check runs.
   */
  readonly contrastWith?: string | undefined;
  readonly onCommit: (value: StyleValue | null) => void;
  /** Live preview while the free picker is dragged; `null` ends it. */
  readonly onPreview?: ((value: StyleValue | null) => void) | undefined;
  readonly mixed?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly labels?: StyleColorControlLabels | undefined;
}

function swatchKey(kind: 'token' | 'palette', id: string): string {
  return `${kind}:${id}`;
}

/**
 * The colour control of every element (style-manager DESIGN.md §A.4–A.5).
 *
 * Theme colours first (a token keeps the page re-themable), then the site
 * palette, then — on agent trees — any colour from a free picker. A token
 * takes an opacity (`bg-accent/80`). When the colour is read against another
 * (text on its background), a WCAG contrast check warns below 4.5:1 and
 * offers the nearest accessible colour in one click.
 *
 * The free picker previews while dragged and commits once, when the pointer
 * or key is released: one Undo per gesture, not one per pixel.
 */
export function StyleColorControl({
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
  labels = STYLE_COLOR_CONTROL_LABELS_EN,
}: StyleColorControlProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);
  const { attach, scope } = useThemeScope();

  const swatches = [
    ...tokens.map((swatch) => ({ kind: 'token' as const, swatch })),
    ...(mode === 'free' ? palette.map((swatch) => ({ kind: 'palette' as const, swatch })) : []),
  ];
  const tokenParts = value?.kind === 'token' ? splitOpacity(value.token) : undefined;
  const checkedKey = mixed
    ? undefined
    : value?.kind === 'token' && tokenParts !== undefined
      ? swatchKey('token', tokenParts.base)
      : value?.kind === 'palette'
        ? swatchKey('palette', value.id)
        : undefined;
  const checkedIndex = swatches.findIndex(
    (entry) => swatchKey(entry.kind, entry.swatch.id) === checkedKey,
  );
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;
  const shown = mixed ? undefined : resolveColor(value, tokens, palette);
  const ratio = mixed ? undefined : contrastOf(shown, contrastWith);
  const lowContrast = ratio !== undefined && ratio < MIN_CONTRAST;

  const choose = (index: number) => {
    const entry = swatches[index];
    if (entry === undefined || disabled) return;
    const next: StyleValue =
      entry.kind === 'token'
        ? {
            kind: 'token',
            token:
              tokenParts?.opacity === undefined
                ? entry.swatch.id
                : `${entry.swatch.id}/${String(tokenParts.opacity)}`,
          }
        : { kind: 'palette', id: entry.swatch.id };
    if (index !== checkedIndex) onCommit(next);
  };

  const commitDraft = () => {
    if (draft === null) return;
    const hex = normalizeHex(draft);
    setDraft(null);
    onPreview?.(null);
    if (hex !== undefined && !(value?.kind === 'raw' && value.css === hex)) {
      onCommit({ kind: 'raw', css: hex });
    }
  };

  const commitOpacity = (base: string) => {
    if (opacityDraft === null) return;
    const typed = Number(opacityDraft);
    setOpacityDraft(null);
    if (opacityDraft.trim() === '' || !Number.isFinite(typed)) return;
    const next = Math.min(100, Math.max(0, Math.round(typed)));
    const token = next === 100 ? base : `${base}/${String(next)}`;
    if (value?.kind === 'token' && value.token === token) return;
    onCommit({ kind: 'token', token });
  };

  const fix = () => {
    if (shown === undefined || contrastWith === undefined) return;
    if (mode === 'tokens') {
      const token = accessibleToken(tokens, contrastWith);
      if (token !== undefined) onCommit({ kind: 'token', token });
      return;
    }
    const color = accessibleColor(shown, contrastWith);
    if (color !== undefined) onCommit({ kind: 'raw', css: color });
  };

  return (
    <div className="bldr-style-color" data-mixed={mixed ? '' : undefined}>
      <div className="bldr-style-color__row">
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label={mixed ? `${label} (${labels.mixed})` : label}
          className="bldr-style-color__swatches"
        >
          {swatches.map((entry, index) => (
            <button
              key={swatchKey(entry.kind, entry.swatch.id)}
              type="button"
              role="radio"
              aria-checked={index === checkedIndex}
              aria-label={entry.swatch.name}
              title={entry.swatch.name}
              tabIndex={index === tabStop ? 0 : -1}
              disabled={disabled}
              data-kind={entry.kind}
              className="bldr-style-color__swatch"
              style={{ backgroundColor: entry.swatch.css }}
              onClick={() => {
                choose(index);
              }}
              onKeyDown={(event) => {
                const next = rovingIndex(event.key, index, swatches.length, dir);
                if (next === undefined) return;
                event.preventDefault();
                choose(next);
                focusRadioAt(groupRef.current, next);
              }}
            />
          ))}
        </div>
        {mode === 'free' ? (
          <Popover.Root
            open={open}
            onOpenChange={(next) => {
              if (!next) commitDraft();
              setOpen(next);
            }}
          >
            <Popover.Trigger asChild>
              <button
                ref={attach}
                type="button"
                className="bldr-style-color__custom"
                aria-label={`${labels.custom}: ${label}`}
                data-active={value?.kind === 'raw' ? '' : undefined}
                disabled={disabled}
              >
                <span
                  className="bldr-style-color__custom-swatch"
                  style={value?.kind === 'raw' ? { backgroundColor: draft ?? value.css } : undefined}
                />
              </button>
            </Popover.Trigger>
            <Popover.Portal container={scope}>
              <Popover.Content
                className="bldr-style-color__popover"
                side="bottom"
                align="end"
                sideOffset={6}
                collisionPadding={8}
              >
                <div
                  className="bldr-style-color__picker"
                  onPointerUp={commitDraft}
                  onKeyUp={(event) => {
                    if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
                      commitDraft();
                    }
                  }}
                >
                  <HexAlphaColorPicker
                    color={draft ?? (value?.kind === 'raw' ? value.css : (shown ?? '#000000'))}
                    onChange={(next) => {
                      setDraft(next);
                      onPreview?.({ kind: 'raw', css: next });
                    }}
                  />
                </div>
                <HexColorInput
                  className="bldr-style-color__hex"
                  aria-label={labels.hex}
                  alpha
                  prefixed
                  color={draft ?? (value?.kind === 'raw' ? value.css : (shown ?? ''))}
                  onChange={(next) => {
                    setDraft(next);
                  }}
                  onBlur={commitDraft}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitDraft();
                  }}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
        {tokenParts === undefined || value?.kind !== 'token' ? null : (
          <input
            className="bldr-style-color__opacity"
            type="number"
            min={0}
            max={100}
            step={5}
            aria-label={`${labels.opacity}: ${label}`}
            disabled={disabled}
            value={opacityDraft ?? String(tokenParts.opacity ?? 100)}
            onChange={(event) => {
              setOpacityDraft(event.target.value);
            }}
            onBlur={() => {
              commitOpacity(tokenParts.base);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitOpacity(tokenParts.base);
            }}
          />
        )}
      </div>
      {lowContrast ? (
        <p className="bldr-style-color__warning" role="status">
          <span>{labels.lowContrast(ratio.toFixed(1), String(MIN_CONTRAST))}</span>
          <button type="button" className="bldr-style-color__fix" onClick={fix} disabled={disabled}>
            {labels.fixContrast}
          </button>
        </p>
      ) : null}
    </div>
  );
}
