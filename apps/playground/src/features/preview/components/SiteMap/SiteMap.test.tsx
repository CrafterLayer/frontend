import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SiteMap, type SiteMapPage } from './SiteMap';

const pages: readonly SiteMapPage[] = [
  {
    id: 'home',
    index: 0,
    title: 'Home',
    address: '/',
    isHome: true,
    thumbnail: { kind: 'fallback', alt: 'No preview available for Home' },
    sharedReferences: [{ id: 'masthead', label: 'header', kind: 'region' }],
  },
  {
    id: 'about',
    index: 1,
    title: 'About',
    address: '/about',
    isHome: false,
    thumbnail: { kind: 'asset', src: '/team.webp', alt: 'Our team' },
    sharedReferences: [],
  },
];

describe('SiteMap', () => {
  it('selects a page by stable identity and exposes current selection', async () => {
    const onSelect = vi.fn();
    render(
      <SiteMap pages={pages} selectedPageId="about" onSelect={onSelect} onReorder={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Open About, /about' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open Home, /' }));
    expect(onSelect).toHaveBeenCalledWith('home');
  });

  it('reorders with explicit keyboard-accessible controls and guards boundaries', async () => {
    const onReorder = vi.fn();
    render(<SiteMap pages={pages} onSelect={vi.fn()} onReorder={onReorder} />);
    expect(screen.getByRole('button', { name: 'Move Home before' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move About after' })).toBeDisabled();
    const move = screen.getByRole('button', { name: 'Move About before' });
    move.focus();
    await userEvent.keyboard('{Enter}');
    expect(onReorder).toHaveBeenCalledWith('about', 0);
  });

  it('states shared-source impact in text and exposes every relationship', () => {
    render(<SiteMap pages={pages} onSelect={vi.fn()} onReorder={vi.fn()} />);
    const shared = screen.getByLabelText('Home shared sources');
    expect(shared).toHaveTextContent('1 shared source');
    expect(within(shared).getByText('header')).toHaveAttribute('title', 'masthead');
    expect(screen.getByText('Page-private content')).toBeInTheDocument();
  });

  it('renders a useful empty state and a labelled fallback thumbnail in RTL', () => {
    const { rerender } = render(
      <div dir="rtl">
        <SiteMap pages={[]} onSelect={vi.fn()} onReorder={vi.fn()} />
      </div>,
    );
    expect(screen.getByRole('region', { name: 'Site map' })).toHaveTextContent(/add a page/i);
    rerender(
      <div dir="rtl">
        <SiteMap pages={pages} onSelect={vi.fn()} onReorder={vi.fn()} />
      </div>,
    );
    expect(screen.getByRole('list', { name: 'Pages in route order' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Our team' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Home, /' })).toHaveTextContent('H');
  });
});
