import { clsx } from 'clsx';

import { motionAttributes } from '@craftkit/builder-renderer';
import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { BreadcrumbsProps } from './schema';

const SIZE_CLASSES: Record<BreadcrumbsProps['size'], string> = {
  small: 'gap-1.5 text-xs',
  medium: 'gap-2 text-sm',
  large: 'gap-3 text-base',
};

const SEPARATOR_GAP_CLASSES: Record<BreadcrumbsProps['size'], string> = {
  small: 'gap-1.5',
  medium: 'gap-2',
  large: 'gap-3',
};

const TONE_CLASSES: Record<BreadcrumbsProps['tone'], string> = {
  default: 'text-text',
  muted: 'text-text-muted',
  inverse: 'rounded-xl bg-surface-inverse px-4 py-3 text-text-inverse shadow-soft',
};

const ALIGN_CLASSES: Record<BreadcrumbsProps['align'], string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const SEPARATORS: Record<BreadcrumbsProps['separator'], string> = {
  chevron: '›',
  slash: '/',
  dot: '·',
};

/** Semantic breadcrumb navigation with canvas-safe links and responsive middle collapse. */
export function Breadcrumbs({ props, isCanvas }: BlockRenderProps<BreadcrumbsProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const currentIndex = props.items.length - 1;
  const shouldCollapse = props.collapse === 'responsive' && props.items.length > 4;

  if (props.items.length === 0 && !isCanvas) return null;

  return (
    <nav
      aria-label={props.label}
      className={clsx(
        '@container min-w-0',
        TONE_CLASSES[props.tone],
        motionClassName,
        props.className,
      )}
      {...motionData}
    >
      {props.items.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">Add breadcrumb items.</p>
      ) : (
        <ol
          className={clsx(
            'm-0 flex min-w-0 list-none flex-wrap items-center p-0',
            SIZE_CLASSES[props.size],
            ALIGN_CLASSES[props.align],
          )}
        >
          {props.items.map((item, index) => {
            const isCurrent = index === currentIndex;
            const isResponsiveMiddle =
              shouldCollapse && index > 0 && index < props.items.length - 2;

            return (
              <li
                className={clsx(
                  'min-w-0 items-center',
                  SEPARATOR_GAP_CLASSES[props.size],
                  isResponsiveMiddle ? 'hidden @md:flex' : 'flex',
                )}
                key={[item.label, item.href ?? 'current', String(index)].join('-')}
              >
                {shouldCollapse && index === props.items.length - 2 ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'shrink-0 text-current opacity-45 @md:hidden',
                        props.separator === 'chevron' ? 'rtl:rotate-180' : undefined,
                      )}
                    >
                      {SEPARATORS[props.separator]}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-semibold tracking-widest text-current opacity-60 @md:hidden"
                      data-breadcrumb-ellipsis="true"
                    >
                      …
                    </span>
                  </>
                ) : null}

                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'shrink-0 text-current opacity-45',
                      props.separator === 'chevron' ? 'rtl:rotate-180' : undefined,
                    )}
                  >
                    {SEPARATORS[props.separator]}
                  </span>
                ) : null}

                {isCurrent ? (
                  <span
                    aria-current="page"
                    className="min-w-0 truncate font-semibold text-current"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : item.href === undefined ? (
                  <span className="min-w-0 truncate text-current opacity-70" title={item.label}>
                    {item.label}
                  </span>
                ) : (
                  <a
                    className="min-w-0 truncate rounded text-current opacity-70 underline-offset-4 transition hover:opacity-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
                    href={item.href}
                    onClick={
                      isCanvas
                        ? (event) => {
                            event.preventDefault();
                          }
                        : undefined
                    }
                    title={item.label}
                  >
                    {item.label}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
