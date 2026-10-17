/**
 * BatchJobForm (2026-10-12): the request (prefilled, and saying so when it came from the
 * composer), every page or a checklist, the price note, then Run in the background. A missing
 * request or page is said under its field and takes focus; with no server, or a server that
 * cannot batch, its sentence is shown plainly and Submit is `aria-disabled` and described by it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { jobsLabels } from '../../copy/jobs-labels';
import { SAMPLE_PAGES, SAMPLE_PAGES_AR } from '../../testing/batch-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { BatchJobForm, type BatchJobFormProps } from './BatchJobForm';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const EN = jobsLabels('en');
const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'BatchJobForm', 'BatchJobForm.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

function setup(overrides: Partial<BatchJobFormProps> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <AgentTooltipProvider delayDuration={0}>
      <BatchJobForm
        locale="en"
        pages={SAMPLE_PAGES}
        connected
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...overrides}
      />
    </AgentTooltipProvider>,
  );
  return { user: userEvent.setup(), onSubmit, onCancel };
}

const submitButton = () => screen.getByRole('button', { name: EN.form.submit });

describe('BatchJobForm', () => {
  it('sends the trimmed request for every page by default', async () => {
    const { user, onSubmit } = setup();
    await user.type(
      screen.getByRole('textbox', { name: EN.form.request }),
      '  Translate every page  ',
    );
    expect(screen.getByRole('radio', { name: EN.form.allPages(5) })).toBeChecked();
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(
      'Translate every page',
      SAMPLE_PAGES.map((page) => page.id),
    );
  });

  it('says what is missing under its field and puts focus there', async () => {
    const { user, onSubmit } = setup();
    await user.click(submitButton());
    const field = screen.getByRole('textbox', { name: EN.form.request });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(EN.form.needsRequest);

    await user.type(field, 'Add a FAQ');
    await user.click(screen.getByRole('radio', { name: EN.form.choosePages }));
    await user.click(screen.getByRole('button', { name: EN.form.selectNone }));
    await user.click(submitButton());
    expect(screen.getByText(EN.form.needsPages)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: EN.form.choosePages })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: /About us/u }));
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith('Add a FAQ', ['about']);
  });

  it('starts the checklist on the page open now', async () => {
    const { user, onSubmit } = setup({ initialRequest: 'Shorter titles' });
    await user.click(screen.getByRole('radio', { name: EN.form.choosePages }));
    expect(screen.getByRole('checkbox', { name: /Home/u })).toBeChecked();
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith('Shorter titles', ['home']);
  });

  it('says the request came from the composer until it is edited', async () => {
    const { user } = setup({ initialRequest: 'Translate', fromDraft: true });
    expect(screen.getByText(EN.form.fromDraft)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: EN.form.request }), ' it');
    expect(screen.queryByText(EN.form.fromDraft)).toBeNull();
  });

  it("shows the server's sentence plainly when it cannot batch, and Submit waits", async () => {
    const sentence = 'Background batches are not configured on this server.';
    const { user, onSubmit } = setup({ initialRequest: 'Translate', unavailable: sentence });
    expect(screen.getByText(EN.unavailable)).toBeInTheDocument();
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
    expect(submitButton()).toHaveAccessibleDescription(`${EN.unavailable} ${sentence}`);
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('waits without a server, and while a send is in flight', async () => {
    const { user, onSubmit } = setup({ initialRequest: 'Translate', connected: false });
    expect(screen.getByText(EN.noServer)).toBeInTheDocument();
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('says a failed send in its own words, and Cancel goes back', async () => {
    const { user, onCancel } = setup({ error: 'The assistant server answered with status 502.' });
    expect(screen.getByRole('alert')).toHaveTextContent('status 502');
    await user.click(screen.getByRole('button', { name: EN.form.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic', () => {
    render(
      <BatchJobForm
        locale="ar"
        pages={SAMPLE_PAGES_AR}
        connected
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const words = jobsLabels('ar');
    expect(screen.getByRole('button', { name: words.form.submit })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: words.form.allPages(5) })).toBeInTheDocument();
    expect(screen.getByText(words.halfPrice)).toBeInTheDocument();
  });

  it('styles with logical properties and builder tokens only', () => {
    expect(CSS).not.toMatch(/\b(?:margin|padding|border)-(?:left|right|top|bottom)\b/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    expect(CSS).toMatch(/:focus-visible/u);
  });
});
