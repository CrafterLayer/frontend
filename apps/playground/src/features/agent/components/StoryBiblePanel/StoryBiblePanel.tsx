import { useId, useState, type SyntheticEvent } from 'react';

import { t } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type { StoryBibleView } from '../../model/story-bible';
import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './StoryBiblePanel.css';

export interface StoryBiblePanelProps {
  readonly locale: Locale;
  /** The bible and the person's edits (`AgentController.storyBible`). */
  readonly bible: StoryBibleView;
  /** Starts open (stories and tests); the panel otherwise opens on the person's click. */
  readonly defaultOpen?: boolean | undefined;
  /** Appended to `ck-agent-bible`. */
  readonly className?: string | undefined;
}

/** The last path segment of an asset URL: what a person recognises ("forest.webp"). */
function fileName(url: string): string {
  const path = url.split(/[?#]/u)[0] ?? url;
  return path.split('/').filter(Boolean).pop() ?? url;
}

/**
 * The project's story bible (creative agent, 2026-10-12): the characters, approved assets,
 * places and canon the Agent keeps identical in every scene and every turn.
 *
 * A quiet disclosure above the composer, counting what the bible holds. Open, it lists each
 * kind under its own heading — a character as its colour swatch, name and role; an asset as
 * its kind and file name — each with a labelled Remove button, then two small forms: add a
 * character (name, role, colour) and add a canon fact. "Clear the bible" asks once more
 * before it empties everything. Nothing here runs a model: edits change what the next run is
 * told, and the Agent itself adds what its own scenes declare.
 */
export function StoryBiblePanel({
  locale,
  bible,
  defaultOpen = false,
  className,
}: StoryBiblePanelProps) {
  const panelId = useId();
  const nameId = useId();
  const roleId = useId();
  const colorId = useId();
  const factId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [used, setUsed] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [fact, setFact] = useState('');
  const [confirming, setConfirming] = useState(false);

  const { memory } = bible;
  const count =
    memory.characters.length + memory.assets.length + memory.locations.length + memory.facts.length;

  const addCharacter = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (bible.addCharacter({ name, role, color })) {
      setName('');
      setRole('');
    }
  };

  const addFact = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (bible.addFact(fact)) setFact('');
  };

  const removeButton = (label: string, onRemove: () => void) => (
    <button
      type="button"
      className="ck-agent-bible__remove"
      aria-label={t(locale, 'bible.remove', { name: label })}
      onClick={onRemove}
    >
      <AgentIcon name="close" />
    </button>
  );

  return (
    <section
      className={className === undefined ? 'ck-agent-bible' : `ck-agent-bible ${className}`}
      aria-label={t(locale, 'bible.toggle', { n: count })}
      data-open={open ? '' : undefined}
      data-animate={used ? '' : undefined}
    >
      <button
        type="button"
        className="ck-agent-bible__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          setUsed(true);
          setConfirming(false);
        }}
      >
        <AgentIcon name="disclosure" className="ck-agent-bible__chevron" />
        {t(locale, 'bible.toggle', { n: count })}
      </button>
      <div id={panelId} className="ck-agent-bible__panel" inert={!open}>
        <div className="ck-agent-bible__inner">
          <p className="ck-agent-bible__intro">
            {t(locale, count === 0 ? 'bible.empty' : 'bible.intro')}
          </p>

          {memory.characters.length > 0 ? (
            <>
              <h3 className="ck-agent-bible__heading">{t(locale, 'bible.characters')}</h3>
              <ul role="list" className="ck-agent-bible__list">
                {memory.characters.map((character) => (
                  <li key={character.id} className="ck-agent-bible__row">
                    <span
                      className="ck-agent-bible__swatch"
                      aria-hidden="true"
                      style={
                        character.color === undefined
                          ? undefined
                          : { backgroundColor: character.color }
                      }
                    />
                    <span className="ck-agent-bible__label">
                      <bdi lang={resolveLang(character.name, locale)}>{character.name}</bdi>
                      {character.role === undefined ? null : (
                        <span className="ck-agent-bible__meta">{character.role}</span>
                      )}
                    </span>
                    {removeButton(character.name, () => {
                      bible.removeCharacter(character.id);
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {memory.assets.length > 0 ? (
            <>
              <h3 className="ck-agent-bible__heading">{t(locale, 'bible.assets')}</h3>
              <ul role="list" className="ck-agent-bible__list">
                {memory.assets.map((asset) => (
                  <li key={asset.id} className="ck-agent-bible__row">
                    <span className="ck-agent-bible__tag">{asset.kind}</span>
                    <bdi className="ck-agent-bible__label" dir="ltr" title={asset.url}>
                      {fileName(asset.url)}
                    </bdi>
                    {removeButton(fileName(asset.url), () => {
                      bible.removeAsset(asset.id);
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {memory.locations.length > 0 ? (
            <>
              <h3 className="ck-agent-bible__heading">{t(locale, 'bible.locations')}</h3>
              <ul role="list" className="ck-agent-bible__list">
                {memory.locations.map((place) => (
                  <li key={place.id} className="ck-agent-bible__row">
                    <bdi className="ck-agent-bible__label" lang={resolveLang(place.name, locale)}>
                      {place.name}
                    </bdi>
                    {removeButton(place.name, () => {
                      bible.removeLocation(place.id);
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {memory.facts.length > 0 ? (
            <>
              <h3 className="ck-agent-bible__heading">{t(locale, 'bible.facts')}</h3>
              <ul role="list" className="ck-agent-bible__list">
                {memory.facts.map((entry) => (
                  <li key={entry} className="ck-agent-bible__row">
                    <bdi
                      className="ck-agent-bible__label ck-agent-bible__label--wrap"
                      lang={resolveLang(entry, locale)}
                    >
                      {entry}
                    </bdi>
                    {removeButton(entry, () => {
                      bible.removeFact(entry);
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <form className="ck-agent-bible__form" onSubmit={addCharacter}>
            <h3 className="ck-agent-bible__heading">{t(locale, 'bible.addCharacter')}</h3>
            <div className="ck-agent-bible__fields">
              <label className="ck-agent-bible__field" htmlFor={nameId}>
                <span>{t(locale, 'bible.name')}</span>
                <input
                  id={nameId}
                  value={name}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              </label>
              <label className="ck-agent-bible__field" htmlFor={roleId}>
                <span>{t(locale, 'bible.role')}</span>
                <input
                  id={roleId}
                  value={role}
                  maxLength={40}
                  autoComplete="off"
                  onChange={(event) => {
                    setRole(event.target.value);
                  }}
                />
              </label>
              <label
                className="ck-agent-bible__field ck-agent-bible__field--color"
                htmlFor={colorId}
              >
                <span>{t(locale, 'bible.color')}</span>
                <input
                  id={colorId}
                  type="color"
                  value={color}
                  onChange={(event) => {
                    setColor(event.target.value);
                  }}
                />
              </label>
              <button type="submit" className="ck-agent-bible__add" disabled={name.trim() === ''}>
                {t(locale, 'bible.add')}
              </button>
            </div>
          </form>

          <form className="ck-agent-bible__form" onSubmit={addFact}>
            <label className="ck-agent-bible__heading" htmlFor={factId}>
              {t(locale, 'bible.addFact')}
            </label>
            <div className="ck-agent-bible__fields">
              <input
                id={factId}
                className="ck-agent-bible__fact"
                value={fact}
                maxLength={200}
                autoComplete="off"
                onChange={(event) => {
                  setFact(event.target.value);
                }}
              />
              <button type="submit" className="ck-agent-bible__add" disabled={fact.trim() === ''}>
                {t(locale, 'bible.add')}
              </button>
            </div>
          </form>

          {count > 0 ? (
            <button
              type="button"
              className="ck-agent-bible__clear"
              data-confirming={confirming ? '' : undefined}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                bible.clear();
                setConfirming(false);
              }}
            >
              {t(locale, confirming ? 'bible.clearConfirm' : 'bible.clear')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
