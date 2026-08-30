import '../section-layout.css';
import './NavLinks.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { NavLinksProps } from './schema';

/** A compact navigation list for freely composed page slots and standalone layouts. */
export function NavLinks({ node, props, isCanvas }: BlockRenderProps<NavLinksProps>) {
  const typographyClassName = sectionTypographyClasses(props);
  const legacyWeight = node.props['weight'];
  const hasLegacyWeight =
    legacyWeight === 'regular' || legacyWeight === 'medium' || legacyWeight === 'semibold';
  const legacyFontWeight =
    props.fontWeight === undefined && hasLegacyWeight ? legacyWeight : undefined;
  const legacyTypographyClassName = sectionTypographyClasses({
    fontWeight: legacyFontWeight,
    letterSpacing:
      props.letterSpacing === undefined && hasLegacyWeight && props.textCase === 'uppercase'
        ? 'wide'
        : undefined,
  });
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
        className={['mkt-section__hint', typographyClassName, legacyTypographyClassName]
          .filter(Boolean)
          .join(' ')}
        style={style}
      >
        This block has no links yet.
      </p>
    );
  }

  /*
    Motion arrives as ATTRIBUTES, never as inline style: the stylesheet stays
    the one place any timing lives, so a document carries a named step and never
    a duration. `class` is pulled out because React spells it `className`.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    'mkt-nav-links',
    `mkt-nav-links--direction-${props.direction}`,
    `mkt-nav-links--style-${props.style}`,
    `mkt-nav-links--gap-${props.gap}`,
    `mkt-nav-links--wrap-${props.wrap}`,
    typographyClassName,
    legacyTypographyClassName,
    motionClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label="Navigation links" className={className} {...motionData} style={style}>
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
