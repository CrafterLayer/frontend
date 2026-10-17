import * as Popover from '@radix-ui/react-popover';
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { t, tParts, type Key } from '../../copy';
import type { SwatchContrast } from '../../model/page-plan-draft';
import type { Locale, SwatchRole } from '../../model/view-types';
import { usePortalScope } from '../IconButton';

import './SwatchPopover.css';

export interface SwatchPopoverProps {
  readonly locale: Locale;
  /** Which of the five direction colours this is (SPEC §4.11 `role.*`). */
  readonly role: SwatchRole;
  /** The colour the plan holds now, `#rrggbb`. */
  readonly hex: string;
  /**
   * The contrast verdict for a candidate colour of this role, against the colour it is read
   * with (DirectionEditor answers with the model's `swatchContrast`, which asks the engine's
   * `validateDesignSystem`). `null` means "not measured", never "passes".
   */
  readonly judge: (hex: string) => SwatchContrast | null;
  /** Applies a colour. Called only with a readable one: a failing pair is refused. */
  readonly onChange: (hex: string) => void;
}

/** The verdict lines by the pair the role is judged in (SPEC §4.11 `swatch.ok` / `swatch.low`). */
const VERDICT: Readonly<Record<SwatchRole, { readonly ok: Key; readonly low: Key }>> = {
  background: { ok: 'swatch.ok', low: 'swatch.low' },
  text: { ok: 'swatch.ok', low: 'swatch.low' },
  surface: { ok: 'swatch.ok.surface', low: 'swatch.low.surface' },
  accent: { ok: 'swatch.ok.accent', low: 'swatch.low.accent' },
  onAccent: { ok: 'swatch.ok.accent', low: 'swatch.low.accent' },
};

/** What the hex field teaches when it cannot read what was typed. */
const EXAMPLE_HEX = '#0F766E';

/** `#rgb`, `#rrggbb`, with or without `#`, any case → `#rrggbb`; anything else → `null`. */
function parseHex(text: string): string | null {
  const digits = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(text.trim())?.[1]?.toLowerCase();
  if (digits === undefined) return null;
  // Hex digits are ASCII, so doubling each character is safe.
  return digits.length === 3 ? `#${digits.replace(/./gu, '$&$&')}` : `#${digits}`;
}

/** How a hex code is shown: `#0F766E`, as design tools print it. */
function shownHex(hex: string): string {
  return hex.toUpperCase();
}

/**
 * The ratio as the verdict prints it, rounded DOWN to two places: a pair measured 4.497:1
 * fails the 4.5 bar, and "4.5" beside "Not readable" would read as a contradiction.
 */
function shownRatio(ratio: number): number {
  return Math.floor(ratio * 100) / 100;
}

/**
 * One colour of the plan's direction (SPEC §4.11): a 20px swatch in a 32px target that opens
 * a Radix Popover with the role's name, the native colour input, a 32px hex field and the
 * live contrast verdict.
 *
 * The verdict follows the candidate as it changes, and the popover refuses a colour that
 * breaks its pair: it shows it, says so, and does not apply it (`onChange` is never called
 * with it), so the plan keeps its last readable colour. A readable colour is applied when
 * the native picker settles (its `change`), and on Enter or blur in the hex field; Enter
 * also closes the popover. Esc closes it without applying what was typed, and focus returns
 * to the swatch.
 *
 * The swatch is the page's colour, content not chrome (SPEC §2.1 rule 4): it sits inside a
 * `--bldr-content-outline` ring and keeps its colour in forced-colors mode. A held colour
 * that fails its pair carries an Amber flag, and the flag's words are the swatch's
 * accessible description.
 */
export function SwatchPopover({ locale, role, hex, judge, onChange }: SwatchPopoverProps) {
  const titleId = useId();
  const verdictId = useId();
  const refusedId = useId();
  const invalidId = useId();
  const flagId = useId();
  const { scope, capture } = usePortalScope();
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState(hex);
  const [field, setField] = useState(shownHex(hex));
  const fieldRef = useRef<HTMLInputElement>(null);
  /**
   * Set when the popover is answered (Esc cancels; Enter applied): the hex field's blur that
   * follows must not apply what was typed, or apply it a second time.
   */
  const settled = useRef(false);

  const keys = VERDICT[role];
  const roleName = t(locale, `role.${role}`);
  const held = judge(hex);
  const flag =
    held !== null && !held.readable ? t(locale, keys.low, { r: shownRatio(held.ratio) }) : null;
  const verdict = open ? judge(candidate) : held;
  const fieldValid = parseHex(field) !== null;
  const refused = open && candidate !== hex && verdict !== null && !verdict.readable;

  /** Applies `value` unless it is the colour already held, or it breaks its pair. */
  const commit = (value: string): boolean => {
    if (value === hex) return true;
    const judged = judge(value);
    if (judged !== null && !judged.readable) return false;
    onChange(value);
    return true;
  };

  /*
    The native picker's `change` fires once, when the person settles on a colour; React's
    onChange fires on every `input` while they drag, which only moves the candidate. The
    listener reads the newest `commit` through a ref, written after each render.
  */
  const latestCommit = useRef(commit);
  useLayoutEffect(() => {
    latestCommit.current = commit;
  });
  const colourInput = useCallback((input: HTMLInputElement | null) => {
    if (input === null) return undefined;
    const settle = () => {
      const value = parseHex(input.value);
      if (value !== null) latestCommit.current(value);
    };
    input.addEventListener('change', settle);
    return () => {
      input.removeEventListener('change', settle);
    };
  }, []);

  const onOpenChange = (next: boolean) => {
    if (next) {
      settled.current = false;
      setCandidate(hex);
      setField(shownHex(hex));
    }
    setOpen(next);
  };

  const captureScope = (event: PointerEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    capture(event.currentTarget);
  };

  const verdictText =
    verdict === null
      ? null
      : t(locale, verdict.readable ? keys.ok : keys.low, { r: shownRatio(verdict.ratio) });
  const describedBy = [
    fieldValid ? null : invalidId,
    verdictText === null ? null : verdictId,
    refused ? refusedId : null,
  ]
    .filter((id) => id !== null)
    .join(' ');

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="ck-agent-swatch"
          aria-label={t(locale, 'plan.swatch.aria', { role: roleName, hex: shownHex(hex) })}
          aria-describedby={flag === null ? undefined : flagId}
          data-role={role}
          data-unreadable={flag === null ? undefined : ''}
          onPointerDown={captureScope}
          onKeyDown={captureScope}
        >
          <span className="ck-agent-swatch__chip" style={{ backgroundColor: hex }} />
          {flag === null ? null : (
            <span id={flagId} hidden>
              {flag}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={scope.container ?? null}>
        <Popover.Content
          className="ck-agent-swatch-popover"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          aria-labelledby={titleId}
          aria-describedby={verdictText === null ? undefined : verdictId}
          onOpenAutoFocus={(event) => {
            // The hex field, selected: typing a code is the keyboard's fastest path.
            event.preventDefault();
            fieldRef.current?.focus();
            fieldRef.current?.select();
          }}
          onEscapeKeyDown={() => {
            settled.current = true;
          }}
        >
          <p id={titleId} className="ck-agent-swatch-popover__title">
            {roleName}
          </p>
          <div className="ck-agent-swatch-popover__fields">
            <input
              ref={colourInput}
              type="color"
              className="ck-agent-swatch-popover__picker"
              aria-label={t(locale, 'swatch.pick')}
              value={candidate}
              onChange={(event) => {
                const value = parseHex(event.currentTarget.value);
                if (value === null) return;
                setCandidate(value);
                setField(shownHex(value));
              }}
            />
            <input
              ref={fieldRef}
              type="text"
              className="ck-agent-swatch-popover__hex"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={7}
              aria-label={t(locale, 'swatch.hex')}
              aria-invalid={fieldValid ? undefined : true}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              value={field}
              onChange={(event) => {
                const text = event.currentTarget.value;
                setField(text);
                const value = parseHex(text);
                if (value !== null) setCandidate(value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                const value = parseHex(field);
                if (value !== null && commit(value)) {
                  settled.current = true;
                  setOpen(false);
                }
              }}
              onBlur={() => {
                if (settled.current) return;
                const value = parseHex(field);
                if (value !== null) commit(value);
              }}
            />
          </div>
          {fieldValid ? null : (
            <p id={invalidId} className="ck-agent-swatch-popover__line" data-tone="warning">
              {tParts(locale, 'swatch.hex.invalid', { hex: EXAMPLE_HEX }).map((part, index) =>
                part.kind === 'value' ? (
                  <bdi key={index} dir="ltr">
                    {part.text}
                  </bdi>
                ) : (
                  part.text
                ),
              )}
            </p>
          )}
          {verdictText === null ? null : (
            <p
              id={verdictId}
              className="ck-agent-swatch-popover__line"
              data-tone={verdict?.readable === false ? 'warning' : undefined}
            >
              {verdictText}
            </p>
          )}
          {refused ? (
            <p id={refusedId} className="ck-agent-swatch-popover__line" data-tone="warning">
              {t(locale, 'swatch.refused')}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
