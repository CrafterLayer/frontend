import '../section-layout.css';
import './PageFooter.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { PageFooterProps } from './schema';

/**
 * The page footer.
 *
 * Colour arrives as a ROLE and resolves here to the page's own custom property,
 * so the document never holds a literal and re-pointing the theme repaints every
 * footer ever authored.
 *
 * `layout` is the only structural property — `minimal` drops everything but the
 * legal line, and the rest differ in arrangement, not in what exists. That
 * keeps a new look a matter of CSS rather than another branch here.
 */
export function PageFooter({ props, slots, isCanvas }: BlockRenderProps<PageFooterProps>) {
  const minimal = props.layout === 'minimal';
  const columns = minimal ? [] : props.columns;
  const social = props.social;
  const bare =
    props.statement === undefined &&
    props.brand === undefined &&
    props.legal === undefined &&
    columns.length === 0 &&
    social.length === 0 &&
    slots['default'] === undefined;

  const className = [
    'mkt-section',
    'mkt-footer',
    `mkt-footer--layout-${props.layout}`,
    `mkt-footer--border-${props.border}`,
    `mkt-footer--links-${props.linkStyle}`,
    `mkt-footer--headings-${props.headingCase}`,
    `mkt-section--tone-${props.tone}`,
    `mkt-section--spacing-${props.spacing}`,
  ].join(' ');

  /*
    The legal line and the social row either sit in the main flow or in their own
    bar under a rule. Deciding it once here keeps the JSX below from carrying the
    same condition three times.
  */
  const tail = (
    <>
      {social.length === 0 ? null : (
        <nav className="mkt-footer__social" aria-label="Social">
          {social.map((item) => (
            <a key={`${item.label}-${item.href}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      )}
      {props.legal === undefined ? null : <p className="mkt-footer__legal">{props.legal}</p>}
    </>
  );

  return (
    <footer className={className} style={sectionColorStyle(props)}>
      <div
        className={`mkt-section__content mkt-section__content--width-${props.width} mkt-section__content--align-${props.align} mkt-footer__body`}
      >
        {props.brand === undefined && props.statement === undefined ? null : (
          <div className="mkt-footer__intro">
            {props.brand === undefined ? null : (
              <strong className="mkt-footer__brand">{props.brand}</strong>
            )}
            {props.statement === undefined ? null : (
              <p className="mkt-footer__statement">{props.statement}</p>
            )}
          </div>
        )}

        {columns.length === 0 ? null : (
          <div className={`mkt-footer__columns mkt-footer__columns--${props.columnCount}`}>
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2>{column.heading}</h2>
                <ul>
                  {column.links.map((item) => (
                    <li key={`${item.label}-${item.href}`}>
                      <a href={item.href}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        )}

        {slots['default']}

        {props.bottomBar ? <div className="mkt-footer__bottom">{tail}</div> : tail}

        {bare && isCanvas ? (
          <p className="mkt-section__hint" role="status">
            Empty footer — add a statement, some link columns, or a legal line.
          </p>
        ) : null}
      </div>
    </footer>
  );
}
