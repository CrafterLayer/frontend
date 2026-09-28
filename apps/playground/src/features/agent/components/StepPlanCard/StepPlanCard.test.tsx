/**
 * StepPlanCard (SPEC §4.12): Plan mode's answer to an edit request, and the end of Plan
 * mode's old dead end, a plan that could only be read.
 *
 * Focus destinations are asserted by name (SPEC §6.3): Run this plan → the new edit
 * record's head; Discard → the composer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { editRunning } from '../../testing/wp-12-records-fixtures';
import { stepsDrafting, stepsPageWide, stepsReady } from '../../testing/wp-13-decisions-fixtures';
import { EditRecord } from '../EditRecord';
import { EndNote } from '../EndNote';

import { StepPlanCard, type StepPlanCardActions } from './StepPlanCard';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'StepPlanCard', 'StepPlanCard.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function fakeActions(overrides: Partial<StepPlanCardActions> = {}): StepPlanCardActions {
  return {
    runSteps: vi.fn<(turnId: string) => void>(),
    discard: vi.fn<(turnId: string) => void>(),
    ...overrides,
  };
}

function Thread() {
  const [answer, setAnswer] = useState<'none' | 'ran' | 'discarded'>('none');
  return (
    <div className="ck-agent">
      <ol>
        <li>
          {answer === 'ran' ? (
            <EditRecord
              locale="en"
              view={editRunning('en')}
              actions={{
                undoEdit: () => undefined,
                redoEdit: () => undefined,
                reveal: () => undefined,
                openPageHistory: () => undefined,
              }}
              onMenuSelect={() => undefined}
            />
          ) : answer === 'discarded' ? (
            <EndNote locale="en" view={{ turnId: 'turn-steps', key: 'planDiscarded' }} />
          ) : (
            <StepPlanCard
              locale="en"
              view={stepsReady('en')}
              actions={fakeActions({
                runSteps: () => {
                  setAnswer('ran');
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

describe('StepPlanCard', () => {
  it('lists the steps in order, each naming the block it touches', () => {
    render(<StepPlanCard locale="en" view={stepsReady('en')} actions={fakeActions()} />);
    const card = screen.getByRole('article', { name: 'Change plan' });
    const steps = within(card).getAllByRole('listitem');
    expect(within(card).getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Rename the heading to “Questions patients ask”');
    expect(steps[0]).toHaveTextContent('In FAQ');
    expect(steps[2]).toHaveTextContent('In Header');
    expect(card).toHaveTextContent('Nothing changes until the plan runs.');
  });

  it('shows a page-wide step without a block', () => {
    render(<StepPlanCard locale="en" view={stepsPageWide('en')} actions={fakeActions()} />);
    const [step] = screen.getAllByRole('listitem');
    expect(step).toHaveTextContent('Set the page to read right to left');
    expect(step).not.toHaveTextContent(/^In /u);
    expect(step?.querySelector('.ck-agent-steps__target')).toBeNull();
  });

  it('speaks Arabic in Arabic, the block in «»', () => {
    render(<StepPlanCard locale="ar" view={stepsReady('ar')} actions={fakeActions()} />);
    expect(screen.getByRole('article', { name: 'خطة التعديل' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'الخطوات' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('في «الأسئلة الشائعة»');
    expect(screen.getByRole('button', { name: 'تنفيذ الخطة' })).toBeInTheDocument();
  });

  it('runs the plan with its own turn and sends focus to the new record’s head', async () => {
    const user = userEvent.setup();
    render(<Thread />);
    await user.click(screen.getByRole('button', { name: 'Run this plan' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3 })).toHaveFocus();
    });
    expect(screen.getByRole('heading', { level: 3 }).closest('.ck-agent-edit')).not.toBeNull();
  });

  it('calls the controller with its own turn', async () => {
    const user = userEvent.setup();
    const runSteps = vi.fn<(turnId: string) => void>();
    render(
      <StepPlanCard locale="en" view={stepsReady('en')} actions={fakeActions({ runSteps })} />,
    );
    await user.click(screen.getByRole('button', { name: 'Run this plan' }));
    expect(runSteps).toHaveBeenCalledWith('turn-steps');
  });

  it('discards and sends focus to the composer', async () => {
    const user = userEvent.setup();
    render(<Thread />);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();
    });
  });

  it('is a working record while the steps are drafted', () => {
    render(<StepPlanCard locale="en" view={stepsDrafting()} actions={fakeActions()} />);
    const record = screen.getByRole('article', { name: 'Change plan' });
    expect(record).toHaveClass('ck-agent-record');
    expect(record).toHaveTextContent('Drafting the plan…');
    expect(screen.queryByRole('button', { name: 'Run this plan' })).toBeNull();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/text-align:\s*(?:left|right)/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
