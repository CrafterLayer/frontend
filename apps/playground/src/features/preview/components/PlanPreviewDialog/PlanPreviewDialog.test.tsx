import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LATEST_SCHEMA_VERSION, type BuilderDocument } from '@craftkit/builder';

import { PlanPreviewDialog } from './PlanPreviewDialog';

const DOCUMENT: BuilderDocument = {
  schemaVersion: LATEST_SCHEMA_VERSION,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: { root: { id: 'root', type: 'page', props: {} } },
};

/** No registry: the preview draws the unknown-block fallback, which is enough here. */
const blocks = () => undefined;

function renderDialog(overrides: Partial<Parameters<typeof PlanPreviewDialog>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <PlanPreviewDialog
      document={DOCUMENT}
      blocks={blocks}
      canApply
      onApply={onApply}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onApply, onClose, user: userEvent.setup() };
}

describe('PlanPreviewDialog', () => {
  it('is a modal dialog with a name, so it is findable and traps meaning', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Preview' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('says plainly that nothing has been applied yet', () => {
    /*
      The whole point of the dialog: looking is not applying. A person reading a
      rendered page has to be told which page it is.
    */
    renderDialog();
    expect(screen.getByText(/Nothing is applied yet/)).toBeVisible();
  });

  it('applies once, and closes with it', async () => {
    const { onApply, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith();
  });

  it('offers NO Apply when the panel may not write, and says why', () => {
    /*
      Not "this proposal is unappliable" — the panel's own promise. A proposal
      made in Ask could be applied from this dialog after the person switched to
      Plan, on the page the panel was promising not to touch.
    */
    renderDialog({ canApply: false });

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByText(/Planning only/)).toBeVisible();
  });

  it('closes from the header, the footer, and the backdrop', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Close preview' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does NOT close on a click that bubbled out of the dialog', async () => {
    /*
      A preview that vanished because somebody pressed a button inside it would
      take away the very thing they were reading.
    */
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('dialog', { name: 'Preview' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
