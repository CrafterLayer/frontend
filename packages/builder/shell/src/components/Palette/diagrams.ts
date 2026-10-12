interface DiagramPart {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

type BlockDiagramKind =
  | 'action'
  | 'chart'
  | 'columns'
  | 'generic'
  | 'grid'
  | 'hero'
  | 'media'
  | 'pricing'
  | 'section'
  | 'table'
  | 'testimonial'
  | 'text';

interface BlockDiagram {
  readonly kind: BlockDiagramKind;
  readonly parts: readonly DiagramPart[];
}

function heroDiagram(): readonly DiagramPart[] {
  return [
    { key: 'heading', x: 2, y: 3, width: 17, height: 4, opacity: 0.9 },
    { key: 'body', x: 2, y: 9, width: 13, height: 2, opacity: 0.42 },
    { key: 'button', x: 2, y: 15, width: 8, height: 4, opacity: 0.72 },
    { key: 'panel', x: 22, y: 3, width: 10, height: 17, opacity: 0.22 },
  ];
}

function columnsDiagram(): readonly DiagramPart[] {
  return [
    { key: 'column-1', x: 2, y: 3, width: 8, height: 18, opacity: 0.35 },
    { key: 'column-2', x: 13, y: 3, width: 8, height: 18, opacity: 0.62 },
    { key: 'column-3', x: 24, y: 3, width: 8, height: 18, opacity: 0.9 },
  ];
}

function gridDiagram(): readonly DiagramPart[] {
  return [
    { key: 'top-1', x: 2, y: 3, width: 8, height: 8, opacity: 0.32 },
    { key: 'top-2', x: 13, y: 3, width: 8, height: 8, opacity: 0.56 },
    { key: 'top-3', x: 24, y: 3, width: 8, height: 8, opacity: 0.8 },
    { key: 'bottom-1', x: 2, y: 13, width: 8, height: 8, opacity: 0.8 },
    { key: 'bottom-2', x: 13, y: 13, width: 8, height: 8, opacity: 0.56 },
    { key: 'bottom-3', x: 24, y: 13, width: 8, height: 8, opacity: 0.32 },
  ];
}

function textDiagram(): readonly DiagramPart[] {
  return [
    { key: 'heading', x: 2, y: 3, width: 21, height: 4, opacity: 0.9 },
    { key: 'line-1', x: 2, y: 10, width: 30, height: 2, opacity: 0.35 },
    { key: 'line-2', x: 2, y: 14, width: 26, height: 2, opacity: 0.35 },
    { key: 'line-3', x: 2, y: 18, width: 18, height: 2, opacity: 0.35 },
  ];
}

function mediaDiagram(): readonly DiagramPart[] {
  return [
    { key: 'frame', x: 2, y: 3, width: 30, height: 14, opacity: 0.25 },
    { key: 'subject', x: 6, y: 7, width: 9, height: 7, opacity: 0.72 },
    { key: 'caption', x: 2, y: 19, width: 19, height: 2, opacity: 0.48 },
  ];
}

function actionDiagram(): readonly DiagramPart[] {
  return [
    { key: 'heading', x: 4, y: 4, width: 26, height: 4, opacity: 0.88 },
    { key: 'body', x: 8, y: 10, width: 18, height: 2, opacity: 0.38 },
    { key: 'button', x: 11, y: 16, width: 12, height: 5, opacity: 0.72 },
  ];
}

function pricingDiagram(): readonly DiagramPart[] {
  return [
    { key: 'card-1', x: 2, y: 3, width: 8, height: 18, opacity: 0.2 },
    { key: 'price-1', x: 4, y: 6, width: 4, height: 3, opacity: 0.68 },
    { key: 'action-1', x: 4, y: 16, width: 4, height: 2, opacity: 0.48 },
    { key: 'card-2', x: 13, y: 3, width: 8, height: 18, opacity: 0.38 },
    { key: 'price-2', x: 15, y: 6, width: 4, height: 3, opacity: 0.9 },
    { key: 'action-2', x: 15, y: 16, width: 4, height: 2, opacity: 0.7 },
    { key: 'card-3', x: 24, y: 3, width: 8, height: 18, opacity: 0.2 },
    { key: 'price-3', x: 26, y: 6, width: 4, height: 3, opacity: 0.68 },
    { key: 'action-3', x: 26, y: 16, width: 4, height: 2, opacity: 0.48 },
  ];
}

function testimonialDiagram(): readonly DiagramPart[] {
  return [
    { key: 'quote-1', x: 3, y: 3, width: 5, height: 6, opacity: 0.84 },
    { key: 'quote-2', x: 10, y: 3, width: 5, height: 6, opacity: 0.84 },
    { key: 'line-1', x: 3, y: 12, width: 28, height: 2, opacity: 0.35 },
    { key: 'line-2', x: 3, y: 16, width: 23, height: 2, opacity: 0.35 },
    { key: 'author', x: 3, y: 20, width: 11, height: 2, opacity: 0.62 },
  ];
}

function sectionDiagram(): readonly DiagramPart[] {
  return [
    { key: 'surface', x: 2, y: 3, width: 30, height: 18, opacity: 0.2 },
    { key: 'heading', x: 6, y: 7, width: 15, height: 3, opacity: 0.82 },
    { key: 'body', x: 6, y: 13, width: 22, height: 2, opacity: 0.4 },
    { key: 'detail', x: 6, y: 17, width: 13, height: 2, opacity: 0.4 },
  ];
}

function tableDiagram(): readonly DiagramPart[] {
  return [
    { key: 'header', x: 2, y: 3, width: 30, height: 4, opacity: 0.72 },
    { key: 'row-1', x: 2, y: 9, width: 30, height: 3, opacity: 0.3 },
    { key: 'row-2', x: 2, y: 13.5, width: 30, height: 3, opacity: 0.45 },
    { key: 'row-3', x: 2, y: 18, width: 30, height: 3, opacity: 0.3 },
  ];
}

function chartDiagram(): readonly DiagramPart[] {
  return [
    { key: 'bar-1', x: 4, y: 13, width: 4, height: 8, opacity: 0.45 },
    { key: 'bar-2', x: 11, y: 8, width: 4, height: 13, opacity: 0.72 },
    { key: 'bar-3', x: 18, y: 11, width: 4, height: 10, opacity: 0.45 },
    { key: 'bar-4', x: 25, y: 4, width: 4, height: 17, opacity: 0.9 },
    { key: 'axis', x: 2, y: 21, width: 30, height: 1, opacity: 0.35 },
  ];
}

function genericDiagram(): readonly DiagramPart[] {
  return [
    { key: 'header', x: 2, y: 3, width: 30, height: 4, opacity: 0.72 },
    { key: 'aside', x: 2, y: 10, width: 9, height: 11, opacity: 0.28 },
    { key: 'content', x: 14, y: 10, width: 18, height: 5, opacity: 0.5 },
    { key: 'footer', x: 14, y: 18, width: 13, height: 3, opacity: 0.36 },
  ];
}

function diagramKey(type: string): string {
  return type.replace(/[^a-zA-Z0-9]/g, '').toLocaleLowerCase();
}

export function diagramForBlockType(type: string): BlockDiagram {
  const key = diagramKey(type);

  if (key.includes('pricing') || key.includes('plan') || key.includes('comparison')) {
    return { kind: 'pricing', parts: pricingDiagram() };
  }
  // After pricing, so a comparison table keeps its plan-columns miniature.
  if (key.includes('table')) {
    return { kind: 'table', parts: tableDiagram() };
  }
  if (key.includes('chart')) {
    return { kind: 'chart', parts: chartDiagram() };
  }
  if (key.includes('testimonial') || key.includes('review') || key.includes('quote')) {
    return { kind: 'testimonial', parts: testimonialDiagram() };
  }
  if (
    key.includes('cta') ||
    key.includes('button') ||
    key.includes('shimmer') ||
    key.includes('action') ||
    key.includes('form') ||
    key.includes('progress') ||
    key === 'dialog'
  ) {
    return { kind: 'action', parts: actionDiagram() };
  }
  if (
    key.includes('hero') ||
    key.includes('banner') ||
    key.includes('announcement') ||
    key.includes('spotlight') ||
    key.includes('aurora') ||
    key.includes('dotpattern') ||
    key.includes('cloudshader')
  ) {
    return { kind: 'hero', parts: heroDiagram() };
  }
  if (
    key.includes('column') ||
    key.includes('row') ||
    key === 'breadcrumbs' ||
    key === 'pagination' ||
    key === 'tabs'
  ) {
    return { kind: 'columns', parts: columnsDiagram() };
  }
  if (
    key.includes('grid') ||
    key.includes('feature') ||
    key.includes('gallery') ||
    key.includes('logo') ||
    key.includes('stats') ||
    key.includes('team') ||
    key.includes('blog') ||
    key.includes('portfolio') ||
    key.includes('product') ||
    key.includes('marquee') ||
    key.includes('avatar')
  ) {
    return { kind: 'grid', parts: gridDiagram() };
  }
  if (
    key.includes('richtext') ||
    key.includes('text') ||
    key.includes('heading') ||
    key.includes('paragraph') ||
    key.includes('faq') ||
    key.includes('contentsection') ||
    key.includes('process') ||
    key.includes('accordion')
  ) {
    return { kind: 'text', parts: textDiagram() };
  }
  if (
    key.includes('image') ||
    key.includes('media') ||
    key.includes('video') ||
    key.includes('embed') ||
    key.includes('contact') ||
    key.includes('newsletter') ||
    key.includes('carousel')
  ) {
    return { kind: 'media', parts: mediaDiagram() };
  }
  if (
    key.includes('page') ||
    key.includes('section') ||
    key.includes('container') ||
    key.includes('navigation') ||
    key.includes('navbar') ||
    key.includes('footer') ||
    key.includes('stack') ||
    key.includes('spacer') ||
    key.includes('divider') ||
    key === 'card' ||
    key === 'badge' ||
    key === 'separator' ||
    key === 'shadcnalert' ||
    key === 'tabpanel' ||
    key === 'shineborder'
  ) {
    return { kind: 'section', parts: sectionDiagram() };
  }

  return { kind: 'generic', parts: genericDiagram() };
}
