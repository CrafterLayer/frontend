import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  findRejectedUtilities,
  splitUtilities,
  unknownUtilityClasses,
  type UtilityRejection,
} from '@craftkit/builder-schema';

import type { FieldControlProps } from '../controls';

import './UtilityClassField.css';

/**
 * The suggestion vocabulary.
 *
 * Not "all of Tailwind": a list long enough to be useless is the same as no
 * list. These are the utilities that resolve through THIS project's tokens —
 * every one of them compiles to `var(--t-…)` or a multiple of the site's
 * spacing step — plus the structural utilities a person reaches for when a
 * block's own controls have run out. Anything outside it is still accepted;
 * the list guides, it does not gate. The gate is `findRejectedUtilities`.
 */
const SUGGESTIONS: readonly { readonly group: string; readonly utilities: readonly string[] }[] = [
  {
    group: 'Colour — roles, not values',
    utilities: [
      'bg-surface',
      'bg-surface-inverse',
      'bg-accent',
      'bg-success',
      'text-text',
      'text-text-muted',
      'text-text-inverse',
      'text-accent',
      'border-accent',
      'hover:bg-accent',
    ],
  },
  {
    group: 'Spacing — steps of the site rhythm',
    utilities: ['p-4', 'p-8', 'px-6', 'py-8', 'pt-4', 'pb-4', 'mx-auto', 'mt-8', 'gap-4', 'gap-8'],
  },
  {
    group: 'Section tokens',
    utilities: [
      'py-section-sm',
      'py-section-md',
      'py-section-lg',
      'px-gutter',
      'gap-gap-sm',
      'gap-gap',
      'gap-gap-lg',
      'max-w-content-narrow',
      'max-w-content-standard',
      'max-w-content-wide',
    ],
  },
  {
    group: 'Layout',
    utilities: [
      'flex',
      'grid',
      'hidden',
      'flex-col',
      'flex-row',
      'flex-wrap',
      'items-center',
      'justify-between',
      'grid-cols-2',
      'grid-cols-3',
    ],
  },
  {
    group: 'Type',
    utilities: [
      'text-sm',
      'text-lg',
      'text-2xl',
      'font-medium',
      'font-bold',
      'text-center',
      'text-balance',
      'uppercase',
      'tracking-wide',
      'leading-relaxed',
    ],
  },
  {
    group: 'Edges and depth',
    utilities: [
      'rounded',
      'rounded-lg',
      'rounded-full',
      'border',
      'shadow-soft',
      'shadow-strong',
      'overflow-hidden',
      'opacity-75',
    ],
  },
  {
    group: 'Responsive',
    utilities: [
      'sm:flex-row',
      'sm:text-lg',
      'md:grid-cols-2',
      'md:px-8',
      'lg:grid-cols-3',
      'lg:py-section-lg',
      'lg:text-3xl',
      'lg:max-w-content-wide',
    ],
  },
];

const ALL_SUGGESTIONS = SUGGESTIONS.flatMap((section) => section.utilities);

/**
 * Extra suggestions for FREE mode (agent trees), where exact values, palette
 * variables and effect hooks are all legitimate (style-manager DESIGN.md D1).
 */
const FREE_SUGGESTIONS: readonly string[] = [
  'p-[18px]',
  'max-w-[72ch]',
  'bg-[#0f766e]',
  'bg-linear-to-b',
  'backdrop-blur-md',
  'ck-fx-glass',
  'ck-fx-mesh',
  'hover:-translate-y-1',
  'max-md:text-center',
  'transition',
];

export interface UtilityClassFieldProps extends FieldControlProps {
  /**
   * `tokens` (the default) keeps a registered block's law: theme tokens only,
   * no arbitrary values, no default palette. `free` is for elements of agent
   * trees: any class the live compiler can style is admitted, checked by the
   * same oracle the door uses.
   */
  readonly mode?: 'tokens' | 'free' | undefined;
}

/** What is wrong with these classes in this mode, as the first rejection, if any. */
function rejectionFor(parts: readonly string[], mode: 'tokens' | 'free'): UtilityRejection | undefined {
  if (mode === 'tokens') return findRejectedUtilities(parts.join(' '))[0];
  const unknown = unknownUtilityClasses(parts.join(' '))[0];
  return unknown === undefined
    ? undefined
    : {
        utility: unknown,
        code: 'arbitrary-value',
        message: `"${unknown}" is not a class the page can style. Check the spelling, or write the value as an arbitrary class such as p-[18px].`,
      };
}

/**
 * The Tailwind control.
 *
 * ## Why this is not a text input
 *
 * It was one, and a text input is what "full Tailwind customisation" looks like
 * when nobody has to use it. Three things were wrong with it. A person had to
 * already know the class names, because nothing offered any. A rejected class
 * failed on COMMIT, so the whole string bounced and the reason arrived after
 * the typing was done. And removing one class out of nine meant editing a
 * string by hand with a caret.
 *
 * Classes are discrete things, so they are edited as discrete things: a chip
 * per class, removable on its own, validated as it is added, with the reason
 * shown against the class that caused it.
 *
 * ## Why a rejected class is refused rather than stored and flagged
 *
 * `bg-blue-500` in a document is not a styling mistake, it is a page the design
 * system can no longer move — the exact failure the whole token argument
 * exists to prevent. Refusing at the point of entry, with the reason and a
 * replacement named, is the only version of this that teaches instead of
 * merely blocking.
 */
export function UtilityClassField({
  value,
  onChange,
  controlId,
  describedBy,
  disabled,
  placeholder,
  mode = 'tokens',
}: UtilityClassFieldProps) {
  const stored = typeof value === 'string' ? value : '';
  const utilities = useMemo(() => splitUtilities(stored), [stored]);

  const [draft, setDraft] = useState('');
  const [rejection, setRejection] = useState<UtilityRejection | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Already-applied classes are not offered again — a duplicate is a no-op. */
  const available = useMemo(() => {
    const applied = new Set(utilities);
    const typed = draft.trim().toLowerCase();
    const pool = mode === 'free' ? [...ALL_SUGGESTIONS, ...FREE_SUGGESTIONS] : ALL_SUGGESTIONS;
    return pool.filter(
      (utility) => !applied.has(utility) && (typed === '' || utility.toLowerCase().includes(typed)),
    ).slice(0, 8);
  }, [utilities, draft, mode]);

  const commit = (next: readonly string[]) => {
    const joined = next.join(' ');
    /*
      An empty list clears the property rather than storing `''`. A block reads
      `className` as optional, and an empty string is a value that says nothing
      while still counting as set.
    */
    onChange(joined === '' ? undefined : joined);
  };

  const add = (utility: string) => {
    const candidate = utility.trim();
    if (candidate === '') {
      return;
    }

    /* One class at a time, but a paste of several is still worth honouring. */
    const parts = splitUtilities(candidate);
    const rejected = rejectionFor(parts, mode);
    if (rejected !== undefined) {
      setRejection(rejected);
      return;
    }

    setRejection(undefined);
    setDraft('');
    const applied = new Set(utilities);
    commit([...utilities, ...parts.filter((part) => !applied.has(part))]);
  };

  const remove = (utility: string) => {
    setRejection(undefined);
    commit(utilities.filter((applied) => applied !== utility));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
      if (draft.trim() === '') {
        return;
      }
      /* Tab still moves on when there is nothing pending — only a draft claims it. */
      event.preventDefault();
      add(draft);
      return;
    }

    /*
      Backspace on an empty field removes the last chip, which is what every
      tag input does and what a person's hands expect.
    */
    if (event.key === 'Backspace' && draft === '' && utilities.length > 0) {
      event.preventDefault();
      const last = utilities[utilities.length - 1];
      if (last !== undefined) {
        remove(last);
      }
    }
  };

  const listId = controlId === undefined ? undefined : `${controlId}-suggestions`;
  const rejectionId = controlId === undefined ? undefined : `${controlId}-rejection`;
  const description =
    rejection === undefined
      ? describedBy
      : [describedBy, rejectionId].filter((id) => id !== undefined).join(' ');

  return (
    <div className="bldr-utility-field">
      {utilities.length === 0 ? null : (
        <ul className="bldr-utility-field__chips">
          {utilities.map((utility) => (
            <li key={utility} className="bldr-utility-field__chip">
              <code className="bldr-utility-field__chip-name">{utility}</code>
              <button
                type="button"
                className="bldr-utility-field__remove"
                onClick={() => {
                  remove(utility);
                }}
                disabled={disabled}
                /* The class is IN the name: "Remove" alone repeats nine times. */
                aria-label={`Remove ${utility}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id={controlId}
        className="bldr-utility-field__input"
        type="text"
        value={draft}
        list={listId}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? 'Add a class…'}
        disabled={disabled}
        aria-describedby={description === '' ? undefined : description}
        aria-invalid={rejection === undefined ? undefined : true}
        onChange={(event) => {
          setDraft(event.target.value);
          if (rejection !== undefined) {
            setRejection(undefined);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim() !== '') {
            add(draft);
          }
        }}
      />

      {listId === undefined ? null : (
        <datalist id={listId}>
          {available.map((utility) => (
            <option key={utility} value={utility} />
          ))}
        </datalist>
      )}

      {rejection === undefined ? null : (
        <p id={rejectionId} className="bldr-utility-field__rejection" role="alert">
          {rejection.message}
        </p>
      )}
    </div>
  );
}
