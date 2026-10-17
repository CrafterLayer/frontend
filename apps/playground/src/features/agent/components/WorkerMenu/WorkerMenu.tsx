import { t } from '../../copy';
import { toolbarLabels } from '../../copy/toolbar-labels';
import type { BuildWorkerCount, Locale } from '../../model/view-types';
import { ChoiceMenu, type ChoiceOption } from '../ComposerToolbar/ChoiceMenu';

import './WorkerMenu.css';

export interface WorkerMenuProps {
  readonly locale: Locale;
  readonly value: BuildWorkerCount;
  readonly running: boolean;
  readonly onChange: (count: BuildWorkerCount) => void;
}

const WORKERS = [1, 3, 6] as const satisfies readonly BuildWorkerCount[];

/**
 * The build-worker chip (compact composer, 2026-10-12): a glyph and the count ("👥 3"), opening
 * the same two-line radio menu as Mode, Model and Effort, each count with what it costs. It was
 * a native select reading «عمال: 3», which took a second row in a narrow panel.
 *
 * The count is fixed while a request runs (the controller keeps the one the build started with):
 * the menu still opens, its tooltip says so, and a pick made then changes nothing.
 */
export function WorkerMenu({ locale, value, running, onChange }: WorkerMenuProps) {
  const labels = toolbarLabels(locale);
  const describe = labels.workerDescription;
  const options: readonly ChoiceOption<`${BuildWorkerCount}`>[] = WORKERS.map((count) => ({
    value: String(count) as `${BuildWorkerCount}`,
    name: t(locale, 'workers.option', { n: count }),
    description: describe[count],
  }));
  return (
    <ChoiceMenu
      locale={locale}
      label={String(value)}
      ariaLabel={`${t(locale, 'workers.label')}: ${t(locale, 'workers.option', { n: value })}`}
      options={options}
      value={String(value) as `${BuildWorkerCount}`}
      onValueChange={(next) => {
        const count = Number(next);
        if (!running && (count === 1 || count === 3 || count === 6)) onChange(count);
      }}
      tooltip={running ? labels.workersLocked : t(locale, 'workers.hint')}
      className="ck-agent-workers"
      icon="users"
    />
  );
}
