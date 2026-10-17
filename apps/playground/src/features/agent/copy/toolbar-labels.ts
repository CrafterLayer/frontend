/**
 * The compact composer's extra words (2026-10-12), in both languages. Kept beside the catalog
 * rather than in it: the catalog files are at their size limit. What each worker count means,
 * so the workers chip opens a menu that explains its choices like Mode, Model and Effort do.
 */
import type { BuildWorkerCount, Locale } from '../model/view-types';

export interface ToolbarLabels {
  readonly workerDescription: Readonly<Record<BuildWorkerCount, string>>;
  /** The workers chip's tooltip while a request runs: the count it started with holds. */
  readonly workersLocked: string;
}

const EN: ToolbarLabels = {
  workerDescription: {
    1: 'One section at a time: the lowest cost',
    3: 'Three sections together: balanced',
    6: 'Six sections together: the fastest build',
  },
  workersLocked: 'Fixed while a request runs',
};

const AR: ToolbarLabels = {
  workerDescription: {
    1: 'قسم واحد في كل مرة: أقل تكلفة',
    3: 'ثلاثة أقسام معًا: توازن بين السرعة والتكلفة',
    6: 'ستة أقسام معًا: أسرع بناء',
  },
  workersLocked: 'ثابت أثناء تنفيذ الطلب',
};

export function toolbarLabels(locale: Locale): ToolbarLabels {
  return locale === 'ar' ? AR : EN;
}
