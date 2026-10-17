import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { sectionColorGroups, sectionColorProps } from '../section-color';
import { sectionCustomGroups, sectionCustomProps } from '../section-custom';
import { sectionMotionGroups, sectionMotionProps } from '../section-motion';
import { sectionSpacingGroups, sectionSpacingProps } from '../section-spacing';
import { sectionTypographyGroups, sectionTypographyProps } from '../section-typography';
import { Gallery } from './Gallery';
import { galleryExamples } from './examples';
import { gallerySchema, type GalleryProps } from './schema';

const IMAGE_SOURCE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M8AAAICAQB7CYZkAAAAAElFTkSuQmCC';
const node: Node = { id: 'gallery-test', type: 'gallery', props: {} };

function renderGallery(props: GalleryProps, isCanvas = false) {
  return render(<Gallery node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

describe('Gallery', () => {
  it('renders a labelled region with semantic figures, captions, and lazy images', () => {
    renderGallery(
      gallerySchema.props.parse({
        heading: 'Selected work',
        items: [
          { src: IMAGE_SOURCE, alt: 'Sunlit courtyard', caption: 'Courtyard House' },
          { src: '/studio.jpg', alt: 'Studio worktable' },
        ],
      }),
    );

    expect(screen.getByRole('region', { name: 'Selected work' })).toHaveClass('@container');
    expect(screen.getByRole('list')).toHaveAttribute('data-gallery-list', 'grid');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('figure')).toHaveLength(2);
    expect(screen.getByText('Courtyard House')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Sunlit courtyard' })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByRole('img', { name: 'Sunlit courtyard' })).toHaveAttribute(
      'decoding',
      'async',
    );
  });

  it('keeps decorative images out of the accessible image tree', () => {
    const { container } = renderGallery(
      gallerySchema.props.parse({
        heading: 'Accessible gallery',
        items: [{ src: IMAGE_SOURCE, decorative: true }],
      }),
      true,
    );

    expect(container.querySelectorAll('img')).toHaveLength(1);
    for (const image of container.querySelectorAll('img')) {
      expect(image).toHaveAttribute('alt', '');
    }
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('requires nonempty alt text for informative images but permits decorative empty alt', () => {
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/informative.jpg', alt: '', decorative: false }],
      }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/decorative.jpg', alt: '', decorative: true }],
      }).success,
    ).toBe(true);
  });

  it('renders safe full-size links and prevents navigation on the builder canvas', () => {
    renderGallery(
      gallerySchema.props.parse({
        heading: 'Linked gallery',
        linkImages: true,
        linkLabel: 'Inspect image',
        newTab: true,
        items: [
          {
            src: '/project.jpg',
            alt: 'Project detail',
            href: '/project-full.jpg',
          },
        ],
      }),
      true,
    );

    const link = screen.getByRole('link', { name: 'Inspect image: Project detail' });
    expect(link).toHaveAttribute('href', '/project-full.jpg');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(fireEvent.click(link)).toBe(false);
  });

  it('promotes the first editorial item without changing source order', () => {
    renderGallery(
      gallerySchema.props.parse({
        heading: 'Editorial sequence',
        layout: 'editorial',
        items: [
          { src: '/lead.jpg', alt: 'Lead image' },
          { src: '/detail.jpg', alt: 'Detail image' },
        ],
      }),
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-gallery-item', 'featured');
    expect(items[0]).toHaveClass('@sm:col-span-2');
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'Lead image',
      'Detail image',
    ]);
  });

  it('shows an editor-only empty hint and keeps preview output free of placeholders', () => {
    const props = gallerySchema.props.parse({ heading: 'Empty gallery' });
    const { rerender } = renderGallery(props, true);

    expect(screen.getByText('Add images to build this gallery.')).toBeVisible();
    rerender(<Gallery node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.queryByText('Add images to build this gallery.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('applies shared token roles, typography, spacing, and custom utilities', () => {
    renderGallery(
      gallerySchema.props.parse({
        heading: 'Styled gallery',
        background: 'surfaceInverse',
        textColor: 'textInverse',
        fontFamily: 'serif',
        marginBlockStart: 3,
        className: 'isolate',
      }),
    );

    const section = screen.getByRole('region', { name: 'Styled gallery' });
    expect(section).toHaveClass('mkt-type--family-serif', 'isolate');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-text-inverse)');
    expect(section.style.marginBlockStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('keeps all shared controls optional and rejects unsafe media values', () => {
    const props = gallerySchema.props.parse({});
    const optionalKeys = [
      ...Object.keys(sectionColorProps),
      ...Object.keys(sectionMotionProps),
      ...Object.keys(sectionCustomProps),
      ...Object.keys(sectionTypographyProps),
      ...Object.keys(sectionSpacingProps),
    ];

    for (const key of optionalKeys) {
      expect(gallerySchema.props.shape, key).toHaveProperty(key);
      expect(props, `${key} must not be defaulted`).not.toHaveProperty(key);
      expect(Object.hasOwn(gallerySchema.propertyGroups ?? {}, key)).toBe(true);
    }

    expect(props).toMatchObject({
      items: [],
      layout: 'grid',
      columns: '3',
      aspect: 'landscape',
      linkImages: false,
    });
    expect(gallerySchema.props.safeParse({ items: [{ src: 'javascript:alert(1)' }] }).success).toBe(
      false,
    );
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/safe.jpg', href: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({ items: [{ src: 'data:text/html,unsafe' }] }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({ items: [{ src: '//evil.example/image.jpg' }] }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/\\evil.example/image.jpg', alt: 'Unsafe image' }],
      }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/safe.jpg', alt: 'Safe image', href: '//evil.example/image.jpg' }],
      }).success,
    ).toBe(false);
    expect(
      gallerySchema.props.safeParse({
        items: [{ src: '/safe.jpg', alt: 'Safe image', href: '/\\evil.example/image.jpg' }],
      }).success,
    ).toBe(false);
  });

  it('declares every inspector group and bilingual examples', () => {
    expect(gallerySchema.propertyGroups).toEqual(
      expect.objectContaining({
        heading: { tab: 'content', section: 'Introduction' },
        items: { tab: 'content', section: 'Images' },
        layout: { tab: 'design', section: 'Layout' },
        newTab: { tab: 'advanced', section: 'Image links' },
        ...sectionColorGroups,
        ...sectionMotionGroups,
        ...sectionCustomGroups,
        ...sectionTypographyGroups,
        ...sectionSpacingGroups,
      }),
    );
    expect(galleryExamples.some(({ prompt }) => /[\u0600-\u06ff]/u.test(prompt))).toBe(true);
    expect(galleryExamples.some(({ prompt }) => /[a-z]/iu.test(prompt))).toBe(true);
  });
});
