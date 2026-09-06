import type { ReactNode } from 'react';

import { ChromeButton } from '../ChromeButton';
import './IconRail.css';

export interface RailItem {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
}

export interface IconRailProps {
  items: readonly RailItem[];
  secondary?: readonly RailItem[] | undefined;
  activeId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  account?: ReactNode | undefined;
  label?: string | undefined;
}

/** Primary builder navigation with footer-pinned utilities and account content. */
export function IconRail({
  items,
  secondary = [],
  activeId,
  onSelect,
  account,
  label = 'Builder sections',
}: IconRailProps) {
  const showLabel = (button: HTMLButtonElement) => {
    const label = button.querySelector<HTMLElement>('.bldr-icon-rail__label');
    if (!label) return;
    const bounds = button.getBoundingClientRect();
    const rtl = getComputedStyle(button).direction === 'rtl';
    label.style.insetInlineStart = `${rtl ? window.innerWidth - bounds.left : bounds.right}px`;
    label.style.insetBlockStart = `${bounds.top + bounds.height / 2}px`;
    label.showPopover?.();
  };
  const hideLabel = (button: HTMLButtonElement) => {
    button.querySelector<HTMLElement>('.bldr-icon-rail__label')?.hidePopover?.();
  };
  const hasFooter = secondary.length > 0 || account !== undefined;

  return (
    <nav className="bldr-icon-rail" aria-label={label}>
      <ul className="bldr-icon-rail__list bldr-icon-rail__list--primary">
        {items.map((item) => (
          <li key={item.id} className="bldr-icon-rail__item">
            <ChromeButton
              className="bldr-icon-rail__button"
              size="lg"
              variant="quiet"
              aria-label={item.label}
              onMouseEnter={(event) => showLabel(event.currentTarget)}
              onMouseLeave={(event) => hideLabel(event.currentTarget)}
              onFocus={(event) => showLabel(event.currentTarget)}
              onBlur={(event) => hideLabel(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') hideLabel(event.currentTarget);
              }}
              aria-current={activeId === item.id ? 'page' : undefined}
              onClick={() => {
                onSelect?.(item.id);
              }}
            >
              <span className="bldr-icon-rail__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="bldr-icon-rail__label" popover="manual" aria-hidden="true">
                {item.label}
              </span>
            </ChromeButton>
          </li>
        ))}
      </ul>

      {hasFooter ? (
        <div className="bldr-icon-rail__footer">
          {secondary.length > 0 ? (
            <ul className="bldr-icon-rail__list bldr-icon-rail__list--secondary">
              {secondary.map((item) => (
                <li key={item.id} className="bldr-icon-rail__item">
                  <ChromeButton
                    className="bldr-icon-rail__button"
                    size="lg"
                    variant="quiet"
                    aria-label={item.label}
                    onMouseEnter={(event) => showLabel(event.currentTarget)}
                    onMouseLeave={(event) => hideLabel(event.currentTarget)}
                    onFocus={(event) => showLabel(event.currentTarget)}
                    onBlur={(event) => hideLabel(event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') hideLabel(event.currentTarget);
                    }}
                    aria-current={activeId === item.id ? 'page' : undefined}
                    onClick={() => {
                      onSelect?.(item.id);
                    }}
                  >
                    <span className="bldr-icon-rail__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="bldr-icon-rail__label" popover="manual" aria-hidden="true">
                      {item.label}
                    </span>
                  </ChromeButton>
                </li>
              ))}
            </ul>
          ) : null}

          {account !== undefined ? <div className="bldr-icon-rail__account">{account}</div> : null}
        </div>
      ) : null}
    </nav>
  );
}
