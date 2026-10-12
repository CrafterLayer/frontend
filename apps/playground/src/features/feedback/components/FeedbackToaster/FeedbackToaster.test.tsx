/**
 * FeedbackToaster (Studio Indigo, 2026-10-12): the outcome of a person's own action, said
 * once near the canvas. Asserted by what a person reads: publishing says it is working,
 * then the outcome in place; a failure offers Try again; Arabic counts agree; the sheet
 * uses logical properties and theme tokens only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { FEEDBACK_LABELS_AR, FEEDBACK_LABELS_EN } from '../../feedback.labels';
import { notifyPublish } from '../../notify';

import { FeedbackToaster } from './FeedbackToaster';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'feedback',
    'components',
    'FeedbackToaster',
    'FeedbackToaster.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

beforeAll(() => {
  // jsdom has no pointer capture; sonner captures the pointer to follow a swipe.
  Element.prototype.setPointerCapture = (): void => undefined;
  Element.prototype.releasePointerCapture = (): void => undefined;
  Element.prototype.hasPointerCapture = (): boolean => false;
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe('FeedbackToaster', () => {
  it('names its region and says the publish outcome in place', async () => {
    render(<FeedbackToaster />);
    expect(screen.getByRole('region', { name: /Notifications/u })).toBeInTheDocument();
    let finish: (files: readonly unknown[]) => void = () => undefined;
    const publish = () =>
      new Promise<readonly unknown[] | undefined>((resolve) => {
        finish = resolve;
      });
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = notifyPublish(publish, FEEDBACK_LABELS_EN, vi.fn());
    });
    expect(await screen.findByText('Publishing the site…')).toBeInTheDocument();
    await act(async () => {
      finish(['index.html', 'about/index.html', 'sitemap.xml']);
      await done;
    });
    expect(await screen.findByText('Site published · 3 files')).toBeInTheDocument();
    expect(
      screen.getByText('The files are downloading. Upload them to any static host.'),
    ).toBeInTheDocument();
  });

  it('offers Try again when publishing fails', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<FeedbackToaster />);
    await act(async () => {
      await notifyPublish(() => Promise.resolve(undefined), FEEDBACK_LABELS_EN, retry);
    });
    expect(await screen.findByText('The site was not published')).toBeInTheDocument();
    expect(screen.getByText('Nothing was lost. Check the page and try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('speaks Arabic, right to left, with agreeing counts', async () => {
    render(<FeedbackToaster labels={FEEDBACK_LABELS_AR} dir="rtl" />);
    expect(screen.getByRole('region', { name: /الإشعارات/u })).toBeInTheDocument();
    await act(async () => {
      await notifyPublish(() => Promise.resolve(['a', 'b']), FEEDBACK_LABELS_AR, vi.fn());
    });
    expect(await screen.findByText('نُشر الموقع · ملفان')).toBeInTheDocument();
    expect(FEEDBACK_LABELS_AR.published(1)).toBe('نُشر الموقع · ملف واحد');
    expect(FEEDBACK_LABELS_AR.published(7)).toBe('نُشر الموقع · 7 ملفات');
    expect(FEEDBACK_LABELS_AR.published(12)).toBe('نُشر الموقع · 12 ملفًا');
    expect(FEEDBACK_LABELS_EN.published(1)).toBe('Site published · 1 file');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
