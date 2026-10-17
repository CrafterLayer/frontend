import { createCarouselEngine } from './carousel-engine';

/** A document-local handshake: either the serialized pack or lazy asset may arrive first. */
const host = window as Window & { ckCarouselFactory?: typeof createCarouselEngine };
host.ckCarouselFactory ??= createCarouselEngine;
window.dispatchEvent(new Event('ck-carousel-ready'));
