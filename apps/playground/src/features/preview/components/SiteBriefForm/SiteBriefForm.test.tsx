import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SiteBriefForm } from './SiteBriefForm';

afterEach(cleanup);

const started = () => vi.fn<(brief: string) => Promise<string | undefined>>().mockResolvedValue(undefined);

describe('SiteBriefForm', () => {
  it('hands the brief to the run, trimmed', async () => {
    const user = userEvent.setup();
    const onSubmit = started();
    render(<SiteBriefForm onSubmit={onSubmit} locale="en" />);

    await user.type(screen.getByLabelText('Describe the site you want'), '  a ceramics studio  ');
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('a ceramics studio');
    });
  });

  it('REFUSES a blank brief without starting a run', async () => {
    const user = userEvent.setup();
    const onSubmit = started();
    render(<SiteBriefForm onSubmit={onSubmit} locale="en" />);

    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    expect(await screen.findByText(/Write a sentence about the site first/u)).toBeVisible();
    /*
      Nothing happened: no spinner, no entry in history, nothing to undo. A
      refusal is the form declining to start a run, not a run that failed.
    */
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks a refused field invalid and ties the reason to it', async () => {
    const user = userEvent.setup();
    render(<SiteBriefForm onSubmit={started()} locale="en" />);

    const field = screen.getByLabelText('Describe the site you want');
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    const message = await screen.findByText(/Write a sentence about the site first/u);
    await waitFor(() => {
      expect(field).toHaveAttribute('aria-invalid', 'true');
    });
    expect(field.getAttribute('aria-describedby') ?? '').toContain(message.id);
  });

  it('keeps what a person typed when the run is not ADMITTED', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn<(brief: string) => Promise<string | undefined>>()
      .mockResolvedValue('No provider is wired, so nothing was built.');
    render(<SiteBriefForm onSubmit={onSubmit} locale="en" />);

    const field = screen.getByLabelText('Describe the site you want');
    await user.type(field, 'a ceramics studio');
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    expect(await screen.findByText(/No provider is wired/u)).toBeVisible();
    /*
      Losing a person's sentence in order to tell them it did not work would be
      its own small insult — and the field is uncontrolled, so keeping it is a
      decision rather than an accident.
    */
    await waitFor(() => {
      expect(field).toHaveValue('a ceramics studio');
    });
    /* A run DID start, so the field is not marked invalid. */
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('announces that it is building, and closes the field while it does', async () => {
    const user = userEvent.setup();
    let release: (reason?: string) => void = () => undefined;
    const onSubmit = vi.fn<(brief: string) => Promise<string | undefined>>().mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          release = resolve;
        }),
    );
    render(<SiteBriefForm onSubmit={onSubmit} locale="en" />);

    const field = screen.getByLabelText('Describe the site you want');
    await user.type(field, 'a ceramics studio');
    await user.click(screen.getByRole('button', { name: /Build the site/u }));

    /*
      The live region carries it, not the button's label: a label on a DISABLED
      control is not reliably announced, and "it is working" is the one thing a
      person waiting on five stages must not have to guess.
    */
    expect(await screen.findByRole('status')).toHaveTextContent('Building the site…');
    await waitFor(() => {
      expect(field).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /Building the site/u })).toBeDisabled();

    release(undefined);
    await waitFor(() => {
      expect(field).toBeEnabled();
    });
  });

  it('will not start a second run while another owns the panel', async () => {
    const user = userEvent.setup();
    const onSubmit = started();
    render(<SiteBriefForm onSubmit={onSubmit} locale="en" busy defaultValue="a ceramics studio" />);

    const button = screen.getByRole('button', { name: /Build the site/u });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Describe the site you want')).toBeDisabled();

    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('speaks Arabic by default, and lets the field follow the text either way', () => {
    render(<SiteBriefForm onSubmit={started()} />);
    expect(screen.getByLabelText('صف الموقع الذي تريده')).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('button', { name: /ابنِ الموقع/u })).toBeEnabled();
  });
});
