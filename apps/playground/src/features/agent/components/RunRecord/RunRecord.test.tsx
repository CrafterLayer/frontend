/**
 * RunRecord (SPEC §4.6): the unboxed shell every past run is drawn in.
 *
 * The accessibility promise this file holds for all of them: a record is an `<article>`
 * named by its `h3`, and the state it is in is said by that title in words ("Page built",
 * "Build stopped"). The glyph beside it is decoration and adds nothing to the name, so no
 * state is ever carried by colour or shape alone (SPEC §2.1 rule 1, §4.7).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { RUN_GLYPH_STATES } from '../RunGlyph';

import { RunRecord } from './RunRecord';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'RunRecord', 'RunRecord.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\}|,)\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(CSS);
  if (match?.[1] === undefined) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe('RunRecord', () => {
  it('keeps a long target fully named for assistive technology while bounding its visual title', () => {
    const title = 'Refining the peace and war mural with a clearer responsive reading order';
    render(<RunRecord glyph="working" title={title} />);
    const article = screen.getByRole('article', { name: title });
    expect(within(article).getByRole('heading', { level: 3, name: title })).toHaveTextContent(
      title,
    );
    expect(ruleBody('.ck-agent-record__title')).toContain('-webkit-line-clamp: 2');
  });

  it('is an article named by its h3 title', () => {
    render(<RunRecord glyph="landed" title="Page built" />);
    const article = screen.getByRole('article', { name: 'Page built' });
    const heading = within(article).getByRole('heading', { level: 3, name: 'Page built' });
    expect(article).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('says its state in the title’s words: the glyph adds nothing to the name, in any state', () => {
    for (const state of RUN_GLYPH_STATES) {
      const { container, unmount } = render(<RunRecord glyph={state} title="Build stopped" />);
      expect(screen.getByRole('article')).toHaveAccessibleName('Build stopped');
      const glyph = container.querySelector('.ck-agent-glyph');
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      expect(glyph).toHaveAttribute('data-state', state);
      unmount();
    }
  });

  it('offers its heading as a focus destination', () => {
    const headingRef = createRef<HTMLHeadingElement>();
    render(<RunRecord glyph="working" title="Building the page" headingRef={headingRef} />);
    const heading = screen.getByRole('heading', { name: 'Building the page' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(headingRef.current).toBe(heading);
    headingRef.current?.focus();
    expect(heading).toHaveFocus();
  });

  it('keeps an interpolated title isolated', () => {
    render(
      <RunRecord
        glyph="landed"
        title={
          <>
            عُدِّل «<bdi>Hero</bdi>»
          </>
        }
      />,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('عُدِّل «Hero»');
    expect(heading.querySelector('bdi')).toHaveTextContent('Hero');
  });

  it('sets each meta figure in its own LTR island', () => {
    const { container } = render(
      <RunRecord glyph="working" title="بناء الصفحة" meta={[{ text: '1/8' }]} />,
    );
    const figure = container.querySelector('.ck-agent-record__meta bdi');
    expect(figure).toHaveAttribute('dir', 'ltr');
    expect(figure).toHaveTextContent('1/8');
  });

  it('reads a figure’s label instead of the bare figure when one is given', () => {
    const { container } = render(
      <RunRecord
        glyph="working"
        title="Building the page"
        meta={[{ text: '1/8', label: '1 of 8 sections are on the page' }]}
      />,
    );
    const figure = container.querySelector('.ck-agent-record__meta bdi');
    expect(figure).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('1 of 8 sections are on the page')).toHaveClass('bldr-visually-hidden');
  });

  it('draws only the parts it is given', () => {
    const { container, rerender } = render(<RunRecord glyph="note" title="Answer" />);
    expect(container.querySelector('.ck-agent-record__meta')).toBeNull();
    expect(container.querySelector('.ck-agent-record__body')).toBeNull();
    expect(container.querySelector('.ck-agent-record__footer')).toBeNull();

    rerender(
      <RunRecord
        glyph="landed"
        title="Hero updated"
        meta={[{ text: '0:16' }]}
        actions={<button type="button">Undo</button>}
        menu={<button type="button">More options</button>}
      >
        <p>Background: light → deep navy</p>
      </RunRecord>,
    );
    const body = container.querySelector('.ck-agent-record__body');
    expect(body).toHaveTextContent('Background: light → deep navy');
    const footer = container.querySelector<HTMLElement>('.ck-agent-record__footer');
    if (footer === null) throw new Error('no footer');
    const buttons = within(footer).getAllByRole('button');
    // The menu closes the footer, at its inline end.
    expect(buttons.map((button) => button.textContent)).toEqual(['Undo', 'More options']);
    expect(footer.querySelector('.ck-agent-record__actions')).toHaveTextContent('Undo');
    expect(footer.querySelector('.ck-agent-record__menu')).toHaveTextContent('More options');
  });

  it('keeps the actions and the menu in two separate footer columns', () => {
    // The actions wrap within their own column, so an InlineConfirm taking the whole row
    // (message, then its answers) never pushes [⋯] onto a line of its own.
    const { container, rerender } = render(
      <RunRecord glyph="note" title="Answer" menu={<button type="button">More options</button>} />,
    );
    expect(container.querySelector('.ck-agent-record__actions')).toBeNull();
    expect(container.querySelector('.ck-agent-record__menu')).toHaveTextContent('More options');

    rerender(
      <RunRecord
        glyph="absent"
        title="Build stopped"
        actions={<button type="button">Finish the rest (3)</button>}
      />,
    );
    expect(container.querySelector('.ck-agent-record__actions')).toHaveTextContent(
      'Finish the rest (3)',
    );
    expect(container.querySelector('.ck-agent-record__menu')).toBeNull();
  });

  it('passes article attributes through', () => {
    render(<RunRecord glyph="landed" title="Page built" data-turn="t-7" />);
    expect(screen.getByRole('article')).toHaveAttribute('data-turn', 't-7');
  });
});

describe('RunRecord.css', () => {
  it('has no box: no border, no background, no radius', () => {
    const root = ruleBody('.ck-agent-record');
    expect(root).not.toMatch(/(^|[\s;])(border|background|border-radius|box-shadow)[\w-]*\s*:/);
  });

  it('puts the glyph in a 16px column, 8px before the title, on a 32px head row', () => {
    const head = ruleBody('.ck-agent-record__head');
    expect(head).toMatch(
      /grid-template-columns:\s*var\(--bldr-space-3xl\)\s+minmax\(0,\s*1fr\)\s+auto/,
    );
    expect(head).toMatch(/column-gap:\s*var\(--bldr-space-md\)/);
    expect(head).toMatch(/min-block-size:\s*var\(--bldr-control-md\)/);
  });

  it('sets the title in Heading type with a two-line visual bound and safe wrapping', () => {
    const title = ruleBody('.ck-agent-record__title');
    expect(title).toMatch(/font-size:\s*var\(--bldr-font-size-read\)/);
    expect(title).toMatch(/font-weight:\s*var\(--bldr-font-weight-semibold\)/);
    expect(title).toMatch(/color:\s*var\(--bldr-panel-text\)/);
    expect(title).toMatch(/white-space:\s*normal/);
    expect(title).toMatch(/overflow-wrap:\s*anywhere/);
    expect(title).toMatch(/-webkit-line-clamp:\s*2/);
    expect(title).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('sets meta figures in Figure type, tabular, in Slate', () => {
    const meta = ruleBody('.ck-agent-record__meta');
    expect(meta).toMatch(/font-size:\s*var\(--bldr-font-size-figure\)/);
    expect(meta).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(meta).toMatch(/color:\s*var\(--bldr-panel-muted\)/);
  });

  it('starts body lines and the footer 24px in, 4px under the head, 8px before the footer', () => {
    const body = ruleBody('.ck-agent-record__body');
    expect(body).toMatch(/margin-block-start:\s*var\(--bldr-space-xs\)/);
    expect(body).toMatch(/row-gap:\s*var\(--bldr-space-2xs\)/);
    expect(body).toMatch(/grid-template-columns:\s*var\(--bldr-space-3xl\)\s+minmax\(0,\s*1fr\)/);
    const footer = ruleBody('.ck-agent-record__footer');
    expect(footer).toMatch(/margin-block-start:\s*var\(--bldr-space-md\)/);
    expect(footer).toMatch(/padding-inline-start:\s*var\(--bldr-space-5xl\)/);
  });

  it('sets the footer as actions, then [⋯] at the inline end on the actions’ last row', () => {
    const footer = ruleBody('.ck-agent-record__footer');
    expect(footer).toMatch(/display:\s*grid/);
    expect(footer).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
    expect(footer).toMatch(/align-items:\s*end/);
    const actions = ruleBody('.ck-agent-record__actions');
    expect(actions).toMatch(/display:\s*flex/);
    expect(actions).toMatch(/flex-wrap:\s*wrap/);
    expect(actions).toMatch(/gap:\s*var\(--bldr-space-md\)/);
    expect(ruleBody('.ck-agent-record__menu')).toMatch(/grid-column:\s*2/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
