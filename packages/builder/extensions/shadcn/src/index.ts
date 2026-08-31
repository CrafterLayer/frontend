/*
  @craftkit/builder-shadcn — components adapted from shadcn/ui (MIT), layer 4.

  shadcn/ui is not a dependency and there is no package to install. It is a set
  of components you copy into your own tree and own outright — which is exactly
  the convention this workspace already follows for Aceternity and Magic UI,
  and stated once here so the absence of a `shadcn` entry in package.json reads
  as the design rather than as an oversight. Provenance is in
  `vendor/VENDOR.md`.

  ## What every adaptation had to change

  Upstream is written against shadcn's OWN theme contract: `bg-card`,
  `text-card-foreground`, `bg-primary`, `text-muted-foreground`, `--border`,
  `--ring`. Copied as-is that installs a second design system beside `--t-*`,
  and a page half in each is two products in one document. Every colour below
  is re-pointed at a role this site can actually move.

  ## What is kept

  The shapes, the spacing rhythm, and — where Radix is involved — the whole
  accessibility layer. A tab strip is four lines of state and forty of
  accessibility, and the forty are the part everyone reimplements incorrectly.
*/
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { AvatarGroup, avatarGroupSchema } from './components/AvatarGroup';
import { Badge, badgeSchema } from './components/Badge';
import { Breadcrumbs, breadcrumbsSchema } from './components/Breadcrumbs';
import { Button, buttonSchema } from './components/Button';
import { Card, cardSchema } from './components/Card';
import { Dialog, dialogSchema } from './components/Dialog';
import { Pagination, paginationSchema } from './components/Pagination';
import { Progress, progressSchema } from './components/Progress';
import { Separator, separatorSchema } from './components/Separator';
import { ShadcnAlert, shadcnAlertSchema } from './components/ShadcnAlert';
import { TabPanel, tabPanelSchema } from './components/TabPanel';
import { Tabs, tabsSchema } from './components/Tabs';

export const builderShadcn: TrustedExtensionManifest = {
  tier: 1,
  name: 'shadcn',
  version: '0.1.0',
  contributes: {
    blocks: [
      { schema: buttonSchema, render: Button },
      { schema: cardSchema, render: Card },
      { schema: badgeSchema, render: Badge },
      { schema: separatorSchema, render: Separator },
      { schema: avatarGroupSchema, render: AvatarGroup },
      { schema: progressSchema, render: Progress },
      { schema: breadcrumbsSchema, render: Breadcrumbs },
      { schema: dialogSchema, render: Dialog },
      { schema: paginationSchema, render: Pagination },
      { schema: shadcnAlertSchema, render: ShadcnAlert },
      { schema: tabsSchema, render: Tabs },
      { schema: tabPanelSchema, render: TabPanel },
    ],
  },
};

export { Card, cardSchema, type CardProps } from './components/Card';
export { Badge, badgeSchema, type BadgeProps } from './components/Badge';
export { Button, buttonSchema, type ButtonProps } from './components/Button';
export { Separator, separatorSchema, type SeparatorProps } from './components/Separator';
export { AvatarGroup, avatarGroupSchema, type AvatarGroupProps } from './components/AvatarGroup';
export { Progress, progressSchema, type ProgressProps } from './components/Progress';
export { Breadcrumbs, breadcrumbsSchema, type BreadcrumbsProps } from './components/Breadcrumbs';
export { Dialog, dialogSchema, type DialogProps } from './components/Dialog';
export { Pagination, paginationSchema, type PaginationProps } from './components/Pagination';
export { ShadcnAlert, shadcnAlertSchema, type ShadcnAlertProps } from './components/ShadcnAlert';
export { Tabs, tabsSchema, type TabsProps } from './components/Tabs';
export { TabPanel, tabPanelSchema, type TabPanelProps } from './components/TabPanel';
