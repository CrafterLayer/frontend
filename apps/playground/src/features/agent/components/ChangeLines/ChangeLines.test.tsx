/**
 * ChangeLines (SPEC §4.9): what an edit changed, as at most three `label before → after`
 * lines, in schema labels, never command names.
 *
 * Seen, a line is a label, two quoted values and an arrow that points along the reading
 * direction. Heard, it is one sentence from the catalog ("Background: from “light” to
 * “deep navy”"), because a screen reader would otherwise say "right arrow" between two
 * quotes. Values are the page's own words, so each sits in `<bdi>` inside the locale's
 * quotes: «» in Arabic, “” in English.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChangeLineView } from '../../model/view-types';

import { ChangeLines } from './ChangeLines';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'ChangeLines', 'ChangeLines.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const HERO_EDIT: readonly ChangeLineView[] = [
  { kind: 'changed', label: 'Background', before: 'light', after: 'deep navy' },
  { kind: 'added', label: 'Button', value: 'WhatsApp' },
  { kind: 'removed', label: 'Subtitle', value: 'Book online' },
  { kind: 'changed', label: 'Heading', before: 'Welcome', after: 'Your new smile' },
  { kind: 'changed', label: 'Alignment', before: 'start', after: 'center' },
];

function lines(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

/** What a sighted reader sees on a line: the aria-hidden visual, with its glyph dropped. */
function seen(line: HTMLElement): string {
  const visual = line.querySelector('.ck-agent-change__visual');
  expect(visual).toHaveAttribute('aria-hidden', 'true');
  return (visual?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('ChangeLines', () => {
  it('draws nothing for no changes', () => {
    const { container } = render(<ChangeLines locale="en" changes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows every change when there are three or fewer, with no "show all"', () => {
    render(<ChangeLines locale="en" changes={HERO_EDIT.slice(0, 3)} />);
    expect(lines()).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads each change as one sentence, and shows it as label, values and arrow', () => {
    render(<ChangeLines locale="en" changes={HERO_EDIT.slice(0, 3)} />);
    const [changed, added, removed] = lines();
    if (changed === undefined || added === undefined || removed === undefined)
      throw new Error('lines');

    expect(within(changed).getByText('Background: from “light” to “deep navy”')).toHaveClass(
      'bldr-visually-hidden',
    );
    expect(seen(changed)).toBe('Background“light”“deep navy”');
    expect(changed.querySelector('svg[data-icon="arrowEnd"]')).toHaveAttribute('data-mirror');

    expect(within(added).getByText('Button: added “WhatsApp”')).toHaveClass('bldr-visually-hidden');
    expect(seen(added)).toBe('Button+“WhatsApp”');

    expect(within(removed).getByText('Subtitle: removed “Book online”')).toHaveClass(
      'bldr-visually-hidden',
    );
    // U+2212 MINUS SIGN, the width of the plus beside it, not a hyphen.
    expect(seen(removed)).toBe('Subtitle−“Book online”');
  });

  it('names a restyled or moved block, then says what happened to it in the catalog’s word', () => {
    // No words to set before and after an arrow: "make the hero darker" changed a class.
    render(
      <ChangeLines
        locale="en"
        changes={[
          { kind: 'restyled', label: 'Section', value: 'Hero' },
          { kind: 'moved', label: 'Section', value: 'Pricing' },
        ]}
      />,
    );
    const [restyled, moved] = lines();
    if (restyled === undefined || moved === undefined) throw new Error('lines');

    expect(within(restyled).getByText('Section: new look for “Hero”')).toHaveClass(
      'bldr-visually-hidden',
    );
    expect(seen(restyled)).toBe('Section“Hero”New look');
    expect(restyled.querySelector('.ck-agent-change__word')).toHaveTextContent('New look');
    // Not a before → after: no arrow, and no sign.
    expect(restyled.querySelector('svg, .ck-agent-change__sign')).toBeNull();

    expect(within(moved).getByText('Section: moved “Pricing”')).toHaveClass('bldr-visually-hidden');
    expect(seen(moved)).toBe('Section“Pricing”Moved');
  });

  it('says it in Arabic too', () => {
    render(
      <ChangeLines
        locale="ar"
        changes={[
          { kind: 'restyled', label: 'القسم', value: 'البطل' },
          { kind: 'moved', label: 'القسم', value: 'الأسعار' },
        ]}
      />,
    );
    const [restyled, moved] = lines();
    if (restyled === undefined || moved === undefined) throw new Error('lines');
    expect(seen(restyled)).toBe('القسم«البطل»مظهر جديد');
    expect(within(restyled).getByText('القسم: تغيّر مظهر «البطل»')).toBeInTheDocument();
    expect(seen(moved)).toBe('القسم«الأسعار»موضع جديد');
    expect(within(moved).getByText('القسم: نُقل «الأسعار» إلى موضع جديد')).toBeInTheDocument();
  });

  it('quotes the way the locale quotes, and isolates every page word', () => {
    render(
      <ChangeLines
        locale="ar"
        changes={[{ kind: 'changed', label: 'الخلفية', before: 'فاتحة', after: 'Deep navy' }]}
      />,
    );
    const [line] = lines();
    if (line === undefined) throw new Error('no line');
    expect(seen(line)).toBe('الخلفية«فاتحة»«Deep navy»');
    expect(within(line).getByText('الخلفية: من «فاتحة» إلى «Deep navy»')).toBeInTheDocument();
    const isolated = [...line.querySelectorAll('.ck-agent-change__visual bdi')].map(
      (bdi) => bdi.textContent,
    );
    expect(isolated).toEqual(['الخلفية', 'فاتحة', 'Deep navy']);
  });

  it('shows three of more, then reveals the rest and moves focus to the first one revealed', async () => {
    const user = userEvent.setup();
    render(<ChangeLines locale="en" changes={HERO_EDIT} />);
    expect(lines()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Show all changes (5)' }));
    const all = lines();
    expect(all).toHaveLength(5);
    expect(all[3]).toHaveFocus();
    // Nothing is left to show, so the button is gone rather than lying about it.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is a disclosure while it is there: collapsed, and naming the list it opens', () => {
    render(<ChangeLines locale="en" changes={HERO_EDIT} />);
    const button = screen.getByRole('button', { name: 'Show all changes (5)' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const list = screen.getByRole('list');
    expect(list.id).not.toBe('');
    expect(button).toHaveAttribute('aria-controls', list.id);
  });

  describe('the reveal', () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));

    beforeEach(() => {
      animate.mockClear();
      // jsdom has neither the Web Animations API nor media queries.
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        value: animate,
        configurable: true,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      Reflect.deleteProperty(window, 'matchMedia');
    });

    /** Three lines are 66px tall and five are 110px; the tokens are the theme's. */
    function renderMeasured() {
      render(<ChangeLines locale="en" changes={HERO_EDIT} />);
      const list = screen.getByRole('list');
      list.style.setProperty('--bldr-duration-enter', '220ms');
      list.style.setProperty('--bldr-easing-enter', 'cubic-bezier(0.16, 1, 0.3, 1)');
      vi.spyOn(list, 'getBoundingClientRect')
        .mockReturnValueOnce(new DOMRect(0, 0, 264, 66))
        .mockReturnValue(new DOMRect(0, 0, 264, 110));
      return list;
    }

    it('grows the list from three lines to all of them over the enter tokens', async () => {
      // SPEC §5 moment 8: a disclosure opens over `enter`, 220ms, `easing-enter`, so the
      // record's footer glides down instead of jumping.
      const user = userEvent.setup();
      const list = renderMeasured();
      await user.click(screen.getByRole('button', { name: 'Show all changes (5)' }));

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.contexts[0]).toBe(list);
      expect(animate).toHaveBeenCalledWith([{ blockSize: '66px' }, { blockSize: '110px' }], {
        duration: 220,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    });

    it('opens at once under reduced motion', async () => {
      const user = userEvent.setup();
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
      });
      renderMeasured();
      await user.click(screen.getByRole('button', { name: 'Show all changes (5)' }));
      expect(animate).not.toHaveBeenCalled();
      expect(lines()).toHaveLength(5);
    });
  });

  it('counts in the locale', () => {
    render(<ChangeLines locale="ar" changes={HERO_EDIT} />);
    expect(screen.getByRole('button', { name: 'عرض كل التغييرات (5)' })).toBeInTheDocument();
  });

  it('honours a different limit', () => {
    render(<ChangeLines locale="en" changes={HERO_EDIT} limit={1} />);
    expect(lines()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Show all changes (5)' })).toBeInTheDocument();
  });
});

describe('ChangeLines.css', () => {
  it('reads in Read type: labels in Slate, values in Graphite', () => {
    const root = /\.ck-agent-changes\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(root).toMatch(/font-size:\s*var\(--bldr-font-size-read\)/);
    const label = /\.ck-agent-change__label\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(label).toMatch(/color:\s*var\(--bldr-panel-muted\)/);
    const values = /\.ck-agent-change__values\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(values).toMatch(/color:\s*var\(--bldr-panel-text-soft\)/);
    // What happened to a restyled or moved block is a verb, in Slate like the arrow.
    const word = /\.ck-agent-change__word\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(word).toMatch(/color:\s*var\(--bldr-panel-muted\)/);
  });

  it('gives the label a 96px column once the panel is 400px wide', () => {
    const wide = /@container agent \(min-width: 400px\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
    expect(wide).toMatch(/grid-template-columns:\s*96px\s+minmax\(0,\s*1fr\)/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
