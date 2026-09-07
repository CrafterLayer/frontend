import type { BlockRenderProps } from '@craftkit/builder-schema';

import { ALIGN_CLASSES, cx, sectionContentClasses, sectionShellClasses } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';

import type { PageFooterProps } from './schema';

const BORDER_CLASSES: Record<PageFooterProps['border'], string | undefined> = {
  none: undefined,
  top: 'border-t',
};

/** A two-slot page footer whose children remain fully author-composable. */
export function PageFooter({ props, slots }: BlockRenderProps<PageFooterProps>) {
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const slotClasses = cx(
    'min-w-0',
    props.layout === 'split' ? 'flex flex-wrap justify-between gap-gap' : undefined,
  );

  return (
    <footer
      className={cx(
        sectionShellClasses(props.tone, props.spacing),
        '@container border-0 border-solid border-current/15',
        BORDER_CLASSES[props.border],
        motionClassName,
        props.className,
      )}
      style={sectionColorStyle(props)}
      {...motionData}
    >
      <div
        className={cx(
          sectionContentClasses(props.width, props.align, props.gutter),
          'flex flex-col gap-gap-lg',
          ALIGN_CLASSES[props.align],
        )}
      >
        <div
          className={cx(
            'grid w-full grid-cols-1 gap-10',
            props.layout === 'centered' ? 'justify-items-center text-center' : undefined,
          )}
          data-page-footer-region="body"
        >
          <div className={slotClasses} data-page-footer-slot="default">
            {slots['default']}
          </div>

          {props.bottomBar ? null : (
            <div className={slotClasses} data-page-footer-slot="bottom">
              {slots['bottom']}
            </div>
          )}
        </div>

        {props.bottomBar ? (
          <div
            className="w-full border-t border-current/15 pt-gap"
            data-page-footer-region="bottom"
          >
            <div className={slotClasses} data-page-footer-slot="bottom">
              {slots['bottom']}
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
