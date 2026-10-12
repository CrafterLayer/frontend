/**
 * CheckpointsTab (2026-10-12): the page's checkpoints over the real hook
 * (`useAgentKnowledge`) and an in-memory port (`createFakeCheckpoints`). It says it is
 * reading while the list is pending and says so when none are kept; each point shows its
 * label, kind and time, and Restore (named for the point) says its outcome once in the
 * status line. Save keeps the page under a typed name, or the default one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { AgentCheckpoint, AgentCheckpointPort } from '../../model/checkpoints';
import type { Locale } from '../../model/view-types';
import {
  createFakeCheckpoints,
  SAMPLE_CHECKPOINTS,
  SAMPLE_CHECKPOINTS_AR,
  type FakeCheckpointsOptions,
} from '../../testing/knowledge-fixtures';

import { CheckpointsTab } from './CheckpointsTab';

const EN = knowledgeLabels('en');
const AR = knowledgeLabels('ar');

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'CheckpointsTab',
    'CheckpointsTab.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface LiveCheckpointsProps {
  readonly locale: Locale;
  readonly port: AgentCheckpointPort;
}

/** The tab over the real hook, reading and saving through the given port. */
function LiveCheckpoints({ locale, port }: LiveCheckpointsProps) {
  const { view } = useAgentKnowledge({ storage: null, checkpoints: port });
  if (view.checkpoints === undefined) return null;
  return (
    <CheckpointsTab
      checkpoints={view.checkpoints}
      labels={knowledgeLabels(locale)}
      locale={locale}
    />
  );
}

function setup(
  points: readonly AgentCheckpoint[] = SAMPLE_CHECKPOINTS,
  options: FakeCheckpointsOptions = {},
  locale: Locale = 'en',
) {
  const port = createFakeCheckpoints(points, options);
  render(<LiveCheckpoints locale={locale} port={port} />);
  return { user: userEvent.setup(), port };
}

function status(): HTMLElement {
  return screen.getByRole('status');
}

describe('CheckpointsTab', () => {
  it('says it is reading while the list is pending', () => {
    setup(SAMPLE_CHECKPOINTS, { pending: true });
    expect(screen.getByText(EN.checkpoints.loading)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(status()).toBeEmptyDOMElement();
  });

  it('says so when no checkpoint is kept', async () => {
    setup([]);
    expect(await screen.findByText(EN.checkpoints.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists each point, newest first, with its label, kind and time', async () => {
    setup();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Make the hero darker and add a booking button');
    expect(rows[0]).toHaveTextContent(EN.checkpoints.kinds.auto);
    expect(rows[1]).toHaveTextContent('Before the new menu');
    expect(rows[1]).toHaveTextContent(EN.checkpoints.kinds.manual);
    expect(rows[1]).toHaveAttribute('data-kind', 'manual');
    const time = rows[0]!.querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-10-12T11:40:00.000Z');
    expect(time?.textContent).toMatch(/12/u);
    expect(rows[2]!.querySelector('time')).toHaveAttribute('datetime', '2026-10-12T10:40:00.000Z');
  });

  it('names each Restore for its point, and says the page is restored', async () => {
    const { user, port } = setup();
    const restore = await screen.findByRole('button', {
      name: 'Restore the page to “Before the new menu”',
    });
    expect(restore).toHaveTextContent(EN.checkpoints.restoreShort);
    await user.click(restore);
    expect(port.restored).toEqual(['cp-2']);
    expect(await screen.findByText(EN.checkpoints.outcomes.restored)).toBe(status());
  });

  it('says when the page already matches the point', async () => {
    const { user } = setup(SAMPLE_CHECKPOINTS, { restore: 'unchanged' });
    await user.click(
      await screen.findByRole('button', { name: 'Restore the page to “Before the new menu”' }),
    );
    expect(await screen.findByText(EN.checkpoints.outcomes.unchanged)).toBe(status());
  });

  it('says when a point is no longer kept', async () => {
    const { user } = setup(SAMPLE_CHECKPOINTS, { restore: 'missing' });
    await user.click(
      await screen.findByRole('button', {
        name: 'Restore the page to “Build a landing page for a café”',
      }),
    );
    expect(await screen.findByText(EN.checkpoints.outcomes.missing)).toBe(status());
  });

  it('says when a point could not be restored', async () => {
    const { user, port } = setup(SAMPLE_CHECKPOINTS, { restore: 'failed' });
    await user.click(
      await screen.findByRole('button', {
        name: 'Restore the page to “Make the hero darker and add a booking button”',
      }),
    );
    expect(port.restored).toEqual(['cp-3']);
    expect(await screen.findByText(EN.checkpoints.outcomes.failed)).toBe(status());
  });

  it('saves the page under the typed name', async () => {
    const { user } = setup();
    await screen.findAllByRole('listitem');
    const name = screen.getByRole('textbox', { name: EN.checkpoints.nameField });
    await user.type(name, 'Before the footer');
    await user.click(screen.getByRole('button', { name: 'Save checkpoint' }));
    expect(await screen.findByText(EN.checkpoints.saved)).toBe(status());
    const saved = await screen.findByRole('button', {
      name: 'Restore the page to “Before the footer”',
    });
    expect(saved.closest('li')).toHaveTextContent(EN.checkpoints.kinds.manual);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(name).toHaveValue('');
  });

  it('saves under the default name when none is typed', async () => {
    const { user } = setup([]);
    await screen.findByText(EN.checkpoints.empty);
    await user.click(screen.getByRole('button', { name: 'Save checkpoint' }));
    expect(
      await screen.findByRole('button', { name: 'Restore the page to “Saved checkpoint”' }),
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent(EN.checkpoints.saved);
  });

  it('says when the save failed, and keeps the typed name', async () => {
    const { user } = setup(SAMPLE_CHECKPOINTS, { saves: false });
    await screen.findAllByRole('listitem');
    const name = screen.getByRole('textbox', { name: EN.checkpoints.nameField });
    await user.type(name, 'Before the footer');
    await user.click(screen.getByRole('button', { name: 'Save checkpoint' }));
    expect(await screen.findByText(EN.checkpoints.saveFailed)).toBe(status());
    expect(name).toHaveValue('Before the footer');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('speaks Arabic, its times in Latin digits', async () => {
    const { user, port } = setup(SAMPLE_CHECKPOINTS_AR, {}, 'ar');
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(AR.checkpoints.kinds.auto);
    expect(rows[1]).toHaveTextContent(AR.checkpoints.kinds.manual);
    const time = within(rows[0]!).getByText((_, element) => element?.tagName === 'TIME');
    expect(time.textContent).toMatch(/\d/u);
    expect(time.textContent).not.toMatch(/[٠-٩]/u);
    expect(screen.getByRole('textbox', { name: 'اسم نقطة الحفظ' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'استرجع الصفحة إلى «قبل القائمة الجديدة»' }),
    );
    expect(port.restored).toEqual(['cp-1']);
    expect(await screen.findByText(AR.checkpoints.outcomes.restored)).toBe(status());
    await user.click(screen.getByRole('button', { name: 'احفظ نقطة' }));
    expect(
      await screen.findByRole('button', { name: 'استرجع الصفحة إلى «نقطة محفوظة»' }),
    ).toBeInTheDocument();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
