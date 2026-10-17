import type { ReactNode } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { clsx } from 'clsx';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import { avatarGroupSchema, type AvatarGroupProps } from './schema';

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

/* A value repeated in an attribute is a plain-string copy, absent while edited in place. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/*
  The shown initials: the stored ones, upper-cased, else derived from the name.
  While either is edited in place it is an editor element, not text: a stored
  value is then rendered as is, and a name being edited derives nothing.
*/
function initialsFor(person: AvatarGroupProps['people'][number]): ReactNode {
  const initials: unknown = person.initials;
  const name: unknown = person.name;
  if (initials !== undefined) {
    return typeof initials === 'string' ? initials.toLocaleUpperCase() : person.initials;
  }
  if (typeof name !== 'string') return '';

  const words = name.trim().split(/\s+/);
  const first = words[0]?.slice(0, 1) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.slice(0, 1) ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase();
}

/** A logical-direction avatar stack with resilient fallbacks and an accessible overflow count. */
export function AvatarGroup({ node, props, isCanvas }: BlockRenderProps<AvatarGroupProps>) {
  const visiblePeople = props.people.slice(0, props.maxVisible);
  const hiddenCount = props.people.length - visiblePeople.length;
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, avatarGroupSchema.parts);

  return (
    <ul
      {...part('people', {
        className: clsx(
          'm-0 flex min-w-0 list-none items-center p-0',
          ALIGN_CLASSES[props.align],
          motionClassName,
          props.className,
        ),
      })}
      aria-label={props.groupLabel}
      {...motionData}
    >
      {visiblePeople.map((person, index) => {
        const at = [index];
        /*
          The avatar is named by the person's name (aria-labelledby), which
          renders once, hidden: a name copied into an attribute would read
          "[object Object]" while it is edited in place.
        */
        const nameId = `${node.id}-person-${String(index)}-name`;
        const rootClassName = clsx(
          'relative flex shrink-0 items-center justify-center overflow-hidden font-semibold ring-2 ring-surface',
          SIZE_CLASSES[props.size],
          SHAPE_CLASSES[props.shape],
          TONE_CLASSES[props.tone],
        );
        const fallbackClassName =
          'flex h-full w-full items-center justify-center bg-inherit text-inherit';
        return (
          /* Keyed by position: a bound value may be an inline editor element. */
          <li
            key={index}
            {...part('person', {
              index: at,
              className: clsx('relative shrink-0 first:ms-0', OVERLAP_CLASSES[props.overlap]),
            })}
            aria-labelledby={nameId}
            title={textOf(person.name)}
          >
            {/* The frame is the image part while a portrait is stored: replacing it opens the asset picker. */}
            <AvatarPrimitive.Root
              {...(person.imageSrc === undefined
                ? { className: rootClassName }
                : part('person.image', { index: at, className: rootClassName }))}
            >
              {person.imageSrc === undefined ? null : (
                <AvatarPrimitive.Image
                  className="h-full w-full object-cover"
                  src={person.imageSrc}
                  alt=""
                />
              )}
              {/*
              Only stored initials are a part; initials derived from the name
              are decoration. No `delayMs`: with one, Radix mounts the
              fallback only after a timer, so the first render (the published
              HTML, and the canvas the inline editor swaps into) had no
              initials at all.
            */}
              <AvatarPrimitive.Fallback
                {...(person.initials === undefined
                  ? { className: fallbackClassName }
                  : part('person.initials', { index: at, className: fallbackClassName }))}
                aria-hidden="true"
              >
                {initialsFor(person)}
              </AvatarPrimitive.Fallback>
            </AvatarPrimitive.Root>
            <span hidden {...part('person.name', { index: at, id: nameId })}>
              {person.name}
            </span>
          </li>
        );
      })}

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
