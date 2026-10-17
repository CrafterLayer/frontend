import { useEffect, useId, useMemo, useState } from 'react';

import type { SiteFont } from '@craftkit/builder-schema';

import { FONT_PICKER_LABELS_EN, type FontPickerLabels } from './FontPicker.labels';
import {
  CURATED_FONTS,
  filterFonts,
  previewStylesheetUrl,
  type CatalogueFont,
  type FontCategory,
} from './font-catalogue';
import { familyFromFileName, readFontUpload } from './font-upload';
import { ensurePreviewStylesheet } from './preview-stylesheet';
import './FontPicker.css';

export interface FontPickerProps {
  /** The family the role currently uses, marked "in use". */
  readonly value?: string | undefined;
  /** A family was chosen. The host turns it into ONE transaction. */
  readonly onPick: (font: CatalogueFont) => void;
  /** Absent ⇒ no upload form. Called once with a checked, encoded font. */
  readonly onUpload?: ((font: SiteFont) => void) | undefined;
  /** Fonts already uploaded to the site, listed first and pickable. */
  readonly uploadedFonts?: readonly SiteFont[] | undefined;
  /** Load each shown family from Google for the preview (off in tests). */
  readonly loadPreviews?: boolean | undefined;
  /** Start with the Arabic filter on (an Arabic site). */
  readonly arabicFirst?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: FontPickerLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

const CATEGORIES = ['all', 'sans', 'serif', 'display', 'mono'] as const;
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

type UploadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'done' | 'refused'; readonly text: string };

/**
 * A searchable list of web fonts with an Arabic filter, each previewed in its
 * own face in BOTH scripts, plus a WOFF2 upload (style-manager DESIGN.md §G).
 *
 * The picker never writes: `onPick` and `onUpload` hand a family to the host,
 * which commits it with the role's token as one transaction. The Arabic
 * sample shows only for faces that carry Arabic, so a Latin-only face is
 * never shown drawing Arabic in a fallback and looking like it works.
 */
export function FontPicker({
  value,
  onPick,
  onUpload,
  uploadedFonts = [],
  loadPreviews = true,
  arabicFirst = false,
  disabled = false,
  labels = FONT_PICKER_LABELS_EN,
  dir,
}: FontPickerProps) {
  const [query, setQuery] = useState('');
  const [arabicOnly, setArabicOnly] = useState(arabicFirst);
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const [file, setFile] = useState<File | undefined>(undefined);
  const [family, setFamily] = useState('');
  const [weight, setWeight] = useState('400');
  const [upload, setUpload] = useState<UploadStatus>({ kind: 'idle' });
  const searchId = useId();
  const categoryId = useId();
  const fileId = useId();
  const familyId = useId();
  const weightId = useId();

  const uploaded = useMemo<readonly CatalogueFont[]>(
    () =>
      uploadedFonts
        .filter((font) => font.source === 'upload')
        .map((font) => ({
          family: font.family,
          weights: font.weights,
          arabic: font.scripts?.includes('arabic') ?? false,
          category: 'sans',
        })),
    [uploadedFonts],
  );
  const uploadedNames = useMemo(() => new Set(uploaded.map((font) => font.family)), [uploaded]);
  const shown = useMemo(
    () => filterFonts([...uploaded, ...CURATED_FONTS], { query, arabicOnly, category }),
    [uploaded, query, arabicOnly, category],
  );

  useEffect(() => {
    if (!loadPreviews) return;
    for (const font of shown) {
      if (!uploadedNames.has(font.family)) ensurePreviewStylesheet(previewStylesheetUrl(font));
    }
  }, [loadPreviews, shown, uploadedNames]);

  const send = async (): Promise<void> => {
    if (file === undefined || onUpload === undefined) return;
    const weights =
      weight === 'variable' ? [100, 900] : [Number.parseInt(weight, 10) || 400];
    const result = await readFontUpload(file, { family: family.trim(), weights });
    if (!result.ok) {
      setUpload({ kind: 'refused', text: labels.uploadRefusals[result.reason] });
      return;
    }
    onUpload(result.font);
    setUpload({ kind: 'done', text: labels.uploadDone(result.font.family) });
  };

  return (
    <section className="bldr-font-picker" aria-label={labels.title} dir={dir}>
      <div className="bldr-font-picker__filters">
        <label className="bldr-font-picker__field" htmlFor={searchId}>
          <span className="bldr-font-picker__label">{labels.search}</span>
          <input
            id={searchId}
            className="bldr-font-picker__input"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <label className="bldr-font-picker__field" htmlFor={categoryId}>
          <span className="bldr-font-picker__label">{labels.category}</span>
          <select
            id={categoryId}
            className="bldr-font-picker__input"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as FontCategory | 'all');
            }}
          >
            {CATEGORIES.map((id) => (
              <option key={id} value={id}>
                {labels.categories[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="bldr-font-picker__check">
          <input
            type="checkbox"
            checked={arabicOnly}
            onChange={(event) => {
              setArabicOnly(event.target.checked);
            }}
          />
          {labels.arabicOnly}
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="bldr-font-picker__empty" role="status">
          {labels.none}
        </p>
      ) : (
        <ul className="bldr-font-picker__list" aria-label={labels.list}>
          {shown.map((font) => {
            const current = font.family === value;
            return (
              <li key={font.family}>
                <button
                  type="button"
                  className="bldr-font-picker__option"
                  aria-pressed={current}
                  disabled={disabled}
                  onClick={() => {
                    onPick(font);
                  }}
                >
                  <span className="bldr-font-picker__name">
                    {font.family}
                    {uploadedNames.has(font.family) ? (
                      <span className="bldr-font-picker__badge">{labels.uploaded}</span>
                    ) : null}
                    {current ? <span className="bldr-font-picker__badge">{labels.current}</span> : null}
                  </span>
                  <span
                    className="bldr-font-picker__sample"
                    dir="ltr"
                    lang="en"
                    style={{ fontFamily: `"${font.family}", system-ui` }}
                  >
                    {labels.sampleLatin}
                  </span>
                  {font.arabic ? (
                    <span
                      className="bldr-font-picker__sample"
                      dir="rtl"
                      lang="ar"
                      style={{ fontFamily: `"${font.family}", system-ui` }}
                    >
                      {labels.sampleArabic}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {onUpload === undefined ? null : (
        <fieldset className="bldr-font-picker__upload" disabled={disabled}>
          <legend className="bldr-font-picker__legend">{labels.upload}</legend>
          <label className="bldr-font-picker__field" htmlFor={fileId}>
            <span className="bldr-font-picker__label">{labels.uploadFile}</span>
            <input
              id={fileId}
              type="file"
              accept=".woff2,font/woff2"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                setFile(chosen);
                setUpload({ kind: 'idle' });
                if (chosen !== undefined) setFamily(familyFromFileName(chosen.name));
              }}
            />
          </label>
          <div className="bldr-font-picker__row">
            <label className="bldr-font-picker__field" htmlFor={familyId}>
              <span className="bldr-font-picker__label">{labels.uploadFamily}</span>
              <input
                id={familyId}
                className="bldr-font-picker__input"
                value={family}
                dir="ltr"
                onChange={(event) => {
                  setFamily(event.target.value);
                }}
              />
            </label>
            <label className="bldr-font-picker__field" htmlFor={weightId}>
              <span className="bldr-font-picker__label">{labels.uploadWeight}</span>
              <select
                id={weightId}
                className="bldr-font-picker__input"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                }}
              >
                {WEIGHTS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
                <option value="variable">{labels.uploadVariable}</option>
              </select>
            </label>
          </div>
          <p className="bldr-font-picker__notice">{labels.uploadNotice}</p>
          <button
            type="button"
            className="bldr-font-picker__send"
            disabled={file === undefined}
            onClick={() => {
              void send();
            }}
          >
            {labels.upload}
          </button>
          <p
            className="bldr-font-picker__status"
            role="status"
            data-kind={upload.kind === 'idle' ? undefined : upload.kind}
          >
            {upload.kind === 'idle' ? '' : upload.text}
          </p>
        </fieldset>
      )}
    </section>
  );
}
