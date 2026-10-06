import { useEffect, useRef, type ReactNode } from 'react';

import { mountCarousel } from '../carousel';
import { mountGallery } from '../gallery';
import { CAROUSEL_PACK_CSS, GALLERY_PACK_CSS } from '../gallery-css';

import type { DemoLang } from './pack-photos';

/** The pack styles, once per document, the way `ensureBehaviorCss` will carry them. */
function ensurePackCss(document: Document): void {
  if (document.head.querySelector('style[data-ck-media-pack-css]') !== null) return;
  const style = document.createElement('style');
  style.setAttribute('data-ck-media-pack-css', '');
  style.textContent = `${GALLERY_PACK_CSS}\n${CAROUSEL_PACK_CSS}`;
  document.head.appendChild(style);
}

/**
 * Mounts the gallery and carousel packs on its region, as the canvas and the
 * published page do, and disposes them on unmount. `interactive: false`
 * shows the editing canvas's still state.
 */
export function PackDemo({
  lang,
  interactive = true,
  children,
}: {
  readonly lang: DemoLang;
  readonly interactive?: boolean;
  readonly children: ReactNode;
}) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = region.current;
    if (el === null) return undefined;
    ensurePackCss(el.ownerDocument);
    const disposers = [mountGallery(el, { interactive }), mountCarousel(el, { interactive })];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [interactive, lang]);
  return (
    <div ref={region} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="p-4">
      {children}
    </div>
  );
}
