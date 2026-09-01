import { clsx } from 'clsx';
import type { MouseEvent as ReactMouseEvent } from 'react';

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
}

/** One visual marquee row, with its seamless copy removed from the accessibility tree. */
export function MarqueeTrack({
  items,
  presentation,
  radius,
  direction,
  secondary = false,
  isCanvas = false,
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
            className="mgc-marquee__list"
            aria-hidden={copy === 'duplicate' ? 'true' : undefined}
            data-marquee-copy={copy}
          >
            {items.map((item, itemIndex) => {
              const content = (
                <>
                  {item.imageUrl === undefined ? (
                    <span className="mgc-marquee__monogram" aria-hidden="true">
                      {item.title.slice(0, 1).toLocaleUpperCase()}
                    </span>
                  ) : (
                    <img
                      className="mgc-marquee__image"
                      src={item.imageUrl}
                      alt={item.imageAlt ?? item.title}
                      loading="lazy"
                    />
                  )}
                  <span className="mgc-marquee__copy">
                    <span className="mgc-marquee__title">{item.title}</span>
                    {item.description === undefined ? null : (
                      <span className="mgc-marquee__description">{item.description}</span>
                    )}
                    {item.meta === undefined ? null : (
                      <span className="mgc-marquee__meta">{item.meta}</span>
                    )}
                  </span>
                </>
              );

              return (
                <li
                  key={`${item.title}-${item.href ?? 'static'}-${String(itemIndex)}`}
                  className={clsx(
                    'mgc-marquee__item',
                    RADIUS_CLASSES[radius],
                    presentation === 'cards' ? 'shadow-soft' : undefined,
                  )}
                >
                  {item.href === undefined || copy === 'duplicate' ? (
                    content
                  ) : (
                    <a
                      className="mgc-marquee__link"
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
