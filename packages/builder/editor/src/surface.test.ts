import { describe, expect, it } from 'vitest';

import * as preset from './index';

// Contract §4 (specs/workspace/004-builder-b1-react-foundation/contracts/builder-view.md):
// the preset is the ONLY entrypoint applications may import, so every promised
// value must actually be re-exported — a missing one is unreachable by law.
const PROMISED_VALUES = [
  'BUCKET_THRESHOLDS',
  'Builder',
  'BuilderProvider',
  'CanvasFrame',
  'DeviceBar',
  'DocumentView',
  'EditorCanvas',
  'Inspector',
  'LayersTree',
  'Page',
  'Palette',
  'RichText',
  'PreviewMode',
  'bucketForWidth',
  'Slot',
  'StaticDocument',
  'UnknownBlock',
  'blocksMarketing',
  'createBuilder',
  'darkTheme',
  'defaultBlocks',
  'defineBlockSchema',
  'defineCanvasTool',
  'defineCommand',
  'emptyDocument',
  'emptyRichText',
  'insertedNodeId',
  'isRichTextSchema',
  'lightTheme',
  'openDocument',
  'renderStaticMarkup',
  'richText',
  'richTextExtension',
  'resolveResponsiveProps',
  'themeToCssVars',
  'useBuilder',
  'useDispatch',
  'useKernelSelector',
  'useNode',
  'useRegistryVersion',
  'useSelection',
] as const;

describe('@craftkit/builder curated surface (contract §4)', () => {
  it.each(PROMISED_VALUES)('re-exports %s', (name) => {
    expect(preset[name as keyof typeof preset]).toBeDefined();
  });
});
