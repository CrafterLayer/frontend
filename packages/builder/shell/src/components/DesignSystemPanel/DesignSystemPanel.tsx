import { useId, useState } from 'react';

import {
  COLOR_TOKENS,
  MEASUREMENT_TOKENS,
  type DesignSystem,
  type TokenName,
} from '@craftkit/builder-schema';

import { ChromeButton } from '../ChromeButton';
import { TokenSwatchGrid } from '../TokenSwatchGrid';
import '../../styles/visually-hidden.css';
import './DesignSystemPanel.css';

export interface DesignSystemPanelProps {
  /** The site's system, as it stands. The panel never owns it. */
  readonly system: DesignSystem;
  /** Commits ONE token. Called on commit, never per keystroke. */
  readonly onChangeToken: (token: TokenName, value: string) => void;
  /** Absent ⇒ the action is not offered. */
  readonly onRegenerate?: (() => void) | undefined;
  /** A run owns the panel: the fields are closed and nothing may be committed. */
  readonly busy?: boolean | undefined;
  /**
   * What the door refused, in the door's own words. Announced, because a person
   * who has just typed a colour is looking at the field, not at a banner.
   */
  readonly issues?: readonly string[] | undefined;
}

/**
 * A site's design system, edited one token at a time.
 *
 * ## Draft discipline: an external write always wins
 *
 * The field holds a DRAFT while a person types, because a controlled input that
 * dispatched per keystroke would fill history with an entry per character. But
 * the draft is not the truth: if the system changes underneath — a generation
 * lands, another tab commits, an undo runs — the draft is DISCARDED and the
 * field shows what the site actually holds.
 *
 * That direction is deliberate and it is the uncomfortable one. Keeping the
 * draft would mean a person's half-typed colour silently outranking a value the
 * kernel has already committed, and the next thing they commit would overwrite
 * a change they never saw. Losing three keystrokes is the smaller harm than
 * showing a site a colour it does not have.
 *
 * ## Why the failures are announced rather than drawn
 *
 * The door owns legibility (FR-014) and refuses a token that would make a
 * pairing unreadable. A person who has just typed one is looking at the field,
 * so the refusal goes into a live region — a banner they are not looking at is
 * a banner they will not read.
 */
export function DesignSystemPanel({
  system,
  onChangeToken,
  onRegenerate,
  busy = false,
  issues,
}: DesignSystemPanelProps) {
  const [selected, setSelected] = useState<TokenName>('accent');
  const [draft, setDraft] = useState<string>(system.tokens[selected]);
  const fieldId = useId();
  const issuesId = useId();

  const committed = system.tokens[selected];
  /*
    The external value is the truth, and this is where that is enforced: any
    change to the committed value — or to which token is being edited — throws
    the draft away.

    Adjusted DURING render, not in an effect. React documents this pattern for
    exactly this case, and an effect would paint one frame of the stale draft
    before correcting it — a person would see their discarded keystrokes flash
    back before the committed value replaced them.
  */
  const [editing, setEditing] = useState(`${selected}:${committed}`);
  if (editing !== `${selected}:${committed}`) {
    setEditing(`${selected}:${committed}`);
    setDraft(committed);
  }

  const commit = (): void => {
    const value = draft.trim();
    if (value === '' || value === committed) return;
    onChangeToken(selected, value);
  };

  return (
    <section className="bldr-design-system" aria-label="Design system">
      <header className="bldr-design-system__head">
        <h2 className="bldr-design-system__title">{system.name}</h2>
        {onRegenerate === undefined ? null : (
          <ChromeButton variant="quiet" size="sm" disabled={busy} onClick={onRegenerate}>
            Regenerate
          </ChromeButton>
        )}
      </header>

      <div className="bldr-design-system__edit">
        <label className="bldr-design-system__label" htmlFor={fieldId}>
          {selected}
        </label>
        <input
          id={fieldId}
          className="bldr-design-system__field"
          value={draft}
          disabled={busy}
          aria-describedby={issues === undefined || issues.length === 0 ? undefined : issuesId}
          aria-invalid={issues !== undefined && issues.length > 0}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          /* Commit on blur and on Enter — never on keystroke, or one colour
             becomes forty entries in history. */
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
      </div>

      <p className="bldr-visually-hidden" role="status">
        {issues === undefined || issues.length === 0 ? '' : issues.join(' ')}
      </p>
      {issues === undefined || issues.length === 0 ? null : (
        <ul id={issuesId} className="bldr-design-system__issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <h3 className="bldr-design-system__group">Colour</h3>
      <TokenSwatchGrid
        tokens={system.tokens}
        names={COLOR_TOKENS}
        label="Colour tokens"
        selected={selected}
        onSelect={setSelected}
        columns={3}
      />

      <h3 className="bldr-design-system__group">Measurement</h3>
      <TokenSwatchGrid
        tokens={system.tokens}
        names={MEASUREMENT_TOKENS}
        label="Measurement tokens"
        selected={selected}
        onSelect={setSelected}
        columns={3}
      />
    </section>
  );
}
