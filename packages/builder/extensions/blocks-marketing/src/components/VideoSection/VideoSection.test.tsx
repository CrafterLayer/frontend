import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { videoSectionExamples } from './examples';
import { videoSectionSchema, type VideoSectionProps } from './schema';
import { VideoSection } from './VideoSection';

const node: Node = { id: 'video-section-test', type: 'videoSection', props: {} };

function renderVideoSection(props: VideoSectionProps, isCanvas = false) {
  return render(
    <VideoSection node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

describe('VideoSection', () => {
  it('renders native video controls, a safe poster, and a captions track', () => {
    const { container } = renderVideoSection(
      videoSectionSchema.props.parse({
        heading: 'Watch the workflow',
        src: '/media/workflow.mp4',
        poster: '/images/workflow-poster.jpg',
        videoLabel: 'Workflow demonstration',
        captionsSrc: '/media/workflow-en.vtt',
        captionsLanguage: 'en',
        captionsLabel: 'English captions',
        caption: 'A two-minute product walkthrough.',
      }),
    );

    const video = screen.getByLabelText('Workflow demonstration');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', '/media/workflow.mp4');
    expect(video).toHaveAttribute('poster', '/images/workflow-poster.jpg');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(container.querySelector('iframe')).not.toBeInTheDocument();

    const track = container.querySelector('track');
    expect(track).toHaveAttribute('kind', 'captions');
    expect(track).toHaveAttribute('src', '/media/workflow-en.vtt');
    expect(track).toHaveAttribute('srclang', 'en');
    expect(track).toHaveAttribute('label', 'English captions');
    expect(track).toHaveAttribute('default');
    expect(screen.getByText('A two-minute product walkthrough.')).toBeVisible();
  });

  it('uses the visible heading as the video name when no explicit label is supplied', () => {
    const { container } = renderVideoSection(
      videoSectionSchema.props.parse({
        heading: 'A named product film',
        src: '/media/product.mp4',
      }),
    );

    expect(container.querySelector('video')).toHaveAccessibleName('A named product film');
    expect(container.querySelector('video')).toHaveAttribute('controls');
  });

  it('shows setup and captions guidance on canvas only', () => {
    const emptyProps = videoSectionSchema.props.parse({ heading: 'Canvas video' });
    const { container, rerender } = renderVideoSection(emptyProps, true);

    expect(screen.getByRole('status')).toHaveTextContent('Add a safe video URL.');
    rerender(<VideoSection node={node} props={emptyProps} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('[data-video-section-media]')).not.toBeInTheDocument();

    const sourceProps = videoSectionSchema.props.parse({
      heading: 'Needs captions',
      src: '/media/spoken.mp4',
    });
    rerender(<VideoSection node={node} props={sourceProps} slots={{}} data={{}} isCanvas={true} />);
    expect(
      screen.getByText('Add a captions track for video with speech or meaningful sound.'),
    ).toBeVisible();
  });

  it('renders a safe CTA and responsive split media order', () => {
    const { container } = renderVideoSection(
      videoSectionSchema.props.parse({
        heading: 'Film and action',
        src: '/media/film.mp4',
        layout: 'split',
        mediaPosition: 'start',
        cta: { label: 'View the case study', href: '/case-study', newTab: true },
      }),
    );

    expect(screen.getByRole('link', { name: /View the case study/ })).toHaveAttribute(
      'href',
      '/case-study',
    );
    expect(screen.getByRole('link', { name: /View the case study/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(container.querySelector('[data-video-section-layout]')).toHaveClass(
      'grid',
      '@lg:grid-cols-2',
    );
    expect(container.querySelector('[data-video-section-media]')).toHaveClass('@lg:order-first');
  });

  it('preserves the CTA anchor but prevents navigation on the builder canvas', () => {
    renderVideoSection(
      videoSectionSchema.props.parse({
        heading: 'Canvas video action',
        cta: { label: 'View the case study', href: '/case-study' },
      }),
      true,
    );

    const action = screen.getByRole('link', { name: /View the case study/ });
    expect(action).toHaveAttribute('href', '/case-study');
    expect(fireEvent.click(action)).toBe(false);
  });

  it('collapses the published split layout when no media is configured', () => {
    const { container } = renderVideoSection(
      videoSectionSchema.props.parse({ heading: 'Copy-only video section', layout: 'split' }),
    );

    expect(container.querySelector('[data-video-section-layout]')).toHaveClass(
      'grid',
      '@lg:grid-cols-1',
    );
    expect(container.querySelector('[data-video-section-layout]')).not.toHaveClass(
      '@lg:grid-cols-2',
    );
  });

  it('applies shared token roles, typography, spacing, and custom utilities', () => {
    renderVideoSection(
      videoSectionSchema.props.parse({
        heading: 'Styled video',
        background: 'surfaceInverse',
        textColor: 'textInverse',
        fontWeight: 'bold',
        paddingBlockStart: 4,
        className: 'isolate',
      }),
    );

    const section = screen.getByRole('region', { name: 'Styled video' });
    expect(section).toHaveClass('mkt-type--weight-bold', 'isolate');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-text-inverse)');
    expect(section.style.paddingBlockStart).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });

  it('keeps optional fields unset and rejects every unsafe URL surface', () => {
    const props = videoSectionSchema.props.parse({});
    const optionalKeys = [
      'eyebrow',
      'body',
      'src',
      'poster',
      'videoLabel',
      'caption',
      'captionsSrc',
      'captionsLanguage',
      'captionsLabel',
      'cta',
      ...Object.keys(sectionColorProps),
      ...Object.keys(sectionMotionProps),
      ...Object.keys(sectionCustomProps),
      ...Object.keys(sectionTypographyProps),
      ...Object.keys(sectionSpacingProps),
    ];

    for (const key of optionalKeys) {
      expect(videoSectionSchema.props.shape, key).toHaveProperty(key);
      expect(props, `${key} must not be defaulted`).not.toHaveProperty(key);
      expect(Object.hasOwn(videoSectionSchema.propertyGroups ?? {}, key)).toBe(true);
    }

    expect(props).toMatchObject({
      layout: 'split',
      mediaPosition: 'end',
      videoFit: 'cover',
      preload: 'metadata',
      muted: false,
      loop: false,
    });
    expect(videoSectionSchema.props.safeParse({ src: 'javascript:alert(1)' }).success).toBe(false);
    expect(videoSectionSchema.props.safeParse({ poster: 'data:text/html,unsafe' }).success).toBe(
      false,
    );
    expect(videoSectionSchema.props.safeParse({ captionsSrc: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(
      videoSectionSchema.props.safeParse({
        cta: { label: 'Unsafe', href: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
    expect(videoSectionSchema.props.safeParse({ src: '//evil.example/video.mp4' }).success).toBe(
      false,
    );
    expect(videoSectionSchema.props.safeParse({ src: '/\\evil.example/video.mp4' }).success).toBe(
      false,
    );
    expect(
      videoSectionSchema.props.safeParse({ poster: '//evil.example/poster.jpg' }).success,
    ).toBe(false);
    expect(
      videoSectionSchema.props.safeParse({ poster: '/\\evil.example/poster.jpg' }).success,
    ).toBe(false);
    expect(
      videoSectionSchema.props.safeParse({ captionsSrc: '//evil.example/captions.vtt' }).success,
    ).toBe(false);
    expect(
      videoSectionSchema.props.safeParse({ captionsSrc: '/\\evil.example/captions.vtt' }).success,
    ).toBe(false);
    expect(
      videoSectionSchema.props.safeParse({
        cta: { label: 'Unsafe', href: '//evil.example/path' },
      }).success,
    ).toBe(false);
    expect(
      videoSectionSchema.props.safeParse({
        cta: { label: 'Unsafe', href: '/\\evil.example/path' },
      }).success,
    ).toBe(false);
  });

  it('declares every inspector group and bilingual examples', () => {
    expect(videoSectionSchema.propertyGroups).toEqual(
      expect.objectContaining({
        heading: { tab: 'content', section: 'Introduction' },
        src: { tab: 'content', section: 'Video' },
        layout: { tab: 'design', section: 'Layout' },
        preload: { tab: 'advanced', section: 'Playback' },
        ...sectionColorGroups,
        ...sectionMotionGroups,
        ...sectionCustomGroups,
        ...sectionTypographyGroups,
        ...sectionSpacingGroups,
      }),
    );
    expect(videoSectionExamples.some(({ prompt }) => /[\u0600-\u06ff]/u.test(prompt))).toBe(true);
    expect(videoSectionExamples.some(({ prompt }) => /[a-z]/iu.test(prompt))).toBe(true);
  });
});
