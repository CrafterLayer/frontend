import { useId, useState } from 'react';

import type { FieldProps } from '@craftkit/builder-schema';

import './CustomCodeJsField.css';

/**
 * The Inspector control for a region's own script (`customJs()`).
 *
 * A monospace box, and nothing cleverer, on purpose. The code is the BODY of an async function with
 * one parameter, `ck`; it runs whenever the block is on the page, on the canvas and on the
 * published site, so what this control owes the author is a plain place to read and edit it and a
 * line saying what it receives. It does not lint or refuse: the free-code mode is the owner's
 * decision, and what gates it is who may author `js` (the composer toggle), not this box.
 *
 * Like the stylesheet field it commits on blur, so a typing session is one undo entry, not one per
 * keystroke.
 */
export default function CustomCodeJsField({ value, onChange, disabled }: FieldProps) {
  const hintId = useId();
  const stored = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="bldr-cc-js">
      <textarea
        className="bldr-cc-js__source"
        spellCheck={false}
        rows={10}
        value={draft ?? stored}
        disabled={disabled ?? false}
        aria-label="Custom JS"
        aria-describedby={hintId}
        placeholder={'const { app } = await ck.stage();\nck.onDispose(() => {});'}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        // One undo entry per edit session, not per keystroke.
        onBlur={(event) => {
          setDraft(null);
          if (event.target.value !== stored) onChange(event.target.value);
        }}
      />
      <p className="bldr-cc-js__hint" id={hintId}>
        Runs on the canvas and on the published page. Receives <code>ck</code>: <code>ck.root</code>
        , <code>ck.editor</code>, <code>ck.reducedMotion</code>, <code>ck.onDispose(fn)</code>,{' '}
        <code>await ck.pixi()</code>, <code>await ck.stage()</code>.
      </p>
    </div>
  );
}
