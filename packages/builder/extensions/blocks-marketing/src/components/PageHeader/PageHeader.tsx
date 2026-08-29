import '../section-layout.css';
import './PageHeader.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { PageHeaderProps } from './schema';

const headerSlotNames = ['start', 'center', 'end'] as const;

/*
  Empty slots are the RENDERER's affordance, not each block's.

  A block used to render its own "drop here" hint when a slot came through
  empty. That stopped being possible the moment the renderer began wrapping
  every slot so the drop resolver could measure it: the slot is now always a
  single wrapper element, never undefined, so the branch could not fire. It also
  should not — one dashed, labelled, measurable box emitted in one place beats
  the same idea re-implemented per block and drifting.
*/

/**
 * A page header whose content belongs entirely to its three slots.
 *
 * `layout` arranges the slot wrappers and never interprets their children.
 * Colour remains the one inline style because a stored role resolves through
 * the active page theme rather than storing a literal colour.
 */
export function PageHeader({ props, slots }: BlockRenderProps<PageHeaderProps>) {
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
    <header className={className} style={sectionColorStyle(props)}>
      <div
        className={`mkt-section__content mkt-section__content--align-${props.align} mkt-section__content--width-${props.width} mkt-header__bar`}
      >
        {headerSlotNames.map((slotName) => {
          const content = slots[slotName];

          return (
            <div key={slotName} className={`mkt-header__slot mkt-header__slot--${slotName}`}>
              {content}
            </div>
          );
        })}
      </div>
    </header>
  );
}
