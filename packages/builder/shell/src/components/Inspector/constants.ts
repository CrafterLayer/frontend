export const TAB_DEFINITIONS = [
  { id: 'content', label: 'Content' },
  { id: 'design', label: 'Design' },
  { id: 'advanced', label: 'Advanced' },
] as const;

/** One frozen empty record: `Object.hasOwn` against it is a stable "no" for every key. */
export const EMPTY_OVERRIDES: Readonly<Record<string, never>> = Object.freeze({});

export const NO_SELECTION_NAME = 'No block selected';

export const SELECTION_CLEARED = 'Selection cleared';

export const EMPTY_STATE_COPY = {
  invitation: 'Select a block to edit its properties.',
  'unknown-type': 'Unknown block type — no schema is registered for it.',
  'no-properties': 'This block has no editable properties.',
  'element-gone': 'That element is no longer in this region. Go back to the region to continue.',
} as const;

export const BACK_TO_REGION = 'Back to region';
