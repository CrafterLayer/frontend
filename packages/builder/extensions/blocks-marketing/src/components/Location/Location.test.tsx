import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Location } from './Location';
import { locationExamples } from './examples';
import { locationSchema } from './schema';

const node: Node = { id: 'location', type: 'location', props: {} };

function renderLocation(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Location
      node={node}
      props={locationSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('Location', () => {
  it('shows the address with an OpenStreetMap search, and the hours as day and time pairs', () => {
    const { container } = renderLocation({ hoursNote: 'Closed on public holidays.' });
    expect(screen.getByRole('region', { name: 'Visit us' })).toHaveClass('@container');
    expect(container.querySelector('address')).toHaveTextContent('18 Market Street, Old Town');
    const maps = screen.getByRole('link', { name: 'Open in Maps' });
    expect(maps).toHaveAttribute(
      'href',
      `https://www.openstreetmap.org/search?query=${encodeURIComponent('18 Market Street, Old Town')}`,
    );
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Sunday – Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(screen.getAllByRole('definition')[2]).toHaveTextContent('Closed');
    expect(screen.getByText('Closed on public holidays.')).toBeInTheDocument();
    /* Nothing to contact and no map: one column, no aside, no third party. */
    expect(container.querySelector('[data-location-contact]')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[data-location-layout]')).not.toHaveClass('@3xl:grid-cols-2');
  });

  it('links WhatsApp first, then a call and an email, each number reading left to right', () => {
    renderLocation({
      phone: '+966 11 456 7890',
      email: 'hello@example.com',
      whatsapp: '+966 50 123 4567',
      whatsappMessage: 'Hello',
    });
    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://wa.me/966501234567?text=Hello',
      'tel:+966114567890',
      'mailto:hello@example.com',
    ]);
    expect(links[0]).toHaveAccessibleName('WhatsApp +966 50 123 4567');
    expect(links[0]).toHaveClass('bg-accent', 'text-accent-text');
    expect(links[1]?.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('pins the coordinates, and embeds the map only when asked, lazily and without a referrer', () => {
    const { container, unmount } = renderLocation({ latitude: 24.7136, longitude: 46.6753 });
    expect(screen.getByRole('link', { name: 'Open in Maps' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=24.7136&mlon=46.6753#map=17/24.7136/46.6753',
    );
    expect(container.querySelector('iframe')).toBeNull();
    unmount();
    renderLocation({
      latitude: 24.7136,
      longitude: 46.6753,
      embedMap: true,
      mapTitle: 'Map of the café',
    });
    const map = screen.getByTitle('Map of the café');
    expect(map.tagName).toBe('IFRAME');
    expect(map).toHaveAttribute('loading', 'lazy');
    expect(map).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(map.getAttribute('src')).toMatch(
      /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/u,
    );
    expect(map).not.toHaveClass('pointer-events-none');
    expect(map.closest('[data-location-layout]')).toHaveClass('@3xl:grid-cols-2');
  });

  it('embeds nothing without coordinates, and lets a canvas click through the map', () => {
    const { container, unmount } = renderLocation({ embedMap: true });
    expect(container.querySelector('iframe')).toBeNull();
    unmount();
    const canvas = renderLocation({ embedMap: true, latitude: 1, longitude: 2 }, true);
    expect(canvas.container.querySelector('iframe')).toHaveClass('pointer-events-none');
  });

  it('stacks on request and keeps secondary text legible on a dark section', () => {
    const { container } = renderLocation({
      layout: 'stacked',
      phone: '+1 555 0100',
      tone: 'dark',
      body: 'Intro.',
    });
    expect(container.querySelector('[data-location-layout]')).toHaveAttribute(
      'data-location-layout',
      'stacked',
    );
    expect(container.querySelector('[data-location-layout]')).not.toHaveClass('@3xl:grid-cols-2');
    expect(screen.getByText('Intro.')).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderLocation({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Visit us' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('Location schema', () => {
  it('defaults to an address and three hours rows, privacy first, and maps every inspector prop', () => {
    const defaults = locationSchema.props.parse({});
    expect(defaults.hours).toHaveLength(3);
    expect(defaults).toMatchObject({ embedMap: false, layout: 'split', mapsLabel: 'Open in Maps' });
    expect(defaults.phone).toBeUndefined();
    expect(Object.keys(locationSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(locationSchema.props.shape).sort(),
    );
  });

  it('refuses a number or address that cannot make a safe link, and coordinates off the globe', () => {
    const parse = (props: unknown) => locationSchema.props.safeParse(props).success;
    expect(parse({ phone: 'call me' })).toBe(false);
    expect(parse({ phone: '+966 (11) 456-7890' })).toBe(true);
    expect(parse({ whatsapp: 'javascript:alert(1)' })).toBe(false);
    expect(parse({ email: 'not-an-email' })).toBe(false);
    expect(parse({ email: 'a"b@example.com' })).toBe(false);
    expect(parse({ latitude: 91 })).toBe(false);
    expect(parse({ longitude: -181 })).toBe(false);
    expect(parse({ hours: Array.from({ length: 11 }, () => ({ days: 'd', time: 't' })) })).toBe(
      false,
    );
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of locationExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('location');
      expect(locationSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(locationExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
