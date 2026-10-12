import type { FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

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
  /**
   * Draw each item's name under its icon (Studio Indigo, 2026-10-12). Icon-only navigation
   * hides where things are; a short caption beside every glyph is what makes the rail
   * learnable, so a host with room (68px) turns it on. The caption replaces the hover label,
   * which would only repeat it. Off by default, so a narrow host keeps the icon rail.
   */
  captions?: boolean | undefined;
}

/**
 * Show or hide the label popover, and survive a runtime that cannot.
 *
 * Three things make the bare call unsafe: the Popover API is simply ABSENT in
 * some runtimes (jsdom has neither method, and so do browsers old enough); a
 * runtime that HAS it throws when asked to show a popover that is already
 * showing, which a fast hover between two icons produces easily; and a detached
 * element throws too.
 *
 * One response covers all three, and the catch is the entire guard — a
 * `typeof` capability check in front of it was tried and removed, because no
 * test could tell it from its own absence: calling a missing method throws the
 * same way, into the same catch. A check nothing can distinguish is not a
 * check.
 *
 * What is NOT swallowed is the consequence. Any of these escaping into React's
 * event dispatch breaks the rail's buttons, which is a loss out of all
 * proportion to a tooltip that did not appear.
 */
function callPopover(element: HTMLElement | null, method: 'showPopover' | 'hidePopover'): void {
  if (element === null) return;
  try {
    if (method === 'showPopover') {
      element.showPopover();
    } else {
      element.hidePopover();
    }
  } catch {
    // A label that did not move is the whole cost.
  }
}

/** Primary builder navigation with footer-pinned utilities and account content. */
export function IconRail({
  items,
  secondary = [],
  activeId,
  onSelect,
  account,
  label = 'Builder sections',
  captions = false,
}: IconRailProps) {
  const showLabel = (button: HTMLButtonElement) => {
    const label = button.querySelector<HTMLElement>('.bldr-icon-rail__label');
    if (!label) return;
    const bounds = button.getBoundingClientRect();
    const rtl = getComputedStyle(button).direction === 'rtl';
    const inlineStart = rtl ? window.innerWidth - bounds.left : bounds.right;
    label.style.insetInlineStart = `${String(inlineStart)}px`;
    label.style.insetBlockStart = `${String(bounds.top + bounds.height / 2)}px`;
    callPopover(label, 'showPopover');
  };
  const hideLabel = (button: HTMLButtonElement) => {
    callPopover(button.querySelector<HTMLElement>('.bldr-icon-rail__label'), 'hidePopover');
  };
  const hasFooter = secondary.length > 0 || account !== undefined;

  /* One button for both lists; with captions the name is drawn, without them it pops over. */
  const renderButton = (item: RailItem) => (
    <ChromeButton
      className="bldr-icon-rail__button"
      size="lg"
      variant="quiet"
      aria-label={item.label}
      {...(captions
        ? {}
        : {
            onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => {
              showLabel(event.currentTarget);
            },
            onMouseLeave: (event: MouseEvent<HTMLButtonElement>) => {
              hideLabel(event.currentTarget);
            },
            onFocus: (event: FocusEvent<HTMLButtonElement>) => {
              showLabel(event.currentTarget);
            },
            onBlur: (event: FocusEvent<HTMLButtonElement>) => {
              hideLabel(event.currentTarget);
            },
            onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === 'Escape') hideLabel(event.currentTarget);
            },
          })}
      aria-current={activeId === item.id ? 'page' : undefined}
      onClick={() => {
        onSelect?.(item.id);
      }}
    >
      <span className="bldr-icon-rail__icon" aria-hidden="true">
        {item.icon}
      </span>
      {captions ? (
        <span className="bldr-icon-rail__caption" aria-hidden="true">
          {item.label}
        </span>
      ) : (
        <span className="bldr-icon-rail__label" popover="manual" aria-hidden="true">
          {item.label}
        </span>
      )}
    </ChromeButton>
  );

  return (
    <nav className="bldr-icon-rail" aria-label={label} data-captions={captions ? '' : undefined}>
      <ul className="bldr-icon-rail__list bldr-icon-rail__list--primary">
        {items.map((item) => (
          <li key={item.id} className="bldr-icon-rail__item">
            {renderButton(item)}
          </li>
        ))}
      </ul>

      {hasFooter ? (
        <div className="bldr-icon-rail__footer">
          {secondary.length > 0 ? (
            <ul className="bldr-icon-rail__list bldr-icon-rail__list--secondary">
              {secondary.map((item) => (
                <li key={item.id} className="bldr-icon-rail__item">
                  {renderButton(item)}
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
