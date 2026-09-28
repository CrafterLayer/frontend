import { useId } from 'react';

import './TypeSpecimen.css';
import {
  FIGURE_GROUPS,
  FONT_FILES,
  TYPE_ROLES,
  formatBytes,
  type TypeMetric,
} from './TypeSpecimen.data';

export type TypeSpecimenLocale = 'en' | 'ar';

export interface TypeSpecimenProps {
  /** The language of the specimen's own labels; the samples always show both scripts. */
  readonly locale?: TypeSpecimenLocale | undefined;
  readonly className?: string | undefined;
}

/*
  The specimen's own words. It is a design document, not panel UI, so it keeps its copy
  here instead of in the agent catalog (WP-04), and it has no plurals or interpolation.
*/
const COPY = {
  en: {
    lede: 'One family in two scripts. Arabic runs one step larger and looser; hierarchy comes from weight and ink, never from a fourth size.',
    roles: 'Roles',
    latin: 'Latin',
    arabic: 'Arabic',
    weight: 'Weight',
    tabular: 'Tabular figures',
    coarse: 'Touch screens only',
    figures: 'Figures',
    figuresNote:
      'Each tinted box is its own width. Plex Sans draws every digit 600 units of 1,000 wide at all three weights, and an Arabic line takes its digits from Plex Sans, so every column is one width.',
    latinLine: 'In a Latin line',
    arabicLine: 'In an Arabic line',
    files: 'The six files',
    filesNote:
      'The host loads them; the browser fetches a weight the first time text in it is drawn.',
    face: 'Face',
    file: 'File',
    size: 'woff2',
    total: 'Total',
  },
  ar: {
    lede: 'عائلة خط واحدة بنظامَي كتابة. العربية أكبر بدرجة وأرحب في السطر، والتدرّج يأتي من الوزن ولون الحبر لا من حجم رابع.',
    roles: 'الأدوار',
    latin: 'لاتيني',
    arabic: 'عربي',
    weight: 'الوزن',
    tabular: 'أرقام متساوية العرض',
    coarse: 'على شاشات اللمس فقط',
    figures: 'الأرقام',
    figuresNote:
      'كل مربع ملوّن بعرضه الحقيقي. يرسم IBM Plex Sans كل رقم بعرض 600 من 1000 في الأوزان الثلاثة، والسطر العربي يأخذ أرقامه منه، فلكل عمود عرض واحد.',
    latinLine: 'في سطر لاتيني',
    arabicLine: 'في سطر عربي',
    files: 'الملفات الستة',
    filesNote: 'يحمّلها التطبيق المضيف، ويجلب المتصفح كل وزن أول مرة يُرسم فيها نص به.',
    face: 'الخط',
    file: 'الملف',
    size: 'woff2',
    total: 'المجموع',
  },
} as const satisfies Record<TypeSpecimenLocale, Record<string, string>>;

const TOTAL_BYTES = FONT_FILES.reduce((sum, file) => sum + file.bytes, 0);

const metric = ({ size, line }: TypeMetric): string => `${String(size)}/${String(line)}`;

/**
 * The type specimen for the agent panel (SPEC §2.2, WP-02 evidence): every role in both
 * scripts, a tabular-figures check, and the six font files with their measured sizes.
 * Sizes, weights and inks come from the `--bldr-*` tokens, so what it shows is what the
 * panel will render, `:lang(ar)` re-pointing included.
 *
 * The root takes the locale's `lang`, as the panel's root does, and every Latin sample, face
 * name and file name inside carries `lang="en"`. Two Latin strings do not: the files table's
 * `woff2` column header and the byte counts (`22,588 B (22.1 KiB)`) inherit the root's
 * `lang`, so in the Arabic specimen a screen reader reads them in the Arabic voice and they
 * take the Arabic stack (wave-1 verifier, 2026-09-28; the test's Latin list leaves them out
 * too). In the Arabic specimen each Latin sample is an island:
 * the theme's `:lang(ar) [lang]:not(:lang(ar))` block re-points `--bldr-font` and the size
 * tokens back to Latin on the element carrying the attribute (custom properties inherit,
 * so without that block a Latin sample would keep the Arabic 14/22 instead of 13/20). The
 * Arabic stories measure every Latin sample inside the Arabic root, so a regression in that
 * block fails them.
 */
export function TypeSpecimen({ locale = 'en', className }: TypeSpecimenProps) {
  const id = useId();
  const copy = COPY[locale];
  const titleId = `${id}-title`;
  const rolesId = `${id}-roles`;
  const figuresId = `${id}-figures`;
  const filesId = `${id}-files`;
  const rootClass =
    className === undefined ? 'ck-agent-specimen' : `ck-agent-specimen ${className}`;

  return (
    <section
      className={rootClass}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      aria-labelledby={titleId}
    >
      <header className="ck-agent-specimen__header">
        <h2 id={titleId} className="ck-agent-specimen__title">
          <bdi lang="en" dir="ltr">
            IBM Plex Sans, IBM Plex Sans Arabic
          </bdi>
        </h2>
        <p className="ck-agent-specimen__lede">{copy.lede}</p>
      </header>

      <section className="ck-agent-specimen__section" aria-labelledby={rolesId}>
        <h3 id={rolesId} className="ck-agent-specimen__heading">
          {copy.roles}
        </h3>
        <ol className="ck-agent-specimen__roles" aria-labelledby={rolesId}>
          {TYPE_ROLES.map((role) => (
            <li key={role.key} className="ck-agent-specimen__role" data-role={role.key}>
              <div className="ck-agent-specimen__role-head">
                <span className="ck-agent-specimen__role-name">{role.label[locale]}</span>
                <span className="ck-agent-specimen__role-use">{role.use[locale]}</span>
                <dl className="ck-agent-specimen__spec">
                  <div>
                    <dt>{copy.latin}</dt>
                    <dd>
                      <bdi dir="ltr">{metric(role.latin)}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.arabic}</dt>
                    <dd>
                      <bdi dir="ltr">{metric(role.arabic)}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.weight}</dt>
                    <dd>
                      <bdi dir="ltr">{role.weight}</bdi>
                    </dd>
                  </div>
                </dl>
                {role.tabular || role.coarseOnly ? (
                  <span className="ck-agent-specimen__role-note">
                    {role.coarseOnly ? copy.coarse : copy.tabular}
                  </span>
                ) : null}
              </div>
              <div className="ck-agent-specimen__samples">
                <p
                  className="ck-agent-specimen__sample"
                  data-role={role.key}
                  data-ink={role.ink}
                  lang="en"
                  dir="ltr"
                >
                  {role.sample.en}
                </p>
                <p
                  className="ck-agent-specimen__sample"
                  data-role={role.key}
                  data-ink={role.ink}
                  lang="ar"
                  dir="rtl"
                >
                  {role.sample.ar}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="ck-agent-specimen__section" aria-labelledby={figuresId}>
        <h3 id={figuresId} className="ck-agent-specimen__heading">
          {copy.figures}
        </h3>
        <p className="ck-agent-specimen__note">{copy.figuresNote}</p>
        <table className="ck-agent-specimen__figures" aria-labelledby={figuresId}>
          <thead>
            <tr>
              <th scope="col">{copy.latinLine}</th>
              <th scope="col">{copy.arabicLine}</th>
            </tr>
          </thead>
          {FIGURE_GROUPS.map((group) => (
            <tbody key={group.join()} className="ck-agent-specimen__figure-group">
              {group.map((value) => (
                <tr key={value}>
                  {/* The cells follow the table's direction, so both columns align alike; the
                      script lives on the figure, which is what picks its font stack. */}
                  <td>
                    <span
                      className="ck-agent-specimen__figure"
                      data-group={group.join()}
                      lang="en"
                      dir="ltr"
                    >
                      {value}
                    </span>
                  </td>
                  <td>
                    <span
                      className="ck-agent-specimen__figure"
                      data-group={group.join()}
                      lang="ar"
                      dir="rtl"
                    >
                      <bdi dir="ltr">{value}</bdi>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>

      <section className="ck-agent-specimen__section" aria-labelledby={filesId}>
        <h3 id={filesId} className="ck-agent-specimen__heading">
          {copy.files}
        </h3>
        <p className="ck-agent-specimen__note">{copy.filesNote}</p>
        <table className="ck-agent-specimen__files" aria-labelledby={filesId}>
          <thead>
            <tr>
              <th scope="col">{copy.face}</th>
              <th scope="col">{copy.weight}</th>
              <th scope="col" className="ck-agent-specimen__file">
                {copy.file}
              </th>
              <th scope="col">{copy.size}</th>
            </tr>
          </thead>
          <tbody>
            {FONT_FILES.map((file) => (
              <tr key={file.file}>
                <th scope="row">
                  {/* No `dir` of its own: one Arabic word shapes and orders the same in
                      either paragraph direction, and without one the span's inline-end
                      margin sits on the page's inline end, between glyphs and name. */}
                  <span
                    className="ck-agent-specimen__glyphs"
                    data-weight={file.weight}
                    lang={file.subset === 'arabic' ? 'ar' : 'en'}
                    aria-hidden="true"
                  >
                    {file.subset === 'arabic' ? 'أبجد' : 'Ag'}
                  </span>
                  <bdi className="ck-agent-specimen__face" lang="en">
                    {file.family}
                  </bdi>
                </th>
                <td>
                  <bdi dir="ltr">{file.weight}</bdi>
                </td>
                <td className="ck-agent-specimen__file">
                  <bdi lang="en" dir="ltr">
                    {file.file}
                  </bdi>
                </td>
                <td className="ck-agent-specimen__bytes">
                  <bdi dir="ltr">{formatBytes(file.bytes)}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                {copy.total}
              </th>
              {/* Its own cell, so the row keeps the grid when the file column hides. */}
              <td className="ck-agent-specimen__file" />
              <td className="ck-agent-specimen__bytes">
                <bdi dir="ltr">{formatBytes(TOTAL_BYTES)}</bdi>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </section>
  );
}
