import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import { readRole } from './colors';
import { createCloudSession, type CloudSession } from './gl';
import type { CloudShaderProps } from './schema';

import './CloudShader.css';

/**
 * Soft procedural clouds drifting across a sky.
 *
 * Inspired by Aceternity UI's Cloud Shader. Their source is distributed
 * through `npx shadcn add @aceternity/cloud-shader` rather than published, so
 * nothing here is copied — the shader in `shader.ts` is written from scratch
 * against the same contract. Provenance is recorded in `vendor/VENDOR.md`
 * alongside the components that ARE vendored, because the distinction between
 * "adapted from" and "inspired by" is worth keeping visible.
 *
 * ## Why this block is allowed to run JavaScript
 *
 * Every other effect in this workspace is a CSS keyframe on a `view()`
 * timeline, and a published page downloads nothing to animate. A raymarched
 * cloud field cannot be that, and pretending otherwise would mean shipping a
 * worse effect and calling it the same one. The cost is contained instead:
 * the shader lives in this block, the loop stops when the section is off
 * screen, and a device without WebGL gets a CSS sky that is a real gradient
 * rather than an empty box.
 */
const OCTAVES: Record<CloudShaderProps['detail'], number> = { soft: 3, normal: 5, intricate: 7 };

/* Lower coverage ⇒ more of the sky is cloud. Named steps, not a float in a document. */
const COVERAGE: Record<CloudShaderProps['coverage'], number> = {
  clear: 0.62,
  scattered: 0.45,
  overcast: 0.26,
};

const SPEED: Record<CloudShaderProps['speed'], number> = { still: 0, drifting: 0.5, brisk: 1.4 };

const MIN_HEIGHT_CLASSES: Record<CloudShaderProps['minHeight'], string> = {
  none: '',
  half: 'min-h-[50svh]',
  /*
    `svh`, not `vh`. On a phone `100vh` is the viewport WITHOUT browser chrome,
    so a full-height hero sits partly under the address bar until the user
    scrolls.
  */
  screen: 'min-h-[100svh]',
};

export function CloudShader({ props, slots }: BlockRenderProps<CloudShaderProps>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /*
    Starts true. A canvas that has not proven it can draw is a blank rectangle,
    and the CSS sky underneath it is the honest thing to show until the first
    frame lands — including forever, on a device with no WebGL.
  */
  const [fallback, setFallback] = useState(true);

  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  const { detail, coverage, speed, cloudColor, skyTopColor, skyBottomColor, animate } = props;

  /*
    TWO effects, and the split is load-bearing rather than tidiness.

    A single effect keyed on the props disposed the GL context every time a
    person moved a control — and disposing calls `loseContext()`, after which
    `getContext('webgl2')` on the SAME canvas hands back the lost context and
    every shader compile fails. React's StrictMode double-mount did it on the
    first render in development, so the block initialised and then immediately
    fell back to the CSS sky. Context lifetime belongs to the canvas; uniforms
    belong to the props.
  */
  const sessionRef = useRef<CloudSession | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (host === null || canvas === null) {
      return;
    }

    const session = createCloudSession(canvas);
    if (session === null) {
      setFallback(true);
      return;
    }
    sessionRef.current = session;

    let frame = 0;
    let visible = true;
    let start = 0;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      session.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };

    const render = (now: number) => {
      if (start === 0) {
        start = now;
      }
      elapsedRef.current = (now - start) / 1000;
      session.draw(elapsedRef.current);
      frame = window.requestAnimationFrame(render);
    };

    const stop = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const startLoop = () => {
      if (frame !== 0 || !visible) {
        return;
      }
      /* Rebase, so a resumed loop continues rather than leaps. */
      start = performance.now() - elapsedRef.current * 1000;
      frame = window.requestAnimationFrame(render);
    };

    measure();
    session.draw(0);
    setFallback(false);

    const resizeObserver = new ResizeObserver(() => {
      measure();
      session.draw(elapsedRef.current);
    });
    resizeObserver.observe(host);

    /*
      A shader running behind content the reader has scrolled past is a fan
      spinning for nothing. This is the single biggest reason a background
      effect is or is not acceptable on a real page.
    */
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        startLoop();
      } else {
        stop();
      }
    });
    intersection.observe(host);

    startLoop();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      sessionRef.current = null;
      session.dispose();
    };
  }, []);

  /* Uniforms follow the props, and never touch the context's lifetime. */
  useEffect(() => {
    const host = hostRef.current;
    const session = sessionRef.current;
    if (host === null || session === null) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      session.update({
        octaves: OCTAVES[detail],
        coverage: COVERAGE[coverage],
        speed: animate && !reduced.matches ? SPEED[speed] : 0,
        cloud: readRole(host, cloudColor, [0.98, 0.97, 0.95]),
        skyTop: readRole(host, skyTopColor, [0.22, 0.46, 0.73]),
        skyBottom: readRole(host, skyBottomColor, [0.55, 0.75, 0.91]),
      });
      session.draw(elapsedRef.current);
    };

    apply();
    reduced.addEventListener('change', apply);
    return () => {
      reduced.removeEventListener('change', apply);
    };
  }, [detail, coverage, speed, animate, cloudColor, skyTopColor, skyBottomColor, fallback]);

  return (
    <div
      ref={hostRef}
      className={clsx(
        'acy-cloud',
        'relative flex w-full flex-col justify-center overflow-hidden',
        MIN_HEIGHT_CLASSES[props.minHeight],
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      data-acy-cloud-fallback={fallback ? 'true' : undefined}
      {...motionData}
    >
      {/*
        `aria-hidden` and no tab stop: this is weather, and a reader who cannot
        see it loses nothing by not being told a canvas is present.
      */}
      <canvas ref={canvasRef} className="acy-cloud__canvas" aria-hidden="true" />
      <div className="acy-cloud__content">{slots['default']}</div>
    </div>
  );
}
