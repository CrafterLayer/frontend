import { clsx } from 'clsx';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';

import type { PartAttributeOptions, PartAttributes } from '@craftkit/builder-schema';

import type { MarqueeItem, MarqueeProps } from '../Marquee/schema';

const RADIUS_CLASSES: Record<MarqueeProps['radius'], string> = {
  small: 'rounded',
  large: 'rounded-xl',
  pill: 'rounded-full',
};

export interface MarqueeTrackProps {
  readonly items: readonly MarqueeItem[];
  readonly presentation: MarqueeProps['presentation'];
  readonly radius: MarqueeProps['radius'];
  readonly direction: MarqueeProps['direction'];
  readonly secondary?: boolean;
  readonly isCanvas?: boolean;
  /**
   * The owning block's part helper (`blockPartProps`), so every copy's
   * elements are parts of the marquee. Without it the track renders its own
   * classes only.
   */
  readonly part?: (name: string, options?: PartAttributeOptions) => PartAttributes;
}

/* Used when no part helper is given: the element keeps its own classes only. */
function classesOnly(_name: string, options?: PartAttributeOptions): PartAttributes {
  return options?.className === undefined ? {} : { className: options.className };
}

/* The decorative monogram reads only a committed title, never an editor element. */
function initialOf(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 1).toLocaleUpperCase() : '';
}

/** One visual marquee row, with its seamless copy removed from the accessibility tree. */
export function MarqueeTrack({
  items,
  presentation,
  radius,
  direction,
  secondary = false,
  isCanvas = false,
  part = classesOnly,
}: MarqueeTrackProps) {
  const copies = secondary
    ? (['duplicate', 'duplicate'] as const)
    : (['primary', 'duplicate'] as const);
  const suppressCanvasNavigation = isCanvas
    ? (event: ReactMouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
      }
    : undefined;

  return (
    <div
      className="mgc-marquee__viewport"
      data-marquee-direction={direction}
      data-marquee-row={secondary ? 'secondary' : 'primary'}
    >
      <div className="mgc-marquee__track">
        {copies.map((copy, copyIndex) => (
          <ul
            key={`${copy}-${String(copyIndex)}`}
            {...part('items', { className: 'mgc-marquee__list' })}
            aria-hidden={copy === 'duplicate' ? 'true' : undefined}
            data-marquee-copy={copy}
          >
            {items.map((item, itemIndex) => {
              const at = [itemIndex];
              /*
                Every copy draws the item's parts; only the readable primary
                copy hosts an inline editor (a non-string value), so it renders
                once while the duplicates wait for the committed text.
              */
              const host = copy === 'primary';
              const show = (value: ReactNode): ReactNode =>
                host || typeof value === 'string' ? value : null;
              const content = (
                <>
                  {item.imageUrl === undefined ? (
                    <span className="mgc-marquee__monogram" aria-hidden="true">
                      {initialOf(item.title)}
                    </span>
                  ) : (
                    <img
                      {...part('item.image', { index: at, className: 'mgc-marquee__image' })}
                      src={item.imageUrl}
                      alt={item.imageAlt ?? (typeof item.title === 'string' ? item.title : '')}
                      loading="lazy"
                    />
                  )}
                  <span className="mgc-marquee__copy">
                    <span {...part('item.title', { index: at, className: 'mgc-marquee__title' })}>
                      {show(item.title)}
                    </span>
                    {item.description === undefined ? null : (
                      <span
                        {...part('item.description', {
                          index: at,
                          className: 'mgc-marquee__description',
                        })}
                      >
                        {show(item.description)}
                      </span>
                    )}
                    {item.meta === undefined ? null : (
                      <span {...part('item.meta', { index: at, className: 'mgc-marquee__meta' })}>
                        {show(item.meta)}
                      </span>
                    )}
                  </span>
                </>
              );

              return (
                /* Keyed by position: a bound value may be an inline editor element. */
                <li
                  key={itemIndex}
                  {...part('item', {
                    index: at,
                    className: clsx(
                      'mgc-marquee__item',
                      RADIUS_CLASSES[radius],
                      presentation === 'cards' ? 'shadow-soft' : undefined,
                    ),
                  })}
                >
                  {item.href === undefined || copy === 'duplicate' ? (
                    content
                  ) : (
                    <a
                      {...part('item.link', { index: at, className: 'mgc-marquee__link' })}
                      href={item.href}
                      onClick={suppressCanvasNavigation}
                      onAuxClick={suppressCanvasNavigation}
                      onContextMenu={suppressCanvasNavigation}
                    >
                      {content}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
