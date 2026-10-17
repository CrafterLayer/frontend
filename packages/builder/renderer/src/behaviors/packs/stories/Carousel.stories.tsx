import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { PackDemo } from './pack-demo';
import { photos, type DemoLang } from './pack-photos';

type Indicator = 'dots' | 'counter' | 'none';

/*
  The `carousel` behaviour's markup: a track (the first child that is not a
  row of buttons) and prev/next buttons outside it, which the pack derives.
  `data-ck-indicator` and `data-ck-autoplay` are the closed params it adds.
*/
function CarouselDemo({
  indicator,
  autoplay = false,
  speed = 'normal',
  lang,
  interactive = true,
}: {
  indicator: Indicator;
  autoplay?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
  lang: DemoLang;
  interactive?: boolean;
}) {
  return (
    <PackDemo lang={lang} interactive={interactive}>
      <div
        data-ck-behavior="carousel"
        data-ck-indicator={indicator}
        data-ck-speed={speed}
        {...(autoplay ? { 'data-ck-autoplay': 'true' } : {})}
      >
        <ul className="m-0 flex list-none gap-4 p-0">
          {photos(lang).map((photo) => (
            <li key={photo.src} className="w-full shrink-0">
              <figure className="m-0">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  className="block aspect-video w-full rounded-lg object-cover"
                />
                <figcaption className="mt-1 text-sm opacity-70">{photo.caption}</figcaption>
              </figure>
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
    </PackDemo>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/Carousel',
  component: CarouselDemo,
  parameters: { layout: 'fullscreen' },
  args: { indicator: 'dots', lang: 'en' },
} satisfies Meta<typeof CarouselDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dots: one labelled button per slide; the current one is aria-current. */
export const Dots: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByRole('button', { name: 'Slide 1 of 6' });
    await expect(first).toHaveAttribute('aria-current', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Slide 3 of 6' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Slide 3 of 6' })).toHaveAttribute('aria-current', 'true');
    });
  },
};

export const DotsArabic: Story = {
  args: { indicator: 'dots', lang: 'ar' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'الشريحة ١ من ٦' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  },
};

/** Counter: «٢ / ٥» style, in a polite live region. */
export const Counter: Story = {
  args: { indicator: 'counter' },
  play: async ({ canvasElement }) => {
    const counter = await waitFor(() => {
      const found = canvasElement.querySelector('[data-ck-carousel-counter]');
      if (found === null) throw new Error('no counter yet');
      return found;
    });
    await expect(counter).toHaveTextContent('1 / 6');
    await expect(counter).toHaveAttribute('aria-live', 'polite');
  },
};

export const CounterArabic: Story = { args: { indicator: 'counter', lang: 'ar' }, globals: { direction: 'rtl' } };

/** Autoplay: a visible pause/play toggle (WCAG 2.2.2); hover, focus and off-screen pause it. */
export const Autoplay: Story = {
  args: { indicator: 'dots', autoplay: true, speed: 'fast' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Pause slideshow' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-label', 'Play slideshow');
  },
};

/** The editing canvas: dots drawn but inert, no autoplay toggle. */
export const Canvas: Story = {
  args: { indicator: 'dots', autoplay: true, interactive: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Slide 1 of 6' });
    await expect(canvas.queryByRole('button', { name: 'Pause slideshow' })).toBeNull();
  },
};
