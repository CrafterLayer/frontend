export interface GridTracksControlLabels {
  readonly add: string;
  readonly count: string;
  readonly track: (index: number) => string;
  readonly remove: (index: number) => string;
}

export const GRID_TRACKS_CONTROL_LABELS_EN: GridTracksControlLabels = {
  add: 'Add track',
  count: 'Number of tracks',
  track: (index) => `Track ${String(index + 1)} size`,
  remove: (index) => `Remove track ${String(index + 1)}`,
};

export const GRID_TRACKS_CONTROL_LABELS_AR: GridTracksControlLabels = {
  add: 'إضافة مسار',
  count: 'عدد المسارات',
  track: (index) => `حجم المسار ${String(index + 1)}`,
  remove: (index) => `حذف المسار ${String(index + 1)}`,
};
