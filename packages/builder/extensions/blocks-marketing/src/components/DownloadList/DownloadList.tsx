import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, GAP_CLASSES, cx, sectionContentClasses } from '../section-classes';
import { ICON_PATHS, ICON_SVG_PROPS } from '../section-icons';
import { mutedTextClasses, sectionRootAttributes } from '../section-root';
import { sharedText } from '../section-text';
import { isSameOriginPath } from '../section-urls';

import { downloadListSchema, type DownloadListProps } from './schema';

const LIST_CLASSES: Readonly<Record<DownloadListProps['layout'], string>> = {
  list: 'flex flex-col gap-3',
  cards: 'grid grid-cols-1 gap-gap @2xl:grid-cols-2 @5xl:grid-cols-3',
};

/** Files to take away — a profile, a menu, a brochure — each a titled link with its format and size. */
export function DownloadList({ node, props, isCanvas }: BlockRenderProps<DownloadListProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, downloadListSchema.parts);
  const root = sectionRootAttributes(props);
  const muted = mutedTextClasses(props.tone);

  return (
    <section
      className={root.className}
      {...root.motion}
      style={root.style}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-download-list-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col',
            GAP_CLASSES.sm,
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className: 'm-0 text-xs font-semibold tracking-wide text-accent uppercase',
              })}
            >
              {props.eyebrow}
            </p>
          )}
          <h2
            {...part('heading', {
              id: headingId,
              className:
                'm-0 text-3xl leading-tight font-bold tracking-tight text-balance @md:text-4xl',
            })}
          >
            {props.heading}
          </h2>
          {props.body === undefined ? null : (
            <p {...part('body', { className: cx('m-0 text-lg leading-relaxed', muted) })}>
              {props.body}
            </p>
          )}
        </header>

        {props.files.length === 0 ? null : (
          <ul
            {...part('files', {
              className: cx('m-0 w-full list-none p-0 text-start', LIST_CLASSES[props.layout]),
            })}
            data-download-list-layout={props.layout}
          >
            {props.files.map((file, index) => {
              const at = [index];
              const metaId = `${node.id}-file-${String(index)}-meta`;
              const hasMeta = file.format !== undefined || file.size !== undefined;
              return (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li
                  key={index}
                  {...part('file', {
                    index: at,
                    className:
                      'group relative flex items-center gap-4 rounded-2xl border border-current/10 p-4 transition-colors hover:border-current/25 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                  })}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"
                  >
                    <svg {...ICON_SVG_PROPS} className="size-6">
                      {ICON_PATHS.fileText.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {/*
                      The heading is the part and its link a block, so an Arabic
                      title keeps the right edge (see JobsList: an inline `a` is an
                      isolate under the page's text-bidi rule).
                    */}
                    <h3
                      {...part('file.title', {
                        index: at,
                        className: 'm-0 text-base leading-snug font-semibold',
                      })}
                    >
                      <a
                        className={cx(
                          'block text-inherit no-underline group-hover:text-accent focus-visible:outline-none',
                          /* The whole tile is the link; on the canvas each part stays clickable. */
                          isCanvas ? undefined : 'after:absolute after:inset-0',
                        )}
                        href={file.href}
                        download={isSameOriginPath(file.href) ? '' : undefined}
                        aria-describedby={hasMeta ? metaId : undefined}
                      >
                        {file.title}
                      </a>
                    </h3>
                    {file.description === undefined ? null : (
                      <p
                        {...part('file.description', {
                          index: at,
                          className: cx('m-0 text-sm leading-relaxed', muted),
                        })}
                      >
                        {file.description}
                      </p>
                    )}
                    {hasMeta ? (
                      <p
                        id={metaId}
                        className={cx(
                          'm-0 flex flex-wrap items-center gap-x-2 text-xs font-medium tracking-wide tabular-nums',
                          muted,
                        )}
                      >
                        {file.format === undefined ? null : (
                          <span {...part('file.format', { index: at, className: 'uppercase' })}>
                            {file.format}
                          </span>
                        )}
                        {/* Spaces, so the link's description reads "PDF 3.2 MB"; the dot is drawn only. */}
                        {file.format !== undefined && file.size !== undefined ? (
                          <>
                            {' '}
                            <span aria-hidden="true">·</span>{' '}
                          </>
                        ) : null}
                        {file.size === undefined ? null : (
                          <span {...part('file.size', { index: at })}>{file.size}</span>
                        )}
                      </p>
                    ) : null}
                  </div>
                  {/* The tile's link already names the file; this is its visual affordance. */}
                  <span
                    aria-hidden="true"
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-accent"
                  >
                    <span {...part('downloadLabel', { className: 'hidden @md:inline' })}>
                      {sharedText(props.downloadLabel, index === 0)}
                    </span>
                    <svg {...ICON_SVG_PROPS} className="size-5">
                      {ICON_PATHS.download.map((d) => (
                        <path key={d} d={d} />
                      ))}
                    </svg>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
