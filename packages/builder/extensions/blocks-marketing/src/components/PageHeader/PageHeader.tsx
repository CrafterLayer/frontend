import type { BlockRenderProps } from '@craftkit/builder-schema';

import { cx, sectionContentClasses, sectionShellClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';

import type { PageHeaderProps } from './schema';

const headerSlotNames = ['start', 'center', 'end'] as const;
type HeaderSlotName = (typeof headerSlotNames)[number];

const DENSITY_CLASSES: Record<PageHeaderProps['density'], string> = {
  compact: 'min-h-bar-compact',
  regular: 'min-h-bar-regular',
  tall: 'min-h-bar-tall',
};

const BORDER_CLASSES: Record<PageHeaderProps['border'], string | undefined> = {
  none: undefined,
  bottom: 'border-b',
};

const SHADOW_CLASSES: Record<PageHeaderProps['shadow'], string | undefined> = {
  none: undefined,
  soft: 'shadow-soft',
  strong: 'shadow-strong',
};

function slotLayoutClasses(layout: PageHeaderProps['layout'], slotName: HeaderSlotName): string {
  if (layout === 'stacked') return 'basis-full justify-center';
  if (layout === 'split' && slotName === 'center') return 'ms-auto';
  if (layout === 'split' && slotName === 'end') return 'ms-gap-lg';
  if (layout === 'navStart' && slotName === 'center') return 'ms-gap-lg';
  if (layout === 'navStart' && slotName === 'end') return 'ms-auto';
  return '';
}

/**
 * A page header whose content belongs entirely to its three slots.
 *
 * `layout` arranges the slot wrappers and never interprets their children.
 * Colour remains the one inline style because a stored role resolves through
 * the active page theme rather than storing a literal colour.
 */
export function PageHeader({ props, slots }: BlockRenderProps<PageHeaderProps>) {
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const centered = props.layout === 'centered' || props.layout === 'stacked';

  return (
    <header
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        'isolate border-0 border-solid border-current/15 transition duration-200',
        BORDER_CLASSES[props.border],
        SHADOW_CLASSES[props.shadow],
        props.sticky ? 'sticky top-0 z-20' : undefined,
        props.sticky && props.translucent
          ? 'bg-current/5 backdrop-blur-md backdrop-saturate-150'
          : undefined,
        motionClassName,
        props.className,
      )}
      {...motionData}
      style={sectionColorStyle(props)}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-wrap items-center gap-gap @container',
          DENSITY_CLASSES[props.density],
          centered ? 'justify-center' : undefined,
          props.layout === 'stacked' ? 'text-center' : undefined,
        )}
      >
        {headerSlotNames.map((slotName) => (
          <div
            key={slotName}
            className={cx('flex min-w-0 items-center', slotLayoutClasses(props.layout, slotName))}
            data-page-header-slot={slotName}
          >
            {slots[slotName]}
          </div>
        ))}
      </div>
    </header>
  );
}
