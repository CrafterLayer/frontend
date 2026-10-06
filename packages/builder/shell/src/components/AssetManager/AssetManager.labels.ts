import type { ImageUploadRefusal } from './image-upload';

export interface AssetManagerLabels {
  readonly title: string;
  readonly tabs: string;
  readonly pictures: string;
  readonly icons: string;
  readonly upload: string;
  readonly drop: string;
  readonly cropFirst: string;
  readonly uploading: string;
  readonly uploaded: (name: string) => string;
  readonly refusals: Readonly<Record<ImageUploadRefusal, string>>;
  readonly siteAssets: string;
  readonly noAssets: string;
  readonly catalogue: string;
  readonly catalogueFilter: string;
  readonly alt: (name: string) => string;
  readonly altMissing: string;
  readonly use: string;
  readonly remove: string;
  readonly size: (width: number, height: number) => string;
  readonly cropSelected: string;
  readonly selectFirst: string;
  readonly commit: {
    readonly upload: (name: string) => string;
    readonly alt: (name: string) => string;
    readonly use: (name: string) => string;
    readonly remove: (name: string) => string;
    readonly crop: string;
    readonly icon: (name: string) => string;
  };
}

export const ASSET_MANAGER_LABELS_EN: AssetManagerLabels = {
  title: 'Assets',
  tabs: 'Asset kinds',
  pictures: 'Pictures',
  icons: 'Icons',
  upload: 'Upload a picture',
  drop: 'Drop a picture here, or choose a file. It is resized to 2400px and saved as WebP.',
  cropFirst: 'Crop before saving',
  uploading: 'Preparing the picture…',
  uploaded: (name) => `Added ${name}. Write its alt text below.`,
  refusals: {
    'not-image': 'That file is not a picture.',
    'too-large': 'Even resized, that picture is over 2 MB. Try a smaller or simpler one.',
    'decode-failed': 'That picture could not be read.',
    'encode-failed': 'That picture could not be converted to WebP.',
  },
  siteAssets: 'Site pictures',
  noAssets: 'No pictures in this site yet.',
  catalogue: 'Photo library',
  catalogueFilter: 'Filter the photo library',
  alt: (name) => `Alt text of ${name}`,
  altMissing: 'Alt text missing',
  use: 'Use on selected',
  remove: 'Delete',
  size: (width, height) => `${String(width)}×${String(height)}`,
  cropSelected: 'Crop the selected image',
  selectFirst: 'Select an element on the canvas first.',
  commit: {
    upload: (name) => `Upload picture · ${name}`,
    alt: (name) => `Alt text · ${name}`,
    use: (name) => `Use picture · ${name}`,
    remove: (name) => `Delete picture · ${name}`,
    crop: 'Crop image',
    icon: (name) => `Icon · ${name}`,
  },
};

export const ASSET_MANAGER_LABELS_AR: AssetManagerLabels = {
  title: 'الوسائط',
  tabs: 'أنواع الوسائط',
  pictures: 'الصور',
  icons: 'الأيقونات',
  upload: 'ارفع صورة',
  drop: 'أفلت صورة هنا أو اختر ملفًا. يُصغَّر إلى 2400 بكسل ويُحفظ بصيغة WebP.',
  cropFirst: 'قص قبل الحفظ',
  uploading: 'يجري تجهيز الصورة…',
  uploaded: (name) => `أُضيفت ${name}. اكتب نصها البديل أدناه.`,
  refusals: {
    'not-image': 'هذا الملف ليس صورة.',
    'too-large': 'حتى بعد التصغير تتجاوز الصورة 2 م.ب. جرّب صورة أصغر أو أبسط.',
    'decode-failed': 'تعذّرت قراءة الصورة.',
    'encode-failed': 'تعذّر تحويل الصورة إلى WebP.',
  },
  siteAssets: 'صور الموقع',
  noAssets: 'لا توجد صور في الموقع بعد.',
  catalogue: 'مكتبة الصور',
  catalogueFilter: 'رشّح مكتبة الصور',
  alt: (name) => `النص البديل لـ ${name}`,
  altMissing: 'النص البديل ناقص',
  use: 'استخدمها في المحدد',
  remove: 'احذف',
  size: (width, height) => `${String(width)}×${String(height)}`,
  cropSelected: 'قص الصورة المحددة',
  selectFirst: 'اختر عنصرًا في اللوحة أولًا.',
  commit: {
    upload: (name) => `رفع صورة · ${name}`,
    alt: (name) => `نص بديل · ${name}`,
    use: (name) => `استخدام صورة · ${name}`,
    remove: (name) => `حذف صورة · ${name}`,
    crop: 'قص صورة',
    icon: (name) => `أيقونة · ${name}`,
  },
};
