import { useEffect, useId, useRef, useState } from 'react';

import type * as CodeMirrorAutocomplete from '@codemirror/autocomplete';
import type * as CodeMirrorCss from '@codemirror/lang-css';
import type * as CodeMirrorJavascript from '@codemirror/lang-javascript';
import type * as CodeMirrorJson from '@codemirror/lang-json';
import type * as CodeMirrorLint from '@codemirror/lint';
import type * as CodeMirrorMerge from '@codemirror/merge';
import type * as CodeMirrorState from '@codemirror/state';
import type * as CodeMirrorView from '@codemirror/view';
import type * as CodeMirrorBase from 'codemirror';

import type { CompileDiagnostic } from '@craftkit/builder-schema';

import './CodeEditor.css';

export type CodeEditorLanguage = 'js' | 'jsx' | 'ts' | 'tsx' | 'css' | 'json';

export interface CodeEditorCompletion {
  readonly label: string;
  readonly detail?: string;
  readonly type?:
    'class' | 'constant' | 'function' | 'interface' | 'keyword' | 'property' | 'text' | 'type';
  /** Text inserted when it differs from the visible label. */
  readonly apply?: string;
}

export interface CodeEditorDiff {
  /** The accepted source compared with the editable `value`. */
  readonly original: string;
  readonly label?: string;
  readonly onApprove?: (() => void) | undefined;
  readonly onReject?: (() => void) | undefined;
}

export interface CodeEditorController {
  focus(): void;
  getValue(): string;
  getSelection(): { readonly from: number; readonly to: number };
  goToRange(from: number, to?: number): void;
  goToPosition(line: number, column?: number): void;
  goToDiagnostic(diagnostic: CompileDiagnostic): void;
  openCompletion(): boolean;
}

interface CodeMirrorModules {
  readonly base: typeof CodeMirrorBase;
  readonly state: typeof CodeMirrorState;
  readonly view: typeof CodeMirrorView;
  readonly autocomplete: typeof CodeMirrorAutocomplete;
  readonly lint: typeof CodeMirrorLint;
  readonly merge: typeof CodeMirrorMerge;
  readonly javascript: typeof CodeMirrorJavascript;
  readonly css: typeof CodeMirrorCss;
  readonly json: typeof CodeMirrorJson;
}

export type CodeEditorModuleLoader = () => Promise<CodeMirrorModules>;

export interface CodeEditorProps {
  value: string;
  language: CodeEditorLanguage;
  label?: string | undefined;
  path?: string | undefined;
  readOnly?: boolean | undefined;
  busy?: boolean | undefined;
  diagnostics?: readonly CompileDiagnostic[] | undefined;
  completions?: readonly CodeEditorCompletion[] | undefined;
  diff?: CodeEditorDiff | undefined;
  describedBy?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  /** Saving is allowed even when diagnostics are present so invalid drafts remain durable. */
  onSave?: ((value: string) => void) | undefined;
  onReady?: ((controller: CodeEditorController | null) => void) | undefined;
  /** Injectable for deterministic loading/failure stories without replacing the editor runtime. */
  loadModules?: CodeEditorModuleLoader | undefined;
}

const DEFAULT_LABEL = 'Source code';

async function loadCodeMirror(): Promise<CodeMirrorModules> {
  const [base, state, view, autocomplete, lint, merge, javascript, css, json] = await Promise.all([
    import('codemirror'),
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/autocomplete'),
    import('@codemirror/lint'),
    import('@codemirror/merge'),
    import('@codemirror/lang-javascript'),
    import('@codemirror/lang-css'),
    import('@codemirror/lang-json'),
  ]);
  return { base, state, view, autocomplete, lint, merge, javascript, css, json };
}

function languageExtension(modules: CodeMirrorModules, language: CodeEditorLanguage) {
  switch (language) {
    case 'tsx':
      return modules.javascript.javascript({ typescript: true, jsx: true });
    case 'ts':
      return modules.javascript.javascript({ typescript: true });
    case 'jsx':
      return modules.javascript.javascript({ jsx: true });
    case 'css':
      return modules.css.css();
    case 'json':
      return modules.json.json();
    default:
      return modules.javascript.javascript();
  }
}

function positionForDiagnostic(source: string, diagnostic: CompileDiagnostic) {
  if (diagnostic.line === undefined) {
    return { from: 0, to: Math.min(1, source.length) };
  }
  const lines = source.split('\n');
  const lineIndex = Math.min(Math.max(0, diagnostic.line - 1), Math.max(0, lines.length - 1));
  let lineStart = 0;
  for (let index = 0; index < lineIndex; index += 1) {
    lineStart += (lines[index]?.length ?? 0) + 1;
  }
  const lineLength = lines[lineIndex]?.length ?? 0;
  const column = Math.min(Math.max(0, diagnostic.column ?? 0), lineLength);
  const from = lineStart + column;
  return { from, to: Math.min(lineStart + lineLength, Math.max(from + 1, from)) };
}

function diagnosticLabel(diagnostic: CompileDiagnostic): string {
  const location =
    diagnostic.line === undefined
      ? ''
      : `Line ${String(diagnostic.line)}${diagnostic.column === undefined ? '' : `, column ${String(diagnostic.column + 1)}`}: `;
  return `${location}${diagnostic.message}`;
}

/**
 * Lazy CodeMirror 6 source surface. Runtime modules enter only after this
 * component mounts, keeping the normal visual-builder path free of editor code.
 */
export function CodeEditor({
  value,
  language,
  label = DEFAULT_LABEL,
  path,
  readOnly = false,
  busy = false,
  diagnostics = [],
  completions = [],
  diff,
  describedBy,
  onChange,
  onSave,
  onReady,
  loadModules = loadCodeMirror,
}: CodeEditorProps) {
  const id = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CodeMirrorView.EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onReadyRef = useRef(onReady);
  const completionsRef = useRef(completions);
  const externalChangeRef = useRef(false);
  const attributesCompartmentRef = useRef<CodeMirrorState.Compartment | null>(null);
  const [modules, setModules] = useState<CodeMirrorModules | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const diffOriginal = diff?.original;

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
    onReadyRef.current = onReady;
    completionsRef.current = completions;
  }, [completions, onChange, onReady, onSave]);

  useEffect(() => {
    let active = true;
    void loadModules()
      .then((loaded) => {
        if (active) {
          setLoadError(null);
          setModules(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoadError(cause instanceof Error ? cause.message : 'The code editor could not load.');
      });
    return () => {
      active = false;
    };
  }, [loadModules]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null || modules === null) return undefined;
    const completionSource: CodeMirrorAutocomplete.CompletionSource = (context) => {
      const word = context.matchBefore(/[\w$.-]*/);
      if (word === null || (word.from === word.to && !context.explicit)) return null;
      return {
        from: word.from,
        options: completionsRef.current.map((item) => {
          const option: CodeMirrorAutocomplete.Completion = { label: item.label };
          if (item.detail !== undefined) option.detail = item.detail;
          if (item.type !== undefined) option.type = item.type;
          if (item.apply !== undefined) option.apply = item.apply;
          return option;
        }),
      };
    };
    const attributesCompartment = new modules.state.Compartment();
    attributesCompartmentRef.current = attributesCompartment;
    const extensions: CodeMirrorState.Extension[] = [
      modules.base.basicSetup,
      languageExtension(modules, language),
      modules.state.EditorState.readOnly.of(readOnly),
      modules.view.EditorView.editable.of(!readOnly),
      attributesCompartment.of(modules.view.EditorView.contentAttributes.of({})),
      modules.autocomplete.autocompletion({ override: [completionSource] }),
      modules.view.keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: (editor) => {
            onSaveRef.current?.(editor.state.doc.toString());
            return true;
          },
        },
      ]),
      modules.view.EditorView.updateListener.of((update) => {
        if (!update.docChanged || externalChangeRef.current) return;
        const nextValue = update.state.doc.toString();
        valueRef.current = nextValue;
        onChangeRef.current?.(nextValue);
      }),
    ];
    if (diffOriginal !== undefined) {
      extensions.push(
        modules.merge.unifiedMergeView({
          original: diffOriginal,
          mergeControls: false,
          gutter: true,
          allowInlineDiffs: true,
        }),
      );
    }
    const editor = new modules.view.EditorView({
      parent: host,
      state: modules.state.EditorState.create({ doc: valueRef.current, extensions }),
    });
    viewRef.current = editor;
    const controller: CodeEditorController = {
      focus: () => {
        editor.focus();
      },
      getValue: () => editor.state.doc.toString(),
      getSelection: () => ({
        from: editor.state.selection.main.from,
        to: editor.state.selection.main.to,
      }),
      goToRange: (from, to = from) => {
        const safeFrom = Math.min(Math.max(0, from), editor.state.doc.length);
        const safeTo = Math.min(Math.max(safeFrom, to), editor.state.doc.length);
        editor.dispatch({
          selection: { anchor: safeFrom, head: safeTo },
          effects: modules.view.EditorView.scrollIntoView(safeFrom, { y: 'center' }),
        });
        editor.focus();
      },
      goToPosition: (line, column = 0) => {
        const range = positionForDiagnostic(editor.state.doc.toString(), {
          code: 'source/navigation',
          message: '',
          severity: 'warning',
          line,
          column,
        });
        editor.dispatch({
          selection: { anchor: range.from },
          effects: modules.view.EditorView.scrollIntoView(range.from, { y: 'center' }),
        });
        editor.focus();
      },
      goToDiagnostic: (diagnostic) => {
        const range = positionForDiagnostic(editor.state.doc.toString(), diagnostic);
        editor.dispatch({
          selection: { anchor: range.from, head: range.to },
          effects: modules.view.EditorView.scrollIntoView(range.from, { y: 'center' }),
        });
        editor.focus();
      },
      openCompletion: () => modules.autocomplete.startCompletion(editor),
    };
    onReadyRef.current?.(controller);
    return () => {
      onReadyRef.current?.(null);
      viewRef.current = null;
      attributesCompartmentRef.current = null;
      editor.destroy();
    };
  }, [diffOriginal, language, modules, readOnly]);

  useEffect(() => {
    const editor = viewRef.current;
    if (editor === null || editor.state.doc.toString() === value) return;
    externalChangeRef.current = true;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    externalChangeRef.current = false;
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const editor = viewRef.current;
    if (editor === null || modules === null) return;
    const source = editor.state.doc.toString();
    editor.dispatch(
      modules.lint.setDiagnostics(
        editor.state,
        diagnostics.map((diagnostic) => ({
          ...positionForDiagnostic(source, diagnostic),
          message: diagnostic.message,
          severity: diagnostic.severity,
          source: diagnostic.code,
        })),
      ),
    );
  }, [diagnostics, modules]);

  useEffect(() => {
    const editor = viewRef.current;
    const compartment = attributesCompartmentRef.current;
    if (editor === null || compartment === null || modules === null) return;
    const attributes: Record<string, string> = {
      'aria-label': label,
      'aria-invalid': diagnostics.some((item) => item.severity === 'error') ? 'true' : 'false',
      'aria-busy': String(busy),
      autocapitalize: 'off',
      autocomplete: 'off',
      spellcheck: 'false',
    };
    if (describedBy !== undefined) attributes['aria-describedby'] = describedBy;
    editor.dispatch({
      effects: compartment.reconfigure(modules.view.EditorView.contentAttributes.of(attributes)),
    });
  }, [busy, describedBy, diagnostics, label, modules]);

  const errorCount = diagnostics.filter((item) => item.severity === 'error').length;
  const loading = modules === null && loadError === null;

  return (
    <section
      className="bldr-code-editor"
      data-language={language}
      data-loading={loading ? 'true' : 'false'}
      data-read-only={readOnly ? 'true' : 'false'}
      aria-labelledby={`${id}-title`}
    >
      <header className="bldr-code-editor__header">
        <div className="bldr-code-editor__identity">
          <strong id={`${id}-title`}>{label}</strong>
          {path === undefined ? null : <code>{path}</code>}
        </div>
        <div className="bldr-code-editor__meta" aria-label="Editor status">
          <span>{language.toUpperCase()}</span>
          {readOnly ? <span>Read only</span> : null}
          {errorCount > 0 ? <span>{`${String(errorCount)} errors`}</span> : null}
        </div>
      </header>
      {diff === undefined ? null : (
        <div className="bldr-code-editor__diff" aria-label="Source diff actions">
          <span>{diff.label ?? 'Review proposed source changes'}</span>
          <div>
            {diff.onReject === undefined ? null : (
              <button type="button" onClick={diff.onReject}>
                Reject
              </button>
            )}
            {diff.onApprove === undefined ? null : (
              <button type="button" onClick={diff.onApprove}>
                Approve
              </button>
            )}
          </div>
        </div>
      )}
      {loading ? (
        <div className="bldr-code-editor__loading" role="status" aria-live="polite">
          Loading code editor…
        </div>
      ) : null}
      {loadError === null ? null : (
        <div className="bldr-code-editor__error" role="alert">
          {loadError}
        </div>
      )}
      <div ref={hostRef} className="bldr-code-editor__surface" dir="ltr" />
      {diagnostics.length === 0 ? null : (
        <ul className="bldr-code-editor__diagnostics" aria-label="Source diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}:${String(diagnostic.line)}:${String(index)}`}>
              <button
                type="button"
                onClick={() => {
                  const editor = viewRef.current;
                  if (editor !== null) positionDiagnostic(editor, diagnostic);
                }}
              >
                <span data-severity={diagnostic.severity}>{diagnostic.severity}</span>
                <span>{diagnosticLabel(diagnostic)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="bldr-code-editor__announcement" aria-live="polite" aria-atomic="true">
        {busy
          ? 'Checking source.'
          : errorCount > 0
            ? `${String(errorCount)} source errors.`
            : 'Source editor ready.'}
      </div>
    </section>
  );

  function positionDiagnostic(
    editor: CodeMirrorView.EditorView,
    diagnostic: CompileDiagnostic,
  ): void {
    if (modules === null) return;
    const range = positionForDiagnostic(editor.state.doc.toString(), diagnostic);
    editor.dispatch({
      selection: { anchor: range.from, head: range.to },
      effects: modules.view.EditorView.scrollIntoView(range.from, { y: 'center' }),
    });
    editor.focus();
  }
}
