import type { CodeFile, ManagedCatalogManifest } from '@craftkit/builder-schema';

export const BASE_UI_VERSION = '1.9.0';
export const BASE_UI_PACKAGE = '@base-ui/react';
export const BASE_UI_PARTS = {
  accordion: 'Accordion',
  dialog: 'Dialog',
  menu: 'Menu',
  'navigation-menu': 'NavigationMenu',
  popover: 'Popover',
  tabs: 'Tabs',
  'direction-provider': 'DirectionProvider',
} as const;

/** One shared module keeps contexts/portals/direction identical across all public facades. */
export const BASE_UI_ENTRY_SOURCE = Object.entries(BASE_UI_PARTS)
  .map(([path, name]) => `export { ${name} } from '${BASE_UI_PACKAGE}/${path}';`)
  .join('\n');

export const BASE_UI_MANIFEST: ManagedCatalogManifest['packages'][number] = {
  packageId: BASE_UI_PACKAGE,
  version: BASE_UI_VERSION,
  importSpecifiers: [
    BASE_UI_PACKAGE,
    ...Object.keys(BASE_UI_PARTS).map((path) => `${BASE_UI_PACKAGE}/${path}`),
  ],
  sourceArtifactId: 'craftkit-base-ui-1.9.0',
  cssArtifactIds: [],
  license: 'MIT',
  integrity: 'unbuilt',
};

/** No ambient resolution: these trusted public modules re-export the same bundled namespaces. */
export const BASE_UI_FACADES: Readonly<Record<string, CodeFile>> = Object.fromEntries(
  Object.entries(BASE_UI_PARTS).map(([path, name]) => [
    `${BASE_UI_PACKAGE}/${path}`,
    { language: 'js', source: `export { ${name} } from '${BASE_UI_PACKAGE}';` },
  ]),
);
