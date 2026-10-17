import { useId, useState } from 'react';

import type { Author } from '@craftkit/builder-schema';

import { commitSiteSteps, useSiteSnapshot, type SiteDoor } from '../DesignSystemPanel/site-door';
import {
  DESIGN_LIBRARY_TRANSFER_LABELS_EN,
  type DesignLibraryTransferLabels,
} from './DesignLibraryTransfer.labels';
import {
  designFileName,
  diffDesign,
  exportDesignFile,
  importDesignSteps,
  parseDesignFile,
  type DesignFile,
} from './design-transfer';
import { DesignDiffLine } from './DesignDiffLine';
import './DesignLibraryTransfer.css';

export interface DesignLibraryTransferProps {
  readonly site: SiteDoor;
  /** Saves the exported JSON. Default: a browser download. */
  readonly onDownload?: ((json: string, fileName: string) => void) | undefined;
  readonly author?: Author | undefined;
  readonly labels?: DesignLibraryTransferLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

type Status = { readonly kind: 'done' | 'refused' | 'busy'; readonly text: string } | undefined;

function browserDownload(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the site's look as `{format:'craftkit-design', v:1, designSystem,
 * library:{palette, styles, fonts}}`, and import one: the file is checked
 * (format, shape, legibility, class vocabulary), the change is previewed as
 * a summary, and only then sent as ONE `importDesignLibrary` — one Undo
 * restores the site. Entries the pages still use are never dropped.
 */
export function DesignLibraryTransfer({
  site,
  onDownload = browserDownload,
  author = 'user',
  labels = DESIGN_LIBRARY_TRANSFER_LABELS_EN,
  dir,
}: DesignLibraryTransferProps) {
  const snapshot = useSiteSnapshot(site);
  const [pending, setPending] = useState<DesignFile | undefined>(undefined);
  const [replace, setReplace] = useState(false);
  const [status, setStatus] = useState<Status>(undefined);
  const fileId = useId();
  const diff = pending === undefined ? undefined : diffDesign(snapshot, pending, replace);

  return (
    <section className="bldr-design-transfer" aria-label={labels.title} dir={dir}>
      <h3 className="bldr-design-transfer__title">{labels.title}</h3>
      <button
        type="button"
        className="bldr-design-transfer__button"
        onClick={() => {
          const file = exportDesignFile(site.getSite());
          const name = designFileName(file);
          onDownload(`${JSON.stringify(file, null, 2)}\n`, name);
          setStatus({ kind: 'done', text: labels.exported(name) });
        }}
      >
        {labels.export}
      </button>

      <label className="bldr-design-transfer__label" htmlFor={fileId}>
        {labels.chooseFile}
      </label>
      <input
        id={fileId}
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen === undefined) return;
          setStatus({ kind: 'busy', text: labels.reading });
          void chosen.text().then((text) => {
            const parsed = parseDesignFile(text);
            if (!parsed.ok) {
              setPending(undefined);
              setStatus({ kind: 'refused', text: parsed.message });
              return;
            }
            setPending(parsed.file);
            setStatus(undefined);
          });
        }}
      />

      {pending === undefined || diff === undefined ? null : (
        <div className="bldr-design-transfer__preview" role="group" aria-label={labels.preview}>
          <h4 className="bldr-design-transfer__subtitle">{labels.preview}</h4>
          <ul className="bldr-design-transfer__diff">
            <li>{labels.systemName(diff.systemName.from, diff.systemName.to)}</li>
            <li>{labels.tokens(diff.tokens.length)}</li>
            <DesignDiffLine title={labels.palette} diff={diff.palette} labels={labels} />
            <DesignDiffLine title={labels.styles} diff={diff.styles} labels={labels} />
            <DesignDiffLine title={labels.fonts} diff={diff.fonts} labels={labels} />
          </ul>
          <label className="bldr-design-transfer__check">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => {
                setReplace(event.target.checked);
              }}
            />
            {labels.replace}
          </label>
          <div className="bldr-design-transfer__actions">
            <button
              type="button"
              className="bldr-design-transfer__button bldr-design-transfer__button--primary"
              onClick={() => {
                const sent = commitSiteSteps(
                  site,
                  importDesignSteps(site.getSite(), pending, replace),
                  labels.commit(pending.designSystem.name),
                  author,
                );
                setStatus(sent.ok ? { kind: 'done', text: labels.done } : { kind: 'refused', text: sent.message });
                if (sent.ok) setPending(undefined);
              }}
            >
              {labels.confirm}
            </button>
            <button
              type="button"
              className="bldr-design-transfer__button"
              onClick={() => {
                setPending(undefined);
              }}
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}

      <p className="bldr-design-transfer__status" role="status" data-kind={status?.kind}>
        {status?.text ?? ''}
      </p>
    </section>
  );
}
