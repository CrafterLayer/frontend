import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import type { InsertionAnchor } from '@craftkit/builder-schema';

import { ChromeButton } from '../ChromeButton';
import './InsertionPicker.css';

export type InsertionPickerMode = 'empty' | 'components' | 'sections' | 'generate';

export interface InsertionPickerOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly kind: 'component' | 'section';
}

export type InsertionChoice =
  { readonly kind: 'empty' } | { readonly kind: 'catalog'; readonly id: string };

export interface InsertionPickerProps {
  readonly anchor: InsertionAnchor;
  readonly anchorLabel: string;
  readonly options?: readonly InsertionPickerOption[] | undefined;
  readonly initialMode?: InsertionPickerMode | undefined;
  readonly state?: 'ready' | 'stale' | 'generating' | undefined;
  readonly onInsert: (choice: InsertionChoice, anchor: InsertionAnchor) => void;
  readonly onGenerate: (request: string, anchor: InsertionAnchor) => void;
  readonly onRequestAnchor?: (() => void) | undefined;
  readonly onClose?: (() => void) | undefined;
}

const MODES: readonly { readonly id: InsertionPickerMode; readonly label: string }[] = [
  { id: 'empty', label: 'Blank' },
  { id: 'components', label: 'Components' },
  { id: 'sections', label: 'Sections' },
  { id: 'generate', label: 'Generate' },
];

function placementLabel(anchor: InsertionAnchor, anchorLabel: string): string {
  const verb = anchor.mode === 'inside' ? 'inside' : anchor.mode;
  return `Insert ${verb} ${anchorLabel}`;
}

/** A focused, anchor-bound choice surface for adding content. */
export function InsertionPicker({
  anchor,
  anchorLabel,
  options = [],
  initialMode = 'components',
  state = 'ready',
  onInsert,
  onGenerate,
  onRequestAnchor,
  onClose,
}: InsertionPickerProps) {
  const [mode, setMode] = useState<InsertionPickerMode>(initialMode);
  const [query, setQuery] = useState('');
  const [request, setRequest] = useState('');
  const titleId = useId();
  const placementId = useId();
  const firstControl = useRef<HTMLElement | null>(null);
  const tabControls = useRef<(HTMLButtonElement | null)[]>([]);
  const unavailable = state !== 'ready';

  useEffect(() => {
    firstControl.current?.focus({ preventScroll: true });
  }, []);

  const filtered = options.filter(
    (option) =>
      option.kind === (mode === 'sections' ? 'section' : 'component') &&
      `${option.label} ${option.description ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  return (
    <section
      className="bldr-insertion-picker"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={placementId}
      data-state={state}
    >
      <header className="bldr-insertion-picker__header">
        <span>
          <strong id={titleId}>Add content</strong>
          <span className="bldr-insertion-picker__placement" id={placementId}>
            {placementLabel(anchor, anchorLabel)}
          </span>
        </span>
        {onClose === undefined ? null : (
          <ChromeButton variant="icon" size="lg" aria-label="Close insert menu" onClick={onClose}>
            ×
          </ChromeButton>
        )}
      </header>

      {state === 'stale' ? (
        <div className="bldr-insertion-picker__notice" role="alert">
          <p>This position changed. Choose a new position before adding content.</p>
          <ChromeButton
            ref={(element) => {
              firstControl.current = element;
            }}
            variant="primary"
            onClick={onRequestAnchor}
          >
            Choose a new position
          </ChromeButton>
        </div>
      ) : (
        <>
          <div
            className="bldr-insertion-picker__tabs"
            role="tablist"
            aria-label="Insert mode"
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              const current = MODES.findIndex((item) => item.id === mode);
              let next: number | undefined;
              if (event.key === 'ArrowRight') next = (current + 1) % MODES.length;
              if (event.key === 'ArrowLeft') next = (current - 1 + MODES.length) % MODES.length;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = MODES.length - 1;
              if (next === undefined) return;
              event.preventDefault();
              const nextMode = MODES[next];
              if (nextMode === undefined) return;
              setMode(nextMode.id);
              tabControls.current[next]?.focus();
            }}
          >
            {MODES.map((item, index) => (
              <ChromeButton
                key={item.id}
                ref={(element) => {
                  tabControls.current[index] = element;
                  if (item.id === initialMode) firstControl.current = element;
                }}
                className="bldr-insertion-picker__tab"
                variant="toggle"
                size="lg"
                role="tab"
                aria-selected={mode === item.id}
                aria-pressed={mode === item.id}
                aria-controls={`${titleId}-panel`}
                tabIndex={mode === item.id ? 0 : -1}
                disabled={unavailable}
                onClick={() => {
                  setMode(item.id);
                }}
              >
                {item.label}
              </ChromeButton>
            ))}
          </div>

          <div className="bldr-insertion-picker__body" id={`${titleId}-panel`} role="tabpanel">
            {state === 'generating' ? (
              <p className="bldr-insertion-picker__notice" role="status" aria-live="polite">
                Generating this section at the saved position…
              </p>
            ) : mode === 'empty' ? (
              <div className="bldr-insertion-picker__empty">
                <p>Add an empty container and design it from the canvas or Inspector.</p>
                <ChromeButton
                  variant="primary"
                  onClick={() => {
                    onInsert({ kind: 'empty' }, anchor);
                  }}
                >
                  Add blank container
                </ChromeButton>
              </div>
            ) : mode === 'generate' ? (
              <form
                className="bldr-insertion-picker__generate"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = request.trim();
                  if (value !== '') onGenerate(value, anchor);
                }}
              >
                <label htmlFor={`${titleId}-request`}>Describe the section</label>
                <textarea
                  id={`${titleId}-request`}
                  rows={3}
                  value={request}
                  onChange={(event) => {
                    setRequest(event.target.value);
                  }}
                  placeholder="A bold pricing section with three plans"
                />
                <ChromeButton
                  variant="primary"
                  disabled={request.trim() === ''}
                  onClick={() => {
                    const value = request.trim();
                    if (value !== '') onGenerate(value, anchor);
                  }}
                >
                  Generate section
                </ChromeButton>
              </form>
            ) : (
              <div className="bldr-insertion-picker__catalog">
                <label htmlFor={`${titleId}-filter`}>Filter {mode}</label>
                <input
                  id={`${titleId}-filter`}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                />
                {filtered.length === 0 ? (
                  <p role="status">No {mode} match this filter.</p>
                ) : (
                  <ul className="bldr-insertion-picker__options">
                    {filtered.map((option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          className="bldr-insertion-picker__option"
                          onClick={() => {
                            onInsert({ kind: 'catalog', id: option.id }, anchor);
                          }}
                        >
                          <strong>{option.label}</strong>
                          {option.description === undefined ? null : (
                            <span>{option.description}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
