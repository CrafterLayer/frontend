import { ChromeButton } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import { AssistantModes } from '../AssistantModes';
import { IconSend, IconStop } from '../AssistantPanel/AssistantPanel.icons';
import { MENTION_PATTERN, type MentionCandidate } from '../AssistantPanel/AssistantPanel.mentions';
import { MODES, type AssistantMode } from '../AssistantPanel/AssistantPanel.modes';
import { MentionPicker } from '../MentionPicker';

export interface AssistantComposerProps {
  /** The field's text. Owned above, because a send reads it and then clears it. */
  readonly draft: string;
  readonly onDraftChange: (draft: string) => void;
  /** The label's `for`, so the hidden label reaches the field it names. */
  readonly inputId: string;
  /** A run owns the panel, while the field remains available for one queued request. */
  readonly busy: boolean;
  readonly queued?: boolean | undefined;
  readonly onSend: () => void;
  readonly onStop: () => void;
  /** Focus, which the agent's face watches. Not focus-within: this is the field. */
  readonly onFocusChange: (focused: boolean) => void;
  /** The `@` fragment under the caret, or null when none is open. */
  readonly mentionQuery: string | null;
  readonly onMentionQueryChange: (query: string | null) => void;
  readonly mentionCandidates: readonly MentionCandidate[];
  readonly onPickMention: (id: string) => void;
  readonly mode: AssistantMode;
  readonly onModeChange: (mode: AssistantMode) => void;
  /** The id of the line explaining why the modes are locked, for `aria-describedby`. */
  readonly modeLockId: string;
  readonly locale: AgentLocale;
  readonly models?: readonly string[] | undefined;
  readonly model?: string | undefined;
  readonly onSelectModel?: ((model: string) => void) | undefined;
}

/** Short enough for the composer row: "Sonnet · CLI", not "sonnet · Claude CLI" cut to "sonnet · Cl…". */
function modelLabel(slug: string): string {
  if (slug.startsWith('cli:')) {
    const name = slug.slice('cli:'.length);
    return name === '' ? 'Claude CLI' : `${name.charAt(0).toUpperCase()}${name.slice(1)} · CLI`;
  }
  if (slug.startsWith('api:')) return `${slug.slice('api:'.length).replace(/^claude-/u, '')} · API`;
  const name = slug.slice(slug.lastIndexOf('/') + 1);
  return name.endsWith(':free') ? `${name.slice(0, -5)} · free` : name;
}

/**
 * The bottom of the panel: the field, the mode row, the send slot, and the two
 * lines that say what the next press will do.
 *
 * It is one control, not three. The focus ring is drawn around the CARD by
 * `:focus-within` and the textarea delegates its own — so tabbing to the send
 * button does not move a ring off the thing a person is looking at.
 */
export function AssistantComposer({
  draft,
  onDraftChange,
  inputId,
  busy,
  queued = false,
  onSend,
  onStop,
  onFocusChange,
  mentionQuery,
  onMentionQueryChange,
  mentionCandidates,
  onPickMention,
  mode,
  onModeChange,
  modeLockId,
  locale,
  models = [],
  model,
  onSelectModel,
}: AssistantComposerProps) {
  return (
    <form
      className="pg-chat__composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="pg-chat__composer-card" data-busy={busy ? '' : undefined}>
        {/* The aurora is DECORATION over the card's own edge, so it can animate
            while the assistant works without moving anything in the layout. Two
            layers, one gradient: the aura is the blurred halo, the glow is the
            crisp ring — split because the ring's mask would clip the halo if
            they shared an element. */}
        <span className="pg-chat__composer-aura" aria-hidden="true" />
        <span className="pg-chat__composer-glow" aria-hidden="true" />
        <label className="bldr-visually-hidden" htmlFor={inputId}>
          Ask the assistant
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          placeholder={busy ? (queued ? 'One next request is queued…' : 'Type the next request…') : 'Ask for a change…'}
          enterKeyHint="send"
          /* The field and its send button are ONE control, so the ring is drawn
             around the card by :focus-within. See the stylesheet. */
          data-bldr-focus-ring="delegated"
          onFocus={() => {
            onFocusChange(true);
          }}
          onBlur={() => {
            onFocusChange(false);
          }}
          onChange={(event) => {
            const value = event.currentTarget.value;
            onDraftChange(value);
            /*
              The mention is read from the text BEFORE the caret, not from the
              whole field. A person editing the middle of a sentence that ends
              in `@hero` is not writing that mention, and opening a picker there
              would put a list under a caret that is somewhere else entirely.
            */
            const caret = event.currentTarget.selectionStart;
            const match = MENTION_PATTERN.exec(value.slice(0, caret));
            onMentionQueryChange(match === null ? null : (match[1] ?? ''));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && mentionQuery !== null) {
              event.preventDefault();
              onMentionQueryChange(null);
              return;
            }
            // Enter sends, Shift+Enter writes a line — the convention every
            // chat uses, and the one a person's hands already know.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!queued) onSend();
            }
          }}
        />
        {mentionQuery === null ? null : (
          <MentionPicker candidates={mentionCandidates} onPick={onPickMention} />
        )}
        <div className="pg-chat__composer-actions">
          {/*
            The mode row, where Claude keeps its own: part of the composer, read
            before every send.

            LOCKED WHILE A RUN IS IN FLIGHT, and that is not a nicety.

            A run captures its mode when it starts, and the closure keeps it: a
            request begun in Auto carries `apply: 'auto'` all the way to
            `applyAiPlan`, and a build's scaffold, its fallback, its fills and
            their retries all apply unconditionally. Leaving this enabled meant a
            person could press Auto, see it thinking, change their mind to Plan —
            and watch the page be written anyway, by a run they had just told to
            stop writing. The same holds for the approval card: it resolves the
            promise the ORIGINAL run installed.

            Locking the control is the honest answer, because it is true: this
            run's authority was decided when it started, and the way to change it
            is Stop. Changing the label while the closure keeps the old authority
            would be the lie.
          */}
          <AssistantModes
            mode={mode}
            onChange={onModeChange}
            busy={busy}
            lockReasonId={modeLockId}
            locale={locale}
          />
          {/*
            Hidden while a run is busy rather than disabled: it cannot change a
            run in flight, and beside "Queue next" it was squeezed to a bare
            chevron that read as a broken control.
          */}
          {models.length > 1 && !busy ? (
            <label className="pg-chat__composer-model">
              <span className="bldr-visually-hidden">Model</span>
              <select
                aria-label="Model"
                title={model ?? models[0]}
                value={model ?? models[0]}
                disabled={busy}
                onChange={(event) => onSelectModel?.(event.currentTarget.value)}
              >
                {models.map((slug) => <option key={slug} value={slug}>{modelLabel(slug)}</option>)}
              </select>
            </label>
          ) : null}
          {busy ? (
            <ChromeButton
              size="sm"
              className="pg-chat__queue-next"
              disabled={queued || draft.trim().length === 0}
              onClick={onSend}
            >
              Queue next
            </ChromeButton>
          ) : null}
          <ChromeButton
            variant="icon"
            tone="primary"
            size="sm"
            className="pg-chat__send"
            /* One slot, two verbs: while the assistant works, the send slot IS
               the stop control — the same place the hand just was, and a promise
               that a running request is never out of reach. */
            aria-label={busy ? 'Stop' : 'Send'}
            disabled={!busy && draft.trim().length === 0}
            onClick={() => {
              if (busy) {
                onStop();
              } else {
                onSend();
              }
            }}
          >
            {busy ? <IconStop /> : <IconSend />}
          </ChromeButton>
        </div>
      </div>
      {/* What the chosen mode will do, said out loud, beside the whole
          guarantee — in one line, where the decision is made. */}
      <p className="pg-chat__footnote">
        {/*
          While a run is in flight this line says WHY the modes are locked,
          instead of what the chosen mode does — which the person cannot act on
          until the run ends anyway.

          It lives here, and not among the buttons, because the first version put
          it inside the radiogroup: a three-line paragraph wedged between the
          modes and the Send button, wrapping over the action row and making the
          composer look broken. A one-line explanation belongs in the one-line
          place a person already reads for mode information.
        */}
        <span id={modeLockId} className="pg-chat__mode-hint">
          {busy
            ? 'Stop the request to change mode.'
            : MODES.find((candidate) => candidate.id === mode)?.hint}
        </span>
        {/* <span className="pg-chat__guarantee">
          <IconShield />
          One change. One undo.
        </span> */}
      </p>
    </form>
  );
}
