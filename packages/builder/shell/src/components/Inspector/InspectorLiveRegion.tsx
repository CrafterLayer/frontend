import type { Announcer } from './types';
import { useAnnouncement } from './use-inspector-announcer';

/**
 * The panel's polite region — the announcer's ONLY subscriber, so a commit's
 * message re-renders this element and nothing else. The zero-width space
 * toggles with the nonce so a repeated outcome still mutates the text node.
 */
export function InspectorLiveRegion({ announcer }: { readonly announcer: Announcer }) {
  const { text, nonce } = useAnnouncement(announcer);
  return (
    <output className="bldr-visually-hidden" aria-live="polite" aria-label="Inspector messages">
      {text}
      {nonce % 2 === 1 ? '​' : ''}
    </output>
  );
}
