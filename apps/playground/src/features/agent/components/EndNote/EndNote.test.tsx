/**
 * EndNote (SPEC §4.10): a turn that ended in one Slate line.
 *
 * Held here: every ending says its catalog sentence as the article's name and heading; nothing
 * on the page came of it, so it has no actions; its glyph never claims ink: the dashed ring
 * for an ending with nothing on the page, the note for a note said after a build that landed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { t } from '../../copy';
import { END_NOTE_KEYS, endNote } from '../../testing/wp-12-records-fixtures';

import { EndNote } from './EndNote';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'EndNote', 'EndNote.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('EndNote', () => {
  it.each(END_NOTE_KEYS)('%s: one line, named by it, and no action', (key) => {
    const { container } = render(<EndNote locale="en" view={endNote(key)} />);
    const line = t('en', `end.${key}`);
    expect(screen.getByRole('article', { name: line })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: line })).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.ck-agent-record__footer')).toBeNull();
  });

  it('draws the dashed ring when nothing reached the page, and never the ink', () => {
    const glyphs = END_NOTE_KEYS.map((key) => {
      const { container, unmount } = render(<EndNote locale="en" view={endNote(key)} />);
      const state = container.querySelector('.ck-agent-glyph')?.getAttribute('data-state');
      unmount();
      return [key, state];
    });
    expect(Object.fromEntries(glyphs)).toEqual({
      proposalDiscarded: 'absent',
      planDiscarded: 'absent',
      planSuperseded: 'absent',
      stoppedBeforeChange: 'absent',
      interrupted: 'absent',
      siteAsOnePage: 'note',
      newPageAppended: 'note',
      appendedNotReplaced: 'note',
    });
  });

  it('speaks Arabic in Arabic', () => {
    render(<EndNote locale="ar" view={endNote('proposalDiscarded')} />);
    expect(screen.getByRole('heading', { name: 'تم تجاهل الاقتراح' })).toBeInTheDocument();
  });
});

describe('EndNote.css', () => {
  it('writes the line in Slate, regular weight, wrapping rather than clipping', () => {
    expect(CSS).toMatch(/color:\s*var\(--bldr-panel-muted\)/);
    expect(CSS).toMatch(/font-weight:\s*var\(--bldr-font-weight-regular\)/);
    expect(CSS).toMatch(/white-space:\s*normal/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
