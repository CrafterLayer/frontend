import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import Sketch from '@uiw/react-color-sketch';

import { isColorRole, type PaletteEntry } from '@craftkit/builder-renderer';

import type { FieldControlProps } from '../controls';
import { useThemeScope } from '../use-theme-scope';

import './ColorRoleField.css';

/** Both axes move through the same flat list — the grid is layout, not structure. */
const ARROW_STEP = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 } as const;

export interface ColorRoleFieldProps extends FieldControlProps {
  /** The active page theme resolved to person-facing roles and swatch-only values. */
  readonly palette: readonly PaletteEntry[];
  /**
   * Re-points a role's value in the live theme. Absent ⇒ the free picker is not
   * offered and only the named roles are, because a colour with nowhere to go is
   * a control that lies.
   */
  readonly onRetheme?: ((role: PaletteEntry['role'], value: string) => void) | undefined;
}

/**
 * The page-colour control.
 *
 * Built on `@uiw/react-color-sketch` — the maintained continuation of
 * react-color's Sketch picker — rather than on a hand-rolled swatch list. The
 * shape is the one people already know: a saturation square over a hue rail, a
 * hex field, and a row of presets underneath.
 *
 * What the two halves MEAN is the part worth reading, because they write to
 * different places:
 *
 * - **A preset is a role.** `packages/builder/schema/src/style-values.ts`
 *   refuses a colour literal in a document outright, and that refusal is what
 *   makes a whole site re-themeable by re-pointing one token. So clicking a
 *   preset commits the ROLE NAME — `accent`, never `#4f46e5`.
 * - **The picker re-points the role.** Dragging in the square edits the value
 *   the current role resolves to, through `onRetheme`. The element repaints
 *   immediately, the document still holds a role, and every other block using
 *   that role moves with it — which is the honest consequence of a design
 *   system and is stated on the control rather than discovered later.
 *
 * Without `onRetheme` the square and rail are hidden entirely. A picker whose
 * dragging silently does nothing is worse than no picker.
 */
export function ColorRoleField({
  value,
  onChange,
  disabled,
  controlId,
  describedBy,
  labelledBy,
  palette,
  onRetheme,
}: ColorRoleFieldProps) {
  const currentRole = typeof value === 'string' && isColorRole(value) ? value : undefined;
  const active = palette.find((entry) => entry.role === currentRole) ?? palette[0];

  /*
    The picker's own colour is held here rather than read from the theme on
    every render. Hex is lossy exactly where a picker lives — `#000000` has no
    hue — so re-deriving on each drag would snap the rail back to red the
    moment someone reached the black corner.
  */
  const [draft, setDraft] = useState<string | undefined>();

  /*
    Roving focus, the WAI-ARIA radiogroup pattern: exactly one radio is tabbable
    and the arrows move between them. `focusedRole` is separate from the checked
    role on purpose — when the door REFUSES an arrow's choice the focus stays on
    the option the person moved to, so Shift+Tab leaves the group instead of
    snapping back to the checked one and trapping them there.
  */
  const [focusedRole, setFocusedRole] = useState<PaletteEntry['role'] | undefined>();
  const [open, setOpen] = useState(false);
  const { attach: attachThemeScope, scope: themeScope } = useThemeScope();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastValue = useRef(active?.value);
  useEffect(() => {
    if (lastValue.current === active?.value) return;
    lastValue.current = active?.value;
    setDraft(undefined);
  }, [active?.value]);

  const shown = draft ?? active?.value ?? '#000000';
  const tabStopRole = focusedRole ?? currentRole ?? palette[0]?.role;

  function moveByArrow(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step: number | undefined = Object.hasOwn(ARROW_STEP, event.key)
      ? ARROW_STEP[event.key as keyof typeof ARROW_STEP]
      : undefined;
    if (disabled === true || step === undefined || palette.length === 0) return;

    event.preventDefault();
    const nextIndex = (index + step + palette.length) % palette.length;
    const next = palette[nextIndex];
    if (next === undefined) return;

    optionRefs.current[nextIndex]?.focus();
    if (next.role !== currentRole) onChange(next.role);
  }

  return (
    <div
      ref={attachThemeScope}
      id={controlId}
      className="bldr-color-role-field"
      aria-disabled={disabled === true ? true : undefined}
    >
      {/*
        The roles stay in the row.

        They are the thing being chosen — the role name is what lands in the
        document — so they are visible and operable without opening anything.
        Only the free colour, which needs a 200px-tall picker, is behind a
        trigger: a control that tall inline pushes every other property off a
        312px panel.
      */}
      <div
        className="bldr-color-role-field__roles"
        role="radiogroup"
        aria-label={labelledBy === undefined ? 'Colour role' : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
            setFocusedRole(undefined);
          }
        }}
      >
        {palette.map((entry, index) => {
          const chosen = entry.role === currentRole;
          return (
            <button
              key={entry.role}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={entry.name}
              title={entry.name}
              tabIndex={entry.role === tabStopRole ? 0 : -1}
              disabled={disabled === true}
              className="bldr-color-role-field__role"
              onFocus={() => {
                setFocusedRole(entry.role);
              }}
              onKeyDown={(event) => {
                moveByArrow(event, index);
              }}
              onClick={() => {
                if (entry.role !== currentRole) onChange(entry.role);
              }}
            >
              <span
                className="bldr-color-role-field__swatch"
                data-color-role-swatch={entry.role}
                style={{ backgroundColor: entry.value }}
              />
              <span className="bldr-color-role-field__role-name">{entry.name}</span>
            </button>
          );
        })}
      </div>

      {/*
        The free colour.

        Radix owns the popover rather than this file: Escape and outside
        pointer-down dismiss it, focus moves in and returns to the trigger,
        placement flips away from the panel edge, and a portal keeps it out of
        the inspector's own scroll container — four things a hand-rolled
        popover gets wrong on the second try.
      */}
      {onRetheme === undefined || currentRole === undefined ? null : (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="bldr-color-role-field__trigger"
              disabled={disabled === true}
              aria-label={`Edit the ${active?.name ?? 'colour'} colour`}
            >
              <span className="bldr-color-role-field__swatch" style={{ backgroundColor: shown }} />
              <span className="bldr-color-role-field__trigger-name">{shown}</span>
            </button>
          </Popover.Trigger>

          {/*
            Portal INTO the theme scope, not the document body.

            `BuilderTheme` stamps `data-bldr-theme` on a wrapper div and every
            chrome token is defined under that attribute, so a portal to the
            body lands outside it and silently resolves the LIGHT palette.
            Measured in a real browser: with the editor stamped dark
            (`--bldr-surface: #171b24`) this popover still painted
            `rgb(255, 255, 255)`. `EditorCanvas` already portals its bubble and
            action bar into nodes inside the canvas for the same reason.
          */}
          <Popover.Portal container={themeScope}>
            <Popover.Content
              className="bldr-color-role-field__popover"
              sideOffset={6}
              collisionPadding={8}
              align="start"
            >
              <Sketch
                className="bldr-color-role-field__picker"
                color={shown}
                disableAlpha
                presetColors={false}
                onChange={(next) => {
                  if (disabled === true) return;
                  setDraft(next.hex);
                  lastValue.current = next.hex;
                  onRetheme(currentRole, next.hex);
                }}
              />
              <p className="bldr-color-role-field__note">
                Re-points “{active?.name}” everywhere it is used.
              </p>
              <Popover.Arrow className="bldr-color-role-field__arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
