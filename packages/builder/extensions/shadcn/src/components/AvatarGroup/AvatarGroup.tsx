import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { AvatarGroupProps } from './schema';

const SIZE_CLASSES: Record<AvatarGroupProps['size'], string> = {
  small: 'size-8 text-xs',
  medium: 'size-10 text-sm',
  large: 'size-14 text-base',
};

const OVERLAP_CLASSES: Record<AvatarGroupProps['overlap'], string> = {
  none: 'ms-0',
  subtle: '-ms-2',
  medium: '-ms-3',
  strong: '-ms-4',
};

const SHAPE_CLASSES: Record<AvatarGroupProps['shape'], string> = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
};

const TONE_CLASSES: Record<AvatarGroupProps['tone'], string> = {
  accent: 'bg-accent text-accent-text',
  neutral: 'border border-text/10 bg-surface text-text',
  inverse: 'bg-surface-inverse text-text-inverse',
};

const ALIGN_CLASSES: Record<AvatarGroupProps['align'], string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

function initialsFor(person: AvatarGroupProps['people'][number]): string {
  if (person.initials !== undefined) return person.initials.toLocaleUpperCase();

  const words = person.name.trim().split(/\s+/);
  const first = words[0]?.slice(0, 1) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.slice(0, 1) ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase();
}

/** A logical-direction avatar stack with resilient fallbacks and an accessible overflow count. */
export function AvatarGroup({ props }: BlockRenderProps<AvatarGroupProps>) {
  const visiblePeople = props.people.slice(0, props.maxVisible);
  const hiddenCount = props.people.length - visiblePeople.length;
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  return (
    <ul
      className={clsx(
        'm-0 flex min-w-0 list-none items-center p-0',
        ALIGN_CLASSES[props.align],
        motionClassName,
        props.className,
      )}
      aria-label={props.groupLabel}
      {...motionData}
    >
      {visiblePeople.map((person, index) => (
        <li
          key={`${person.name}-${String(index)}`}
          className={clsx('relative shrink-0 first:ms-0', OVERLAP_CLASSES[props.overlap])}
          aria-label={person.name}
          title={person.name}
        >
          <AvatarPrimitive.Root
            className={clsx(
              'relative flex shrink-0 items-center justify-center overflow-hidden font-semibold ring-2 ring-surface',
              SIZE_CLASSES[props.size],
              SHAPE_CLASSES[props.shape],
              TONE_CLASSES[props.tone],
            )}
          >
            {person.imageSrc === undefined ? null : (
              <AvatarPrimitive.Image
                className="h-full w-full object-cover"
                src={person.imageSrc}
                alt=""
              />
            )}
            <AvatarPrimitive.Fallback
              className="flex h-full w-full items-center justify-center bg-inherit text-inherit"
              delayMs={0}
              aria-hidden="true"
            >
              {initialsFor(person)}
            </AvatarPrimitive.Fallback>
          </AvatarPrimitive.Root>
        </li>
      ))}

      {hiddenCount <= 0 ? null : (
        <li
          className={clsx(
            'relative flex shrink-0 items-center justify-center font-semibold ring-2 ring-surface first:ms-0',
            OVERLAP_CLASSES[props.overlap],
            SIZE_CLASSES[props.size],
            SHAPE_CLASSES[props.shape],
            TONE_CLASSES[props.tone],
          )}
          aria-label={`${props.overflowLabel} ${String(hiddenCount)}`}
          data-avatar-overflow=""
        >
          <span aria-hidden="true">+{hiddenCount}</span>
        </li>
      )}
    </ul>
  );
}
