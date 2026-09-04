import '../section-layout.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import {
  ALIGN_CLASSES,
  DIRECTION_CLASSES,
  GAP_CLASSES,
  WRAP_CLASSES,
  cx,
} from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';
import { sectionTypographyClasses } from '../section-typography';

import type { NavLinksProps } from './schema';

const LINK_STYLE_CLASSES: Record<NavLinksProps['style'], string | undefined> = {
  plain: undefined,
  underline: 'underline',
  pill: 'rounded-base border border-current px-control-inline-sm py-control-block-sm',
};

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
        className={cx(
          'm-0 rounded-base bg-text-muted/10 p-gap-sm text-center text-sm text-text-muted',
          typographyClassName,
          legacyTypographyClassName,
          props.className,
        )}
        style={style}
      >
        This block has no links yet.
      </p>
    );
  }

  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);

  return (
    <nav
      aria-label="Navigation links"
      className={cx(
        'box-border inline-flex max-w-full',
        typographyClassName,
        legacyTypographyClassName,
        motionClassName,
        props.className,
      )}
      {...motionData}
      style={style}
    >
      <ul
        className={cx(
          'm-0 flex list-none items-center p-0',
          DIRECTION_CLASSES[props.direction],
          props.direction === 'column' ? ALIGN_CLASSES.start : undefined,
          GAP_CLASSES[props.gap],
          WRAP_CLASSES[props.wrap],
        )}
      >
        {props.links.map((link, index) => (
          <li key={`${link.href}-${String(index)}`}>
            <a
              className={cx(
                'inline-flex text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                LINK_STYLE_CLASSES[props.style],
              )}
              href={link.href}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
