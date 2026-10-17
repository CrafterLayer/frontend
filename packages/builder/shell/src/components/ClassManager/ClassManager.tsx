import { useState, type ReactNode } from 'react';

import type { SiteGroupStep } from '@craftkit/builder-core';
import type { Author } from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_EN,
  type ElementNameWords,
  type ElementTarget,
  type ResolvedTreeTarget,
} from '../../custom-code/element-target';
import { namedStyleSource } from '../../style-manager/named-style-source';
import type { StyleSource } from '../../style-manager/style-source';
import { commitSiteSteps, useSiteSnapshot, type SiteDoor } from '../DesignSystemPanel/site-door';
import { CLASS_MANAGER_LABELS_EN, type ClassManagerLabels } from './ClassManager.labels';
import {
  applyStyleSteps,
  createStyleFromElement,
  markersOf,
  namedStyleRows,
  removeMarkerSteps,
  reorderMarkerSteps,
  resolveStyledTarget,
  similarTargets,
  type StepsOrRefusal,
} from './class-manager-ops';
import { ElementStyleStrip } from './ElementStyleStrip';
import { StyleRowItem } from './StyleRowItem';
import '../../styles/visually-hidden.css';
import './ClassManager.css';

export interface ClassManagerProps {
  /** The site kernel (or any `SiteDoor`): read for styles, written in one group per action. */
  readonly site: SiteDoor;
  /** The primary selected element (the kernel's focused element). */
  readonly target?: ElementTarget | undefined;
  /** Every selected element (multi-select); defaults to `[target]`. */
  readonly targets?: readonly ElementTarget[] | undefined;
  /**
   * The full StylePanel bound to a style (P6). Absent ⇒ "Edit style" shows a
   * raw class field, which still commits through `setNamedStyle`.
   */
  readonly renderStyleEditor?: ((source: StyleSource) => ReactNode) | undefined;
  readonly author?: Author | undefined;
  readonly labels?: ClassManagerLabels | undefined;
  readonly words?: ElementNameWords | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

type Status = { readonly kind: 'done' | 'refused'; readonly text: string } | undefined;

/**
 * Named styles — Webflow-style classes — for every element (style-manager
 * DESIGN.md §G, D6).
 *
 * A style is a bundle of utilities in the site library; an element carries it
 * as the marker `ck-s-<id>`, and the renderer expands markers at render time,
 * so editing a style once moves every element that uses it, on the canvas and
 * in the export. Every action here is ONE labelled transaction:
 *
 * - create from element: `setNamedStyle` + the element's classes replaced by
 *   the marker (its look does not change);
 * - apply to selected / to all similar siblings;
 * - rename, edit (the StylePanel through `namedStyleSource`, or raw classes);
 * - combo order (later wins), remove from the element;
 * - delete, refused by the door while in use unless "detach" inlines it.
 */
export function ClassManager({
  site,
  target,
  targets,
  renderStyleEditor,
  author = 'user',
  labels = CLASS_MANAGER_LABELS_EN,
  words = ELEMENT_NAME_WORDS_EN,
  dir,
}: ClassManagerProps) {
  const snapshot = useSiteSnapshot(site);
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<Status>(undefined);

  const pageId = site.currentPage();
  const page = site.page(pageId);
  const primary = target === undefined ? undefined : resolveStyledTarget(page, target, words);
  const selection = (targets ?? (target === undefined ? [] : [target]))
    .map((each) => resolveStyledTarget(page, each, words))
    .filter((each): each is ResolvedTreeTarget => typeof each !== 'string');
  const resolved = typeof primary === 'string' ? undefined : primary;
  const similar = resolved === undefined ? [] : similarTargets(resolved);
  const similarResolved = similar
    .map((each) => resolveStyledTarget(page, each, words))
    .filter((each): each is ResolvedTreeTarget => typeof each !== 'string');
  const rows = namedStyleRows(snapshot);
  const styles = snapshot.library?.styles ?? {};

  const run = (result: StepsOrRefusal, label: string, done?: string): boolean => {
    if (!result.ok) {
      setStatus({ kind: 'refused', text: result.message });
      return false;
    }
    const sent = commitSiteSteps(site, result.steps, label, author);
    setStatus(sent.ok ? { kind: 'done', text: done ?? label } : { kind: 'refused', text: sent.message });
    return sent.ok;
  };
  const send = (steps: readonly SiteGroupStep[], label: string): boolean =>
    run({ ok: true, steps }, label);

  const className =
    resolved === undefined || resolved.node.kind === 'component' ? '' : (resolved.node.className ?? '');

  return (
    <section className="bldr-class-manager" aria-label={labels.title} dir={dir}>
      <h3 className="bldr-class-manager__title">{labels.title}</h3>

      {resolved === undefined ? (
        <p className="bldr-class-manager__muted">
          {typeof primary === 'string' ? primary : labels.noSelection}
        </p>
      ) : (
        <ElementStyleStrip
          elementName={resolved.displayName}
          markers={markersOf(className).map((id) => ({
            id,
            style: Object.hasOwn(styles, id) ? styles[id] : undefined,
          }))}
          labels={labels}
          onMove={(id, delta) => {
            run(reorderMarkerSteps(resolved, id, delta, pageId), labels.commit.order(resolved.displayName));
          }}
          onRemove={(id) => {
            run(removeMarkerSteps(resolved, id, pageId), labels.commit.unapply(styles[id]?.name ?? id));
          }}
          onCreate={(name) => {
            run(createStyleFromElement(snapshot, resolved, name, pageId), labels.commit.create(name.trim()));
          }}
        />
      )}

      {rows.length === 0 ? (
        <p className="bldr-class-manager__muted">{labels.empty}</p>
      ) : (
        <ul className="bldr-class-manager__list" aria-label={labels.list}>
          {rows.map((row) => {
            const { style } = row;
            return (
              <StyleRowItem
                key={style.id}
                row={row}
                labels={labels}
                onApply={
                  selection.length === 0
                    ? undefined
                    : () => {
                        run(applyStyleSteps(selection, style.id, pageId), labels.commit.apply(style.name));
                      }
                }
                onApplySimilar={
                  similarResolved.length <= 1
                    ? undefined
                    : () => {
                        run(
                          applyStyleSteps(similarResolved, style.id, pageId),
                          labels.commit.apply(style.name),
                        );
                      }
                }
                similarCount={similarResolved.length}
                onRename={(name) => {
                  send(
                    [{ command: 'setNamedStyle', args: { style: { ...style, name: name.slice(0, 80) } } }],
                    labels.commit.rename(name),
                  );
                }}
                onClasses={(next) => {
                  send(
                    [{ command: 'setNamedStyle', args: { style: { ...style, className: next } } }],
                    labels.commit.classes(style.name),
                  );
                }}
                editing={editing === style.id}
                onToggleEdit={() => {
                  setEditing((current) => (current === style.id ? undefined : style.id));
                }}
                editor={
                  editing === style.id && renderStyleEditor !== undefined
                    ? renderStyleEditor(namedStyleSource(site, style.id))
                    : undefined
                }
                confirming={confirming === style.id}
                onDelete={() => {
                  if (row.uses > 0) {
                    setConfirming(style.id);
                    return;
                  }
                  send([{ command: 'removeNamedStyle', args: { id: style.id } }], labels.commit.remove(style.name));
                }}
                onDetach={() => {
                  setConfirming(undefined);
                  send(
                    [{ command: 'removeNamedStyle', args: { id: style.id, detach: true } }],
                    labels.commit.detach(style.name),
                  );
                }}
                onCancel={() => {
                  setConfirming(undefined);
                }}
              />
            );
          })}
        </ul>
      )}

      <p
        className="bldr-class-manager__status"
        role="status"
        data-kind={status?.kind}
      >
        {status?.text ?? ''}
      </p>
    </section>
  );
}
