/*
  ── The editor's string catalogue: one typed door, two languages ─────────────

  Each surface keeps its strings beside itself (`X.labels.ts`, DESIGN §0.3), so a
  component's story, test and docs read one file. What was missing was ONE place
  a host asks for "the editor in Arabic" and gets every surface's set at once —
  and one place a test proves the two languages have the same shape. This is
  that place: `editorCatalogue(locale)` returns every set, and
  `EDITOR_CATALOGUES` holds both for the parity test.
*/
import {
  ELEMENT_ACTION_LABELS_AR,
  ELEMENT_ACTION_LABELS_EN,
} from '../clipboard/element-actions.labels';
import { ASSET_MANAGER_LABELS_AR, ASSET_MANAGER_LABELS_EN } from '../components/AssetManager/AssetManager.labels';
import { CLASS_MANAGER_LABELS_AR, CLASS_MANAGER_LABELS_EN } from '../components/ClassManager/ClassManager.labels';
import {
  DESIGN_LIBRARY_TRANSFER_LABELS_AR,
  DESIGN_LIBRARY_TRANSFER_LABELS_EN,
} from '../components/DesignLibraryTransfer/DesignLibraryTransfer.labels';
import {
  DESIGN_SYSTEM_PANEL_LABELS_AR,
  DESIGN_SYSTEM_PANEL_LABELS_EN,
} from '../components/DesignSystemPanel/DesignSystemPanel.labels';
import {
  EDITOR_CANVAS_LABELS_AR,
  EDITOR_CANVAS_LABELS_EN,
} from '../components/EditorCanvas/EditorCanvas.labels';
import {
  ELEMENT_QUICK_BAR_LABELS_AR,
  ELEMENT_QUICK_BAR_LABELS_EN,
} from '../components/ElementQuickBar/ElementQuickBar.labels';
import { FONT_PICKER_LABELS_AR, FONT_PICKER_LABELS_EN } from '../components/FontPicker/FontPicker.labels';
import { HISTORY_LIST_LABELS_AR, HISTORY_LIST_LABELS_EN } from '../components/HistoryList/HistoryList.labels';
import { ICON_BROWSER_LABELS_AR, ICON_BROWSER_LABELS_EN } from '../components/IconBrowser/IconBrowser.labels';
import { IMAGE_CROPPER_LABELS_AR, IMAGE_CROPPER_LABELS_EN } from '../components/ImageCropper/ImageCropper.labels';
import { INSPECTOR_LABELS_AR, INSPECTOR_LABELS_EN } from '../components/Inspector/Inspector.labels';
import { LAYERS_TREE_LABELS_AR, LAYERS_TREE_LABELS_EN } from '../components/LayersTree/LayersTree.labels';
import { LIBRARY_PANEL_LABELS_AR, LIBRARY_PANEL_LABELS_EN } from '../components/LibraryPanel/LibraryPanel.labels';
import { PALETTE_LABELS_AR, PALETTE_LABELS_EN } from '../components/Palette/Palette.labels';
import {
  PALETTE_RAMP_EDITOR_LABELS_AR,
  PALETTE_RAMP_EDITOR_LABELS_EN,
} from '../components/PaletteRampEditor/PaletteRampEditor.labels';
import {
  SHORTCUTS_DIALOG_LABELS_AR,
  SHORTCUTS_DIALOG_LABELS_EN,
} from '../components/ShortcutsDialog/ShortcutsDialog.labels';
import { SITE_PAGES_LABELS_AR, SITE_PAGES_LABELS_EN } from '../components/SitePages/SitePages.labels';
import { STATUS_BAR_LABELS_AR, STATUS_BAR_LABELS_EN } from '../components/StatusBar/StatusBar.labels';
import { SYMBOLS_PANEL_LABELS_AR, SYMBOLS_PANEL_LABELS_EN } from '../components/SymbolsPanel/SymbolsPanel.labels';
import { TOP_BAR_LABELS_AR, TOP_BAR_LABELS_EN } from '../components/TopBar/TopBar.labels';
import { ELEMENT_NAME_WORDS_AR, ELEMENT_NAME_WORDS_EN } from '../custom-code/element-target';
import { TREE_TEXT_ACTION_LABELS_AR, TREE_TEXT_ACTION_LABELS_EN } from '../overlay/tree-text-actions';
import { RICH_TEXT_ACTION_LABELS_AR, RICH_TEXT_ACTION_LABELS_EN } from '../overlay/inline-dock-anchor';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN } from '../style-manager/StylePanel/StylePanel.labels';
import { editorDirection, type EditorDirection, type EditorLocale } from './editor-locale';

const CATALOGUE_EN = {
  assetManager: ASSET_MANAGER_LABELS_EN,
  canvas: EDITOR_CANVAS_LABELS_EN,
  classManager: CLASS_MANAGER_LABELS_EN,
  designSystem: DESIGN_SYSTEM_PANEL_LABELS_EN,
  designTransfer: DESIGN_LIBRARY_TRANSFER_LABELS_EN,
  elementActions: ELEMENT_ACTION_LABELS_EN,
  elementWords: ELEMENT_NAME_WORDS_EN,
  fontPicker: FONT_PICKER_LABELS_EN,
  historyList: HISTORY_LIST_LABELS_EN,
  iconBrowser: ICON_BROWSER_LABELS_EN,
  imageCropper: IMAGE_CROPPER_LABELS_EN,
  inspector: INSPECTOR_LABELS_EN,
  layersTree: LAYERS_TREE_LABELS_EN,
  libraryPanel: LIBRARY_PANEL_LABELS_EN,
  palette: PALETTE_LABELS_EN,
  paletteRamp: PALETTE_RAMP_EDITOR_LABELS_EN,
  quickBar: ELEMENT_QUICK_BAR_LABELS_EN,
  richText: RICH_TEXT_ACTION_LABELS_EN,
  shortcuts: SHORTCUTS_DIALOG_LABELS_EN,
  sitePages: SITE_PAGES_LABELS_EN,
  statusBar: STATUS_BAR_LABELS_EN,
  stylePanel: STYLE_PANEL_LABELS_EN,
  symbols: SYMBOLS_PANEL_LABELS_EN,
  topBar: TOP_BAR_LABELS_EN,
  treeText: TREE_TEXT_ACTION_LABELS_EN,
};

/** Every editor surface's strings in one language. */
export type EditorStrings = typeof CATALOGUE_EN;

/** The Arabic set is typed against the English one: a missing surface fails to compile. */
const CATALOGUE_AR: EditorStrings = {
  assetManager: ASSET_MANAGER_LABELS_AR,
  canvas: EDITOR_CANVAS_LABELS_AR,
  classManager: CLASS_MANAGER_LABELS_AR,
  designSystem: DESIGN_SYSTEM_PANEL_LABELS_AR,
  designTransfer: DESIGN_LIBRARY_TRANSFER_LABELS_AR,
  elementActions: ELEMENT_ACTION_LABELS_AR,
  elementWords: ELEMENT_NAME_WORDS_AR,
  fontPicker: FONT_PICKER_LABELS_AR,
  historyList: HISTORY_LIST_LABELS_AR,
  iconBrowser: ICON_BROWSER_LABELS_AR,
  imageCropper: IMAGE_CROPPER_LABELS_AR,
  inspector: INSPECTOR_LABELS_AR,
  layersTree: LAYERS_TREE_LABELS_AR,
  libraryPanel: LIBRARY_PANEL_LABELS_AR,
  palette: PALETTE_LABELS_AR,
  paletteRamp: PALETTE_RAMP_EDITOR_LABELS_AR,
  quickBar: ELEMENT_QUICK_BAR_LABELS_AR,
  richText: RICH_TEXT_ACTION_LABELS_AR,
  shortcuts: SHORTCUTS_DIALOG_LABELS_AR,
  sitePages: SITE_PAGES_LABELS_AR,
  statusBar: STATUS_BAR_LABELS_AR,
  stylePanel: STYLE_PANEL_LABELS_AR,
  symbols: SYMBOLS_PANEL_LABELS_AR,
  topBar: TOP_BAR_LABELS_AR,
  treeText: TREE_TEXT_ACTION_LABELS_AR,
};

/** Both languages, for parity tests and tooling. */
export const EDITOR_CATALOGUES: Readonly<Record<EditorLocale, EditorStrings>> = {
  en: CATALOGUE_EN,
  ar: CATALOGUE_AR,
};

/** The catalogue a host renders with: the language, its direction and every surface's strings. */
export type EditorCatalogue = EditorStrings & {
  readonly locale: EditorLocale;
  readonly dir: EditorDirection;
};

const BUILT: Readonly<Record<EditorLocale, EditorCatalogue>> = {
  en: { ...CATALOGUE_EN, locale: 'en', dir: editorDirection('en') },
  ar: { ...CATALOGUE_AR, locale: 'ar', dir: editorDirection('ar') },
};

/** Every editor surface's strings for one language — the same object each call. */
export function editorCatalogue(locale: EditorLocale): EditorCatalogue {
  return BUILT[locale];
}
