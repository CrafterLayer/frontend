import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudShader } from './CloudShader';
import { parseColor } from './colors';
import { createCloudSession, type CloudSession } from './gl';
import { cloudShaderSchema } from './schema';

vi.mock('./gl', () => ({ createCloudSession: vi.fn() }));

let emitIntersection: (isIntersecting: boolean) => void;
let setDocumentHidden: (hidden: boolean) => void;
let setReducedMotion: (matches: boolean) => void;
let scheduling: ReturnType<typeof installSchedulingEnvironment>;

function installSchedulingEnvironment() {
  let nextFrame = 1;
  let documentHidden = false;
  let reducedMotion = false;
  const frames = new Map<number, FrameRequestCallback>();
  const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  });
  const cancelFrame = vi.fn((id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);

  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => documentHidden);
  setDocumentHidden = (hidden) => {
    documentHidden = hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  const mediaQuery = {
    get matches() {
      return reducedMotion;
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mediaListeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  } as MediaQueryList;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQuery),
  );
  setReducedMotion = (matches) => {
    reducedMotion = matches;
    const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
    for (const listener of mediaListeners) {
      listener(event);
    }
  };

  class TestResizeObserver implements ResizeObserver {
    disconnect = vi.fn();
    observe = vi.fn((_target: Element) => undefined);
    unobserve = vi.fn((_target: Element) => undefined);
  }

  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [0];

    constructor(callback: IntersectionObserverCallback) {
      emitIntersection = (isIntersecting) => {
        callback([{ isIntersecting }] as IntersectionObserverEntry[], this);
      };
    }

    disconnect = vi.fn();
    observe = vi.fn((_target: Element) => undefined);
    takeRecords = () => [];
    unobserve = vi.fn((_target: Element) => undefined);
  }

  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);

  return { cancelFrame, requestFrame };
}

function createSession(): CloudSession {
  return {
    draw: vi.fn(),
    resize: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

beforeEach(() => {
  scheduling = installSchedulingEnvironment();
  vi.mocked(createCloudSession).mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

    expect(container.firstElementChild).toHaveAttribute('data-acy-cloud-min-height', 'screen');
    expect(container.firstElementChild?.className).not.toMatch(/min-h-\[/);
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

  it('schema: accepts the supported primary vocabulary without recursive effects', () => {
    expect(cloudShaderSchema.slots?.['default']?.allow).toEqual(
      expect.arrayContaining([
        'card',
        'badge',
        'shadcnAlert',
        'tabs',
        'separator',
        'avatarGroup',
        'progress',
        'breadcrumbs',
        'dialog',
        'pagination',
        'button',
        'shimmerButton',
      ]),
    );
    expect(cloudShaderSchema.slots?.['default']?.allow).not.toContain('cloudShader');
    expect(cloudShaderSchema.slots?.['default']?.allow).not.toContain('auroraBackground');
    expect(cloudShaderSchema.slots?.['default']?.allow).not.toContain('spotlightSurface');
  });

  describe('render-loop discipline', () => {
    it.each([
      ['animate=false', { animate: false }],
      ["speed='still'", { speed: 'still' }],
    ])('draws one still frame and schedules no RAF for %s', (_case, overrides) => {
      const session = createSession();
      vi.mocked(createCloudSession).mockReturnValue(session);

      renderCloud(overrides);

      expect(session.draw).toHaveBeenCalledTimes(1);
      expect(session.update).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0 }));
      expect(scheduling.requestFrame).not.toHaveBeenCalled();
    });

    it('stops and resumes the RAF when reduced-motion changes', () => {
      const session = createSession();
      vi.mocked(createCloudSession).mockReturnValue(session);

      renderCloud();
      expect(scheduling.requestFrame).toHaveBeenCalledTimes(1);
      expect(session.update).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0.5 }));

      act(() => {
        setReducedMotion(true);
      });
      expect(scheduling.cancelFrame).toHaveBeenCalledTimes(1);
      expect(session.update).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0 }));

      act(() => {
        setReducedMotion(false);
      });
      expect(scheduling.requestFrame).toHaveBeenCalledTimes(2);
      expect(session.update).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0.5 }));
    });

    it('paints one frame without starting the loop when reduced motion is already active', () => {
      const session = createSession();
      vi.mocked(createCloudSession).mockReturnValue(session);
      setReducedMotion(true);

      renderCloud();

      expect(session.draw).toHaveBeenCalledTimes(1);
      expect(session.update).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 0 }));
      expect(scheduling.requestFrame).not.toHaveBeenCalled();
    });

    it('stops offscreen or in a hidden document and resumes only when visible', () => {
      const session = createSession();
      vi.mocked(createCloudSession).mockReturnValue(session);

      renderCloud();
      expect(scheduling.requestFrame).toHaveBeenCalledTimes(1);

      act(() => {
        emitIntersection(false);
      });
      expect(scheduling.cancelFrame).toHaveBeenCalledTimes(1);

      act(() => {
        emitIntersection(true);
      });
      expect(scheduling.requestFrame).toHaveBeenCalledTimes(2);

      act(() => {
        setDocumentHidden(true);
      });
      expect(scheduling.cancelFrame).toHaveBeenCalledTimes(2);

      act(() => {
        setDocumentHidden(false);
      });
      expect(scheduling.requestFrame).toHaveBeenCalledTimes(3);
    });
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
