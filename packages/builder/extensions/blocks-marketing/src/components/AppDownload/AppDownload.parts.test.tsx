import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AppDownload } from './AppDownload';
import { appDownloadSchema, type AppDownloadProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, every benefit, every store
  button and its lead-in, the rating note and the screenshot are addressable
  on the canvas, carry nothing extra when published, take classes from
  `partStyles`, and render an inline editor at its bind exactly once.
*/
const node: Node = { id: 'app-parts', type: 'appDownload', props: {} };
const FULL = {
  eyebrow: 'Our app',
  body: 'Free on every phone.',
  note: 'Rated 4.8',
  imageSrc: '/assets/app.png',
  imageAlt: 'The app',
};

type Swap = (props: AppDownloadProps) => AppDownloadProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = appDownloadSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<AppDownload node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('AppDownload parts', () => {
  it('stamps every benefit, store button, lead-in, the note and the screenshot', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'feature').map((item) => item.dataset['ckBind'])).toEqual([
      'features.0',
      'features.1',
      'features.2',
    ]);
    expect(partsNamed(container, 'store')[1]).toHaveAttribute('data-ck-bind', 'stores.1.label');
    expect(partsNamed(container, 'store')[1]?.tagName).toBe('A');
    expect(partsNamed(container, 'store.kicker')[0]).toHaveAttribute(
      'data-ck-bind',
      'stores.0.kicker',
    );
    expect(partsNamed(container, 'note')[0]).toHaveAttribute('data-ck-bind', 'note');
    expect(partsNamed(container, 'image')[0]).toHaveAttribute('data-ck-bind', 'imageSrc');
    expect(partsNamed(container, 'stores')[0]?.tagName).toBe('UL');
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderBlock(
      {
        partStyles: {
          feature: { className: 'font-bold' },
          'feature@1': { className: 'font-regular', dir: 'rtl' },
        },
      },
      true,
    );
    const features = partsNamed(container, 'feature');
    expect(features[0]).toHaveClass('font-bold');
    expect(features[1]).toHaveClass('font-regular');
    expect(features[1]).toHaveAttribute('dir', 'rtl');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      features: props.features.map((_, index) => swapped(`features.${String(index)}`)),
      stores: props.stores.map((store, index) => ({
        ...store,
        label: swapped(`stores.${String(index)}.label`),
        kicker: swapped(`stores.${String(index)}.kicker`),
      })),
      note: swapped('note'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'features.2', 'stores.0.label', 'stores.1.kicker', 'note']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
