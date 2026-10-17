import type { AgentLocale } from '../AgentFace';
import { MODES, type AssistantMode } from '../AssistantPanel/AssistantPanel.modes';

export interface AssistantModesProps {
  readonly mode: AssistantMode;
  readonly onChange: (mode: AssistantMode) => void;
  /**
   * A run is in flight, so the group is LOCKED.
   *
   * Not a nicety. A run captures its mode when it starts and the closure keeps
   * it: a request begun in Auto carries `apply: 'auto'` all the way to the
   * door, and a build's scaffold, fallback, fills and retries all apply
   * unconditionally. Leaving this enabled meant a person could press Auto,
   * change their mind to Plan, and watch the page be written anyway — by a run
   * they had just told to stop writing.
   *
   * Locking is the honest answer because it is TRUE: this run's authority was
   * decided when it started, and the way to change it is Stop. Relabelling
   * while the closure keeps the old authority would be the lie.
   */
  readonly busy: boolean;
  /** Names the element that explains the lock, for people who cannot hover. */
  readonly lockReasonId: string;
  /** Which way "forward" is: Arabic mirrors the horizontal arrows. */
  readonly locale: AgentLocale;
}

/**
 * How eagerly the assistant acts, chosen before every send.
 *
 * A real radio group, keyboard contract included. Buttons with `role="radio"`
 * do not answer arrows on their own and each would be its own tab stop — so a
 * person told "radio group" reaches for the arrows and finds nothing, and
 * crossing the composer's action row costs three presses instead of one.
 */
export function AssistantModes({
  mode,
  onChange,
  busy,
  lockReasonId,
  locale,
}: AssistantModesProps) {
  return (
    <div
      className="pg-chat__modes"
      role="radiogroup"
      aria-label="Assistant mode"
      aria-disabled={busy ? true : undefined}
      {...(busy ? { 'aria-describedby': lockReasonId } : {})}
    >
      {MODES.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          role="radio"
          aria-checked={mode === candidate.id}
          className="pg-chat__mode"
          disabled={busy}
          /* ONE tab stop for the group, on the chosen option. */
          tabIndex={mode === candidate.id ? 0 : -1}
          data-mode={candidate.id}
          onKeyDown={(event) => {
            const mirrored =
              locale === 'ar' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                ? event.key === 'ArrowLeft'
                  ? 'ArrowRight'
                  : 'ArrowLeft'
                : event.key;
            const step =
              mirrored === 'ArrowRight' || mirrored === 'ArrowDown'
                ? 1
                : mirrored === 'ArrowLeft' || mirrored === 'ArrowUp'
                  ? -1
                  : 0;
            if (step === 0) return;
            event.preventDefault();
            const at = MODES.findIndex((entry) => entry.id === mode);
            // Wraps, as a radio group does: the ends are not walls.
            const next = MODES[(at + step + MODES.length) % MODES.length];
            if (next === undefined) return;
            onChange(next.id);
            /*
              Selection MOVES focus in a radio group — the newly chosen option
              is the one tab stop, so leaving focus behind would strand it on an
              element the browser will skip next time.
            */
            event.currentTarget.parentElement
              ?.querySelector<HTMLButtonElement>(`[data-mode="${next.id}"]`)
              ?.focus();
          }}
          onClick={() => {
            onChange(candidate.id);
          }}
        >
          {candidate.label}
        </button>
      ))}
    </div>
  );
}
