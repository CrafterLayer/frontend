import { useId, useRef, useState } from 'react';

import type { CustomCodeElement, TreeNodePatch } from '@craftkit/builder-schema';

import {
  attributeInMessage,
  formatElementCode,
  parseElementCode,
  patchFromCode,
  type ElementCodeError,
} from '../element-code';
import type { StyleApplyResult } from '../style-source';
import {
  ELEMENT_CODE_EDITOR_LABELS_EN,
  type ElementCodeEditorLabels,
} from './ElementCodeEditor.labels';

import './ElementCodeEditor.css';

export interface ElementCodeEditorProps {
  readonly element: CustomCodeElement;
  /** Writes the patch as one transaction (patchTreeNode); a refusal is shown at its attribute. */
  readonly onCommit: (patch: TreeNodePatch) => StyleApplyResult;
  readonly announce?: ((text: string) => void) | undefined;
  /** Links to the region's css field and the page's pageCss (the escape hatch for what classes cannot say). */
  readonly onOpenRegionCss?: (() => void) | undefined;
  readonly onOpenPageCss?: (() => void) | undefined;
  readonly labels?: ElementCodeEditorLabels | undefined;
}

/**
 * The element as code (style-manager DESIGN.md §G "Code view"): one line of
 * markup — tag, classes, attributes, text; children collapsed to `…` — in a
 * monospace editor. Apply parses it, diffs it against the element and writes
 * ONE `patchTreeNode`. A parse error or a door refusal is shown at the
 * attribute it is about, and the draft is kept so it can be fixed.
 */
export function ElementCodeEditor({
  element,
  onCommit,
  announce,
  onOpenRegionCss,
  onOpenPageCss,
  labels = ELEMENT_CODE_EDITOR_LABELS_EN,
}: ElementCodeEditorProps) {
  const document = formatElementCode(element);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<ElementCodeError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const hintId = useId();

  const apply = () => {
    const source = draft ?? document;
    const parsed = parseElementCode(source);
    if (!parsed.ok) {
      setError(parsed.error);
      textareaRef.current?.setSelectionRange(parsed.error.offset, parsed.error.offset);
      return;
    }
    const patch = patchFromCode(element, parsed.value);
    if (patch.set === undefined && patch.attributes === undefined) {
      setDraft(null);
      setError(null);
      return;
    }
    const result = onCommit(patch);
    if (result.ok) {
      setDraft(null);
      setError(null);
      announce?.(labels.applied);
      return;
    }
    const names = ['class', ...Object.keys(parsed.value.attributes), ...Object.keys(element.attributes ?? {})];
    const attribute = attributeInMessage(result.message, names);
    const offset = attribute === undefined ? 0 : Math.max(0, source.indexOf(attribute));
    setError({ message: result.message, attribute, offset });
    announce?.(result.message);
  };

  return (
    <div className="bldr-element-code">
      <textarea
        ref={textareaRef}
        className="bldr-element-code__editor"
        aria-label={labels.editor}
        aria-describedby={error === null ? hintId : `${errorId} ${hintId}`}
        aria-invalid={error === null ? undefined : true}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        dir="ltr"
        rows={4}
        value={draft ?? document}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      {error === null ? null : (
        <p id={errorId} className="bldr-element-code__error" role="alert">
          {error.attribute === undefined ? null : (
            <code className="bldr-element-code__attribute">{labels.atAttribute(error.attribute)}</code>
          )}{' '}
          {error.message}
        </p>
      )}
      <p id={hintId} className="bldr-element-code__hint">
        {labels.hint}
      </p>
      <div className="bldr-element-code__actions">
        <button type="button" className="bldr-element-code__button" data-primary="" onClick={apply}>
          {labels.apply}
        </button>
        <button
          type="button"
          className="bldr-element-code__button"
          disabled={draft === null}
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
        >
          {labels.revert}
        </button>
        {onOpenRegionCss === undefined ? null : (
          <button type="button" className="bldr-element-code__link" onClick={onOpenRegionCss}>
            {labels.regionCss}
          </button>
        )}
        {onOpenPageCss === undefined ? null : (
          <button type="button" className="bldr-element-code__link" onClick={onOpenPageCss}>
            {labels.pageCss}
          </button>
        )}
      </div>
    </div>
  );
}
