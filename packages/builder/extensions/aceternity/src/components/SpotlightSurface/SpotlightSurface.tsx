import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { SpotlightSurfaceProps } from './schema';

import './SpotlightSurface.css';

const TONE_CLASSES: Record<SpotlightSurfaceProps['tone'], string> = {
  light: 'bg-surface text-text',
  dark: 'bg-surface-inverse text-text-inverse',
};

const HEIGHT_CLASSES: Record<SpotlightSurfaceProps['minHeight'], string> = {
  auto: '',
  compact: 'min-h-96',
  viewport: 'min-h-svh',
};

/** A quiet animated spotlight wrapper that follows Builder theme roles. */
export function SpotlightSurface({ props, slots }: BlockRenderProps<SpotlightSurfaceProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  return (
    <div
      className={clsx(
        'ace-spotlight',
        TONE_CLASSES[props.tone],
        HEIGHT_CLASSES[props.minHeight],
        motionClassName,
        props.className,
      )}
      data-spotlight-variant={props.variant}
      data-spotlight-position={props.position}
      data-spotlight-intensity={props.intensity}
      data-spotlight-animate={props.animate ? 'true' : 'false'}
      {...motionData}
    >
      <div className="ace-spotlight__content">{slots['default']}</div>
    </div>
  );
}
