import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { ShadcnAlertProps } from './schema';

/**
 * shadcn/ui's Alert, re-pointed at this project's tokens.
 *
 * ## Why the type is not only a colour
 *
 * Upstream ships `default` and `destructive`, and the difference between them
 * is a text colour. That is a message a colour-blind reader receives as "a
 * message" — the severity, the single most important thing about an alert,
 * arrives through the one channel some people do not have.
 *
 * So `attention` and `critical` also change the ROLE the element reports:
 * a critical alert is `role="alert"` and announces itself, an informational
 * one is `role="status"` and waits its turn. The colour is the third signal,
 * after the icon and the live-region politeness.
 *
 * ## Why the body is a slot
 *
 * The same argument the Card makes. An alert whose body is a string can hold a
 * sentence; a real one holds a sentence and a link to the thing that fixes it.
 */
const VARIANT_CLASSES: Record<ShadcnAlertProps['variant'], string> = {
  info: 'border-accent text-text',
  attention: 'border-success text-text',
  critical: 'border-accent bg-accent text-accent-text',
};

/*
  Text, not a coloured dot. An icon font is a dependency and an SVG sprite is
  an asset; a glyph is neither, and it is announced correctly when it carries
  a label rather than being hidden.
*/
const VARIANT_GLYPH: Record<ShadcnAlertProps['variant'], string> = {
  info: 'i',
  attention: '!',
  critical: '!',
};

export function ShadcnAlert({ props, slots }: BlockRenderProps<ShadcnAlertProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  /*
    `alert` interrupts; `status` waits for a pause. Getting this backwards is
    how a page ends up shouting a hint over whatever the reader was doing.
  */
  const live = props.variant === 'critical' ? 'alert' : 'status';

  return (
    <div
      role={live}
      className={clsx(
        'flex min-w-0 items-start gap-3 rounded-lg border p-4',
        VARIANT_CLASSES[props.variant],
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      {...motionData}
    >
      <span
        className="flex size-6 flex-none items-center justify-center rounded-full border border-current text-sm font-bold"
        aria-hidden="true"
      >
        {VARIANT_GLYPH[props.variant]}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{props.title}</p>
        <div className="flex min-w-0 flex-col gap-2 text-sm">{slots['default']}</div>
      </div>
    </div>
  );
}
