import {
  ASSET_MANAGER_LABELS_AR,
  ASSET_MANAGER_LABELS_EN,
  CLASS_MANAGER_LABELS_AR,
  CLASS_MANAGER_LABELS_EN,
  DESIGN_LIBRARY_TRANSFER_LABELS_AR,
  DESIGN_LIBRARY_TRANSFER_LABELS_EN,
  DESIGN_SYSTEM_PANEL_LABELS_AR,
  DESIGN_SYSTEM_PANEL_LABELS_EN,
  ELEMENT_ACTION_LABELS_AR,
  ELEMENT_ACTION_LABELS_EN,
  ELEMENT_NAME_WORDS_AR,
  ELEMENT_NAME_WORDS_EN,
  ELEMENT_QUICK_BAR_LABELS_AR,
  ELEMENT_QUICK_BAR_LABELS_EN,
  FONT_PICKER_LABELS_AR,
  FONT_PICKER_LABELS_EN,
  HISTORY_LIST_LABELS_AR,
  HISTORY_LIST_LABELS_EN,
  ICON_BROWSER_LABELS_AR,
  ICON_BROWSER_LABELS_EN,
  IMAGE_CROPPER_LABELS_AR,
  IMAGE_CROPPER_LABELS_EN,
  LAYERS_TREE_LABELS_AR,
  LAYERS_TREE_LABELS_EN,
  LIBRARY_PANEL_LABELS_AR,
  LIBRARY_PANEL_LABELS_EN,
  PALETTE_RAMP_EDITOR_LABELS_AR,
  PALETTE_RAMP_EDITOR_LABELS_EN,
  SHORTCUTS_DIALOG_LABELS_AR,
  SHORTCUTS_DIALOG_LABELS_EN,
  STYLE_PANEL_LABELS_AR,
  STYLE_PANEL_LABELS_EN,
  SYMBOLS_PANEL_LABELS_AR,
  SYMBOLS_PANEL_LABELS_EN,
  TREE_TEXT_ACTION_LABELS_AR,
  TREE_TEXT_ACTION_LABELS_EN,
} from '@craftkit/builder';

/** The editor UI's language. The page's own language is the document's business. */
export type EditorLocale = 'en' | 'ar';

/** VITE_EDITOR_LOCALE=ar opens the editor chrome in Arabic; English otherwise (it is today's chrome). */
export function editorLocaleFromEnv(env: Readonly<Record<string, unknown>>): EditorLocale {
  const value = env['VITE_EDITOR_LOCALE'];
  return typeof value === 'string' && value.trim().toLowerCase() === 'ar' ? 'ar' : 'en';
}

/**
 * Every style-manager surface's labels, picked once per locale (DESIGN §0.3:
 * defaults live in each component's `X.labels.ts`; the host picks one).
 */
export function editorLabels(locale: EditorLocale) {
  const ar = locale === 'ar';
  return {
    dir: ar ? ('rtl' as const) : ('ltr' as const),
    assetManager: ar ? ASSET_MANAGER_LABELS_AR : ASSET_MANAGER_LABELS_EN,
    classManager: ar ? CLASS_MANAGER_LABELS_AR : CLASS_MANAGER_LABELS_EN,
    designTransfer: ar ? DESIGN_LIBRARY_TRANSFER_LABELS_AR : DESIGN_LIBRARY_TRANSFER_LABELS_EN,
    designSystem: ar ? DESIGN_SYSTEM_PANEL_LABELS_AR : DESIGN_SYSTEM_PANEL_LABELS_EN,
    elementActions: ar ? ELEMENT_ACTION_LABELS_AR : ELEMENT_ACTION_LABELS_EN,
    elementWords: ar ? ELEMENT_NAME_WORDS_AR : ELEMENT_NAME_WORDS_EN,
    quickBar: ar ? ELEMENT_QUICK_BAR_LABELS_AR : ELEMENT_QUICK_BAR_LABELS_EN,
    fontPicker: ar ? FONT_PICKER_LABELS_AR : FONT_PICKER_LABELS_EN,
    historyList: ar ? HISTORY_LIST_LABELS_AR : HISTORY_LIST_LABELS_EN,
    iconBrowser: ar ? ICON_BROWSER_LABELS_AR : ICON_BROWSER_LABELS_EN,
    imageCropper: ar ? IMAGE_CROPPER_LABELS_AR : IMAGE_CROPPER_LABELS_EN,
    layersTree: ar ? LAYERS_TREE_LABELS_AR : LAYERS_TREE_LABELS_EN,
    libraryPanel: ar ? LIBRARY_PANEL_LABELS_AR : LIBRARY_PANEL_LABELS_EN,
    paletteRamp: ar ? PALETTE_RAMP_EDITOR_LABELS_AR : PALETTE_RAMP_EDITOR_LABELS_EN,
    shortcuts: ar ? SHORTCUTS_DIALOG_LABELS_AR : SHORTCUTS_DIALOG_LABELS_EN,
    stylePanel: ar ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN,
    symbols: ar ? SYMBOLS_PANEL_LABELS_AR : SYMBOLS_PANEL_LABELS_EN,
    treeText: ar ? TREE_TEXT_ACTION_LABELS_AR : TREE_TEXT_ACTION_LABELS_EN,
  };
}

export type EditorLabels = ReturnType<typeof editorLabels>;
