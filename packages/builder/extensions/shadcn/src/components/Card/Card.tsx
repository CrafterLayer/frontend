import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { CardProps } from './schema';

/**
 * shadcn/ui's Card, as a builder block.
 *
 * ## What shadcn is, and why "installing" it looks like this
 *
 * shadcn/ui is not a dependency. It is a set of components you copy into your
 * own tree and own outright — which is the same convention this workspace
 * already follows for Aceternity and Magic UI, and the reason there is no
 * `shadcn` package in `package.json`. What ships here is the adaptation.
 *
 * ## What the adaptation changed
 *
 * Upstream's Card is `rounded-xl border bg-card text-card-foreground shadow`.
 * Three of those four resolve through shadcn's OWN theme contract —
 * `--card`, `--card-foreground`, `--border` — which is a second design system
 * living beside this one. A page half in `--card` and half in `--t-surface` is
 * two products in one document.
 *
 * They are re-pointed at `--t-*`: `bg-surface`, `text-text`, `border-accent`.
 * The shape, the spacing rhythm, and the header/content/footer split are kept
 * verbatim, because that is the part worth having.
 *
 * ## Why the parts are SLOTS rather than props
 *
 * A card whose body is a string can hold a sentence. The whole reason a card
 * exists is to hold a heading, a paragraph, an image, and a button — so the
 * three regions take blocks. This is the same defect the Pricing section had
 * before it was split into a container and a card.
 */
const PADDING_CLASSES: Record<CardProps['padding'], string> = {
  none: '',
  compact: 'p-4',
  regular: 'p-6',
  roomy: 'p-8',
};

const RADIUS_CLASSES: Record<CardProps['radius'], string> = {
  none: 'rounded-none',
  small: 'rounded',
  regular: 'rounded-lg',
  large: 'rounded-2xl',
};

const TONE_CLASSES: Record<CardProps['tone'], string> = {
  /* Ground and ink as a PAIR — a card that sets one inherits the other. */
  surface: 'bg-surface text-text',
  inverse: 'bg-surface-inverse text-text-inverse',
  transparent: 'bg-transparent text-inherit',
};

export function Card({ props, slots }: BlockRenderProps<CardProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  const header = slots['header'];
  const footer = slots['footer'];

  return (
    <div
      className={clsx(
        'flex min-w-0 flex-col gap-4',
        TONE_CLASSES[props.tone],
        RADIUS_CLASSES[props.radius],
        PADDING_CLASSES[props.padding],
        props.bordered ? 'border border-accent' : undefined,
        props.elevation === 'none' ? undefined : `shadow-${props.elevation}`,
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      {...motionData}
    >
      {header === undefined ? null : <div className="flex min-w-0 flex-col gap-1">{header}</div>}

      {/*
        `flex-1` on the body, so a row of cards with different amounts of
        content still lines its footers up. Without it a card with two lines
        sits short and the row reads as broken — the same failure
        `items-stretch` fixes one level up.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">{slots['default']}</div>

      {footer === undefined ? null : <div className="flex min-w-0 flex-col gap-2">{footer}</div>}
    </div>
  );
}
