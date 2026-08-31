import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CloudShader } from './CloudShader';
import { parseColor } from './colors';
import { cloudShaderSchema } from './schema';

afterEach(cleanup);

const node = { id: 'cloud-1', type: 'cloudShader', props: {} };

function renderCloud(overrides: Record<string, unknown> = {}) {
  return render(
    <CloudShader
      node={node}
      props={cloudShaderSchema.props.parse(overrides)}
      slots={{ default: <p>Above the weather</p> }}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('CloudShader', () => {
  /*
    jsdom implements no WebGL at all, which makes it the exact environment the
    fallback exists for — a real one, not a simulated one. This asserts the
    behaviour a person on a blocklisted driver gets.
  */
  it('degrades to the CSS sky where WebGL is unavailable, and still shows its content', () => {
    const { container } = renderCloud();
    const host = container.firstElementChild;

    expect(host).toHaveAttribute('data-acy-cloud-fallback', 'true');
    expect(screen.getByText('Above the weather')).toBeInTheDocument();
  });

  it('keeps the canvas out of the accessibility tree', () => {
    const { container } = renderCloud();
    const canvas = container.querySelector('canvas');

    /* Weather is not something a screen reader needs announced. */
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the requested minimum height, so an empty sky is still a sky', () => {
    const { container } = renderCloud({ minHeight: 'screen' });

    expect(container.firstElementChild).toHaveClass('min-h-[100svh]');
  });

  it('defaults to a visible band rather than collapsing', () => {
    /*
      The default that matters most: a freshly inserted block whose slot is
      empty has no content to take its height from, and `none` made it a strip
      with a placeholder in it. A person adds the block and concludes it is
      broken.
    */
    expect(cloudShaderSchema.props.parse({}).minHeight).toBe('half');
  });

  it('passes the block className through, last, so a caller wins', () => {
    const { container } = renderCloud({ className: 'rounded-lg' });

    expect(container.firstElementChild).toHaveClass('rounded-lg');
  });

  /*
    The whole reason `colors.ts` exists. Upstream takes `skyTopColor="#3876ba"`
    — a literal, in a prop, which in a document is a sky the design system can
    never move.
  */
  it('schema: stores colour ROLES, never colour values', () => {
    expect(cloudShaderSchema.props.safeParse({ skyTopColor: 'accent' }).success).toBe(true);
    expect(cloudShaderSchema.props.safeParse({ skyTopColor: '#3876ba' }).success).toBe(false);
    expect(cloudShaderSchema.props.parse({}).skyTopColor).toBe('accent');
  });

  it('schema: refuses a class the design system cannot reach', () => {
    expect(cloudShaderSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(false);
    expect(cloudShaderSchema.props.safeParse({ className: 'lg:rounded-xl' }).success).toBe(true);
  });

  describe('parseColor', () => {
    const fallback = [0, 0, 0] as const;

    it('reads the two forms a theme actually emits', () => {
      expect(parseColor('#4f46e5', fallback)).toEqual([79 / 255, 70 / 255, 229 / 255]);
      expect(parseColor('#fff', fallback)).toEqual([1, 1, 1]);
      expect(parseColor('rgb(17, 24, 39)', fallback)).toEqual([17 / 255, 24 / 255, 39 / 255]);
      expect(parseColor('rgba(17 24 39 / 50%)', fallback)).toEqual([17 / 255, 24 / 255, 39 / 255]);
    });

    it('falls back rather than yielding a black sky on an unparsed form', () => {
      /*
        A silent black sky reads as a bug in the shader, which is the wrong
        place to go looking. The neutral is visibly not-the-theme instead.
      */
      expect(parseColor('oklch(0.7 0.1 200)', fallback)).toEqual(fallback);
      expect(parseColor('', fallback)).toEqual(fallback);
    });
  });
});
