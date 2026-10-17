import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyStyleIntents, setUtilityClassOracle } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../style-manager/test-support';
import { ImageCropper } from './ImageCropper';
import { IMAGE_CROPPER_LABELS_AR } from './ImageCropper.labels';
import { cropIntents, cropRect, type CropValue } from './crop-math';

beforeAll(() => {
  installBrowserStandIns();
  setUtilityClassOracle(() => true);
});
afterAll(() => {
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const SRC = 'https://images.example.com/photo.jpg';

describe('ImageCropper', () => {
  it('moves the focal point with the keyboard: 1% per arrow, 10% with Shift, Home to centre', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn<(crop: CropValue) => void>();
    render(<ImageCropper src={SRC} onApply={onApply} />);

    const handle = screen.getByRole('slider', { name: 'Focal point' });
    handle.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}');
    expect(handle).toHaveAttribute('aria-valuetext', '52% across, 60% down');

    await user.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}');
    expect(handle).toHaveAttribute('aria-valuetext', '0% across, 60% down');

    await user.keyboard('{Home}');
    expect(handle).toHaveAttribute('aria-valuetext', '50% across, 50% down');
  });

  it('keeps arrows in image coordinates in a right-to-left editor', async () => {
    const user = userEvent.setup();
    render(<ImageCropper src={SRC} onApply={vi.fn()} labels={IMAGE_CROPPER_LABELS_AR} dir="rtl" />);
    const handle = screen.getByRole('slider', { name: 'نقطة التركيز' });
    handle.focus();
    await user.keyboard('{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '51');
  });

  it('places the focal point by pointer and previews without writing', () => {
    const onPreview = vi.fn<(crop: CropValue) => void>();
    const onApply = vi.fn<(crop: CropValue) => void>();
    render(<ImageCropper src={SRC} onApply={onApply} onPreview={onPreview} />);
    const stage = screen.getByRole('slider').parentElement;
    if (stage === null) throw new Error('stage missing');
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;

    fireEvent.pointerDown(stage, { clientX: 50, clientY: 75, pointerId: 1 });
    expect(onPreview).toHaveBeenLastCalledWith({ aspect: 'original', x: 25, y: 75 });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the chosen aspect and focal point once', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn<(crop: CropValue) => void>();
    render(<ImageCropper src={SRC} onApply={onApply} />);
    await user.click(screen.getByLabelText('16:9'));
    await user.click(screen.getByRole('button', { name: 'Apply crop' }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ aspect: '16/9', x: 50, y: 50 });
  });
});

describe('crop math', () => {
  it('writes aspect, cover and object position as classes through the engine', () => {
    const result = applyStyleIntents('rounded-lg', cropIntents({ aspect: '16/9', x: 30, y: 60 }), { mode: 'free' });
    expect(result.ok && result.className.split(' ').sort()).toEqual(
      ['aspect-16/9', 'object-[30%_60%]', 'object-cover', 'rounded-lg'].sort(),
    );
  });

  it('removes the crop classes for the original ratio at the centre', () => {
    const result = applyStyleIntents('aspect-16/9 object-cover object-[30%_60%] rounded-lg', cropIntents({ aspect: 'original', x: 50, y: 50 }), {
      mode: 'free',
    });
    expect(result.ok && result.className).toBe('rounded-lg');
  });

  it('finds the largest rectangle of the ratio around the focal point, inside the image', () => {
    expect(cropRect(1600, 900, { aspect: 'square', x: 50, y: 50 })).toEqual({ sx: 350, sy: 0, sw: 900, sh: 900 });
    expect(cropRect(1600, 900, { aspect: 'square', x: 0, y: 50 })).toEqual({ sx: 0, sy: 0, sw: 900, sh: 900 });
    expect(cropRect(1000, 1000, { aspect: '16/9', x: 50, y: 100 })).toEqual({ sx: 0, sy: 438, sw: 1000, sh: 563 });
  });
});
