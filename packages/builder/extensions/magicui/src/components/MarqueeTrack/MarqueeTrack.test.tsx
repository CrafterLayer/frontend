import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarqueeTrack } from './MarqueeTrack';

const items = [
  { title: 'Northstar', href: '/northstar' },
  { title: 'Monument', imageUrl: '/monument.svg', imageAlt: 'Monument mark' },
];

describe('MarqueeTrack', () => {
  it('keeps only the primary copy semantic and interactive', () => {
    render(<MarqueeTrack items={items} presentation="logos" radius="large" direction="forward" />);

    const primary = document.querySelector<HTMLElement>('[data-marquee-copy="primary"]');
    const duplicate = document.querySelector<HTMLElement>('[data-marquee-copy="duplicate"]');
    expect(primary).not.toBeNull();
    expect(within(primary!).getAllByRole('listitem')).toHaveLength(2);
    expect(within(primary!).getByRole('link', { name: /Northstar/ })).toHaveAttribute(
      'href',
      '/northstar',
    );
    expect(duplicate).toHaveAttribute('aria-hidden', 'true');
    expect(duplicate?.querySelector('a')).toBeNull();
  });

  it('makes every copy of a secondary decorative row non-interactive', () => {
    render(
      <MarqueeTrack
        items={items}
        presentation="cards"
        radius="pill"
        direction="reverse"
        secondary
      />,
    );

    expect(document.querySelector('[data-marquee-copy="primary"]')).toBeNull();
    expect(document.querySelectorAll('[data-marquee-copy="duplicate"]')).toHaveLength(2);
    expect(document.querySelector('a')).toBeNull();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('retains safe hrefs while suppressing canvas navigation', () => {
    render(
      <MarqueeTrack
        items={items}
        presentation="compact"
        radius="small"
        direction="forward"
        isCanvas
      />,
    );

    const link = screen.getByRole('link', { name: /Northstar/ });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute('href', '/northstar');
  });

  it.each([
    ['auxiliary click', 'auxclick', 1],
    ['context menu', 'contextmenu', 2],
  ] as const)('suppresses canvas navigation from %s', (_label, eventType, button) => {
    render(
      <MarqueeTrack
        items={items}
        presentation="compact"
        radius="small"
        direction="forward"
        isCanvas
      />,
    );

    const link = screen.getByRole('link', { name: /Northstar/ });
    const event = new MouseEvent(eventType, { bubbles: true, cancelable: true, button });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute('href', '/northstar');
  });
});
