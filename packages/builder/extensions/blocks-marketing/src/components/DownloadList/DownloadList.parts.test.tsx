import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { DownloadList } from './DownloadList';
import { downloadListSchema, type DownloadListProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the list, every file and its
  title, description, format and size, and the shared download label are
  addressable on the canvas, carry nothing extra when published, and render
  an inline editor at its bind exactly once.
*/
const node: Node = { id: 'files-parts', type: 'downloadList', props: {} };
const FULL = { eyebrow: 'Resources', body: 'Take them with you.' };

type Swap = (props: DownloadListProps) => DownloadListProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = downloadListSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(
    <DownloadList node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('DownloadList parts', () => {
  it('stamps every file and its words, and the download label beside each', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'files')[0]?.tagName).toBe('UL');
    expect(partsNamed(container, 'file')[2]).toHaveAttribute('data-ck-bind', 'files.2');
    expect(partsNamed(container, 'file.title')[0]).toHaveAttribute('data-ck-bind', 'files.0.title');
    expect(partsNamed(container, 'file.description')).toHaveLength(2);
    expect(partsNamed(container, 'file.format').map((format) => format.dataset['ckBind'])).toEqual([
      'files.0.format',
      'files.1.format',
      'files.2.format',
    ]);
    expect(partsNamed(container, 'file.size')[1]).toHaveAttribute('data-ck-bind', 'files.1.size');
    expect(partsNamed(container, 'downloadLabel')).toHaveLength(3);
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
          'file.format': { className: 'text-accent' },
          'file.format@2': { className: 'text-inherit', dir: 'ltr' },
        },
      },
      true,
    );
    const formats = partsNamed(container, 'file.format');
    expect(formats[0]).toHaveClass('text-accent', 'uppercase');
    expect(formats[2]).toHaveClass('text-inherit');
    expect(formats[2]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      downloadLabel: swapped('downloadLabel'),
      files: props.files.map((file, index) => ({
        ...file,
        title: swapped(`files.${String(index)}.title`),
        size: swapped(`files.${String(index)}.size`),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'downloadLabel', 'files.1.title', 'files.2.size']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
