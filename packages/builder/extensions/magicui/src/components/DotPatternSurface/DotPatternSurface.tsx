import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { DotPatternSurfaceProps } from './schema';

import './DotPatternSurface.css';

const DENSITY_GAP: Record<DotPatternSurfaceProps['density'], string> = {
  sparse: 'calc(var(--t-space-unit, 4px) * 8)',
  balanced: 'calc(var(--t-space-unit, 4px) * 5)',
  dense: 'calc(var(--t-space-unit, 4px) * 3)',
};

const DOT_SIZE: Record<DotPatternSurfaceProps['size'], string> = {
  fine: 'var(--t-border-width, 1px)',
  regular: 'calc(var(--t-border-width, 1px) * 2)',
  bold: 'calc(var(--t-border-width, 1px) * 3)',
};

const INTENSITY_OPACITY: Record<DotPatternSurfaceProps['intensity'], string> = {
  subtle: '0.12',
  balanced: '0.22',
  strong: '0.36',
};

const TONE_COLOR: Record<DotPatternSurfaceProps['tone'], string> = {
  muted: 'var(--t-text-muted)',
  accent: 'var(--t-accent)',
  inverse: 'var(--t-text-inverse)',
};

const PADDING_CLASSES: Record<DotPatternSurfaceProps['padding'], string> = {
  none: 'p-0',
  compact: 'p-4',
  regular: 'p-6',
  roomy: 'p-10',
};

const RADIUS_CLASSES: Record<DotPatternSurfaceProps['radius'], string> = {
  none: 'rounded-none',
  regular: 'rounded-base',
  large: 'rounded-xl',
};

/** A compositional surface with a decorative, token-derived dot field behind its slot. */
export function DotPatternSurface({ props, slots }: BlockRenderProps<DotPatternSurfaceProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  return (
    <div
      className={clsx(
        'mgc-dot-surface',
        'min-w-0',
        PADDING_CLASSES[props.padding],
        RADIUS_CLASSES[props.radius],
        motionClassName,
        props.className,
      )}
      style={{
        ['--mgc-dot-gap' as string]: DENSITY_GAP[props.density],
        ['--mgc-dot-size' as string]: DOT_SIZE[props.size],
        ['--mgc-dot-opacity' as string]: INTENSITY_OPACITY[props.intensity],
        ['--mgc-dot-color' as string]: TONE_COLOR[props.tone],
        ['--mgc-dot-play' as string]: props.animate ? 'running' : 'paused',
      }}
      data-dot-fade={props.fade}
      data-dot-mask={props.maskPosition}
      data-dot-animate={props.animate ? 'true' : 'false'}
      {...motionData}
    >
      <div className="mgc-dot-surface__content">{slots['default']}</div>
    </div>
  );
}
