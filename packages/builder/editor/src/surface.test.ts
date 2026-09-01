import { describe, expect, it } from 'vitest';

import type {
  AccordionItemProps,
  AccordionProps,
  AuroraBackgroundProps,
  AvatarGroupProps,
  BadgeProps,
  BlockSlotChildMetadata,
  BreadcrumbsProps,
  ButtonProps,
  CardProps,
  CloudShaderProps,
  DialogProps,
  DotPatternSurfaceProps,
  MarqueeProps,
  PaginationProps,
  ProgressProps,
  SeparatorProps,
  ShadcnAlertProps,
  ShimmerButtonProps,
  ShineBorderProps,
  SlotDecl,
  SpotlightSurfaceProps,
  TabPanelProps,
  TabsProps,
} from './index';

import * as preset from './index';

// Contract §4 (specs/workspace/004-builder-b1-react-foundation/contracts/builder-view.md):
// the preset is the ONLY entrypoint applications may import, so every promised
// value must actually be re-exported — a missing one is unreachable by law.
const PROMISED_VALUES = [
  'BUCKET_THRESHOLDS',
  'BlockActionBar',
  'Builder',
  'BuilderShell',
  'BuilderTheme',
  'BuilderProvider',
  'CanvasFrame',
  'DeviceBar',
  'DocumentView',
  'EditorCanvas',
  'InlineTextSurface',
  'IconRail',
  'Inspector',
  'LayersTree',
  'Page',
  'Palette',
  'RichText',
  'PreviewMode',
  'bucketForWidth',
  'Slot',
  'StatusBar',
  'StaticDocument',
  'TextBubble',
  'TopBar',
  'UnknownBlock',
  'blocksMarketing',
  'builderAceternity',
  'builderMagicUi',
  'builderPrimitives',
  'builderShadcn',
  'codeViewExtension',
  'createCodeViewWorkerClient',
  'createBuilder',
  'CHROME_TOKENS',
  'buildStylesheet',
  'comfortable',
  'compact',
  'darkChromeTheme',
  'darkTheme',
  'densities',
  'lightChromeTheme',
  'themeStyle',
  'themeStyleText',
  'defaultBlocks',
  'accordionItemSchema',
  'accordionSchema',
  'auroraBackgroundSchema',
  'avatarGroupSchema',
  'badgeSchema',
  'breadcrumbsSchema',
  'buttonSchema',
  'cardSchema',
  'cloudShaderSchema',
  'defineBlockSchema',
  'defineCanvasTool',
  'defineCommand',
  'emptyDocument',
  'emptyRichText',
  'dialogSchema',
  'dotPatternSurfaceSchema',
  'insertedNodeId',
  'isRichTextSchema',
  'lightTheme',
  'marqueeItemSchema',
  'marqueeSchema',
  'marketingTemplates',
  'openDocument',
  'performBlockAction',
  'paginationSchema',
  'pageSchema',
  'progressSchema',
  'renderStaticMarkup',
  'richText',
  'richTextExtension',
  'resolveBlockActions',
  'resolveResponsiveProps',
  'separatorSchema',
  'shadcnAlertSchema',
  'shimmerButtonSchema',
  'shineBorderSchema',
  'spotlightSurfaceSchema',
  'tabPanelSchema',
  'tabsSchema',
  'themeToCssVars',
  'useBuilder',
  'useDispatch',
  'useKernelSelector',
  'useNode',
  'useRegistryVersion',
  'useSelection',
] as const;

type PublicExtensionProps = [
  AccordionItemProps,
  AccordionProps,
  AuroraBackgroundProps,
  AvatarGroupProps,
  BadgeProps,
  BlockSlotChildMetadata,
  BreadcrumbsProps,
  ButtonProps,
  CardProps,
  CloudShaderProps,
  DialogProps,
  DotPatternSurfaceProps,
  MarqueeProps,
  PaginationProps,
  ProgressProps,
  SeparatorProps,
  ShadcnAlertProps,
  ShimmerButtonProps,
  ShineBorderProps,
  SlotDecl,
  SpotlightSurfaceProps,
  TabPanelProps,
  TabsProps,
];

void (undefined as unknown as PublicExtensionProps);

describe('@craftkit/builder curated surface (contract §4)', () => {
  it.each(PROMISED_VALUES)('re-exports %s', (name) => {
    expect(preset[name as keyof typeof preset]).toBeDefined();
  });

  it('re-exports every curated catalog manifest with its exact discoverable name', () => {
    expect([
      preset.builderAceternity.name,
      preset.builderMagicUi.name,
      preset.builderPrimitives.name,
      preset.builderShadcn.name,
      preset.blocksMarketing.name,
    ]).toEqual(['aceternity', 'magicui', 'primitives', 'shadcn', 'blocks-marketing']);
    for (const manifest of [
      preset.builderAceternity,
      preset.builderMagicUi,
      preset.builderPrimitives,
      preset.builderShadcn,
      preset.blocksMarketing,
    ]) {
      expect(manifest.tier).toBe(1);
      expect(manifest.contributes?.blocks?.length).toBeGreaterThan(0);
    }
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
