import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InteractionsPanel, type InteractionsPanelProps } from './InteractionsPanel';
import { INTERACTIONS_PANEL_LABELS_AR } from './InteractionsPanel.labels';
import { TIMELINE_PANEL_ENABLED } from './timeline-flag';

afterEach(cleanup);

function setup(overrides: Partial<InteractionsPanelProps> = {}) {
  const onCommit = vi.fn(() => ({ ok: true as const }));
  const onPreview = vi.fn();
  render(
    <InteractionsPanel
      attributes={{}}
      isContainer={false}
      targetIds={['faq']}
      onCommit={onCommit}
      onPreview={onPreview}
      {...overrides}
    />,
  );
  return { onCommit, onPreview };
}

describe('InteractionsPanel', () => {
  it('chooses a trigger then a preset: one write carrying both', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup();
    await user.click(screen.getByRole('radio', { name: 'On load' }));
    expect(onCommit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: 'Fade up' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ 'data-ck-motion': 'fade-up', 'data-ck-trigger': 'load' }, 'Animation');
  });

  it('params are disabled until something animates', () => {
    setup();
    expect(screen.getByRole('group', { name: /Choose an animation/u })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove animation' })).toBeDisabled();
  });

  it('tunes the params of a running animation, one write each', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({ attributes: { 'data-ck-motion': 'fade-up' }, isContainer: true });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay' }), '3');
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-delay': '3' }, 'Delay');
    await user.click(screen.getByRole('radio', { name: 'Fast' }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-speed': 'fast' }, 'Speed');
    await user.click(screen.getByRole('checkbox', { name: 'Play once' }));
    expect(onCommit).toHaveBeenLastCalledWith({ 'data-ck-once': 'false' }, 'Play once');
    expect(screen.getByRole('radiogroup', { name: 'Stagger children' })).toBeInTheDocument();
  });

  it('switching to a trigger the preset cannot play drops the preset in the same write', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({ attributes: { 'data-ck-motion': 'fade-up' } });
    await user.click(screen.getByRole('radio', { name: 'While scrolling' }));
    expect(onCommit).toHaveBeenCalledWith({ 'data-ck-trigger': 'scroll', 'data-ck-motion': null }, 'Plays');
  });

  it('a click trigger offers a target in the same tree', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({ attributes: { 'data-ck-motion': 'fade', 'data-ck-trigger': 'click' } });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Plays on' }), 'faq');
    expect(onCommit).toHaveBeenCalledWith({ 'data-ck-target': 'faq' }, 'Plays on');
  });

  it('Preview replays; Remove clears every motion attribute in one write', async () => {
    const user = userEvent.setup();
    const { onCommit, onPreview } = setup({
      attributes: { 'data-ck-motion': 'fade', 'data-ck-hover': 'lift', 'data-ck-delay': '2' },
    });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Remove animation' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      { 'data-ck-motion': null, 'data-ck-hover': null, 'data-ck-delay': null },
      'Remove animation',
    );
  });

  it('shows a refusal and labels in Arabic', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn(() => ({ ok: false as const, message: 'refused by the door' }));
    render(
      <InteractionsPanel
        attributes={{}}
        isContainer={false}
        targetIds={[]}
        onCommit={onCommit}
        dir="rtl"
        labels={INTERACTIONS_PANEL_LABELS_AR}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'ارتفاع' }));
    expect(screen.getByRole('alert')).toHaveTextContent('refused by the door');
  });
});

// media-motion (2026-10-06) additions: the flag-gated "Cinematic motion" section.
describe('InteractionsPanel — Cinematic motion (media-motion DESIGN §C.1.2, §C.4)', () => {
  it('the section is hidden by default: the flag is off until the owner answers Q1', () => {
    expect(TIMELINE_PANEL_ENABLED).toBe(false);
    setup({ attributes: { 'data-ck-motion': 'fade-up' } });
    expect(screen.queryByRole('region', { name: 'Cinematic motion' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Cinematic motion' })).not.toBeInTheDocument();
  });

  it('the timelinePanel prop shows it; picking a recipe drops the CSS preset in the SAME write', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({
      attributes: { 'data-ck-motion': 'fade-up', 'data-ck-trigger': 'load' },
      timelinePanel: true,
    });
    const section = screen.getByRole('region', { name: 'Cinematic motion' });
    expect(section).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cinematic motion' }), 'split-reveal');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-ck-timeline': 'split-reveal', 'data-ck-motion': null, 'data-ck-trigger': null }),
      'Cinematic motion',
    );
  });

  it('choosing a CSS preset removes the scroll timeline (and its scrub) in the SAME write', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({
      attributes: { 'data-ck-timeline': 'stagger-in', 'data-ck-scrub': 'true' },
      timelinePanel: true,
    });
    await user.click(screen.getByRole('radio', { name: 'Fade up' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      { 'data-ck-motion': 'fade-up', 'data-ck-timeline': null, 'data-ck-scrub': null },
      'Animation',
    );
  });

  it('labels the section in Arabic', () => {
    setup({ labels: INTERACTIONS_PANEL_LABELS_AR, dir: 'rtl', timelinePanel: true });
    expect(screen.getByRole('region', { name: 'حركة سينمائية' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'حركة سينمائية' })).toHaveValue('');
  });
});
