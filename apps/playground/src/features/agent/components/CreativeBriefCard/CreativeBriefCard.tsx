import { useId } from 'react';

import { t, type Key } from '../../copy';
import type { CreativeBriefGenre, CreativeBriefView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './CreativeBriefCard.css';

export interface CreativeBriefCardProps {
  readonly locale: Locale;
  readonly brief: CreativeBriefView;
  /** Appended to `ck-agent-brief`. */
  readonly className?: string | undefined;
}

const GENRE_KEY = {
  platformer: 'brief.genre.platformer',
  'maze-adventure': 'brief.genre.maze-adventure',
  arcade: 'brief.genre.arcade',
  puzzle: 'brief.genre.puzzle',
  'physics-toy': 'brief.genre.physics-toy',
  'visual-novel': 'brief.genre.visual-novel',
  'picture-book': 'brief.genre.picture-book',
  'chapter-story': 'brief.genre.chapter-story',
  mural: 'brief.genre.mural',
} as const satisfies Readonly<Record<CreativeBriefGenre, Key>>;

/** The planner's own role ids, in catalog words; a role the bible keeps is the person's text. */
const ROLE_KEY: Readonly<Record<string, Key>> = {
  hero: 'brief.role.hero',
  supporting: 'brief.role.supporting',
};

function roleText(locale: Locale, role: string): string {
  const key = ROLE_KEY[role];
  return key === undefined ? role : t(locale, key);
}

/** API ids (`tilemap`, `dust`) as code chips: always left-to-right, in the mono face. */
function Chips({ ids }: { readonly ids: readonly string[] }) {
  return (
    // role="list": WebKit drops the list role from a list drawn without markers.
    <ul role="list" className="ck-agent-brief__chips">
      {ids.map((id) => (
        <li key={id}>
          <code className="ck-agent-brief__chip" dir="ltr">
            {id}
          </code>
        </li>
      ))}
    </ul>
  );
}

/**
 * The creative brief a game or story build was planned from (creative agent, 2026-10-12).
 *
 * Before any section writer starts, the creative planner reads the request and decides what
 * the piece is (a platformer, a visual novel, a picture book), which Studio libraries serve
 * it, the effects that fit its setting and the characters it names. The writers read that
 * brief; this card shows the person the same plan, so a game that arrives with dust on
 * landing and a tile world is never a surprise, and a wrong genre is caught at a glance.
 *
 * A boxed card, unlike the record around it: it is a document the build carries, not the
 * build's history. A named region (`section` + heading), a description list of four facts,
 * library and effect names as left-to-right code, each character with the colour the story
 * bible keeps for them as a decorative dot. Not live: the record's head already speaks.
 */
export function CreativeBriefCard({ locale, brief, className }: CreativeBriefCardProps) {
  const titleId = useId();
  return (
    <section
      className={className === undefined ? 'ck-agent-brief' : `ck-agent-brief ${className}`}
      aria-labelledby={titleId}
      data-genre={brief.genre}
    >
      <div className="ck-agent-brief__head">
        <AgentIcon name="book" className="ck-agent-brief__glyph" />
        <h4 id={titleId} className="ck-agent-brief__title">
          {t(locale, 'brief.title')}
        </h4>
        <span className="ck-agent-brief__caption">{t(locale, 'brief.caption')}</span>
      </div>
      <dl className="ck-agent-brief__facts">
        <div className="ck-agent-brief__row">
          <dt>{t(locale, 'brief.genre')}</dt>
          <dd>{t(locale, GENRE_KEY[brief.genre])}</dd>
        </div>
        {brief.libs.length === 0 ? null : (
          <div className="ck-agent-brief__row">
            <dt>{t(locale, 'brief.libs')}</dt>
            <dd>
              <Chips ids={brief.libs} />
            </dd>
          </div>
        )}
        {brief.effects.length === 0 ? null : (
          <div className="ck-agent-brief__row">
            <dt>{t(locale, 'brief.effects')}</dt>
            <dd>
              <Chips ids={brief.effects} />
            </dd>
          </div>
        )}
        {brief.cast.length === 0 ? null : (
          <div className="ck-agent-brief__row">
            <dt>{t(locale, 'brief.cast')}</dt>
            <dd>
              <ul role="list" className="ck-agent-brief__cast">
                {brief.cast.map((character) => (
                  <li key={character.id} className="ck-agent-brief__character">
                    <span
                      className="ck-agent-brief__dot"
                      aria-hidden="true"
                      style={
                        character.color === undefined
                          ? undefined
                          : { backgroundColor: character.color }
                      }
                    />
                    <bdi>{character.name}</bdi>
                    {character.role === undefined ? null : (
                      <span className="ck-agent-brief__role">
                        <bdi>{roleText(locale, character.role)}</bdi>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
