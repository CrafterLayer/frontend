import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IconRail, type RailItem } from './IconRail';

const ITEMS = [
  {
    id: 'pages',
    label: 'Pages',
    icon: <svg data-testid="pages-icon" />,
  },
  {
    id: 'blocks',
    label: 'Blocks',
    icon: <svg data-testid="blocks-icon" />,
  },
  {
    id: 'layers',
    label: 'Layers',
    icon: <svg data-testid="layers-icon" />,
  },
] as const satisfies readonly RailItem[];

const SECONDARY = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <svg data-testid="settings-icon" />,
  },
  {
    id: 'help',
    label: 'Help',
    icon: <svg data-testid="help-icon" />,
  },
] as const satisfies readonly RailItem[];

afterEach(cleanup);

describe('IconRail', () => {
  it('renders a named navigation list with every button named and every icon hidden from AT', () => {
    render(<IconRail items={ITEMS} />);

    const navigation = screen.getByRole('navigation', { name: 'Builder sections' });
    expect(within(navigation).getAllByRole('list')).toHaveLength(1);

    for (const item of ITEMS) {
      const button = within(navigation).getByRole('button', { name: item.label });
      expect(button).toBeVisible();
      expect(button.closest('li')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', item.label);
      expect(within(navigation).getByText(item.label)).toHaveAttribute('popover', 'manual');
      expect(screen.getByTestId(`${item.id}-icon`).closest('[aria-hidden="true"]')).toBeVisible();
    }
  });

  it('draws each name under its icon with captions on, and keeps every button named', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <IconRail
        items={ITEMS}
        secondary={SECONDARY}
        activeId="pages"
        onSelect={onSelect}
        captions
      />,
    );
    const navigation = screen.getByRole('navigation', { name: 'Builder sections' });
    expect(navigation).toHaveAttribute('data-captions');
    for (const item of [...ITEMS, ...SECONDARY]) {
      const button = within(navigation).getByRole('button', { name: item.label });
      const caption = button.querySelector('.bldr-icon-rail__caption');
      expect(caption).toHaveTextContent(item.label);
      expect(caption).toHaveAttribute('aria-hidden', 'true');
      // The caption replaces the hover label: one name on screen, never two.
      expect(button.querySelector('[popover]')).toBeNull();
    }
    expect(container.querySelectorAll('.bldr-icon-rail__label')).toHaveLength(0);
    await user.click(within(navigation).getByRole('button', { name: 'Layers' }));
    expect(onSelect).toHaveBeenCalledWith('layers');
  });

  it('paints the rail dark with the rail tokens and lays captions out in a 68px track', () => {
    const css = readFileSync(
      join(process.cwd(), 'src', 'components', 'IconRail', 'IconRail.css'),
      'utf8',
    );
    expect(css).toMatch(/\.bldr-icon-rail \{[^}]*background-color: var\(--bldr-rail\)/u);
    expect(css).toMatch(/\.bldr-icon-rail \{[^}]*color: var\(--bldr-rail-text\)/u);
    expect(css).toMatch(
      /\.bldr-icon-rail\[data-captions\] \{[^}]*inline-size: var\(--bldr-rail-width\)/u,
    );
    expect(css).toMatch(/\.bldr-icon-rail__caption \{[^}]*text-overflow: ellipsis/u);
  });

  it('marks only the active item as the current page and accepts a custom navigation label', () => {
    render(<IconRail items={ITEMS} activeId="layers" label="Editor navigation" />);

    const navigation = screen.getByRole('navigation', { name: 'Editor navigation' });
    expect(within(navigation).getByRole('button', { name: 'Layers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('button', { name: 'Pages' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('calls onSelect with the item id on native keyboard and click activation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<IconRail items={ITEMS} secondary={SECONDARY} onSelect={onSelect} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Pages' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('pages');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSelect).toHaveBeenLastCalledWith('settings');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('renders the secondary group after the primary group and the account below both', () => {
    render(
      <IconRail
        items={ITEMS}
        secondary={SECONDARY}
        activeId="settings"
        account={<span>AB</span>}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Builder sections' });
    expect(within(navigation).getAllByRole('list')).toHaveLength(2);
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pages', 'Blocks', 'Layers', 'Settings', 'Help']);
    expect(within(navigation).getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByText('AB')).toBeVisible();
  });

  it('works with no activeId or onSelect', async () => {
    const user = userEvent.setup();
    render(<IconRail items={ITEMS} />);

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).not.toHaveAttribute('aria-current');
    }

    const pagesButton = screen.getByRole('button', { name: 'Pages' });
    await user.click(pagesButton);
    expect(pagesButton).toBeVisible();
  });

  /*
    The rail's whole suite was passing while `vitest` exited 1: six unhandled
    `label.showPopover is not a function` errors, thrown inside React's event
    dispatch, where an assertion cannot see them. That is the shape of defect a
    green test count hides best — the component "works" in every assertion made
    about it and breaks the runtime around it.

    Both ways the Popover API lets a caller down are exercised here, because the
    guard has two branches: a runtime that does not implement it at all (jsdom,
    and any browser old enough), and one that implements it and THROWS — which
    a real browser does when asked to show a popover that is already showing, as
    a fast hover between two icons produces.
  */
  it.each([
    ['absent', undefined],
    [
      'throwing',
      () => {
        throw new Error('InvalidStateError');
      },
    ],
  ] as const)('keeps working when the Popover API is %s', async (_case, stub) => {
    const errors: ErrorEvent[] = [];
    const collect = (event: ErrorEvent): void => {
      errors.push(event);
    };
    window.addEventListener('error', collect);

    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const saved = new Map<string, PropertyDescriptor | undefined>();
    for (const method of ['showPopover', 'hidePopover']) {
      saved.set(method, Object.getOwnPropertyDescriptor(proto, method));
      if (stub === undefined) {
        Reflect.deleteProperty(proto, method);
      } else {
        proto[method] = stub;
      }
    }

    try {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<IconRail items={ITEMS} onSelect={onSelect} />);

      const pages = screen.getByRole('button', { name: 'Pages' });
      await user.hover(pages);
      await user.click(pages);
      await user.unhover(pages);

      // The rail still navigates — the tooltip is the only thing that was lost.
      expect(onSelect).toHaveBeenCalledWith('pages');
      // …and nothing escaped into the page, which is what turned the suite red.
      expect(errors).toEqual([]);
    } finally {
      for (const [method, descriptor] of saved) {
        Reflect.deleteProperty(proto, method);
        if (descriptor !== undefined) Object.defineProperty(proto, method, descriptor);
      }
      window.removeEventListener('error', collect);
    }
  });

  it('routes every navigation item through the lg ChromeButton scale', () => {
    render(<IconRail items={ITEMS} secondary={SECONDARY} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('data-bldr-chrome-button', '');
      expect(button).toHaveAttribute('data-size', 'lg');
      expect(button).toHaveAttribute('data-variant', 'quiet');
    }
  });
});

/**
 * THE RAIL OVERRIDES A PRIMITIVE IT RENDERS, so it has to out-specify it.
 *
 * This is a source contract rather than a rendered one on purpose: CSS `:hover`
 * follows the real cursor, so a synthetic hover event cannot prove it, and jsdom
 * resolves no cascade at all. The defect was never about markup — it was that
 * `ChromeButton`'s quiet-hover selector carries FOUR compound parts and the
 * rail's carried two or three, so the light chrome won every tie. Measured in
 * Chromium before the fix: hovering any rail tab painted `--bldr-surface-hover`
 * (a 6%-black tint, invisible on a near-black rail) and hovering the SELECTED
 * tab replaced its accent fill with that same grey.
 */
describe('the rail out-specifies the button primitive it re-skins', () => {
  /**
   * Specificity's (classes + attributes + pseudo-classes) column — the only one
   * these selectors use. `:hover`/`:enabled` count here; `::before` would not,
   * and no selector compared below carries an id, an element, or `:not()`.
   */
  const weigh = (selector: string): number => {
    const withoutPseudoElements = selector.replaceAll('::', ' ');
    const classes = withoutPseudoElements.match(/\.[\w-]+/g) ?? [];
    const attributes = withoutPseudoElements.match(/\[[^\]]+\]/g) ?? [];
    const pseudoClasses = withoutPseudoElements.match(/:[\w-]+/g) ?? [];
    return classes.length + attributes.length + pseudoClasses.length;
  };

  const selectorsFrom = (css: string, matching: RegExp): string[] =>
    css
      .replaceAll(/\/\*[\s\S]*?\*\//g, '') // a rule's own comment may quote a selector
      .split('}')
      .map((block) => block.split('{')[0]?.trim() ?? '')
      .flatMap((prelude) => prelude.split(','))
      .map((selector) => selector.replaceAll(/\s+/g, ' ').trim())
      .filter((selector) => matching.test(selector));

  const read = (component: string) =>
    readFileSync(join(process.cwd(), 'src', 'components', component, `${component}.css`), 'utf8');

  const railCss = read('IconRail');
  const chromeButtonCss = read('ChromeButton');

  it('weighs its own hover and press above the quiet ChromeButton states', () => {
    const primitive = selectorsFrom(chromeButtonCss, /data-variant='quiet'.*:(hover|active)/);
    const rail = selectorsFrom(railCss, /icon-rail__button.*:(hover|active)/);

    // Non-vacuous: an empty match set would make every comparison below vacuous,
    // which is exactly how a renamed selector would slip past this gate.
    expect(primitive.length).toBeGreaterThan(0);
    expect(rail.length).toBeGreaterThan(0);

    const heaviestPrimitive = Math.max(...primitive.map(weigh));
    // Reported as a pair so a failure names the selector that lost, not just a number.
    const losers = rail
      .map((selector) => ({ selector, weight: weigh(selector) }))
      .filter((rule) => rule.weight <= heaviestPrimitive);
    expect(losers).toEqual([]);
  });

  it('keeps the selected tab heavier than the rail hover that would otherwise grey it out', () => {
    const railHover = selectorsFrom(
      railCss,
      /icon-rail__button\[data-variant='quiet'\]:enabled:hover/,
    );
    const selectedHover = selectorsFrom(railCss, /aria-current='page'\]:enabled:hover/);

    expect(railHover.length).toBeGreaterThan(0);
    expect(selectedHover.length).toBeGreaterThan(0);
    expect(Math.min(...selectedHover.map(weigh))).toBeGreaterThan(
      Math.max(...railHover.map(weigh)),
    );
  });

  it('re-colours the product focus ring rather than removing it', () => {
    const focus = selectorsFrom(railCss, /icon-rail__button:focus-visible/);
    expect(focus.length).toBeGreaterThan(0);
    // Heavier than the product-wide `.bldr-root :focus-visible`, which is two.
    expect(Math.min(...focus.map(weigh))).toBeGreaterThan(2);

    const declarations = railCss.slice(railCss.indexOf(focus[0] ?? ''));
    const body = declarations.slice(declarations.indexOf('{'), declarations.indexOf('}'));
    expect(body).toContain('outline-color');
    // Removing the ring is the one thing a component may never do.
    expect(body).not.toMatch(/outline\s*:\s*(none|0)/);
  });
});
