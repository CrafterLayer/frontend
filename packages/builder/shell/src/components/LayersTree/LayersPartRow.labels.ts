/** The strings of a block's part rows in Layers (block-parts DESIGN §2.13). */
export interface LayersPartLabels {
  /** Which half of a part's `{ en, ar }` label the rows show. */
  readonly locale: 'en' | 'ar';
  /** A repeated part's row name: "Title 3". */
  readonly instance: (partLabel: string, position: number) => string;
  /** The row's tooltip: "Heading · Hero". */
  readonly description: (partLabel: string, blockName: string) => string;
  /** A list part's preview: "3 items". */
  readonly count: (items: number) => string;
  readonly actions: {
    readonly duplicate: string;
    readonly moveUp: string;
    readonly moveDown: string;
    readonly remove: string;
  };
  /** Accessible names of an item row's buttons: "Duplicate Feature 2". */
  readonly actionOn: (action: string, name: string) => string;
  readonly announce: {
    readonly done: (action: string, name: string) => string;
    readonly refused: (action: string, message: string) => string;
  };
}

export const LAYERS_PART_LABELS_EN: LayersPartLabels = {
  locale: 'en',
  instance: (partLabel, position) => `${partLabel} ${String(position)}`,
  description: (partLabel, blockName) => `${partLabel} · ${blockName}`,
  count: (items) => (items === 1 ? '1 item' : `${String(items)} items`),
  actions: { duplicate: 'Duplicate', moveUp: 'Move up', moveDown: 'Move down', remove: 'Remove' },
  actionOn: (action, name) => `${action} ${name}`,
  announce: {
    done: (action, name) => `${action} · ${name}.`,
    refused: (action, message) => `${action} refused: ${message}`,
  },
};

export const LAYERS_PART_LABELS_AR: LayersPartLabels = {
  locale: 'ar',
  instance: (partLabel, position) => `${partLabel} ${String(position)}`,
  description: (partLabel, blockName) => `${partLabel} · ${blockName}`,
  count: (items) => (items === 1 ? 'عنصر واحد' : items === 2 ? 'عنصران' : `${String(items)} عناصر`),
  actions: { duplicate: 'تكرار', moveUp: 'نقل للأعلى', moveDown: 'نقل للأسفل', remove: 'إزالة' },
  actionOn: (action, name) => `${action} ${name}`,
  announce: {
    done: (action, name) => `${action} · ${name}.`,
    refused: (action, message) => `رُفض ${action}: ${message}`,
  },
};
