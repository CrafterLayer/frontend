import { defineCanvasTool, type TrustedExtensionManifest } from '@craftkit/builder';

import { Announcement, announcementSchema } from './components/Announcement';

/** Registered at runtime by <RegisterDemoExtension/> — never at mount (FR-013). */
export const demoExtension: TrustedExtensionManifest = {
  tier: 1,
  name: 'playground-demo',
  version: '0.1.0',
  contributes: {
    blocks: [{ schema: announcementSchema, render: Announcement }],
    // B2a: a read-only canvas tool — a badge naming the selected block's type,
    // mounted imperatively into the chrome layer and cleaned up on dismissal.
    canvasTools: [
      defineCanvasTool({
        id: 'playground-selection-badge',
        on: 'selection',
        mount: (target) => {
          const badge = target.layer.ownerDocument.createElement('div');
          badge.className = 'pg-selection-badge';
          badge.dataset['testid'] = 'pg-selection-badge';
          badge.textContent =
            target.ctx.store.getState().doc.nodes[target.nodeId]?.type ?? target.nodeId;
          badge.style.position = 'absolute';
          badge.style.transform = `translate(${String(target.rect.x)}px, ${String(
            target.rect.y + target.rect.height,
          )}px)`;
          target.layer.appendChild(badge);
          return () => {
            badge.remove();
          };
        },
      }),
    ],
  },
};
