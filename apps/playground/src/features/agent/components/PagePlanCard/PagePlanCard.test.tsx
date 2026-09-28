/**
 * PagePlanCard (SPEC §4.11, frame §3.7): the editable page plan, a decision surface.
 *
 * Edits run through the controller's plan path in miniature (`useLivePlan`): each op goes
 * through the model's `applyPlanOp` over the engine's validated plan, so "Edited", the
 * limits and the problems come from the same code the product runs, and the announcement
 * is the sentence LiveStatus would speak (`plan.moved`, `plan.removed`).
 *
 * Every focus destination is asserted by name (SPEC §6.3), never as "focus left X".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale, PlanView } from '../../model/view-types';
import {
  dentalDraft,
  planApproval,
  planAtMaximum,
  planAtMinimum,
  planDrafting,
  planDuplicateTitle,
  planLowContrast,
  planReadOnly,
  planReady,
  useLivePlan,
  type PlanFrame,
} from '../../testing/wp-13-decisions-fixtures';
import { buildSkeleton } from '../../testing/wp-12-records-fixtures';
import { BuildRecord, type BuildRecordActions } from '../BuildRecord';
import { EndNote } from '../EndNote';

import { PagePlanCard, type PagePlanCardActions } from './PagePlanCard';

/* Radix measures its menus and popovers; jsdom has no ResizeObserver. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const DIR = join(process.cwd(), 'src', 'features', 'agent', 'components', 'PagePlanCard');
const CSS = ['PagePlanCard.css', 'DecisionCard.css']
  .map((file) => readFileSync(join(DIR, file), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function fakeActions(overrides: Partial<PagePlanCardActions> = {}): PagePlanCardActions {
  return {
    build: vi.fn<(turnId: string) => void>(),
    discard: vi.fn<(turnId: string) => void>(),
    editPlan: vi.fn<PagePlanCardActions['editPlan']>(),
    ...overrides,
  };
}

function buildActions(): BuildRecordActions {
  const noop = () => undefined;
  return {
    undoSection: noop,
    redoSection: noop,
    undoBuild: noop,
    redoBuild: noop,
    retrySections: noop,
    finishRest: noop,
    removeEmpty: noop,
    tryAgain: noop,
    reveal: noop,
    peek: noop,
    openPageHistory: noop,
  };
}

/** A card the person can really edit, and what LiveStatus would say after each move. */
function LiveCard({
  locale = 'en',
  frame = {},
  actions = {},
}: {
  readonly locale?: Locale;
  readonly frame?: PlanFrame;
  readonly actions?: Partial<PagePlanCardActions>;
}) {
  const plan = useLivePlan(locale, dentalDraft(locale), frame);
  return (
    <>
      <PagePlanCard
        locale={locale}
        view={plan.view}
        actions={fakeActions({ editPlan: plan.edit, ...actions })}
        accepts={plan.accepts}
      />
      <output data-testid="said">{plan.announcement ?? ''}</output>
    </>
  );
}

/** The panel as far as an answer needs it: the turn's `<li>` and the composer. */
function Thread({ view }: { readonly view: PlanView }) {
  const [answer, setAnswer] = useState<'none' | 'built' | 'discarded'>('none');
  return (
    <div className="ck-agent">
      <ol>
        <li>
          {answer === 'built' ? (
            <BuildRecord
              locale="en"
              view={buildSkeleton('en')}
              actions={buildActions()}
              onMenuSelect={() => undefined}
            />
          ) : answer === 'discarded' ? (
            <EndNote locale="en" view={{ turnId: view.turnId, key: 'planDiscarded' }} />
          ) : (
            <PagePlanCard
              locale="en"
              view={view}
              actions={fakeActions({
                build: () => {
                  setAnswer('built');
                },
                discard: () => {
                  setAnswer('discarded');
                },
              })}
            />
          )}
        </li>
      </ol>
      <textarea aria-label="Message" />
    </div>
  );
}

function rowTitles(): string[] {
  const list = screen.getByRole('list', { name: /^Sections/u });
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.ck-agent-plan-row__title')?.textContent ?? '');
}

function said(): string {
  return screen.getByTestId('said').textContent;
}

describe('PagePlanCard', () => {
  it('is a decision named "Page plan", with its subject, its sections and the build note', () => {
    render(<PagePlanCard locale="en" view={planReady('en')} actions={fakeActions()} />);
    const card = screen.getByRole('article', { name: 'Page plan' });
    expect(card).toHaveTextContent('Dental clinic, Amman');
    expect(screen.getByRole('list', { name: 'Sections (8)' })).toBeInTheDocument();
    expect(rowTitles()).toEqual([
      'Header',
      'Hero',
      'Services',
      'Why us',
      'Doctors',
      'Testimonials',
      'FAQ',
      'Contact',
    ]);
    expect(card).toHaveTextContent('Builds exactly the sections shown.');
    expect(card).not.toHaveTextContent('Edited');
    expect(screen.getByRole('button', { name: 'Build this page' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('draws the structured direction as an editor: mood, five colours, the font pair', () => {
    render(<PagePlanCard locale="en" view={planReady('en')} actions={fakeActions()} />);
    expect(screen.getByRole('textbox', { name: 'Style' })).toHaveValue('Calm, clinical, teal');
    const colours = screen.getByRole('group', { name: 'Colours' });
    expect(within(colours).getAllByRole('button')).toHaveLength(5);
    expect(
      screen.getByRole('button', { name: 'Fonts: Reem Kufi / IBM Plex Sans Arabic' }),
    ).toBeInTheDocument();
  });

  it('speaks Arabic in Arabic', () => {
    render(<PagePlanCard locale="ar" view={planReady('ar')} actions={fakeActions()} />);
    expect(screen.getByRole('article', { name: 'خطة الصفحة' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'الأقسام (8)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بناء هذه الصفحة' })).toBeInTheDocument();
  });

  it('tags the plan "Edited" once the person has changed it', async () => {
    const user = userEvent.setup();
    render(<LiveCard />);
    const card = screen.getByRole('article', { name: 'Page plan' });
    expect(card).not.toHaveTextContent('Edited');

    await user.dblClick(within(card).getByText('Testimonials'));
    const field = screen.getByRole('textbox', { name: 'Rename Testimonials' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Patient stories{Enter}');

    expect(rowTitles()).toContain('Patient stories');
    expect(card).toHaveTextContent('Edited');
  });

  it('shows "Waiting for your approval" in Ask mode', () => {
    render(<PagePlanCard locale="en" view={planApproval('en')} actions={fakeActions()} />);
    expect(screen.getByRole('article', { name: 'Page plan' })).toHaveTextContent(
      'Waiting for your approval',
    );
  });

  describe('reorder', () => {
    it('moves a section with Alt+↓ and Alt+↑, announces it, and keeps focus on its handle', async () => {
      const user = userEvent.setup();
      render(<LiveCard />);

      screen.getByRole('button', { name: 'Reorder Services' }).focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(rowTitles().slice(2, 4)).toEqual(['Why us', 'Services']);
      expect(said()).toBe('Moved Services to position 4 of 8');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reorder Services' })).toHaveFocus();
      });

      await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
      expect(rowTitles().slice(2, 4)).toEqual(['Services', 'Why us']);
      expect(said()).toBe('Moved Services to position 3 of 8');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reorder Services' })).toHaveFocus();
      });
    });

    it('does nothing at the edge: the first section has nowhere up to go', async () => {
      const user = userEvent.setup();
      const editPlan = vi.fn<PagePlanCardActions['editPlan']>();
      render(
        <PagePlanCard locale="en" view={planReady('en')} actions={fakeActions({ editPlan })} />,
      );
      screen.getByRole('button', { name: 'Reorder Header' }).focus();
      await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
      expect(editPlan).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Reorder Header' })).toHaveFocus();
    });

    it('moves a section from its menu, announces it, and returns focus to its [⋯]', async () => {
      const user = userEvent.setup();
      render(<LiveCard />);

      await user.click(screen.getByRole('button', { name: 'Options for FAQ' }));
      await user.click(screen.getByRole('menuitem', { name: 'Move up' }));

      expect(rowTitles().slice(5, 7)).toEqual(['FAQ', 'Testimonials']);
      expect(said()).toBe('Moved FAQ to position 6 of 8');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Options for FAQ' })).toHaveFocus();
      });
    });

    it('offers Move up on the first section as unavailable', async () => {
      const user = userEvent.setup();
      render(<LiveCard />);
      await user.click(screen.getByRole('button', { name: 'Options for Header' }));
      expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });

  describe('limits', () => {
    it('keeps two sections: Remove stays reachable, refused, with the reason written under it', async () => {
      const user = userEvent.setup();
      const editPlan = vi.fn<PagePlanCardActions['editPlan']>();
      render(
        <PagePlanCard locale="en" view={planAtMinimum('en')} actions={fakeActions({ editPlan })} />,
      );
      await user.click(screen.getByRole('button', { name: 'Options for Hero' }));
      const remove = screen.getByRole('menuitem', { name: /^Remove section/u });
      expect(remove).toHaveAttribute('aria-disabled', 'true');
      expect(remove).toHaveAccessibleDescription('A page needs at least two sections');
      expect(within(remove).getByText('A page needs at least two sections')).toBeVisible();

      await user.click(remove);
      expect(editPlan).not.toHaveBeenCalled();
    });

    it('removes a section above the floor and hands focus to the row that took its place', async () => {
      const user = userEvent.setup();
      render(<LiveCard />);
      await user.click(screen.getByRole('button', { name: 'Options for Doctors' }));
      await user.click(screen.getByRole('menuitem', { name: 'Remove section' }));

      expect(rowTitles()).not.toContain('Doctors');
      expect(screen.getByRole('list', { name: 'Sections (7)' })).toBeInTheDocument();
      expect(said()).toBe('Removed Doctors from the plan');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Options for Testimonials' })).toHaveFocus();
      });
    });

    it('holds twelve: Add section stays reachable, refused, with the reason shown', async () => {
      const user = userEvent.setup();
      const editPlan = vi.fn<PagePlanCardActions['editPlan']>();
      render(
        <PagePlanCard locale="en" view={planAtMaximum('en')} actions={fakeActions({ editPlan })} />,
      );
      expect(screen.getByRole('list', { name: 'Sections (12)' })).toBeInTheDocument();
      const add = screen.getByRole('button', { name: 'Add section' });
      expect(add).toHaveAttribute('aria-disabled', 'true');
      expect(add).toHaveAccessibleDescription('A plan holds up to 12 sections');
      expect(screen.getByText('A plan holds up to 12 sections')).toBeVisible();

      await user.click(add);
      expect(screen.queryByRole('textbox', { name: 'Add section' })).toBeNull();
      expect(editPlan).not.toHaveBeenCalled();
    });

    it('adds a section before the page’s closing footer, and keeps the field open', async () => {
      const user = userEvent.setup();
      render(<LiveCard />);
      await user.click(screen.getByRole('button', { name: 'Add section' }));
      const field = screen.getByRole('textbox', { name: 'Add section' });
      expect(field).toHaveFocus();

      await user.type(field, '  Pricing  {Enter}');
      expect(rowTitles().slice(-2)).toEqual(['Pricing', 'Contact']);
      expect(screen.getByRole('textbox', { name: 'Add section' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Add section' })).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('textbox', { name: 'Add section' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Add section' })).toHaveFocus();
    });
  });

  describe('Build this page', () => {
    it('is refused while a colour pair cannot be read, and says why in the words under it', async () => {
      const user = userEvent.setup();
      const build = vi.fn<(turnId: string) => void>();
      render(
        <PagePlanCard locale="en" view={planLowContrast('en')} actions={fakeActions({ build })} />,
      );
      const button = screen.getByRole('button', { name: 'Build this page' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription("Text and background don't contrast enough");
      await user.click(button);
      expect(build).not.toHaveBeenCalled();
      // The reason replaces the note: the note promises a build that cannot happen yet.
      expect(screen.queryByText('Builds exactly the sections shown.')).toBeNull();
    });

    it('is refused while two sections share a name, and marks both', () => {
      const { container } = render(
        <PagePlanCard locale="en" view={planDuplicateTitle('en')} actions={fakeActions()} />,
      );
      expect(screen.getByRole('button', { name: 'Build this page' })).toHaveAccessibleDescription(
        'Each section needs its own name',
      );
      expect(container.querySelectorAll('.ck-agent-plan-row[data-duplicate]')).toHaveLength(2);
    });

    it('builds this plan and sends focus to the new build record’s head', async () => {
      const user = userEvent.setup();
      render(<Thread view={planReady('en')} />);
      await user.click(screen.getByRole('button', { name: 'Build this page' }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 3 })).toHaveFocus();
      });
      expect(screen.queryByRole('article', { name: 'Page plan' })).toBeNull();
      expect(screen.getByRole('heading', { level: 3 }).closest('.ck-agent-record')).not.toBeNull();
    });

    it('calls the controller with its own turn', async () => {
      const user = userEvent.setup();
      const build = vi.fn<(turnId: string) => void>();
      render(
        <PagePlanCard
          locale="en"
          view={planReady('en', { turnId: 'turn-7' })}
          actions={fakeActions({ build })}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Build this page' }));
      expect(build).toHaveBeenCalledWith('turn-7');
    });
  });

  it('discards the plan and sends focus to the composer', async () => {
    const user = userEvent.setup();
    render(<Thread view={planReady('en')} />);
    await user.click(screen.getByRole('button', { name: 'Discard plan' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();
    });
    expect(screen.getByRole('article', { name: 'Plan discarded' })).toBeInTheDocument();
  });

  describe('read-only fallback (SPEC §7.6 E6, E7 absent)', () => {
    it('shows titles and the direction prose, with nothing to drag, rename or add', () => {
      render(
        <PagePlanCard locale="en" view={planReadOnly('en', 'exact')} actions={fakeActions()} />,
      );
      expect(rowTitles()).toHaveLength(8);
      expect(screen.queryByRole('button', { name: /^Reorder/u })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Options for/u })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add section' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Style' })).toBeNull();
      expect(
        screen.getByText('Calm and clinical, a teal accent and a Kufi face for headings'),
      ).toBeInTheDocument();
      expect(screen.getByText('Builds exactly the sections shown.')).toBeInTheDocument();
    });

    it('says the built page may differ when Build will re-plan', () => {
      render(
        <PagePlanCard locale="en" view={planReadOnly('en', 'mayDiffer')} actions={fakeActions()} />,
      );
      expect(screen.getByText('The built page may differ from this outline.')).toBeInTheDocument();
      expect(screen.queryByText('Builds exactly the sections shown.')).toBeNull();
    });
  });

  it('says so when the layout was written before approval (SPEC §7.6 E0c)', () => {
    render(
      <PagePlanCard locale="ar" view={planApproval('ar')} actions={fakeActions()} layoutPrepared />,
    );
    expect(screen.getByText(t('ar', 'plan.layoutPrepared'))).toBeInTheDocument();
  });

  it('is a working record while the plan is being drafted', () => {
    render(<PagePlanCard locale="en" view={planDrafting('en')} actions={fakeActions()} />);
    const record = screen.getByRole('article', { name: 'Page plan' });
    expect(record).toHaveClass('ck-agent-record');
    expect(record).toHaveTextContent('Drafting the plan…');
    expect(screen.queryByRole('button', { name: 'Build this page' })).toBeNull();
  });

  it('carries no live region of its own (SPEC §6.1: LiveStatus is the only one)', () => {
    const { container } = render(
      <PagePlanCard locale="en" view={planReady('en')} actions={fakeActions()} />,
    );
    expect(
      container.querySelectorAll('[aria-live], [role=status], [role=log], [role=alert]'),
    ).toHaveLength(0);
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/text-align:\s*(?:left|right)/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
    expect(CSS).not.toMatch(/translateX/u);
  });
});
