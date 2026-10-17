import { describe, expect, it } from 'vitest';

import { clearMotionPatch, hasAnimation, presetPatch, triggerOf, triggerPatch } from './motion-attributes';

describe('timeline recipes count as animation (2026-10-08)', () => {
  it('treats an element animated only by a timeline recipe as animated, so Preview and Remove work', () => {
    expect(hasAnimation({ 'data-ck-timeline': 'stagger-in' })).toBe(true);
    expect(hasAnimation({})).toBe(false);
  });

  it('clears the timeline recipe and its scrub with the rest of the motion', () => {
    expect(clearMotionPatch({ 'data-ck-timeline': 'split-reveal', 'data-ck-scrub': 'true' })).toEqual({
      'data-ck-timeline': null,
      'data-ck-scrub': null,
    });
  });
});

describe('motion attributes', () => {
  it('reads the trigger, defaulting to view', () => {
    expect(triggerOf({})).toBe('view');
    expect(triggerOf({ 'data-ck-trigger': 'click' })).toBe('click');
  });

  it('drops a preset the new trigger cannot play', () => {
    expect(triggerPatch({ 'data-ck-motion': 'fade-up' }, 'scroll')).toEqual({
      'data-ck-trigger': 'scroll',
      'data-ck-motion': null,
    });
    expect(triggerPatch({ 'data-ck-motion': 'parallax-slow' }, 'scroll')).toEqual({ 'data-ck-trigger': 'scroll' });
    expect(triggerPatch({ 'data-ck-motion': 'fade', 'data-ck-trigger': 'click' }, 'view')).toEqual({
      'data-ck-trigger': null,
    });
  });

  it('a chosen preset carries its pending trigger; clearing the last animation clears the params', () => {
    expect(presetPatch({}, 'data-ck-motion', 'fade-up', 'load')).toEqual({
      'data-ck-motion': 'fade-up',
      'data-ck-trigger': 'load',
    });
    expect(
      presetPatch({ 'data-ck-motion': 'fade', 'data-ck-delay': '2', 'data-ck-speed': 'fast' }, 'data-ck-motion', null, 'view'),
    ).toEqual({ 'data-ck-motion': null, 'data-ck-delay': null, 'data-ck-speed': null });
    expect(presetPatch({ 'data-ck-motion': 'fade', 'data-ck-hover': 'lift' }, 'data-ck-hover', null, 'view')).toEqual({
      'data-ck-hover': null,
    });
  });

  it('keeps a behaviour-shared speed', () => {
    expect(clearMotionPatch({ 'data-ck-motion': 'fade', 'data-ck-speed': 'slow', 'data-ck-behavior': 'marquee' })).toEqual({
      'data-ck-motion': null,
    });
  });
});
