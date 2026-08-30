import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionCustomGroups } from '../section-custom';
import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { Image } from './Image';
import { imageExamples } from './examples';
import { imageSchema, type ImageProps } from './schema';

const SOURCE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"%3E%3Crect width="320" height="180" fill="%234f46e5"/%3E%3C/svg%3E';
const node: Node = { id: 'image-test', type: 'image', props: {} };

function renderImage(props: ImageProps, isCanvas: boolean) {
  return render(<Image node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

describe('Image', () => {
  it('decorative images force an empty alt and stay out of the accessible image tree', () => {
    const { container } = renderImage(
      imageSchema.props.parse({
        src: SOURCE,
        alt: 'This must not be announced',
        decorative: true,
      }),
      true,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('decorative images never show the missing-alt canvas warning', () => {
    const { container } = renderImage(
      imageSchema.props.parse({ src: SOURCE, alt: '', decorative: true }),
      true,
    );

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByText('This image needs alt text.')).not.toBeInTheDocument();
  });

  it('missing alt text warns on canvas only', () => {
    const props = imageSchema.props.parse({ src: SOURCE, alt: '', decorative: false });
    const { container, rerender } = renderImage(props, true);

    expect(screen.getByText('This image needs alt text.')).toBeVisible();
    expect(container.querySelector('img')).toHaveAttribute('src', SOURCE);

    rerender(<Image node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.queryByText('This image needs alt text.')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', SOURCE);
  });

  it('missing src shows a canvas placeholder and renders nothing in preview', () => {
    const props = imageSchema.props.parse({});
    const { container, rerender } = renderImage(props, true);

    expect(screen.getByText('Add an image URL.')).toBeVisible();
    expect(container.querySelector('.mkt-image')).not.toHaveAttribute('style');

    rerender(<Image node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fit, ratio, and radius values apply their modifier classes', () => {
    const base = imageSchema.props.parse({ src: SOURCE, alt: 'Product image' });
    const { rerender } = renderImage(base, false);

    for (const fit of ['cover', 'contain', 'fill'] as const) {
      rerender(
        <Image node={node} props={{ ...base, fit }} slots={{}} data={{}} isCanvas={false} />,
      );
      expect(screen.getByRole('img', { name: 'Product image' }).closest('.mkt-image')).toHaveClass(
        `mkt-image--fit-${fit}`,
      );
    }

    for (const ratio of ['auto', 'square', 'wide', 'portrait'] as const) {
      rerender(
        <Image node={node} props={{ ...base, ratio }} slots={{}} data={{}} isCanvas={false} />,
      );
      expect(screen.getByRole('img', { name: 'Product image' }).closest('.mkt-image')).toHaveClass(
        `mkt-image--ratio-${ratio}`,
      );
    }

    for (const radius of ['none', 'sm', 'md', 'full'] as const) {
      rerender(
        <Image node={node} props={{ ...base, radius }} slots={{}} data={{}} isCanvas={false} />,
      );
      expect(screen.getByRole('img', { name: 'Product image' }).closest('.mkt-image')).toHaveClass(
        `mkt-image--radius-${radius}`,
      );
    }
  });

  it('color roles reach the root as kebab-cased theme variables', () => {
    const { container } = renderImage(
      imageSchema.props.parse({
        src: SOURCE,
        alt: 'Product image',
        background: 'surfaceInverse',
      }),
      false,
    );

    expect(container.querySelector<HTMLElement>('.mkt-image')?.style.background).toBe(
      'var(--t-surface-inverse)',
    );
  });

  it('renderer: merges colour and spacing on both rendered root variants', () => {
    const props = imageSchema.props.parse({
      background: 'surfaceInverse',
      marginBlockEnd: -2,
    });
    const { container, rerender } = renderImage(props, true);

    let root = container.querySelector<HTMLElement>('.mkt-image');
    expect(root?.style.background).toBe('var(--t-surface-inverse)');
    expect(root?.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * -2)');

    rerender(
      <Image
        node={node}
        props={{ ...props, src: SOURCE, alt: 'Product image' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    root = container.querySelector<HTMLElement>('.mkt-image');
    expect(root?.style.background).toBe('var(--t-surface-inverse)');
    expect(root?.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * -2)');
  });

  it('schema defaults authored properties except src, colour roles, and spacing', () => {
    const props = imageSchema.props.parse({});
    const colorKeys = Object.keys(sectionColorProps);
    const motionKeys = Object.keys(sectionMotionProps);
    const spacingKeys = Object.keys(sectionSpacingProps);
    const noDefaultKeys = [
      ...motionKeys,
      'src',
      ...colorKeys,
      ...spacingKeys,
      'gutter',
      'className',
    ];

    expect(colorKeys.sort()).toEqual(['background', 'textColor']);
    expect(spacingKeys.sort()).toEqual([
      'marginBlockEnd',
      'marginBlockStart',
      'marginInlineEnd',
      'marginInlineStart',
      'paddingBlockEnd',
      'paddingBlockStart',
      'paddingInlineEnd',
      'paddingInlineStart',
    ]);
    for (const key of noDefaultKeys) {
      expect(imageSchema.props.shape, key).toHaveProperty(key);
      expect(props, key).not.toHaveProperty(key);
    }
    expect(Object.keys(props).sort()).toEqual(
      Object.keys(imageSchema.props.shape)
        .filter((key) => !noDefaultKeys.includes(key))
        .sort(),
    );
    expect(props).toEqual({
      alt: '',
      decorative: false,
      fit: 'cover',
      ratio: 'auto',
      radius: 'none',
      width: 'standard',
      align: 'start',
    });
  });

  it('schema enforces content limits and the complete enum vocabulary', () => {
    expect(imageSchema.props.safeParse({ src: 'x'.repeat(2000) }).success).toBe(true);
    expect(imageSchema.props.safeParse({ src: 'x'.repeat(2001) }).success).toBe(false);
    expect(imageSchema.props.safeParse({ alt: 'x'.repeat(160) }).success).toBe(true);
    expect(imageSchema.props.safeParse({ alt: 'x'.repeat(161) }).success).toBe(false);

    for (const fit of ['cover', 'contain', 'fill']) {
      expect(imageSchema.props.safeParse({ fit }).success, `fit=${fit}`).toBe(true);
    }
    for (const ratio of ['auto', 'square', 'wide', 'portrait']) {
      expect(imageSchema.props.safeParse({ ratio }).success, `ratio=${ratio}`).toBe(true);
    }
    for (const radius of ['none', 'sm', 'md', 'full']) {
      expect(imageSchema.props.safeParse({ radius }).success, `radius=${radius}`).toBe(true);
    }
    for (const width of ['narrow', 'standard', 'wide', 'full']) {
      expect(imageSchema.props.safeParse({ width }).success, `width=${width}`).toBe(true);
    }
    for (const align of ['start', 'center', 'end']) {
      expect(imageSchema.props.safeParse({ align }).success, `align=${align}`).toBe(true);
    }

    expect(imageSchema.props.safeParse({ fit: 'scale-down' }).success).toBe(false);
    expect(imageSchema.props.safeParse({ ratio: 'landscape' }).success).toBe(false);
    expect(imageSchema.props.safeParse({ radius: 'lg' }).success).toBe(false);
    expect(imageSchema.props.safeParse({ width: 'auto' }).success).toBe(false);
    expect(imageSchema.props.safeParse({ align: 'left' }).success).toBe(false);
  });

  it('places every property in its required inspector tab', () => {
    expect(imageSchema.propertyGroups).toEqual({
      src: { tab: 'content', section: 'Image' },
      alt: { tab: 'content', section: 'Accessibility' },
      decorative: { tab: 'advanced', section: 'Accessibility' },
      fit: { tab: 'design', section: 'Image' },
      ratio: { tab: 'design', section: 'Image' },
      radius: { tab: 'design', section: 'Image' },
      width: { tab: 'design', section: 'Layout' },
      align: { tab: 'design', section: 'Layout' },
      ...sectionColorGroups,
      ...sectionMotionGroups,
      ...sectionSpacingGroups,
      ...sectionCustomGroups,
    });
  });

  it('ships Arabic and English assistant examples', () => {
    expect(imageExamples.some(({ prompt }) => /[\u0600-\u06ff]/u.test(prompt))).toBe(true);
    expect(imageExamples.some(({ prompt }) => /[a-z]/iu.test(prompt))).toBe(true);
  });
});
