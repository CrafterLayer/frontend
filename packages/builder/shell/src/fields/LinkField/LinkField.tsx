import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { z } from 'zod';

import { safeHref } from '@craftkit/builder-renderer';

import type { FieldCommit } from '../field-commit';
import { useFieldLabels, useFieldServices, type FieldPage } from '../field-services-context';
import { ObjectField, type ObjectFieldRowProps } from '../ObjectField';
import { initialValueForSchema } from '../repeater-schema';
import { propsShapeOf, unwrapSchema } from '../resolve-field';
import './LinkField.css';

export interface LinkFieldProps {
  readonly schema: z.ZodType;
  readonly value: unknown;
  readonly path: (string | number)[];
  readonly disabled?: boolean | undefined;
  readonly controlId?: string | undefined;
  readonly labelledBy?: string | undefined;
  readonly describedBy?: string | undefined;
  /** The ONE door of the owning property. Object mode writes the whole object. */
  readonly commit: FieldCommit;
  /**
   * The object key holding the visible label. Absent in HREF-ONLY mode (a
   * string property declared `kind: 'link'`), where the value IS the address.
   */
  readonly textKey?: string | undefined;
  /** The object key holding the address (object mode). Defaults to `href`. */
  readonly hrefKey?: string | undefined;
  /** Pages to offer; falls back to `FieldServices.pages`. */
  readonly pages?: readonly FieldPage[] | undefined;
  /** Renders the object's OTHER keys (`newTab`…) as ordinary sub-rows. */
  readonly renderRow?: ((props: ObjectFieldRowProps) => ReactNode) | undefined;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function isStringSchema(schema: z.ZodType): boolean {
  return unwrapSchema(schema)._zod.def.type === 'string';
}

type Draft = { readonly source: unknown; readonly text: string } | null;

/**
 * A link as a person thinks of it: the words on the page, and where they go.
 *
 * Used for a link PART's `{ text, href }` binding (block-parts DESIGN §2.10:
 * the object row `link: { label, href }` becomes this field), for a property
 * a block declares `kind: 'link'`, and inside repeater items the same way.
 *
 * - The address is validated with the renderer's `safeHref` — the one
 *   allowlist the published page uses — BEFORE it reaches the door, and a
 *   refused address says why instead of silently not saving.
 * - When the host knows the site's pages, a page picker sets the address.
 * - Each input drafts locally and commits ONCE on blur or Enter, so a whole
 *   edited label is one Undo, not one per keystroke.
 */
export function LinkField({
  schema,
  value,
  path,
  disabled = false,
  controlId,
  labelledBy,
  describedBy,
  commit,
  textKey,
  hrefKey = 'href',
  pages,
  renderRow,
}: LinkFieldProps) {
  const uid = useId();
  const labels = useFieldLabels();
  const services = useFieldServices();
  const offered = pages ?? services.pages ?? [];
  const hrefOnly = isStringSchema(schema);
  const record = asRecord(value);
  const storedText = !hrefOnly && textKey !== undefined ? record?.[textKey] : undefined;
  const storedHref = hrefOnly ? value : record?.[hrefKey];
  const text = typeof storedText === 'string' ? storedText : '';
  const href = typeof storedHref === 'string' ? storedHref : '';

  const [textDraft, setTextDraft] = useState<Draft>(null);
  const [hrefDraft, setHrefDraft] = useState<Draft>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // A draft typed over an older value no longer applies once the value moved.
  const liveText = textDraft !== null && Object.is(textDraft.source, value) ? textDraft.text : text;
  const liveHref = hrefDraft !== null && Object.is(hrefDraft.source, value) ? hrefDraft.text : href;

  const textId = controlId ?? `${uid}-text`;
  const hrefId = textKey === undefined || hrefOnly ? (controlId ?? `${uid}-href`) : `${uid}-href`;
  const pageId = `${uid}-page`;
  const errorId = `${uid}-error`;
  const described = [describedBy, refusal === null ? undefined : errorId]
    .filter((id): id is string => id !== undefined)
    .join(' ');

  const base = (): Readonly<Record<string, unknown>> => {
    if (record !== undefined) return record;
    const seed = initialValueForSchema(unwrapSchema(schema));
    return (seed.ok ? asRecord(seed.value) : undefined) ?? {};
  };

  const writeText = (next: string) => {
    if (textKey === undefined || next === text) return;
    const result = commit({ ...base(), [textKey]: next });
    if (result.ok) setTextDraft(null);
  };

  const writeHref = (next: string) => {
    if (next === href) {
      setRefusal(null);
      return;
    }
    if (next !== '' && safeHref(next) === undefined) {
      setRefusal(labels.linkRefused);
      return;
    }
    const result = hrefOnly ? commit(next) : commit({ ...base(), [hrefKey]: next });
    if (result.ok) {
      setRefusal(null);
      setHrefDraft(null);
    } else {
      setRefusal(result.message);
    }
  };

  const onEnter = (event: KeyboardEvent<HTMLInputElement>, run: () => void) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      run();
    }
  };

  const otherKeys =
    hrefOnly || renderRow === undefined
      ? []
      : Object.keys(propsShapeOf(unwrapSchema(schema))).filter(
          (key) => key !== textKey && key !== hrefKey,
        );

  return (
    <div
      className="bldr-link-field"
      role={labelledBy === undefined ? undefined : 'group'}
      aria-labelledby={labelledBy}
      aria-describedby={described === '' ? undefined : described}
    >
      {!hrefOnly && textKey !== undefined ? (
        <div className="bldr-link-field__row">
          <label className="bldr-link-field__label" htmlFor={textId}>
            {labels.linkText}
          </label>
          <input
            id={textId}
            className="bldr-field__input"
            type="text"
            dir="auto"
            value={liveText}
            disabled={disabled}
            onChange={(event) => {
              setTextDraft({ source: value, text: event.target.value });
            }}
            onBlur={() => {
              writeText(liveText);
            }}
            onKeyDown={(event) => {
              onEnter(event, () => {
                writeText(liveText);
              });
            }}
          />
        </div>
      ) : null}
      <div className="bldr-link-field__row">
        <label className="bldr-link-field__label" htmlFor={hrefId}>
          {labels.linkAddress}
        </label>
        <input
          id={hrefId}
          className="bldr-field__input bldr-link-field__href"
          type="text"
          inputMode="url"
          dir="ltr"
          spellCheck={false}
          value={liveHref}
          disabled={disabled}
          aria-invalid={refusal === null ? undefined : true}
          aria-describedby={refusal === null ? undefined : errorId}
          onChange={(event) => {
            setHrefDraft({ source: value, text: event.target.value });
          }}
          onBlur={() => {
            writeHref(liveHref.trim());
          }}
          onKeyDown={(event) => {
            onEnter(event, () => {
              writeHref(liveHref.trim());
            });
          }}
        />
      </div>
      {offered.length > 0 ? (
        <div className="bldr-link-field__row">
          <label className="bldr-link-field__label" htmlFor={pageId}>
            {labels.linkPage}
          </label>
          <select
            id={pageId}
            className="bldr-field__input"
            value={offered.some((page) => page.path === href) ? href : ''}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value !== '') writeHref(event.target.value);
            }}
          >
            <option value="">{labels.linkPageNone}</option>
            {offered.map((page) => (
              <option key={page.path} value={page.path}>
                {page.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {refusal === null ? null : (
        <p id={errorId} className="bldr-inspector__rejection" role="alert">
          {refusal}
        </p>
      )}
      {otherKeys.length > 0 && renderRow !== undefined ? (
        <ObjectField
          schema={schema}
          value={value}
          path={path}
          disabled={disabled}
          commit={commit}
          omitKeys={[...(textKey === undefined ? [] : [textKey]), hrefKey]}
          renderRow={renderRow}
        />
      ) : null}
    </div>
  );
}
