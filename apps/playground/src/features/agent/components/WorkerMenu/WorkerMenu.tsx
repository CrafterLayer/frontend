import { useId } from 'react';

import { t } from '../../copy';
import type { BuildWorkerCount, Locale } from '../../model/view-types';

import './WorkerMenu.css';

export interface WorkerMenuProps {
  readonly locale: Locale;
  readonly value: BuildWorkerCount;
  readonly running: boolean;
  readonly onChange: (count: BuildWorkerCount) => void;
}

const WORKERS = [1, 3, 6] as const satisfies readonly BuildWorkerCount[];

/** The maximum section writers for the next build; never extra concurrent site writers. */
export function WorkerMenu({ locale, value, running, onChange }: WorkerMenuProps) {
  const hintId = useId();
  const hint = t(locale, 'workers.hint');
  return (
    <span className="ck-agent-workers">
      <select
        className="ck-agent-workers__select"
        aria-label={t(locale, 'workers.label')}
        aria-describedby={hintId}
        title={hint}
        value={value}
        disabled={running}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (!running && (next === 1 || next === 3 || next === 6)) onChange(next);
        }}
      >
        {WORKERS.map((count) => (
          <option key={count} value={count}>
            {t(locale, 'workers.option', { n: count })}
          </option>
        ))}
      </select>
      <span id={hintId} className="bldr-visually-hidden">
        {hint}
      </span>
    </span>
  );
}
