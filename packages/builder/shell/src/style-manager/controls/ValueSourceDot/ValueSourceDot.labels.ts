import type { ValueOrigin } from './value-origin';

export interface ValueSourceDotLabels {
  /** What each origin is called in the hover card and the accessible name. */
  readonly origin: Readonly<Record<ValueOrigin, string>>;
  /** The heading over the class that carries the value. */
  readonly classHeading: string;
  readonly reset: string;
  /** Shown when the family also has classes behind breakpoints the panel does not write. */
  readonly customBreakpoint: string;
  /** The accessible name of the dot: "Padding: set here". */
  readonly name: (property: string, origin: string) => string;
}

export const VALUE_SOURCE_DOT_LABELS_EN: ValueSourceDotLabels = {
  origin: {
    here: 'Set here',
    'larger-bucket': 'Inherited from a larger screen',
    'default-state': 'Inherited from the default state',
    'named-style': 'From a named style',
    unset: 'Not set',
  },
  classHeading: 'Class',
  reset: 'Reset',
  customBreakpoint: 'Also set at a custom breakpoint',
  name: (property, origin) => `${property}: ${origin}`,
};

export const VALUE_SOURCE_DOT_LABELS_AR: ValueSourceDotLabels = {
  origin: {
    here: 'مضبوطة هنا',
    'larger-bucket': 'موروثة من شاشة أكبر',
    'default-state': 'موروثة من الحالة الافتراضية',
    'named-style': 'من نمط مسمّى',
    unset: 'غير مضبوطة',
  },
  classHeading: 'الصنف',
  reset: 'إعادة الضبط',
  customBreakpoint: 'مضبوطة أيضًا عند نقطة توقف مخصّصة',
  name: (property, origin) => `${property}: ${origin}`,
};
