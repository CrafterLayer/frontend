import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { videoSectionSchema, type VideoSectionProps } from './schema';
import { VideoSection } from './VideoSection';

/*
  Block parts (DESIGN §4.3): the introduction, the caption and the call to
  action are addressable on the canvas, carry nothing extra when published,
  take classes and direction from `partStyles`, and render an inline editor
  swapped in at its bind exactly once. The video reads the heading through
  aria-labelledby when it has no label of its own.
*/
const node: Node = { id: 'video-parts', type: 'videoSection', props: {} };

const FULL = {
  eyebrow: 'Product film',
  heading: 'See the workflow in motion.',
  body: 'A two-minute walkthrough.',
  src: '/media/workflow.mp4',
  caption: 'Recorded on the live product.',
  cta: { label: 'Explore the workflow', href: '#workflow' },
};

type Swap = (props: VideoSectionProps) => VideoSectionProps;

function renderVideo(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = videoSectionSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(
    <VideoSection node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('VideoSection parts', () => {
  it('stamps the introduction, caption and call to action on the canvas', () => {
    const { container } = renderVideo({}, true);
    for (const name of ['eyebrow', 'heading', 'body', 'caption']) {
      expect(partsNamed(container, name)[0], name).toHaveAttribute('data-ck-bind', name);
    }
    const cta = partsNamed(container, 'cta')[0];
    expect(cta?.tagName).toBe('A');
    expect(cta).toHaveAttribute('data-ck-bind', 'cta.label');
  });

  it('publishes no part markers and names the video by the heading', () => {
    const { container } = renderVideo({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    const video = container.querySelector('video');
    expect(video).toHaveAccessibleName('See the workflow in motion.');
    expect(video).not.toHaveAttribute('aria-label');
  });

  it('applies part styles and direction to exactly their element', () => {
    const { container } = renderVideo(
      {
        partStyles: {
          caption: { className: 'ps-4', dir: 'ltr' },
          cta: { className: 'pe-2' },
        },
      },
      true,
    );
    expect(partsNamed(container, 'caption')[0]).toHaveClass('ps-4', 'text-sm');
    expect(partsNamed(container, 'caption')[0]).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'cta')[0]).toHaveClass('pe-2', 'bg-accent');
    expect(partsNamed(container, 'body')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves the media to the page', () => {
    const { container } = renderVideo({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('a')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('figure')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderVideo({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      caption: swapped('caption'),
      ...(props.cta === undefined ? {} : { cta: { ...props.cta, label: swapped('cta.label') } }),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'caption', 'cta.label']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
