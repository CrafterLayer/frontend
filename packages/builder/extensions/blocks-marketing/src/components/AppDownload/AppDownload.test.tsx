import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AppDownload } from './AppDownload';
import { appDownloadExamples } from './examples';
import { appDownloadSchema } from './schema';

const node: Node = { id: 'app', type: 'appDownload', props: {} };

function renderApp(overrides: Record<string, unknown> = {}) {
  return render(
    <AppDownload
      node={node}
      props={appDownloadSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('AppDownload', () => {
  it('is a section named by its heading with benefits and generic store links', () => {
    renderApp({ body: 'Free on every phone.' });
    const section = screen.getByRole('region', { name: 'Everything you need, in your pocket' });
    expect(section).toHaveClass('@container', 'bg-surface');
    const lists = within(section).getAllByRole('list');
    expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(3);
    const appStore = screen.getByRole('link', { name: 'Download on the App Store' });
    expect(appStore).toHaveAttribute('href', '#');
    expect(appStore).toHaveAttribute('data-app-download-store', 'phone');
    /* A drawn glyph, never a store's badge image. */
    expect(appStore.querySelector('img')).toBeNull();
    expect(appStore.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toBeInTheDocument();
  });

  it('frames a screenshot in a drawn device, or draws a placeholder screen without one', () => {
    const { container, unmount } = renderApp();
    expect(container.querySelector('[data-app-download-device]')).not.toBeNull();
    expect(container.querySelector('[data-app-download-placeholder]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    unmount();
    renderApp({ imageSrc: '/assets/app.png', imageAlt: 'The app home screen' });
    expect(screen.getByRole('img', { name: 'The app home screen' })).toHaveClass('object-cover');
  });

  it('shows a bare screenshot without the device, and no media at all without either', () => {
    const bare = renderApp({ showDevice: false, imageSrc: '/a.png', imageAlt: 'Screens' });
    expect(bare.container.querySelector('[data-app-download-device]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Screens' })).toHaveClass('rounded-2xl');
    bare.unmount();
    const none = renderApp({ showDevice: false });
    expect(none.container.querySelector('[data-app-download-media]')).toBeNull();
  });

  it('puts the media at the inline start on wide containers when asked', () => {
    const { container } = renderApp({ mediaPosition: 'start' });
    expect(container.querySelector('[data-app-download-content]')).toHaveClass('@3xl:grid-cols-2');
    expect(container.querySelector('[data-app-download-media]')).toHaveClass('@3xl:order-first');
  });

  it('centres the stack in the centred layout', () => {
    const { container } = renderApp({ layout: 'centered' });
    const content = container.querySelector('[data-app-download-content]');
    expect(content).toHaveClass('grid-cols-1', 'justify-items-center', 'text-center');
    expect(content).not.toHaveClass('@3xl:grid-cols-2');
  });

  it('lays a store button out in the page direction, whatever language its store name is in', () => {
    const { unmount } = render(
      <AppDownload
        node={node}
        props={appDownloadSchema.props.parse({
          partStyles: { 'store@1': { dir: 'rtl' } },
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('link', { name: 'Download on the App Store' })).not.toHaveAttribute(
      'dir',
    );
    /* A person's own override still lands. */
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute(
      'dir',
      'rtl',
    );
    unmount();
  });

  it('inverts the buttons on a dark section and keeps the rating note muted', () => {
    renderApp({ tone: 'dark', note: 'Rated 4.8' });
    expect(screen.getByRole('link', { name: 'Download on the App Store' })).toHaveClass(
      'bg-surface',
      'text-text',
    );
    expect(screen.getByText('Rated 4.8').parentElement).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderApp({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Everything you need, in your pocket' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('AppDownload schema', () => {
  it('defaults to a split promotion with two store buttons and maps every inspector prop', () => {
    const defaults = appDownloadSchema.props.parse({});
    expect(defaults.stores).toHaveLength(2);
    expect(defaults).toMatchObject({ layout: 'split', tone: 'light', width: 'wide' });
    expect(Object.keys(appDownloadSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(appDownloadSchema.props.shape).sort(),
    );
  });

  it('bounds the buttons and benefits and refuses unsafe links or glyphs', () => {
    const parse = (value: unknown) => appDownloadSchema.props.safeParse(value).success;
    const store = { label: 'Store', href: '#' };
    expect(parse({ stores: [store, store, store, store] })).toBe(false);
    expect(parse({ features: Array.from({ length: 6 }, () => 'x') })).toBe(false);
    expect(parse({ stores: [{ label: 'x', href: 'javascript:alert(1)' }] })).toBe(false);
    expect(parse({ stores: [{ label: 'x', href: '#', icon: 'apple' }] })).toBe(false);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of appDownloadExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('appDownload');
      expect(appDownloadSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(appDownloadExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
