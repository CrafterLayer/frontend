import { describe, expect, it } from 'vitest';

import * as preset from './index';

// Contract §4 (specs/workspace/004-builder-b1-react-foundation/contracts/builder-view.md):
// the preset is the ONLY entrypoint applications may import, so every promised
// value must actually be re-exported — a missing one is unreachable by law.
const PROMISED_VALUES = [
  'BUCKET_THRESHOLDS',
  'BlockActionBar',
  'Builder',
  'BuilderProvider',
  'CanvasFrame',
  'DeviceBar',
  'DocumentView',
  'EditorCanvas',
  'InlineTextSurface',
  'Inspector',
  'LayersTree',
  'Page',
  'Palette',
  'RichText',
  'PreviewMode',
  'bucketForWidth',
  'Slot',
  'StaticDocument',
  'TextBubble',
  'UnknownBlock',
  'blocksMarketing',
  'codeViewExtension',
  'createCodeViewWorkerClient',
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
  'performBlockAction',
  'renderStaticMarkup',
  'richText',
  'richTextExtension',
  'resolveBlockActions',
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

  // Review 011/T033 finding 8: re-exporting the loopback and raw client put
  // worker/client.ts + worker/protocol.ts on every consumer's INITIAL module
  // graph. They are test tooling; they live on './testing' and must never
  // return to the production surface.
  it.each(['createLoopbackWorkerLike', 'createTransformWorkerClient'])(
    'keeps worker plumbing %s OFF the production surface',
    (name) => {
      expect(name in preset).toBe(false);
    },
  );

  it('serves the worker plumbing from the ./testing surface instead', async () => {
    const testing = await import('./testing');
    expect(typeof testing.createLoopbackWorkerLike).toBe('function');
    expect(typeof testing.createTransformWorkerClient).toBe('function');
  });
});
