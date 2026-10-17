import {
  BORDER_SIDES_CONTROL_LABELS_AR,
  BORDER_SIDES_CONTROL_LABELS_EN,
  type BorderSidesControlLabels,
} from '../controls/BorderSidesControl';
import {
  BOX_MODEL_CONTROL_LABELS_AR,
  BOX_MODEL_CONTROL_LABELS_EN,
  type BoxModelControlLabels,
} from '../controls/BoxModelControl';
import {
  BUCKET_STATE_SWITCHER_LABELS_AR,
  BUCKET_STATE_SWITCHER_LABELS_EN,
  type BucketStateSwitcherLabels,
} from '../controls/BucketStateSwitcher';
import { COLOR_FIELD_LABELS_AR, COLOR_FIELD_LABELS_EN, type ColorFieldLabels } from '../controls/ColorField';
import {
  CORNER_RADIUS_CONTROL_LABELS_AR,
  CORNER_RADIUS_CONTROL_LABELS_EN,
  type CornerRadiusControlLabels,
} from '../controls/CornerRadiusControl';
import {
  EFFECT_PRESET_PICKER_LABELS_AR,
  EFFECT_PRESET_PICKER_LABELS_EN,
  type EffectPresetPickerLabels,
} from '../controls/EffectPresetPicker';
import {
  GRID_TRACKS_CONTROL_LABELS_AR,
  GRID_TRACKS_CONTROL_LABELS_EN,
  type GridTracksControlLabels,
} from '../controls/GridTracksControl';
import {
  SCALE_NUMBER_CONTROL_LABELS_AR,
  SCALE_NUMBER_CONTROL_LABELS_EN,
  type ScaleNumberControlLabels,
} from '../controls/ScaleNumberControl';
import {
  STACK_CONTROL_LABELS_AR,
  STACK_CONTROL_LABELS_EN,
  type StackControlLabels,
} from '../controls/StackControl';
import {
  STYLE_COLOR_CONTROL_LABELS_AR,
  STYLE_COLOR_CONTROL_LABELS_EN,
  type StyleColorControlLabels,
} from '../controls/StyleColorControl';
import {
  TRANSFORM_ORIGIN_CONTROL_LABELS_AR,
  TRANSFORM_ORIGIN_CONTROL_LABELS_EN,
  type TransformOriginControlLabels,
} from '../controls/TransformOriginControl';
import {
  VALUE_SOURCE_DOT_LABELS_AR,
  VALUE_SOURCE_DOT_LABELS_EN,
  type ValueSourceDotLabels,
} from '../controls/ValueSourceDot';

export interface StylePanelLabels {
  readonly locale: 'en' | 'ar';
  readonly panel: string;
  readonly mixed: string;
  readonly unset: string;
  readonly customBreakpoint: string;
  /** Why the badge is there: classes at a breakpoint this panel does not edit still apply. */
  readonly customBreakpointHint: string;
  readonly imageUrl: string;
  /** Announced after a write: "Padding updated". */
  readonly updated: (property: string) => string;
  readonly refused: (property: string, reason: string) => string;
  readonly switcher: BucketStateSwitcherLabels;
  readonly source: ValueSourceDotLabels;
  readonly number: ScaleNumberControlLabels;
  readonly box: BoxModelControlLabels;
  readonly corners: CornerRadiusControlLabels;
  readonly border: BorderSidesControlLabels;
  readonly stack: StackControlLabels;
  readonly grid: GridTracksControlLabels;
  readonly origin: TransformOriginControlLabels;
  readonly color: StyleColorControlLabels;
  readonly effects: EffectPresetPickerLabels;
  // panel-design additions
  readonly colorField: ColorFieldLabels;
  /** The property filter's accessible name. */
  readonly filter: string;
  readonly filterPlaceholder: string;
  readonly clearFilter: string;
  /** Shown when the filter matches no property. */
  readonly noMatches: (query: string) => string;
  /** A segmented row's overflow menu: "More Display options". */
  readonly moreOptions: (property: string) => string;
  /** A sector's count, read as its description: "2 set here". */
  readonly setHere: (count: number) => string;
  // end panel-design additions
}

export const STYLE_PANEL_LABELS_EN: StylePanelLabels = {
  locale: 'en',
  panel: 'Design',
  mixed: 'Mixed',
  unset: '—',
  customBreakpoint: 'Custom breakpoint',
  customBreakpointHint:
    'This property also has classes at another breakpoint (sm, xl, @md…). This panel leaves them as they are, and they still apply on those screens.',
  imageUrl: 'Image URL',
  updated: (property) => `${property} updated`,
  refused: (property, reason) => `${property} not changed: ${reason}`,
  switcher: BUCKET_STATE_SWITCHER_LABELS_EN,
  source: VALUE_SOURCE_DOT_LABELS_EN,
  number: SCALE_NUMBER_CONTROL_LABELS_EN,
  box: BOX_MODEL_CONTROL_LABELS_EN,
  corners: CORNER_RADIUS_CONTROL_LABELS_EN,
  border: BORDER_SIDES_CONTROL_LABELS_EN,
  stack: STACK_CONTROL_LABELS_EN,
  grid: GRID_TRACKS_CONTROL_LABELS_EN,
  origin: TRANSFORM_ORIGIN_CONTROL_LABELS_EN,
  color: STYLE_COLOR_CONTROL_LABELS_EN,
  effects: EFFECT_PRESET_PICKER_LABELS_EN,
  colorField: COLOR_FIELD_LABELS_EN,
  filter: 'Filter properties',
  filterPlaceholder: 'Find a property…',
  clearFilter: 'Clear filter',
  noMatches: (query) => `No property matches “${query}”`,
  moreOptions: (property) => `More ${property} options`,
  setHere: (count) => (count === 1 ? '1 value set here' : `${String(count)} values set here`),
};

export const STYLE_PANEL_LABELS_AR: StylePanelLabels = {
  locale: 'ar',
  panel: 'التصميم',
  mixed: 'مختلطة',
  unset: '—',
  customBreakpoint: 'نقطة توقف مخصّصة',
  customBreakpointHint:
    'لهذه الخاصية أصناف أخرى عند نقطة توقف مختلفة (sm أو xl أو @md…). تتركها هذه اللوحة كما هي، وتبقى سارية على تلك الشاشات.',
  imageUrl: 'رابط الصورة',
  updated: (property) => `تم تحديث ${property}`,
  refused: (property, reason) => `لم يتغير ${property}: ${reason}`,
  switcher: BUCKET_STATE_SWITCHER_LABELS_AR,
  source: VALUE_SOURCE_DOT_LABELS_AR,
  number: SCALE_NUMBER_CONTROL_LABELS_AR,
  box: BOX_MODEL_CONTROL_LABELS_AR,
  corners: CORNER_RADIUS_CONTROL_LABELS_AR,
  border: BORDER_SIDES_CONTROL_LABELS_AR,
  stack: STACK_CONTROL_LABELS_AR,
  grid: GRID_TRACKS_CONTROL_LABELS_AR,
  origin: TRANSFORM_ORIGIN_CONTROL_LABELS_AR,
  color: STYLE_COLOR_CONTROL_LABELS_AR,
  effects: EFFECT_PRESET_PICKER_LABELS_AR,
  colorField: COLOR_FIELD_LABELS_AR,
  filter: 'تصفية الخصائص',
  filterPlaceholder: 'ابحث عن خاصية…',
  clearFilter: 'مسح البحث',
  noMatches: (query) => `لا توجد خاصية تطابق «${query}»`,
  moreOptions: (property) => `خيارات أخرى: ${property}`,
  setHere: (count) => (count === 1 ? 'قيمة واحدة مضبوطة هنا' : `${String(count)} قيم مضبوطة هنا`),
};
