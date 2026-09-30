/**
 * BuildRecord (SPEC §4.8, §6.3, §6.5): one page build, in every phase.
 *
 * The honesty rules a record can break on screen, each held here:
 * - the head counts landed sections only (`landed/total`), read as a sentence; a live record
 *   has no clock (the RunBar owns the one clock), a settled one shows its final time;
 * - "Page built" only for `done`; a failed section makes it "Page built, 1 failed";
 * - row Undo only after `build.completed` (where the view gives it), and a revived Undo is
 *   `aria-disabled` and described by the caption that says why;
 * - the completion sweep plays once, only when this record saw every section land;
 * - Retry, Write the failed sections again, Finish the rest, Remove empty and Try again call
 *   the controller and never post a message; focus then goes to the record's head;
 * - nothing internal reaches the screen: no command names, skill ids, run ids, token counts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import { t, tAnnounce } from '../../copy';
import type { AgentController, BuildRecordView, Locale } from '../../model/view-types';
import {
  buildBlocked,
  buildBuilding,
  buildCollapsed,
  buildDone,
  buildEveryRowState,
  buildFailed,
  buildInterrupted,
  buildPartial,
  buildRevived,
  buildSkeleton,
  buildStopped,
  buildStopping,
  buildUndone,
  SECTION_TITLES,
  spineRows,
} from '../../testing/wp-12-records-fixtures';

import { BuildRecord } from './BuildRecord';

/* Radix measures its menu before positioning it; jsdom has no ResizeObserver. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

/**
 * A whole controller whose every action is a spy, created on first use: `called()` lists the
 * actions that ran, so "and nothing else" (no `send`, no `setDraft`) is one assertion.
 */
function fakeController() {
  const spies = new Map<string, Mock>();
  const controller = new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== 'string') return undefined;
        let spy = spies.get(key);
        if (spy === undefined) {
          spy = vi.fn();
          spies.set(key, spy);
        }
        return spy;
      },
    },
  ) as AgentController;
  const spy = (key: keyof AgentController): Mock => {
    void controller[key];
    const found = spies.get(key);
    if (found === undefined) throw new Error(`no spy for ${key}`);
    return found;
  };
  const called = (): string[] =>
    [...spies].filter(([, fn]) => fn.mock.calls.length > 0).map(([key]) => key);
  return { controller, spy, called };
}

function renderRecord(view: BuildRecordView, locale: Locale = 'en') {
  const fake = fakeController();
  const onMenuSelect = vi.fn();
  const utils = render(
    <BuildRecord
      locale={locale}
      view={view}
      actions={fake.controller}
      onMenuSelect={onMenuSelect}
    />,
  );
  const rerender = (next: BuildRecordView) => {
    utils.rerender(
      <BuildRecord
        locale={locale}
        view={next}
        actions={fake.controller}
        onMenuSelect={onMenuSelect}
      />,
    );
  };
  return { ...utils, ...fake, onMenuSelect, rerender };
}

function heading(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name });
}

/* ── Titles, glyphs and figures ───────────────────────────────────────────── */

describe('BuildRecord: the head says the state in words', () => {
  const TABLE: readonly (readonly [string, BuildRecordView, string, string])[] = [
    ['skeleton', buildSkeleton('en'), 'Laying out the page', 'working'],
    ['building', buildBuilding('en'), 'Building the page', 'working'],
    ['stopping', buildStopping('en'), 'Building the page', 'working'],
    ['done', buildDone('en'), 'Page built', 'landed'],
    ['partial', buildPartial('en'), 'Page built, 1 failed', 'partial'],
    ['stopped', buildStopped('en', 'signal'), 'Build stopped', 'absent'],
    ['budget', buildStopped('en', 'budget'), 'Build hit its time limit', 'absent'],
    ['maxTasks', buildStopped('en', 'maxTasks'), 'Build hit the section limit', 'absent'],
    ['interrupted', buildInterrupted('en', true), 'Interrupted by a reload', 'absent'],
    ['failed', buildFailed('en'), "Couldn't build the page", 'failed'],
    ['undone', buildUndone('en'), 'Build undone', 'absent'],
  ];

  it.each(TABLE)('%s: titled and glyphed by its phase', (_, view, title, glyph) => {
    const { container } = renderRecord(view);
    const article = screen.getByRole('article', { name: title });
    expect(heading(title)).toHaveAttribute('tabindex', '-1');
    expect(article.querySelector('.ck-agent-record__head .ck-agent-glyph')).toHaveAttribute(
      'data-state',
      glyph,
    );
    expect(container.querySelector('.ck-agent-build')).toHaveAttribute('data-phase', view.phase);
  });

  it('titles Arabic records in Arabic', () => {
    renderRecord(buildPartial('ar'), 'ar');
    expect(heading('بُنيت الصفحة، وتعذّر قسم واحد')).toBeInTheDocument();
  });
});

describe('BuildRecord: honest figures', () => {
  it('counts landed sections only while live, read as a sentence, with no clock', () => {
    // §3.4: one landed, one drafted, four writing: the draft is not counted.
    const view = buildBuilding('en');
    expect(view.rows.filter((row) => row.state === 'drafted')).toHaveLength(1);
    const { container } = renderRecord(view);
    const figure = container.querySelector('.ck-agent-record__meta');
    expect(figure).toHaveTextContent('1/8');
    expect(
      within(figure as HTMLElement).getByText(
        tAnnounce('en', 'build.progress', { done: 1, total: 8 }),
      ),
    ).toHaveClass('bldr-visually-hidden');
    expect(container.querySelector('.ck-agent-clock')).toBeNull();
  });

  it('keeps the count honest when the view says fewer landed than the rows could suggest', () => {
    const view: BuildRecordView = {
      ...buildBuilding('en'),
      rows: spineRows('en', ['landed', 'drafted', 'drafted', 'writing']),
      landed: 1,
      total: 4,
    };
    const { container } = renderRecord(view);
    expect(container.querySelector('.ck-agent-record__meta')).toHaveTextContent('1/4');
  });

  it('shows the final time once settled, and the count no more', () => {
    const { container } = renderRecord(buildDone('en'));
    expect(container.querySelector('.ck-agent-record__meta')).toHaveTextContent('2:21');
    expect(screen.getByText('8 sections on the page')).toBeInTheDocument();
  });

  it('shows no figure for a skeleton pass or an interrupted build', () => {
    const skeleton = renderRecord(buildSkeleton('en'));
    expect(skeleton.container.querySelector('.ck-agent-record__meta')).toBeNull();
    skeleton.unmount();
    const interrupted = renderRecord(buildInterrupted('en', true));
    expect(interrupted.container.querySelector('.ck-agent-record__meta')).toBeNull();
  });

  it('lays out the page without claiming any section yet (SPEC §3.3)', () => {
    const { container } = renderRecord(buildSkeleton('en'));
    expect(screen.getByText(t('en', 'build.live.skeleton'))).toHaveClass('ck-agent-lead__live');
    expect(screen.queryByRole('list')).toBeNull();
    expect(container.querySelector('.ck-agent-segment')).toHaveAttribute(
      'data-state',
      'indeterminate',
    );
  });

  it('shows the estimate while building, and the direction', () => {
    renderRecord(buildBuilding('en'));
    expect(screen.getByText('About 2 min left')).toBeInTheDocument();
    expect(document.querySelector('.ck-agent-direction')).not.toBeNull();
  });
});

/* ── Rows ─────────────────────────────────────────────────────────────────── */

describe('BuildRecord: rows say their state', () => {
  it('names every row with its state word', () => {
    renderRecord(buildEveryRowState('en'));
    const list = screen.getByRole('list', { name: 'Page sections' });
    const names = within(list)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Section 1 of 8: Header, On the page',
      'Section 2 of 8: Hero, Second try',
      'Section 3 of 8: Services, Writing',
      'Section 4 of 8: Why us, Written, waiting its turn',
      'Section 5 of 8: Doctors, Writing',
      'Section 6 of 8: Testimonials, Writing',
      'Section 7 of 8: FAQ, Waiting',
      'Section 8 of 8: Contact, Waiting',
    ]);
  });

  it('reveals a section when its row is activated', async () => {
    const user = userEvent.setup();
    const { spy } = renderRecord(buildBuilding('en'));
    await user.click(screen.getByRole('button', { name: /^Section 1 of 8/u }));
    expect(spy('reveal')).toHaveBeenCalledExactlyOnceWith('sec-1');
  });

  it('offers row Undo only after build.completed', () => {
    const { rerender } = renderRecord(buildBuilding('en'));
    expect(screen.queryAllByRole('button', { name: /^Undo /u })).toHaveLength(0);
    rerender(buildDone('en'));
    // One Undo per landed row, named by its section; "Undo build" is the footer's, not a row's.
    for (const title of SECTION_TITLES.en) {
      expect(screen.getByRole('button', { name: `Undo ${title}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /^Undo /u })).toHaveLength(
      SECTION_TITLES.en.length + 1,
    );
  });

  it('shows a revived Undo aria-disabled, described by the revived caption, and offers page history', async () => {
    const user = userEvent.setup();
    const { spy, called } = renderRecord(buildRevived('en'));
    const caption = screen.getByText(t('en', 'build.caption.revived'));
    const undos = screen.getAllByRole('button', { name: /^Undo /u });
    expect(undos).toHaveLength(8);
    for (const undo of undos) {
      expect(undo).toHaveAttribute('aria-disabled', 'true');
      expect(undo).toHaveAccessibleDescription(caption.textContent);
    }
    await user.click(undos[0]!);
    expect(called()).toEqual([]);
    await user.click(screen.getByRole('button', { name: t('en', 'build.pageHistory') }));
    expect(spy('openPageHistory')).toHaveBeenCalledOnce();
    // No Undo build either: the history it would undo belongs to a session that is gone.
    expect(screen.queryByRole('button', { name: t('en', 'footer.undoBuild') })).toBeNull();
  });

  it('undoes one row and keeps focus on that row’s button, now Redo', async () => {
    const user = userEvent.setup();
    const view = buildDone('en');
    const { spy, rerender } = renderRecord(view);
    const undo = screen.getByRole('button', { name: 'Undo Hero' });
    await user.click(undo);
    expect(spy('undoSection')).toHaveBeenCalledExactlyOnceWith(view.turnId, 'sec-2');
    rerender({
      ...view,
      rows: view.rows.map((row) =>
        row.position === 2
          ? { ...row, state: 'undone', undo: { kind: 'redo', transactionId: 'tx-undo-2' } }
          : row,
      ),
      landed: 7,
    });
    expect(screen.getByRole('button', { name: 'Redo Hero' })).toBe(undo);
    expect(undo).toHaveFocus();
  });
});

/* ── Actions: controller calls, never a message; focus to the head ─────────── */

describe('BuildRecord: actions call the controller, never post a message', () => {
  it('retries one failed row, and sends focus to the record’s head', async () => {
    const user = userEvent.setup();
    const view = buildPartial('en');
    const { spy, called } = renderRecord(view);
    await user.click(screen.getByRole('button', { name: 'Retry Doctors' }));
    expect(spy('retrySections')).toHaveBeenCalledExactlyOnceWith(view.turnId, ['sec-5']);
    expect(called()).toEqual(['retrySections']);
    expect(heading('Page built, 1 failed')).toHaveFocus();
  });

  it('writes every failed section again from the footer', async () => {
    const user = userEvent.setup();
    const view = buildPartial('en');
    const { spy, called } = renderRecord(view);
    await user.click(screen.getByRole('button', { name: 'Write the failed section again' }));
    expect(spy('retrySections')).toHaveBeenCalledExactlyOnceWith(view.turnId, ['sec-5']);
    expect(called()).toEqual(['retrySections']);
    expect(heading('Page built, 1 failed')).toHaveFocus();
  });

  it('finishes the rest, or removes the empty sections, of a stopped build', async () => {
    const user = userEvent.setup();
    const view = buildStopped('en', 'signal');
    const { spy, called } = renderRecord(view);
    expect(screen.getByText("3 sections weren't written")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish the rest (3)' }));
    expect(spy('finishRest')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(heading('Build stopped')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove empty sections (3)' }));
    expect(spy('removeEmpty')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(heading('Build stopped')).toHaveFocus();
    expect(called().sort()).toEqual(['finishRest', 'removeEmpty']);
  });

  it('lists sample details only for sections that landed on the page', async () => {
    const user = userEvent.setup();
    const base = buildStopped('en', 'signal');
    const landed = base.rows.find((row) => row.state === 'landed');
    const unwritten = base.rows.find((row) => row.state === 'notWritten');
    if (landed === undefined || unwritten === undefined) throw new Error('fixture changed');
    const view: BuildRecordView = {
      ...base,
      facts: [
        { sample: '25 JD', section: landed.title, nodeId: landed.key },
        { sample: '+966 50 123 4567', section: unwritten.title, nodeId: unwritten.key },
      ],
    };
    renderRecord(view);
    const toggle = screen.getByRole('button', { name: t('en', 'facts.toggle', { n: 1 }) });
    await user.click(toggle);
    expect(screen.getByText('25 JD')).toBeInTheDocument();
    expect(screen.queryByText('+966 50 123 4567')).toBeNull();
  });

  it('says a stopped row was not written, in words, at any width', () => {
    renderRecord(buildStopped('en', 'budget'));
    expect(screen.getByRole('button', { name: 'Section 6 of 8: Testimonials, Not written' })).toBeInTheDocument();
  });

  it('confirms Undo build in place, then undoes it and sends focus to the head', async () => {
    const user = userEvent.setup();
    const view = buildDone('en');
    const { spy, called } = renderRecord(view);
    await user.click(screen.getByRole('button', { name: 'Undo build' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(called()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(spy('undoBuild')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(heading('Page built')).toHaveFocus();
  });

  it('redoes an undone build', async () => {
    const user = userEvent.setup();
    const view = buildUndone('en');
    const { spy, called } = renderRecord(view);
    await user.click(screen.getByRole('button', { name: 'Redo build' }));
    expect(spy('redoBuild')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(called()).toEqual(['redoBuild']);
    expect(heading('Build undone')).toHaveFocus();
  });

  it('tries a failed build again, or removes its empty layout', async () => {
    const user = userEvent.setup();
    const view = buildFailed('en');
    const { spy, called } = renderRecord(view);
    expect(screen.getByText(t('en', 'error.unreachable.cause'))).toBeInTheDocument();
    expect(screen.getByText(t('en', 'error.page.skeleton'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(spy('tryAgain')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(heading("Couldn't build the page")).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove the empty layout' }));
    expect(spy('removeEmpty')).toHaveBeenCalledExactlyOnceWith(view.turnId);
    expect(called().sort()).toEqual(['removeEmpty', 'tryAgain']);
  });

  it('continues an interrupted build only when its section list was saved', () => {
    const resumable = renderRecord(buildInterrupted('en', true));
    expect(screen.getByText('3 of 8 sections landed before the reload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish the rest (5)' })).toBeInTheDocument();
    resumable.unmount();
    renderRecord(buildInterrupted('en', false));
    expect(screen.getByText(t('en', 'build.caption.notResumable'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Finish the rest/u })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove empty sections (5)' })).toBeInTheDocument();
  });

  it('adds Copy summary to a finished build’s footer, shown from 400px of panel', async () => {
    const user = userEvent.setup();
    const { container, onMenuSelect } = renderRecord(buildDone('en'));
    const footer = container.querySelector('.ck-agent-record__actions');
    if (!(footer instanceof HTMLElement)) throw new Error('no footer');
    const copy = within(footer).getByRole('button', { name: 'Copy summary' });
    expect(copy).toHaveClass('ck-agent-build__copy');
    expect(copy).toHaveAttribute('data-ck-tone', 'text');
    await user.click(copy);
    expect(onMenuSelect).toHaveBeenCalledExactlyOnceWith('copySummary');
    const css = readFileSync(
      join(process.cwd(), 'src', 'features', 'agent', 'components', 'BuildRecord', 'BuildRecord.css'),
      'utf8',
    );
    expect(css).toMatch(/\.ck-agent-build__copy[^{]*\{[^}]*display:\s*none/u);
    expect(css).toMatch(/@container agent \(inline-size >= 400px\)\s*\{[^@]*\.ck-agent-build__copy/u);
  });

  it('keeps Copy summary in the menu alone while a build is stopped', () => {
    const { container } = renderRecord(buildStopped('en', 'signal'));
    expect(container.querySelector('.ck-agent-build__copy')).toBeNull();
  });

  it('hands the menu’s choice to its caller', async () => {
    const user = userEvent.setup();
    const { onMenuSelect } = renderRecord(buildDone('en'));
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy summary' }));
    expect(onMenuSelect).toHaveBeenCalledExactlyOnceWith('copySummary');
  });

  it('never posts a message, whatever is pressed', async () => {
    const user = userEvent.setup();
    const { called } = renderRecord(buildPartial('en'));
    for (const name of ['Retry Doctors', 'Write the failed section again', 'Undo Hero']) {
      await user.click(screen.getByRole('button', { name }));
    }
    const ran = called();
    for (const forbidden of ['send', 'setDraft', 'continueQueued', 'reuse', 'sendAsWritten']) {
      expect(ran).not.toContain(forbidden);
    }
  });
});

/* ── Folding ──────────────────────────────────────────────────────────────── */

describe('BuildRecord: folding', () => {
  it('folds an older build to its head, caption and Show sections, and opens on request', async () => {
    const user = userEvent.setup();
    const { container } = renderRecord(buildCollapsed('en'));
    expect(screen.getByText('8 sections on the page')).toBeInTheDocument();
    // Head, caption and the toggle: no footer, no menu, no direction, no facts.
    expect(container.querySelector('.ck-agent-record__footer')).toBeNull();
    expect(container.querySelector('.ck-agent-direction')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Sample details/u })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show sections (8)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = container.querySelector('.ck-agent-build__sections');
    expect(region).toHaveAttribute('inert');
    const list = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(list).toHaveAttribute('aria-label', 'Page sections');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Hide sections');
    expect(toggle).toHaveFocus();
    expect(region).not.toHaveAttribute('inert');
    expect(container.querySelector('.ck-agent-record__footer')).not.toBeNull();
  });

  it('keeps the spine’s first stretch beside the caption of a folded build', () => {
    const { container } = renderRecord(buildCollapsed('en'));
    const segment = container.querySelector('.ck-agent-lead > .ck-agent-segment');
    expect(segment).toHaveAttribute('data-state', 'ink');
    expect(segment).toHaveAttribute('data-to', 'end');
  });

  it('folds the sections of a failed or undone build behind Show sections', () => {
    renderRecord(buildUndone('en'));
    expect(screen.getByRole('button', { name: 'Show sections (8)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

/* ── Motion, once and only while live ─────────────────────────────────────── */

describe('BuildRecord: the completion sweep', () => {
  function whole(): BuildRecordView {
    return buildDone('en');
  }

  it('sweeps once when the record saw every section land', () => {
    const { container, rerender } = renderRecord(buildBuilding('en'));
    expect(container.querySelector('ol[data-sweep]')).toBeNull();
    rerender(whole());
    expect(container.querySelector('ol')).toHaveAttribute('data-sweep');
  });

  it('never sweeps a partial build', () => {
    const { container, rerender } = renderRecord(buildBuilding('en'));
    rerender(buildPartial('en'));
    expect(container.querySelector('ol[data-sweep]')).toBeNull();
  });

  it('never sweeps a record that mounted already settled (history, a reload)', () => {
    const { container, rerender } = renderRecord(whole());
    rerender({ ...whole(), menu: ['reuse'] });
    expect(container.querySelector('ol[data-sweep]')).toBeNull();
  });

  it('lets the rows arrive only when they appear after the record mounted', () => {
    const { container, rerender } = renderRecord(buildSkeleton('en'));
    rerender(buildBuilding('en'));
    expect(container.querySelectorAll('li[data-arriving]')).toHaveLength(8);
    const settled = renderRecord(buildBuilding('en'));
    expect(settled.container.querySelectorAll('li[data-arriving]')).toHaveLength(0);
  });

  it('staggers landings in one moment 80ms apart, on the row and the stretch above it', () => {
    const { container, rerender } = renderRecord(buildBlocked('en'));
    // Hero lands, and the drafts below it (3 to 6) land within the same moment.
    const view = buildBlocked('en');
    act(() => {
      rerender({
        ...view,
        rows: view.rows.map((row) =>
          row.position >= 2 && row.position <= 6 ? { ...row, state: 'landed' } : row,
        ),
        landed: 6,
      });
    });
    const delayOf = (selector: string): string =>
      container.querySelector<HTMLElement>(selector)?.style.getPropertyValue(
        '--ck-agent-land-delay',
      ) ?? '';
    expect(delayOf('li[data-land-key="sec-2"]')).toBe('0ms');
    expect(delayOf('li[data-land-key="sec-3"]')).toBe('80ms');
    expect(delayOf('li[data-land-key="sec-6"]')).toBe('320ms');
    // The stretch above node 3 is drawn by row 2, and lands with row 3.
    expect(delayOf('.ck-agent-segment[data-land-key="sec-3"]')).toBe('80ms');
    // Row 1 was already ink, and is left alone.
    expect(delayOf('li[data-land-key="sec-1"]')).toBe('');
  });
});

/* ── Nothing internal on screen (SPEC §6.5) ───────────────────────────────── */

describe('BuildRecord: no internals on screen', () => {
  const EVERY_PHASE: readonly BuildRecordView[] = [
    buildSkeleton('en'),
    buildBuilding('en'),
    buildBlocked('en'),
    buildStopping('en'),
    buildDone('en'),
    buildPartial('en'),
    buildStopped('en', 'signal'),
    buildStopped('en', 'budget'),
    buildStopped('en', 'maxTasks'),
    buildInterrupted('en', true),
    buildInterrupted('en', false),
    buildFailed('en'),
    buildUndone('en'),
    buildRevived('en'),
    buildCollapsed('en'),
  ];

  it('shows no command names, skill ids, run ids, token counts or milliseconds', () => {
    for (const view of EVERY_PHASE) {
      const { container, unmount } = renderRecord(view);
      const text = container.textContent;
      expect(text, view.phase).not.toMatch(/setProp|craftkit\.|fill-\d|~?\d+(\.\d+)?k tokens|\d+ms\b|tokens?\b/iu);
      unmount();
    }
  });
});

/* ── CSS ──────────────────────────────────────────────────────────────────── */

describe('the records’ stylesheets', () => {
  const COMPONENTS = join(process.cwd(), 'src', 'features', 'agent', 'components');
  const MINE = [
    'UserMessage',
    'BuildRecord',
    'SpineList',
    'SpineRow',
    'DirectionLine',
    'FactsDisclosure',
    'EditRecord',
    'AnswerRecord',
    'EndNote',
    'ErrorRecord',
  ];
  const sheets = MINE.flatMap((name) =>
    readdirSync(join(COMPONENTS, name))
      .filter((file) => file.endsWith('.css'))
      .map((file) => ({
        file: `${name}/${file}`,
        css: readFileSync(join(COMPONENTS, name, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
      })),
  );

  it('finds every sheet', () => {
    expect(sheets.length).toBeGreaterThanOrEqual(13);
  });

  it('use logical properties only (SPEC §6.6)', () => {
    const physical =
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/;
    expect(sheets.filter(({ css }) => physical.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('use theme tokens for colour, never a raw colour (system colours only for forced colors)', () => {
    const raw = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/iu;
    expect(sheets.filter(({ css }) => raw.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('never letter-space, italicise or uppercase (SPEC §2.2: Arabic joins break)', () => {
    const forbidden = /letter-spacing|font-style:\s*italic|text-transform:\s*uppercase/u;
    expect(sheets.filter(({ css }) => forbidden.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('keep the ck-agent- class prefix', () => {
    for (const { file, css } of sheets) {
      for (const [, name] of css.matchAll(/\.([a-z][\w-]*)/giu)) {
        if (name === undefined || /^\d/u.test(name)) continue;
        expect(
          name.startsWith('ck-agent') || name.startsWith('bldr-'),
          `${file}: .${name}`,
        ).toBe(true);
      }
    }
  });

  it('draw the lead’s stretch from just under the head node (a 32px head, a 4px gap)', () => {
    const segment = sheets.find(({ file }) => file === 'SpineRow/SpineSegment.css')?.css ?? '';
    expect(segment).toMatch(
      /\[data-from='head'\] \{\s*inset-block-start: calc\(\s*-1 \* \(var\(--bldr-space-xs\) \+ var\(--bldr-control-md\) \/ 2 - var\(--ck-agent-node-reach\)\)\s*\);/,
    );
  });

  it('keep undo a row away under a fine pointer, and always in view under a coarse one', () => {
    const row = sheets.find(({ file }) => file === 'SpineRow/SpineRow.css')?.css ?? '';
    expect(row).toMatch(/@media \(pointer: coarse\) \{\s*\.ck-agent-spine-row__trailing\[data-reveal='hover'\] \{\s*opacity: 1;/);
  });

  it('mirror by logical properties alone: no direction is special-cased (SPEC §3.15)', () => {
    expect(sheets.filter(({ css }) => /\[dir=['"]?rtl/u.test(css)).map(({ file }) => file)).toEqual(
      [],
    );
  });
});
