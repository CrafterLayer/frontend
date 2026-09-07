import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AssetEntry, Node } from '@craftkit/builder-schema';
import { AssetTableProvider } from '@craftkit/builder-renderer';

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

const KILN: AssetEntry = {
  id: 'kiln',
  url: 'https://assets.example.test/kiln.jpg',
  description: 'A ceramics kiln glowing in a workshop',
  mood: ['warm'],
  palette: ['#c2410c'],
  alt: 'A kiln glowing orange in a dim ceramics workshop',
  width: 1600,
  height: 1067,
};

function renderWithLibrary(props: ImageProps, assets: Readonly<Record<string, AssetEntry>>) {
  return render(
    <AssetTableProvider assets={assets}>
      <Image node={node} props={props} slots={{}} data={{}} isCanvas />
    </AssetTableProvider>,
  );
}

describe('Image — pictures from the library (FR-045)', () => {
  it('resolves an asset reference through the site asset table', () => {
    renderWithLibrary(imageSchema.props.parse({ asset: { assetId: 'kiln' } }), { kiln: KILN });

    expect(screen.getByRole('img', { name: KILN.alt })).toHaveAttribute('src', KILN.url);
  });

  it('borrows the library alt text only when the block has none of its own', () => {
    /*
      The library's alt was written by whoever chose the picture, describing
      THAT picture. An empty alt on a meaningful image is a failure a sighted
      person never sees — and an author's own alt is still the better answer,
      because they know what the picture is doing HERE.
    */
    renderWithLibrary(imageSchema.props.parse({ asset: { assetId: 'kiln' }, alt: 'Our kiln' }), {
      kiln: KILN,
    });

    expect(screen.getByRole('img', { name: 'Our kiln' })).toBeVisible();
  });

  it('draws a LABELLED absence, carrying the reason it was given', () => {
    renderWithLibrary(
      imageSchema.props.parse({
        asset: { absent: true, reason: 'Nothing in the library matches "a kiln at work".' },
      }),
      { kiln: KILN },
    );

    expect(screen.getByText('Nothing in the library matches "a kiln at work".')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('names an unresolvable picture rather than showing an empty box', () => {
    /*
      `validateSite` refuses a stored site whose reference does not resolve in
      its own table, so this fires only for a document rendered OUTSIDE its
      site — a page in isolation, an export assembled without the table. It
      degrades to a sentence naming the picture, because "pass the table" and
      "choose another" both need the name.
    */
    renderWithLibrary(imageSchema.props.parse({ asset: { assetId: 'kiln' } }), {});

    expect(
      screen.getByText('The picture "kiln" is not in the asset table this page was rendered with.'),
    ).toBeVisible();
  });

  it('renders NOTHING for an unresolvable picture once published', () => {
    /*
      The explanation is editing scaffolding. A visitor gets no box and no
      apology — they get a page that reads as if the picture was never planned.
    */
    const { container } = render(
      <AssetTableProvider assets={{}}>
        <Image
          node={node}
          props={imageSchema.props.parse({ asset: { assetId: 'kiln' } })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </AssetTableProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('prefers the ASSET over a typed URL, because the table outlives the URL', () => {
    renderWithLibrary(imageSchema.props.parse({ asset: { assetId: 'kiln' }, src: SOURCE }), {
      kiln: KILN,
    });

    expect(screen.getByRole('img', { name: KILN.alt })).toHaveAttribute('src', KILN.url);
  });

  it('degrades to the typed URL when no library is mounted at all', () => {
    /*
      No provider anywhere — a story, a static export, a test. A block that
      threw here would take a whole page down over a missing context.
    */
    render(
      <Image
        node={node}
        props={imageSchema.props.parse({ src: SOURCE, alt: 'Product image' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('img', { name: 'Product image' })).toHaveAttribute('src', SOURCE);
  });
});

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

    expect(screen.getByText('Add an image URL, or choose one from the library.')).toBeVisible();
    expect(container.firstElementChild).not.toHaveAttribute('style');

    rerender(<Image node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fit, ratio, and radius values apply their utilities', () => {
    const base = imageSchema.props.parse({ src: SOURCE, alt: 'Product image' });
    const { rerender } = renderImage(base, false);

    for (const fit of ['cover', 'contain', 'fill'] as const) {
      rerender(
        <Image node={node} props={{ ...base, fit }} slots={{}} data={{}} isCanvas={false} />,
      );
      const fitClass = { cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[
        fit
      ];
      expect(screen.getByRole('img', { name: 'Product image' })).toHaveClass(fitClass);
    }

    for (const ratio of ['auto', 'square', 'wide', 'portrait'] as const) {
      rerender(
        <Image node={node} props={{ ...base, ratio }} slots={{}} data={{}} isCanvas={false} />,
      );
      const ratioClass = {
        auto: 'aspect-auto',
        square: 'aspect-square',
        wide: 'aspect-video',
        portrait: 'aspect-3/4',
      }[ratio];
      expect(screen.getByRole('img', { name: 'Product image' })).toHaveClass(ratioClass);
    }

    for (const radius of ['none', 'sm', 'md', 'full'] as const) {
      rerender(
        <Image node={node} props={{ ...base, radius }} slots={{}} data={{}} isCanvas={false} />,
      );
      const radiusClass = {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-base',
        full: 'rounded-full',
      }[radius];
      expect(screen.getByRole('img', { name: 'Product image' })).toHaveClass(radiusClass);
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

    expect((container.firstElementChild as HTMLElement).style.background).toBe(
      'var(--t-surface-inverse)',
    );
  });

  it('renderer: merges colour and spacing on both rendered root variants', () => {
    const props = imageSchema.props.parse({
      background: 'surfaceInverse',
      marginBlockEnd: -2,
    });
    const { container, rerender } = renderImage(props, true);

    let root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe('var(--t-surface-inverse)');
    expect(root.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * -2)');

    rerender(
      <Image
        node={node}
        props={{ ...props, src: SOURCE, alt: 'Product image' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe('var(--t-surface-inverse)');
    expect(root.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * -2)');
  });

  it('schema defaults authored properties except src, colour roles, and spacing', () => {
    const props = imageSchema.props.parse({});
    const colorKeys = Object.keys(sectionColorProps);
    const motionKeys = Object.keys(sectionMotionProps);
    const spacingKeys = Object.keys(sectionSpacingProps);
    const noDefaultKeys = [
      ...motionKeys,
      'asset',
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
      asset: { tab: 'content', section: 'Image' },
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

  it('ships renderable HTTPS Unsplash sources instead of placeholder media domains', () => {
    const sources = imageExamples.map(({ node: exampleNode }) => {
      const example = exampleNode as { props: unknown };
      return imageSchema.props.parse(example.props).src;
    });

    expect(sources).toHaveLength(2);
    for (const source of sources) {
      expect(source).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
      expect(source).not.toContain('example.com');
    }
  });
});
