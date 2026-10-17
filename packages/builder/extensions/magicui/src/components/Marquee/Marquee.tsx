import { useState } from 'react';
import { clsx } from 'clsx';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import { MarqueeTrack } from '../MarqueeTrack';

import { marqueeSchema, type MarqueeProps } from './schema';

import './Marquee.css';

const SPEED_DURATION: Record<MarqueeProps['speed'], string> = {
  slow: '44s',
  normal: '28s',
  fast: '16s',
};

const TONE_CLASSES: Record<MarqueeProps['tone'], string> = {
  transparent: 'bg-transparent text-inherit',
  surface: 'bg-surface text-text',
  inverse: 'bg-surface-inverse text-text-inverse',
};

/** A seamless semantic marquee whose duplicate track is hidden from assistive technology. */
export function Marquee({ node, props, isCanvas }: BlockRenderProps<MarqueeProps>) {
  const [paused, setPaused] = useState(false);
  /* Each inner element is a part: addressable on the canvas, stylable per part. */
  const part = blockPartProps({ node, props, isCanvas }, marqueeSchema.parts);
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const secondaryDirection = props.direction === 'forward' ? 'reverse' : 'forward';

  return (
    <section
      className={clsx(
        'mgc-marquee',
        TONE_CLASSES[props.tone],
        props.edgeFade ? 'mgc-marquee--fade' : undefined,
        props.pauseOnHover ? 'mgc-marquee--pause' : undefined,
        paused ? 'mgc-marquee--paused' : undefined,
        motionClassName,
        props.className,
      )}
      style={{ ['--mgc-marquee-duration' as string]: SPEED_DURATION[props.speed] }}
      aria-label={props.label}
      data-marquee-presentation={props.presentation}
      data-marquee-state={paused ? 'paused' : 'running'}
      {...motionData}
    >
      <button
        type="button"
        className="self-end rounded-full border border-text/20 bg-surface px-3 py-2 text-sm font-medium text-text shadow-soft focus-visible:outline focus-visible:outline-accent"
        aria-pressed={paused}
        onClick={() => {
          setPaused((current) => !current);
        }}
        data-marquee-pause-control=""
      >
        {/*
          Both labels stay rendered, one hidden, so each is a part the canvas
          can reach whichever state the button is in.
        */}
        <span {...part('pauseLabel')} hidden={paused}>
          {props.pauseLabel}
        </span>
        <span {...part('resumeLabel')} hidden={!paused}>
          {props.resumeLabel}
        </span>
      </button>
      <MarqueeTrack
        items={props.items}
        presentation={props.presentation}
        radius={props.radius}
        direction={props.direction}
        isCanvas={isCanvas}
        part={part}
      />
      {props.rows === 'two' ? (
        <MarqueeTrack
          items={props.items}
          presentation={props.presentation}
          radius={props.radius}
          direction={secondaryDirection}
          secondary
          isCanvas={isCanvas}
          part={part}
        />
      ) : null}
    </section>
  );
}
