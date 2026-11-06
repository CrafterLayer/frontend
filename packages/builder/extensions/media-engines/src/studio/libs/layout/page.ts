/*
  Storybook spreads for the `layout` Studio library (2026-11-05).

  `layout.page(width, height, options)` splits a page into a picture rectangle and a text
  rectangle. 'auto' puts the picture beside the text on a landscape page (on the reading-start
  side) and above it on a portrait one; 'left'/'right' fall back to 'top' on a portrait page,
  where a side-by-side split leaves the text column too narrow to read. Right-to-left mirrors
  left and right, so an Arabic book's picture leads from the right. 'full' lays the picture over
  the whole page and the text in a band across its bottom. Pure maths: rectangles, no Pixi.
*/

import { num, spacing, type Box, type Spacing } from './flex';

export const PAGE_PICTURES = Object.freeze([
  'auto',
  'top',
  'bottom',
  'left',
  'right',
  'full',
] as const);
export type PagePicture = (typeof PAGE_PICTURES)[number];

export interface PageOptions {
  picture?: PagePicture;
  /** The picture's share of the split side (0.2..0.85); 0.6 beside, 0.62 above, 0.3 text band on 'full'. */
  ratio?: number;
  padding?: Spacing;
  gap?: number;
  rtl?: boolean;
}

export interface PageLayout {
  picture: Box;
  text: Box;
  orientation: 'portrait' | 'landscape';
  /** Where the picture ended up after 'auto', the portrait fallback and RTL mirroring. */
  placement: Exclude<PagePicture, 'auto'>;
}

function round(box: Box): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.max(0, Math.round(box.width)),
    height: Math.max(0, Math.round(box.height)),
  };
}

export function pageLayout(
  width: unknown,
  height: unknown,
  input?: PageOptions | null,
): PageLayout {
  const options = input ?? {};
  const w = num(width, 0, 0);
  const h = num(height, 0, 0);
  const orientation = h > w ? 'portrait' : 'landscape';
  const pad = spacing(options.padding ?? Math.round(Math.min(w, h) * 0.05));
  const gap = num(options.gap, Math.round(Math.min(w, h) * 0.04), 0);
  const rtl = options.rtl === true;
  const asked: PagePicture = PAGE_PICTURES.find((p) => p === options.picture) ?? 'auto';

  let placement: PageLayout['placement'];
  if (asked === 'auto') placement = orientation === 'portrait' ? 'top' : 'left';
  else if ((asked === 'left' || asked === 'right') && orientation === 'portrait') placement = 'top';
  else placement = asked;
  // 'left' means the reading-start side: mirrored for right-to-left books.
  if (rtl && placement === 'left') placement = 'right';
  else if (rtl && placement === 'right') placement = 'left';

  const inner = {
    x: pad.left,
    y: pad.top,
    width: Math.max(0, w - pad.left - pad.right),
    height: Math.max(0, h - pad.top - pad.bottom),
  };

  if (placement === 'full') {
    const band = num(options.ratio, 0.3, 0.15, 0.6);
    const textH = inner.height * band;
    return {
      picture: round({ x: 0, y: 0, width: w, height: h }),
      text: round({
        x: inner.x,
        y: inner.y + inner.height - textH,
        width: inner.width,
        height: textH,
      }),
      orientation,
      placement,
    };
  }

  const beside = placement === 'left' || placement === 'right';
  const ratio = num(options.ratio, beside ? 0.6 : 0.62, 0.2, 0.85);
  let picture: Box;
  let text: Box;
  if (beside) {
    const pw = (inner.width - gap) * ratio;
    const tw = inner.width - gap - pw;
    const pictureFirst = placement === 'left';
    picture = {
      x: pictureFirst ? inner.x : inner.x + tw + gap,
      y: inner.y,
      width: pw,
      height: inner.height,
    };
    text = {
      x: pictureFirst ? inner.x + pw + gap : inner.x,
      y: inner.y,
      width: tw,
      height: inner.height,
    };
  } else {
    const ph = (inner.height - gap) * ratio;
    const th = inner.height - gap - ph;
    const pictureFirst = placement === 'top';
    picture = {
      x: inner.x,
      y: pictureFirst ? inner.y : inner.y + th + gap,
      width: inner.width,
      height: ph,
    };
    text = {
      x: inner.x,
      y: pictureFirst ? inner.y + ph + gap : inner.y,
      width: inner.width,
      height: th,
    };
  }
  return { picture: round(picture), text: round(text), orientation, placement };
}
