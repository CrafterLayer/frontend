import type { Editor } from '@tiptap/react';

import type { FieldProps } from '@craftkit/builder-schema';

import { ResponsiveNotice } from './ResponsiveNotice';
import { RichTextEditor } from './RichTextEditor';
import './RichTextField.css';

export interface RichTextFieldProps extends FieldProps {
  /** Shell extras (008 §3 e2) — optional so any host may omit them. */
  controlId?: string | undefined;
  describedBy?: string | undefined;
  /** id of the row's property label; names the contenteditable surface. */
  labelledBy?: string | undefined;
  /**
   * Dev/test instrumentation — receives the engine instance ONCE per editor
   * (the `onBlockRender` / `geometryPorts` precedent). Hosts never pass it.
   */
  onEditorReady?: ((editor: Editor) => void) | undefined;
  /**
   * B3c inline chrome (009 contract §4 t2): the canvas surface reuses this
   * editor while the floating bubble replaces the block toolbar. Additive and
   * optional — inspector hosts never pass it; omitting it changes nothing.
   */
  hideToolbar?: boolean | undefined;
  /**
   * The PROSE CONTEXT the editing surface writes inside — the same class the
   * rendered output carries, so the two cannot style prose differently.
   *
   * Measured defect this closed: inline editing replaces the rendered
   * `.bldr-richtext` wrapper with the editor, and the prose typography left
   * with it. Paragraphs fell back to the user agent's 1em margins where the
   * page renders 0.5em, so a block GREW as soon as you edited it — 40px to
   * 83px on an empty rich-text block — and shrank again when you stopped.
   *
   * Canvas hosts pass their renderer's prose class. Inspector hosts must NOT:
   * that class paints with the PAGE theme (`--t-text`), which is undefined in
   * the editor's own chrome and would put page-coloured text on a panel.
   */
  surfaceClassName?: string | undefined;
}

/**
 * The contributed rich-text field (008 contract §3). Deliberately hook-free:
 * it routes on the commit PATH before any editor exists, so an override bucket
 * shows its notice without instantiating the engine at all (e5).
 */
export function RichTextField(props: RichTextFieldProps) {
  if (props.path[0] === 'responsive') {
    const bucket = props.path[1];
    return <ResponsiveNotice bucket={typeof bucket === 'string' ? bucket : 'this breakpoint'} />;
  }
  return <RichTextEditor {...props} />;
}
