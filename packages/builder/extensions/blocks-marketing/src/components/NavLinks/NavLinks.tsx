import '../section-layout.css';
import './NavLinks.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { NavLinksProps } from './schema';

/** A compact navigation list for freely composed page slots and standalone layouts. */
export function NavLinks({ props, isCanvas }: BlockRenderProps<NavLinksProps>) {
  const typographyClassName = sectionTypographyClasses(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  if (props.links.length === 0) {
    if (!isCanvas) return null;

    return (
      <p
        className={['mkt-section__hint', typographyClassName].filter(Boolean).join(' ')}
        style={style}
      >
        This block has no links yet.
      </p>
    );
  }

  const className = [
    'mkt-nav-links',
    `mkt-nav-links--direction-${props.direction}`,
    `mkt-nav-links--style-${props.style}`,
    `mkt-nav-links--gap-${props.gap}`,
    `mkt-nav-links--wrap-${props.wrap}`,
    typographyClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label="Navigation links" className={className} style={style}>
      <ul className="mkt-nav-links__list">
        {props.links.map((link, index) => (
          <li key={`${link.href}-${String(index)}`} className="mkt-nav-links__item">
            <a className="mkt-nav-links__link" href={link.href}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
