import { applyStyleIntents, type NamedStyle, type StyleIntent } from '@craftkit/builder-schema';

import { commitSiteSteps, type SiteDoor } from '../components/DesignSystemPanel/site-door';
import { styleTransactionLabel, type StyleApplyResult, type StyleSource } from './style-source';

/*
  ── A named style as a StyleSource (style-manager DESIGN.md §G, D6) ─────────

  The class manager's "Edit style" opens the SAME StylePanel an element uses,
  pointed at a named style instead of a tree element. The panel reads one
  class string and hands back intents; this adapter turns them into one
  `setNamedStyle` — one transaction, one Undo — and every element carrying
  the `ck-s-<id>` marker repaints, on the canvas and in the export, because
  the renderer expands markers at render time.

  A named style is free-mode by definition (the library stores utilities,
  palette variables and arbitrary values alike), so the panel shows every
  control. The door still checks every class against the live vocabulary.
*/

function styleOf(door: Pick<SiteDoor, 'getSite'>, id: string): NamedStyle | undefined {
  const styles = door.getSite().library?.styles ?? {};
  return Object.hasOwn(styles, id) ? styles[id] : undefined;
}

/**
 * The style panel's source for the library style `id`. Its label follows the
 * style's current name; `read()` returns `['']` once the style is gone, and
 * `apply()` then refuses rather than recreating it.
 */
export function namedStyleSource(
  door: Pick<SiteDoor, 'getSite' | 'subscribe' | 'dispatchGroup'>,
  id: string,
): StyleSource {
  return {
    id: `named-style:${id}`,
    get label(): string {
      return styleOf(door, id)?.name ?? id;
    },
    mode: 'free',
    targetCount: 1,
    read: () => [styleOf(door, id)?.className ?? ''],
    apply(intents: readonly StyleIntent[], label: string): StyleApplyResult {
      const style = styleOf(door, id);
      if (style === undefined) {
        return { ok: false, message: `Named style "${id}" no longer exists.` };
      }
      const result = applyStyleIntents(style.className, intents, { mode: 'free' });
      if (!result.ok) return { ok: false, message: result.message };
      if (result.className === style.className) return { ok: true };
      return commitSiteSteps(
        door,
        [{ command: 'setNamedStyle', args: { style: { ...style, className: result.className } } }],
        styleTransactionLabel(label, style.name),
      );
    },
    subscribe: (onChange) => door.subscribe(onChange),
  };
}
