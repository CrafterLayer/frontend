import { BOX_MODEL_CONTROL_LABELS_AR, BOX_MODEL_CONTROL_LABELS_EN, type BoxModelControlLabels } from '../BoxModelControl';

export interface BorderSidesControlLabels {
  readonly group: string;
  readonly width: string;
  readonly style: string;
  readonly styles: Readonly<Record<string, string>>;
  readonly box: BoxModelControlLabels;
}

export const BORDER_SIDES_CONTROL_LABELS_EN: BorderSidesControlLabels = {
  group: 'Border',
  width: 'Border width',
  style: 'Border style',
  styles: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted', double: 'Double', none: 'None' },
  box: { ...BOX_MODEL_CONTROL_LABELS_EN, group: 'Border width' },
};

export const BORDER_SIDES_CONTROL_LABELS_AR: BorderSidesControlLabels = {
  group: 'الحد',
  width: 'سماكة الحد',
  style: 'نمط الحد',
  styles: { solid: 'متصل', dashed: 'متقطع', dotted: 'منقط', double: 'مزدوج', none: 'بدون' },
  box: { ...BOX_MODEL_CONTROL_LABELS_AR, group: 'سماكة الحد' },
};
