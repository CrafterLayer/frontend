export interface ClassManagerLabels {
  readonly title: string;
  readonly empty: string;
  readonly list: string;
  readonly uses: (count: number) => string;
  readonly selected: (name: string) => string;
  readonly noSelection: string;
  readonly combo: string;
  readonly comboEmpty: string;
  readonly earlier: (name: string) => string;
  readonly later: (name: string) => string;
  readonly removeFrom: (name: string) => string;
  readonly createName: string;
  readonly create: string;
  readonly rename: (name: string) => string;
  readonly apply: string;
  readonly applySimilar: (count: number) => string;
  readonly edit: string;
  readonly closeEdit: string;
  readonly classes: (name: string) => string;
  readonly remove: string;
  readonly inUse: (count: number) => string;
  readonly detach: string;
  readonly cancel: string;
  readonly done: (what: string) => string;
  readonly commit: {
    readonly create: (name: string) => string;
    readonly apply: (name: string) => string;
    readonly rename: (name: string) => string;
    readonly remove: (name: string) => string;
    readonly detach: (name: string) => string;
    readonly unapply: (name: string) => string;
    readonly order: (element: string) => string;
    readonly classes: (name: string) => string;
  };
}

export const CLASS_MANAGER_LABELS_EN: ClassManagerLabels = {
  title: 'Styles',
  empty: 'No named styles yet. Select an element and create one from its look.',
  list: 'Named styles',
  uses: (count) => (count === 1 ? '1 use' : `${String(count)} uses`),
  selected: (name) => `Selected: ${name}`,
  noSelection: 'Select an element on the canvas to create or apply a style.',
  combo: 'Styles on this element (later wins)',
  comboEmpty: 'This element has no named styles.',
  earlier: (name) => `Move ${name} earlier`,
  later: (name) => `Move ${name} later`,
  removeFrom: (name) => `Remove ${name} from the element`,
  createName: 'New style name',
  create: 'Create from element',
  rename: (name) => `Name of ${name}`,
  apply: 'Apply to selected',
  applySimilar: (count) => `Apply to all similar (${String(count)})`,
  edit: 'Edit style',
  closeEdit: 'Close editor',
  classes: (name) => `Classes of ${name}`,
  remove: 'Delete',
  inUse: (count) =>
    `Used by ${String(count)} element${count === 1 ? '' : 's'}. Detach inlines the style into each of them, so their look stays.`,
  detach: 'Detach and delete',
  cancel: 'Cancel',
  done: (what) => what,
  commit: {
    create: (name) => `Create style · ${name}`,
    apply: (name) => `Apply style · ${name}`,
    rename: (name) => `Rename style · ${name}`,
    remove: (name) => `Delete style · ${name}`,
    detach: (name) => `Detach style · ${name}`,
    unapply: (name) => `Remove style · ${name}`,
    order: (element) => `Style order · ${element}`,
    classes: (name) => `Style classes · ${name}`,
  },
};

export const CLASS_MANAGER_LABELS_AR: ClassManagerLabels = {
  title: 'الأنماط',
  empty: 'لا توجد أنماط مسمّاة بعد. اختر عنصرًا وأنشئ نمطًا من مظهره.',
  list: 'الأنماط المسمّاة',
  uses: (count) => `${String(count)} استخدام`,
  selected: (name) => `المحدد: ${name}`,
  noSelection: 'اختر عنصرًا في اللوحة لإنشاء نمط أو تطبيقه.',
  combo: 'أنماط هذا العنصر (الأخير يغلب)',
  comboEmpty: 'لا يحمل هذا العنصر أنماطًا مسمّاة.',
  earlier: (name) => `قدّم ${name}`,
  later: (name) => `أخّر ${name}`,
  removeFrom: (name) => `أزل ${name} من العنصر`,
  createName: 'اسم النمط الجديد',
  create: 'أنشئ من العنصر',
  rename: (name) => `اسم ${name}`,
  apply: 'طبّق على المحدد',
  applySimilar: (count) => `طبّق على كل المتشابهة (${String(count)})`,
  edit: 'حرّر النمط',
  closeEdit: 'أغلق المحرر',
  classes: (name) => `فئات ${name}`,
  remove: 'احذف',
  inUse: (count) => `مستخدم في ${String(count)} عنصر. الفصل يدمج النمط في كل عنصر فيبقى مظهره.`,
  detach: 'افصل واحذف',
  cancel: 'إلغاء',
  done: (what) => what,
  commit: {
    create: (name) => `إنشاء نمط · ${name}`,
    apply: (name) => `تطبيق نمط · ${name}`,
    rename: (name) => `إعادة تسمية نمط · ${name}`,
    remove: (name) => `حذف نمط · ${name}`,
    detach: (name) => `فصل نمط · ${name}`,
    unapply: (name) => `إزالة نمط · ${name}`,
    order: (element) => `ترتيب الأنماط · ${element}`,
    classes: (name) => `فئات النمط · ${name}`,
  },
};
