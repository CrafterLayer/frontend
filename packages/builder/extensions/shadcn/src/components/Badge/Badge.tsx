import { clsx } from 'clsx';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { badgeSchema, type BadgeProps } from './schema';

/**
 * shadcn/ui's Badge, re-pointed at this project's tokens.
 *
 * Upstream's variants read `bg-primary text-primary-foreground`,
 * `bg-destructive …`, `border text-foreground` — shadcn's own theme contract.
 * Adopted as-is they would install a SECOND design system beside `--t-*`, and
 * a page half in each is two products in one document. The variants below are
 * the same four ideas expressed in roles this site can actually re-point.
 */
const VARIANT_CLASSES: Record<BadgeProps['variant'], string> = {
  /* Ground and ink together, always — a badge is small and contrast is where it fails. */
  accent: 'bg-accent text-accent-text',
  success: 'bg-success text-success-text',
  neutral: 'bg-surface-inverse text-text-inverse',
  outline: 'border border-accent text-accent',
};

const SIZE_CLASSES: Record<BadgeProps['size'], string> = {
  small: 'px-2 py-0 text-xs',
  regular: 'px-3 py-1 text-sm',
};

export function Badge({ node, props, isCanvas }: BlockRenderProps<BadgeProps>) {
  const part = blockPartProps({ node, props, isCanvas }, badgeSchema.parts);
  return (
    <span
      {...part('label', {
        className: clsx(
          'inline-flex min-w-0 items-center gap-1 rounded-full font-medium',
          VARIANT_CLASSES[props.variant],
          SIZE_CLASSES[props.size],
          /* The document's own utilities go LAST, so a caller wins a conflict. */
          props.className,
        ),
      })}
    >
      {props.label}
    </span>
  );
}
