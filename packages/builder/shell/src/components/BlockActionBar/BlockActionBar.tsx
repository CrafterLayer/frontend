import { useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';

import { ChromeButton } from '../ChromeButton';
import type { BlockAction } from '../../overlay/block-actions';
import { BLOCK_ACTION_ICONS } from './BlockActionBar.icons';
import '../../styles/visually-hidden.css';
import './BlockActionBar.css';

export interface BlockActionBarProps {
  /** Accessible name for the toolbar — name the selected block ("Actions for Heading"). */
  label: string;
  /** Ordered list from `resolveBlockActions`; disabled entries render disabled (a3). */
  actions: readonly BlockAction[];
  /** One call per activation with the activated action's id. */
  onAction: (id: string) => void;
  /** Content direction — the arrow keys mirror under RTL. Default `ltr`. */
  dir?: 'ltr' | 'rtl' | undefined;
}

/**
 * The quick-action bar attached to the selected block (009 contract §6,
 * US3). CONTENT ONLY: the canvas portals this into a floating host
 * (`createFloatingHost`, align `start`), and the HOST owns position, flip,
 * visibility, and the hidden-during-drag rule (a4) — nothing geometric may
 * live here, which is what keeps scroll-time positioning at zero renders.
 *
 * `role="toolbar"` is EARNED, not decorative: one tab stop with roving
 * tabindex, arrow keys move between enabled actions (mirrored under RTL),
 * Home/End jump to the edges. Activation cancels pointerdown and mousedown
 * and stops click propagation, so pressing a button never moves focus off the
 * canvas and never re-enters the canvas selection path.
 */
export function BlockActionBar({ label, actions, onAction, dir }: BlockActionBarProps) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  if (actions.length === 0) {
    return null;
  }

  // Disabled actions keep their seat (stable layout, a3) but leave the roving
  // order — a native-disabled button cannot take focus.
  const enabledIndexes = actions.flatMap((action, index) => (action.enabled ? [index] : []));
  const tabStop = actions[active]?.enabled === true ? active : (enabledIndexes[0] ?? -1);

  const focusIndex = (index: number) => {
    setActive(index);
    buttons.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabledIndexes.length === 0) {
      return;
    }
    // "Forward" is the READING direction, so the horizontal pair mirrors under
    // RTL — the same rule as traversal and the keyboard move actions.
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const at = enabledIndexes.indexOf(tabStop);
    let next: number | undefined;
    if (event.key === forward) {
      next = enabledIndexes[(at + 1) % enabledIndexes.length];
    } else if (event.key === backward) {
      next = enabledIndexes[(at - 1 + enabledIndexes.length) % enabledIndexes.length];
    } else if (event.key === 'Home') {
      next = enabledIndexes[0];
    } else if (event.key === 'End') {
      next = enabledIndexes[enabledIndexes.length - 1];
    }
    if (next !== undefined) {
      // Handled here: the arrows must not scroll the host or reach any canvas
      // keyboard handler behind the bar.
      event.preventDefault();
      event.stopPropagation();
      focusIndex(next);
    }
  };

  const swallowPress = (event: SyntheticEvent) => {
    // The press is the bar's own business: preventDefault keeps focus where it
    // is (activation must not blur the canvas), stopPropagation keeps it out
    // of the canvas selection path.
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="bldr-block-actions"
      role="toolbar"
      aria-label={label}
      {...(enabledIndexes.length === 0 ? { tabIndex: 0 } : {})}
      onKeyDown={onKeyDown}
      onPointerDown={swallowPress}
      onMouseDown={swallowPress}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {actions.map((action, index) => (
        <ChromeButton
          key={action.id}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          className="bldr-block-actions__action"
          /* The id, not the label: what a rule keys on must not be prose. */
          data-action={action.id}
          size="lg"
          variant="quiet"
          disabled={!action.enabled}
          tabIndex={index === tabStop ? 0 : -1}
          onFocus={() => {
            setActive(index);
          }}
          onClick={() => {
            onAction(action.id);
          }}
          /* A hover hint for the pointer, with the keyboard shortcut when the
             action declares one ("Deselect (Esc)"). It is NOT the accessible
             name — the visually-hidden text below is, and it stays the name
             whether or not a platform surfaces `title` at all. */
          title={action.hint === undefined ? action.label : `${action.label} (${action.hint})`}
        >
          {BLOCK_ACTION_ICONS[action.id]}
          {/* The name lives in the DOM, just not on screen: an icon-only bar
              that carries its labels this way keeps one accessible name per
              action and needs no parallel `aria-label` to drift from it. */}
          <span className="bldr-visually-hidden">{action.label}</span>
        </ChromeButton>
      ))}
    </div>
  );
}
