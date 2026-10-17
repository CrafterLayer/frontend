import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { DownloadList } from './DownloadList';
import { downloadListExamples } from './examples';
import { downloadListSchema } from './schema';

const node: Node = { id: 'files', type: 'downloadList', props: {} };

function renderFiles(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <DownloadList
      node={node}
      props={downloadListSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('DownloadList', () => {
  it('lists every file as a titled link described by its format and size', () => {
    renderFiles();
    expect(screen.getByRole('region', { name: 'Downloads' })).toHaveClass('@container');
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    const profile = within(list).getByRole('link', { name: 'Company profile' });
    expect(profile).toHaveAccessibleDescription('PDF 3.2 MB');
    expect(profile.closest('h3')).toHaveAttribute('dir', 'auto');
    expect(profile).not.toHaveAttribute('dir');
    expect(screen.getByText('Who we are, what we do and who we do it for.').tagName).toBe('P');
  });

  it('asks a same-origin file to download, and leaves other addresses to the browser', () => {
    renderFiles({
      files: [
        { title: 'Menu', href: '/files/menu.pdf' },
        { title: 'Report', href: 'https://cdn.example.com/report.pdf' },
      ],
    });
    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute('download', '');
    expect(screen.getByRole('link', { name: 'Report' })).not.toHaveAttribute('download');
    /* No meta line, no description reference. */
    expect(screen.getByRole('link', { name: 'Menu' })).not.toHaveAttribute('aria-describedby');
  });

  it('stretches the link over the tile when published, and not on the canvas', () => {
    const { unmount } = renderFiles();
    expect(screen.getByRole('link', { name: 'Price list' })).toHaveClass('after:absolute');
    unmount();
    renderFiles({}, true);
    expect(screen.getByRole('link', { name: 'Price list' })).not.toHaveClass('after:absolute');
  });

  it('draws the download affordance once per file, hidden from screen readers', () => {
    renderFiles({ downloadLabel: 'Get it' });
    const labels = screen.getAllByText('Get it');
    expect(labels).toHaveLength(3);
    expect(labels[0]?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('lays the files out as a list or as cards', () => {
    const { container, unmount } = renderFiles();
    expect(container.querySelector('[data-download-list-layout="list"]')).toHaveClass('flex-col');
    unmount();
    const cards = renderFiles({ layout: 'cards' }).container;
    expect(cards.querySelector('[data-download-list-layout="cards"]')).toHaveClass(
      '@2xl:grid-cols-2',
    );
  });

  it('keeps secondary text legible on a dark section', () => {
    renderFiles({ tone: 'dark' });
    expect(screen.getByText('Who we are, what we do and who we do it for.')).toHaveClass(
      'opacity-80',
    );
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderFiles({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Downloads' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('DownloadList schema', () => {
  it('defaults to three files and maps every inspector prop', () => {
    const defaults = downloadListSchema.props.parse({});
    expect(defaults.files).toHaveLength(3);
    expect(defaults).toMatchObject({ downloadLabel: 'Download', layout: 'list', width: 'wide' });
    expect(Object.keys(downloadListSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(downloadListSchema.props.shape).sort(),
    );
  });

  it('requires a safe link for every file and bounds the list', () => {
    const parse = (value: unknown) => downloadListSchema.props.safeParse(value).success;
    expect(parse({ files: [{ title: 'x' }] })).toBe(false);
    expect(parse({ files: [{ title: 'x', href: 'javascript:alert(1)' }] })).toBe(false);
    expect(parse({ files: [{ title: 'x', href: '/f.pdf', format: 'TOOLONGFMT' }] })).toBe(false);
    expect(parse({ files: Array.from({ length: 21 }, () => ({ title: 'x', href: '/f' })) })).toBe(
      false,
    );
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of downloadListExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('downloadList');
      expect(downloadListSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(downloadListExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
