import '../section-layout.css';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  GAP_CLASSES,
  cx,
  sectionContentClasses,
  sectionShellClasses,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import { teamSchema, type TeamProps } from './schema';

/*
  The portrait letter is decoration derived from the name. While the name is
  being edited in place it is an editor element, not a string, so there is no
  letter to derive and the portrait stays empty for that moment.
*/
function initialOf(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, 1).toLocaleUpperCase() : '';
}

const COLUMN_CLASSES: Record<TeamProps['columns'], string> = {
  '2': 'grid-cols-1 @md:grid-cols-2',
  '3': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3',
  '4': 'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4',
};

const CARD_CLASSES: Record<TeamProps['variant'], string> = {
  cards:
    'group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated',
  editorial:
    'group grid min-w-0 grid-cols-1 overflow-hidden rounded-xl border border-text/10 bg-surface text-text shadow-soft transition duration-300 hover:shadow-elevated @md:grid-cols-2 @md:items-center',
  compact:
    'group flex min-w-0 items-center gap-gap rounded-xl border border-text/10 bg-surface p-gap-sm text-text shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elevated',
};

const PORTRAIT_CLASSES: Record<TeamProps['variant'], string> = {
  cards: 'aspect-4/5 w-full',
  editorial: 'aspect-4/5 w-full',
  compact: 'size-20 shrink-0 rounded-full',
};

const COPY_CLASSES: Record<TeamProps['variant'], string> = {
  cards: 'flex min-w-0 flex-1 flex-col gap-gap-sm p-6',
  editorial: 'flex min-w-0 flex-col gap-gap-sm p-6 @lg:p-8',
  compact: 'flex min-w-0 flex-1 flex-col gap-1',
};

/** A responsive people section with real names, roles, biographies, and optional profile links. */
export function Team({ node, props, isCanvas }: BlockRenderProps<TeamProps>) {
  const headingId = `${node.id}-heading`;
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, teamSchema.parts);
  /*
    `profileLabel` shows in every profile link. While it is edited in place its
    value is ONE editor element, which may mount only once: the first link
    holds the editor and the others keep showing the stored text.
  */
  const storedProfileLabel = node.props['profileLabel'];
  const profileLabel: unknown = props.profileLabel;
  const editorIndex = props.members.findIndex((member) => member.profileHref !== undefined);
  const profileLabelChild = (index: number) =>
    typeof profileLabel === 'string' || index === editorIndex
      ? props.profileLabel
      : typeof storedProfileLabel === 'string'
        ? storedProfileLabel
        : '';
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  return (
    <section
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container',
        sectionTypographyClasses(props),
        motionClassName,
        props.className,
      )}
      {...motionData}
      style={style}
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col',
          ALIGN_CLASSES[props.align],
          GAP_CLASSES.lg,
        )}
        data-team-content=""
      >
        <header
          className={cx(
            'flex max-w-content-narrow flex-col gap-gap-sm',
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.eyebrow === undefined ? null : (
            <p
              {...part('eyebrow', {
                className:
                  'm-0 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase',
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
            <p
              {...part('body', {
                className: cx(
                  'm-0 text-lg leading-relaxed',
                  props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted',
                ),
              })}
            >
              {props.body}
            </p>
          )}
        </header>

        <ul
          {...part('members', {
            className: cx(
              'm-0 grid w-full list-none p-0',
              COLUMN_CLASSES[props.columns],
              props.variant === 'editorial' ? GAP_CLASSES.lg : GAP_CLASSES.md,
            ),
          })}
          data-team-grid=""
        >
          {props.members.map((member, index) => {
            const at = [index];
            /*
              The link's accessible name is read from the VISIBLE label and name
              (aria-labelledby), never a string built from them: inline editing
              swaps either for an editor element, which a template literal would
              turn into "[object Object]".
            */
            const nameId = `${node.id}-member-${String(index)}-name`;
            const profileLabelId = `${node.id}-member-${String(index)}-profile`;
            return (
              /* Keyed by position: a bound value may be an inline editor element. */
              <li
                key={index}
                {...part('member', { index: at, className: CARD_CLASSES[props.variant] })}
              >
                <div
                  className={cx(
                    'grid place-items-center overflow-hidden bg-accent/10 text-accent',
                    PORTRAIT_CLASSES[props.variant],
                  )}
                >
                  {member.imageSrc === undefined ? (
                    <span aria-hidden="true" className="text-2xl font-bold">
                      {initialOf(member.name)}
                    </span>
                  ) : (
                    <img
                      {...part('member.image', {
                        index: at,
                        className:
                          'h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none',
                      })}
                      src={member.imageSrc}
                      alt={member.imageAlt ?? ''}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>

                <div className={COPY_CLASSES[props.variant]}>
                  <h3
                    {...part('member.name', {
                      index: at,
                      id: nameId,
                      className: 'm-0 text-xl leading-tight font-semibold tracking-tight',
                    })}
                  >
                    {member.name}
                  </h3>
                  <p
                    {...part('member.role', {
                      index: at,
                      className: 'm-0 text-sm font-semibold tracking-wide text-accent',
                    })}
                  >
                    {member.role}
                  </p>
                  {member.bio === undefined ? null : (
                    <p
                      {...part('member.bio', {
                        index: at,
                        className: 'm-0 leading-relaxed text-text-muted',
                      })}
                    >
                      {member.bio}
                    </p>
                  )}
                  {member.profileHref === undefined ? null : (
                    <a
                      className="mt-auto inline-flex min-h-11 items-center self-start font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                      href={member.profileHref}
                      aria-labelledby={`${profileLabelId} ${nameId}`}
                    >
                      <span {...part('profileLabel', { id: profileLabelId })}>
                        {profileLabelChild(index)}
                      </span>
                      <span aria-hidden="true" className="ms-gap-xs">
                        ↗
                      </span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
