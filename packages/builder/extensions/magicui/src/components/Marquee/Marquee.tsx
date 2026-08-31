import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { MarqueeItem, MarqueeProps } from './schema';

import './Marquee.css';

const SPEED_DURATION: Record<MarqueeProps['speed'], string> = {
  slow: '44s',
  normal: '28s',
  fast: '16s',
};

const TONE_CLASSES: Record<MarqueeProps['tone'], string> = {
  transparent: 'bg-transparent text-inherit',
  surface: 'bg-surface text-text',
  inverse: 'bg-surface-inverse text-text-inverse',
};

const RADIUS_CLASSES: Record<MarqueeProps['radius'], string> = {
  small: 'rounded',
  large: 'rounded-xl',
  pill: 'rounded-full',
};

function marqueeList(
  items: readonly MarqueeItem[],
  presentation: MarqueeProps['presentation'],
  radius: MarqueeProps['radius'],
  duplicate: boolean,
) {
  return (
    <ul
      className="mgc-marquee__list"
      aria-hidden={duplicate ? 'true' : undefined}
      data-marquee-copy={duplicate ? 'duplicate' : 'primary'}
    >
      {items.map((item, index) => {
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
            key={`${item.title}-${item.href ?? 'static'}-${String(index)}`}
            className={clsx(
              'mgc-marquee__item',
              RADIUS_CLASSES[radius],
              presentation === 'cards' ? 'shadow-soft' : undefined,
            )}
          >
            {item.href === undefined ? (
              content
            ) : (
              <a
                className="mgc-marquee__link"
                href={item.href}
                tabIndex={duplicate ? -1 : undefined}
              >
                {content}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A seamless semantic marquee whose duplicate track is hidden from assistive technology. */
export function Marquee({ props }: BlockRenderProps<MarqueeProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const renderTrack = (row: 'primary' | 'secondary') => (
    <div
      className="mgc-marquee__viewport"
      data-marquee-direction={row === 'secondary' ? 'reverse' : props.direction}
    >
      <div className="mgc-marquee__track">
        {marqueeList(props.items, props.presentation, props.radius, row === 'secondary')}
        {marqueeList(props.items, props.presentation, props.radius, true)}
      </div>
    </div>
  );

  return (
    <section
      className={clsx(
        'mgc-marquee',
        TONE_CLASSES[props.tone],
        props.edgeFade ? 'mgc-marquee--fade' : undefined,
        props.pauseOnHover ? 'mgc-marquee--pause' : undefined,
        motionClassName,
        props.className,
      )}
      style={{ ['--mgc-marquee-duration' as string]: SPEED_DURATION[props.speed] }}
      aria-label={props.label}
      data-marquee-presentation={props.presentation}
      {...motionData}
    >
      {renderTrack('primary')}
      {props.rows === 'two' ? renderTrack('secondary') : null}
    </section>
  );
}
