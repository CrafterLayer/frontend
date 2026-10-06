import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { PackDemo } from './pack-demo';
import { photos, type DemoLang } from './pack-photos';

type Layout = 'grid' | 'masonry' | 'bento' | 'carousel';

/*
  The layouts of media-motion DESIGN §B.1: CSS only on the container, the
  `gallery` behaviour on top. The carousel layout nests the `carousel`
  behaviour (track + derived buttons) inside the gallery.
*/
function GalleryDemo({ layout, lang, interactive = true }: { layout: Layout; lang: DemoLang; interactive?: boolean }) {
  const items = photos(lang, layout === 'masonry');
  const figures = items.map((photo, at) => (
    <figure
      key={photo.src}
      className={
        layout === 'bento' && at === 0
          ? 'm-0 col-span-2 row-span-2 h-full'
          : layout === 'bento'
            ? 'm-0 h-full'
            : 'm-0'
      }
    >
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={at === 0 ? 'eager' : 'lazy'}
        decoding="async"
        className={
          layout === 'grid'
            ? 'block aspect-[4/3] w-full rounded-lg object-cover'
            : layout === 'bento'
              ? 'block h-full w-full rounded-lg object-cover'
              : 'block h-auto w-full rounded-lg'
        }
      />
      {layout === 'bento' ? null : (
        <figcaption className="mt-1 text-sm opacity-70">{photo.caption}</figcaption>
      )}
    </figure>
  ));
  return (
    <PackDemo lang={lang} interactive={interactive}>
      {layout === 'carousel' ? (
        <div data-ck-behavior="gallery">
          <div data-ck-behavior="carousel" data-ck-indicator="dots">
            <ul className="m-0 flex list-none gap-4 p-0">
              {figures.map((figure) => (
                <li key={figure.key} className="w-4/5 shrink-0 md:w-1/3">
                  {figure}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between">
              <button type="button" aria-label={lang === 'ar' ? 'السابق' : 'Previous'}>
                ‹
              </button>
              <button type="button" aria-label={lang === 'ar' ? 'التالي' : 'Next'}>
                ›
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          data-ck-behavior="gallery"
          className={
            layout === 'grid'
              ? 'grid grid-cols-2 gap-4 md:grid-cols-3'
              : layout === 'masonry'
                ? 'columns-2 gap-4 md:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid'
                : 'grid auto-rows-[12rem] grid-cols-2 gap-4 md:grid-cols-4'
          }
        >
          {figures}
        </div>
      )}
    </PackDemo>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/Gallery',
  component: GalleryDemo,
  parameters: { layout: 'fullscreen' },
  args: { layout: 'grid', lang: 'en' },
} satisfies Meta<typeof GalleryDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * fix pass (2026-10-06): the published site.css carries the Tailwind preflight
 * (`*,::backdrop{margin:0}`), which pinned the lightbox to the inline-start
 * corner. The story adds that rule and holds the dialog to the viewport centre.
 */
async function expectCentred(dialog: HTMLElement): Promise<void> {
  const root = dialog.ownerDocument.documentElement;
  await waitFor(async () => {
    const rect = dialog.getBoundingClientRect();
    await expect(Math.abs(rect.left + rect.width / 2 - root.clientWidth / 2)).toBeLessThan(4);
    await expect(Math.abs(rect.top + rect.height / 2 - root.clientHeight / 2)).toBeLessThan(4);
  });
}

/** Grid: open an image, step with the arrow key, close; focus returns to the thumbnail. */
export const Grid: Story = {
  play: async ({ canvasElement }) => {
    const preflight = canvasElement.ownerDocument.createElement('style');
    preflight.textContent = '*,::backdrop{margin:0}';
    canvasElement.ownerDocument.head.appendChild(preflight);
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', { name: /^Photo 1/u });
    await userEvent.click(first);
    const dialog = await waitFor(() => {
      const found = canvasElement.ownerDocument.querySelector('dialog[data-ck-lightbox]');
      if (found === null) throw new Error('no dialog yet');
      return found as HTMLElement;
    });
    try {
      await expectCentred(dialog);
    } finally {
      preflight.remove();
    }
    // The dialog fades in from opacity 0 (ck-lightbox-in): visible once its first frame has painted.
    await waitFor(async () => {
      await expect(within(dialog).getByText('1 / 6')).toBeVisible();
    });
    await userEvent.keyboard('{ArrowRight}');
    await expect(within(dialog).getByText('2 / 6')).toBeVisible();
    await expect(within(dialog).getByText('Market street')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.querySelector('dialog[data-ck-lightbox]')).toBeNull();
    });
    await expect(first).toHaveFocus();
  },
};

export const Masonry: Story = { args: { layout: 'masonry' } };

export const Bento: Story = { args: { layout: 'bento' } };

export const Carousel: Story = { args: { layout: 'carousel' } };

/** Arabic, RTL: Arabic labels and Arabic-Indic digits; ← moves forward. */
export const GridArabic: Story = {
  args: { layout: 'grid', lang: 'ar' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^صورة 1/u }));
    const dialog = await waitFor(() => {
      const found = canvasElement.ownerDocument.querySelector('dialog[data-ck-lightbox]');
      if (found === null) throw new Error('no dialog yet');
      return found as HTMLElement;
    });
    await waitFor(async () => {
      await expect(within(dialog).getByText('١ / ٦')).toBeVisible();
    });
    await userEvent.keyboard('{ArrowLeft}');
    await expect(within(dialog).getByText('٢ / ٦')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'إغلاق' }));
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.querySelector('dialog[data-ck-lightbox]')).toBeNull();
    });
  },
};

export const MasonryArabic: Story = { args: { layout: 'masonry', lang: 'ar' }, globals: { direction: 'rtl' } };

export const BentoArabic: Story = { args: { layout: 'bento', lang: 'ar' }, globals: { direction: 'rtl' } };

export const CarouselArabic: Story = { args: { layout: 'carousel', lang: 'ar' }, globals: { direction: 'rtl' } };

/** The editing canvas: nothing is attached, a click selects. */
export const Canvas: Story = {
  args: { layout: 'grid', interactive: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Photo 1/u })).toBeNull();
  },
};
