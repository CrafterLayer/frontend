import '../section-layout.css';
import './PageHeader.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { PageHeaderProps } from './schema';

/**
 * The page header.
 *
 * Every visual choice arrives as a class, never an inline style — the one
 * exception being colour, which resolves a ROLE to the page's own custom
 * property (`background: 'accent'` → `var(--t-accent)`). That indirection is the
 * whole point: the document never holds a colour, so re-pointing the theme
 * repaints every header ever authored.
 *
 * `layout` decides where the three regions sit and is the only structural
 * property; everything else dresses them. Keeping it that way is what stops the
 * option list becoming a pile of special cases — a new look is a new value of
 * `layout` plus CSS, not a new branch here.
 */
export function PageHeader({ node, props, slots, isCanvas }: BlockRenderProps<PageHeaderProps>) {
  const brandId = `${node.id}-brand`;
  const bare =
    props.links.length === 0 && props.actionLabel === undefined && slots['default'] === undefined;

  const className = [
    'mkt-section',
    'mkt-header',
    `mkt-header--layout-${props.layout}`,
    `mkt-header--density-${props.density}`,
    `mkt-header--border-${props.border}`,
    `mkt-header--shadow-${props.shadow}`,
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
    props.sticky ? 'mkt-header--sticky' : undefined,
    props.sticky && props.translucent ? 'mkt-header--translucent' : undefined,
  ]
    .filter((name) => name !== undefined)
    .join(' ');

  return (
    <header className={className} style={sectionColorStyle(props)} aria-labelledby={brandId}>
      <div
        className={`mkt-section__content mkt-section__content--width-${props.width} mkt-header__bar`}
      >
        <div className={`mkt-header__brand mkt-header__brand--${props.brandSize}`}>
          {/*
            The accessible name comes from the VISIBLE wordmark, never a copy of
            its text: inline editing swaps that property for an editor element,
            and an element in aria-label stringifies to "[object Object]".
          */}
          {props.brandHref === undefined ? (
            <strong id={brandId}>{props.brand}</strong>
          ) : (
            <a className="mkt-header__brand-link" href={props.brandHref}>
              <strong id={brandId}>{props.brand}</strong>
            </a>
          )}
          {props.tagline === undefined ? null : (
            <span className="mkt-header__tagline">{props.tagline}</span>
          )}
        </div>

        {props.links.length === 0 ? null : (
          <nav
            className={[
              'mkt-header__nav',
              `mkt-header__nav--${props.navStyle}`,
              `mkt-header__nav--case-${props.navCase}`,
              `mkt-header__nav--weight-${props.navWeight}`,
            ].join(' ')}
            aria-label="Page"
          >
            {props.links.map((link) => (
              <a key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {props.actionLabel === undefined && props.secondaryActionLabel === undefined ? null : (
          <div className="mkt-header__actions">
            {props.secondaryActionLabel === undefined ? null : (
              <Action
                label={props.secondaryActionLabel}
                href={props.secondaryActionHref}
                style="ghost"
                size={props.actionSize}
              />
            )}
            {props.actionLabel === undefined ? null : (
              <Action
                label={props.actionLabel}
                href={props.actionHref}
                style={props.actionStyle}
                size={props.actionSize}
              />
            )}
          </div>
        )}

        {slots['default']}
        {bare && isCanvas ? (
          <p className="mkt-section__hint" role="status">
            Add navigation links or an action.
          </p>
        ) : null}
      </div>
    </header>
  );
}

/**
 * An action is a LINK when it has a destination and a button when it does not.
 *
 * Rendering everything as a `<button>` would give the reader a control that
 * looks like it navigates and does not, and would hide the destination from a
 * screen reader and from a middle click. The element follows the behaviour.
 */
function Action({
  label,
  href,
  style,
  size,
}: {
  label: string;
  href: string | undefined;
  style: PageHeaderProps['actionStyle'];
  size: PageHeaderProps['actionSize'];
}) {
  const className = `mkt-header__action mkt-header__action--${style} mkt-header__action--${size}`;
  return href === undefined ? (
    <button type="button" className={className}>
      {label}
    </button>
  ) : (
    <a className={className} href={href}>
      {label}
    </a>
  );
}
