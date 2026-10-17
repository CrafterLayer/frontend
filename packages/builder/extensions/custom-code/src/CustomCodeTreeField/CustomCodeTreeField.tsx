import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  customCodeComponentTypes,
  customCodeTreeSchema,
  type FieldProps,
} from '@craftkit/builder-schema';

import './CustomCodeTreeField.css';

/**
 * The Inspector control for a composition tree.
 *
 * ## Why it is a JSON editor and not a visual one
 *
 * A visual editor for this tree is a second canvas — selection, drag, drop,
 * insertion points, keyboard traversal — and the product already has one of
 * those for the DOCUMENT. Building a second, poorer one inside a properties
 * panel would be a large amount of work whose ceiling is "worse than the
 * canvas you already have".
 *
 * The honest v1 is therefore a text surface over the stored JSON, with the
 * three things that make such a surface usable rather than hostile:
 *
 *   1. it never writes an invalid tree — parse first, commit second;
 *   2. it says WHY when it refuses, at the path that failed;
 *   3. it summarises what the tree contains, so the panel is informative even
 *      to someone who will not read the JSON.
 *
 * The better answer for the common case has since arrived one layer up and
 * without unbuilding this: clicking an authored element on the canvas focuses
 * it (`kernel.focusElement`), and the shell's Inspector replaces the block's
 * rows — this JSON included — with that element's own (`src`/`alt`, text,
 * `href`, classes). This control remains the whole-tree door: structure,
 * reordering, component references, and anything the element rows do not
 * cover. Promoting an element into a real document node stays a later
 * milestone.
 *
 * block-parts fix pass (2026-10-06): the owner said NEVER raw JSON anywhere.
 * The panel now shows the summary and where to edit (the canvas, Layers);
 * the JSON source mounts only behind an explicit "Edit source (advanced)"
 * disclosure, so no Inspector row shows JSON unless the person asks for it.
 */
const WORDS = {
  en: {
    hint: 'Click any element on the canvas to edit it, or pick it in Layers.',
    source: 'Edit source (advanced)',
  },
  ar: {
    hint: 'انقر أي عنصر على اللوحة لتعديله، أو اختره من الطبقات.',
    source: 'تحرير المصدر (متقدّم)',
  },
} as const;
export default function CustomCodeTreeField({ value, onChange, disabled }: FieldProps) {
  const errorId = useId();
  const summaryId = useId();
  const sourceId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // The editor's language, read from the panel it sits in: an RTL panel speaks Arabic.
  const [arabic, setArabic] = useState(false);
  useLayoutEffect(() => {
    const scope = rootRef.current?.closest('[dir]');
    setArabic(scope?.getAttribute('dir') === 'rtl');
  }, []);
  const words = arabic ? WORDS.ar : WORDS.en;
  const serialized = useMemo(() => JSON.stringify(value ?? null, null, 2), [value]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const text = draft ?? serialized;
  const summary = useMemo(() => describeTree(value), [value]);

  const commit = (next: string): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (cause) {
      setError(cause instanceof Error ? `Not valid JSON: ${cause.message}` : 'Not valid JSON.');
      return;
    }
    const result = customCodeTreeSchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      const at =
        first === undefined || first.path.length === 0 ? '' : ` at ${first.path.join('.')}`;
      setError(`${first?.message ?? 'The tree is not valid.'}${at}`);
      return;
    }
    setError(undefined);
    setDraft(null);
    onChange(result.data);
  };

  return (
    <div className="bldr-cc-tree" ref={rootRef}>
      <p className="bldr-cc-tree__summary" id={summaryId}>
        <bdi>{summary}</bdi>
      </p>
      <p className="bldr-cc-tree__hint">{words.hint}</p>
      <button
        type="button"
        className="bldr-cc-tree__toggle"
        aria-expanded={open}
        aria-controls={open ? sourceId : undefined}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        {words.source}
      </button>
      {open ? (
      <textarea
        id={sourceId}
        dir="ltr"
        className="bldr-cc-tree__source"
        spellCheck={false}
        rows={14}
        value={text}
        disabled={disabled ?? false}
        aria-label="Composition tree"
        aria-describedby={error === undefined ? summaryId : `${summaryId} ${errorId}`}
        aria-invalid={error !== undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(undefined);
        }}
        /*
          Commit on blur rather than per keystroke: every accepted edit is a
          dispatched command and therefore an undo entry, and one undo step per
          character typed makes undo useless for exactly the edit it matters on.
        */
        onBlur={(event) => {
          if (event.target.value !== serialized) commit(event.target.value);
        }}
      />
      ) : null}
      {error === undefined ? null : (
        <p className="bldr-cc-tree__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A one-line account of the tree, for a reader who will not read the JSON. */
function describeTree(value: unknown): string {
  const counts = countNodes(value);
  if (counts.total === 0) return 'Empty region.';
  const referenced = customCodeComponentTypes(value);
  const elements = `${String(counts.elements)} element${counts.elements === 1 ? '' : 's'}`;
  if (referenced.length === 0) return `${elements}.`;
  return `${elements}, and ${String(counts.components)} block reference${
    counts.components === 1 ? '' : 's'
  }: ${referenced.join(', ')}.`;
}

function countNodes(value: unknown): { total: number; elements: number; components: number } {
  let elements = 0;
  let components = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) continue;
    const record = node as { kind?: unknown; children?: unknown };
    if (record.kind === 'element') elements += 1;
    if (record.kind === 'component') components += 1;
    if (Array.isArray(record.children)) {
      for (const child of record.children) stack.push(child);
    }
  }
  return { total: elements + components, elements, components };
}
