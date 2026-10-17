import { IconRail, type RailItem } from '@craftkit/builder';

import type { EditorPanes } from './use-editor-panes';

export interface EditorRailProps {
  /** The destinations, named in the editor's language. */
  readonly items: readonly RailItem[];
  readonly secondary: readonly RailItem[];
  readonly label: string;
  readonly panes: Pick<
    EditorPanes,
    'railSection' | 'setRailSection' | 'setPanelOpen' | 'setActiveSide'
  >;
}

/** The icon rail: choosing a destination opens it in the panel column. */
export function EditorRail({ items, secondary, label, panes }: EditorRailProps) {
  const { railSection, setRailSection, setPanelOpen, setActiveSide } = panes;
  return (
    <IconRail
      items={items}
      secondary={secondary}
      label={label}
      captions
      activeId={railSection}
      onSelect={(id) => {
        /*
            Settings is an ACTION, not a destination. The scenario
            controls have to work in preview too, where there is no
            panel to put them in, so they live in a disclosure — and the
            rail's settings item opens exactly that rather than pointing
            at it in prose. Nothing about the panel changes, so the
            current destination keeps its `aria-current`.
          */
        setRailSection(id);
        setPanelOpen(true);
        setActiveSide('panel');
      }}
      account={<div className="pg-avatar">CK</div>}
    />
  );
}
