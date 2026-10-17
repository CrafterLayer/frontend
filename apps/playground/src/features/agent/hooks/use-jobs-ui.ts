import { useState } from 'react';

import { jobCounts } from '../../jobs';
import { jobsLabels } from '../copy/jobs-labels';
import type { BackgroundJobsView } from '../model/background-jobs';
import { batchCommandText } from '../model/skill-slash';
import type { Locale } from '../model/view-types';

/** The jobs dialog shows the list, or the form that starts a job. */
export type JobsDialogView = 'list' | 'new';

/** AgentHeader's `jobs` prop. */
export interface AgentHeaderJobs {
  readonly label: string;
  /** The second tooltip line and accessible description: what is waiting. */
  readonly hint: string | undefined;
  /** A dot on the button: answers waiting to be applied (`ready`), or batches answering. */
  readonly badge: 'ready' | 'active' | undefined;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly controls?: string | undefined;
}

export interface JobsUi {
  readonly open: boolean;
  readonly view: JobsDialogView;
  /** What the form starts with: the words of `/batch`, or the composer's draft. */
  readonly request: string;
  /** Whether those words came from the composer's draft. */
  readonly fromDraft: boolean;
  /** Counts every opening of the form, so it starts afresh each time (its `key`). */
  readonly opening: number;
  readonly setOpen: (open: boolean) => void;
  readonly setView: (view: JobsDialogView) => void;
  /** Opens the form on these words. */
  readonly start: (request: string, fromDraft?: boolean) => void;
  /**
   * The composer is sending its draft: when it is `/batch <request>`, the form opens on the
   * request instead, and the caller clears the draft. True when the draft was taken.
   */
  readonly takeDraft: (draft: string) => boolean;
  /** AgentHeader's `jobs` prop: absent without jobs; `before` runs ahead of a toggle. */
  readonly header: (controls: string, before: () => void) => AgentHeaderJobs | undefined;
}

/**
 * The panel's "Background jobs" dialog state (2026-10-12), kept out of AgentPanel like
 * `useKnowledgeUi`: whether it is open, on the list or the form, and what the form starts
 * with. The composer's `/batch` reaches it twice: picked from the `/` list (the words before
 * the slash) and sent as `/batch <request>` (the words after it).
 */
export function useJobsUi(jobs: BackgroundJobsView | undefined, locale: Locale): JobsUi {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<JobsDialogView>('list');
  const [request, setRequest] = useState('');
  const [fromDraft, setFromDraft] = useState(false);
  const [opening, setOpening] = useState(0);

  const start = (words: string, draft = false): void => {
    setRequest(words.trim());
    setFromDraft(draft && words.trim() !== '');
    setOpening((count) => count + 1);
    setView('new');
    setOpen(true);
  };

  return {
    open,
    view,
    request,
    fromDraft,
    opening,
    setOpen,
    setView: (next) => {
      if (next === 'new') setOpening((count) => count + 1);
      setView(next);
    },
    start,
    takeDraft: (draft) => {
      if (jobs === undefined) return false;
      const words = batchCommandText(draft);
      if (words === undefined) return false;
      start(words);
      return true;
    },
    header: (controls, before) => {
      if (jobs === undefined) return undefined;
      const labels = jobsLabels(locale);
      const { ready, active } = jobCounts(jobs.jobs ?? []);
      return {
        label: labels.title,
        hint: labels.openHint(ready, active),
        badge: ready > 0 ? 'ready' : active > 0 ? 'active' : undefined,
        open,
        onToggle: () => {
          before();
          if (!open) {
            setRequest('');
            setFromDraft(false);
            setView('list');
          }
          setOpen(!open);
        },
        controls,
      };
    },
  };
}
