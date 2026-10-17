/*
  The `hud` Studio library's shapes (game libraries, 2026-10-12). @pixi/ui's widget classes are
  injected structurally (hud-entry.ts passes the real ones, tests pass stand-ins), like the
  tilemap pipe classes.
*/

import type { PixiContainer } from '../shared/pixi-types';

export interface SignalLike<Args extends unknown[]> {
  connect(fn: (...args: Args) => void): { disconnect(): unknown };
}

export type UiView = PixiContainer & { eventMode?: string; width: number; height: number };

export interface ProgressBarLike extends UiView {
  progress: number;
}

export interface SliderLike extends UiView {
  value: number;
  readonly onUpdate: SignalLike<[number]>;
}

export interface ButtonLike extends UiView {
  enabled: boolean;
  readonly onPress: SignalLike<unknown[]>;
}

export interface CheckBoxLike extends UiView {
  checked: boolean;
  readonly onCheck: SignalLike<[boolean]>;
}

export interface ScrollBoxLike extends UiView {
  addItems(items: unknown[]): void;
  removeItems(): void;
}

type Make<T> = new (options: Record<string, unknown>) => T;

export interface UiClasses {
  ProgressBar: Make<ProgressBarLike>;
  Slider: Make<SliderLike>;
  FancyButton: Make<ButtonLike>;
  CheckBox: Make<CheckBoxLike>;
  ScrollBox: Make<ScrollBoxLike>;
}

/** The part of the Studio scene `s` the HUD reads (passed as `create(s)`). */
export interface HudSceneLike {
  readonly stage: unknown;
  readonly width: number;
  readonly height: number;
  readonly editor?: boolean;
  readonly reducedMotion?: boolean;
  readonly rtl?: boolean;
  readonly canvas?: { readonly parentElement: HTMLElement | null } | null;
  readonly palette?: { readonly accent: number; readonly text: number; readonly surface: number };
  text?(text: string, style?: Record<string, unknown>): unknown;
  onResize?(fn: (width: number, height: number) => void): void;
  dispose?(fn: () => void): void;
}

export type HudColor = number | string;

export interface HudTheme {
  /** Panel and track background. */
  surface: HudColor;
  /** Labels. */
  text: HudColor;
  /** Fills, handles, focus. */
  accent: HudColor;
  /** Empty part of bars and sliders. */
  track: HudColor;
}

export type HudCorner = 'topStart' | 'topEnd' | 'bottomStart' | 'bottomEnd' | 'top' | 'bottom';

export interface HudOptions {
  /** Colours; default from the scene's palette (the site's tokens). */
  theme?: Partial<HudTheme>;
  /** Where the DOM controls mount (default: the scene's region). */
  root?: HTMLElement;
  /** Distance from the canvas edge, px (default 12). */
  margin?: number;
  /** Space between widgets stacked in one corner, px (default 8). */
  gap?: number;
  /** The keyboard panel's accessible name. */
  label?: string;
}

interface Placed {
  /** Corner to stack in (default 'topStart'; start/end follow the page direction). */
  corner?: HudCorner;
}

export interface BarOptions extends Placed {
  label: string;
  value?: number;
  max?: number;
  width?: number;
  height?: number;
  color?: HudColor;
}

export interface SliderOptions extends Placed {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  width?: number;
  onChange?: (value: number) => void;
}

export interface ButtonOptions extends Placed {
  label: string;
  width?: number;
  height?: number;
  onPress?: () => void;
}

export interface CheckOptions extends Placed {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export interface ListOptions extends Placed {
  label: string;
  items?: readonly string[];
  width?: number;
  height?: number;
}

export interface TextOptions extends Placed {
  size?: number;
  color?: HudColor;
}

export interface HudWidget {
  readonly view: UiView;
  readonly width: number;
  readonly height: number;
  /** Its accessible DOM counterpart. */
  readonly mirror: HTMLElement;
  dispose(): void;
}

export interface HudBar extends HudWidget {
  value: number;
  max: number;
}

export interface HudSlider extends HudWidget {
  value: number;
}

export interface HudButton extends HudWidget {
  enabled: boolean;
}

export interface HudCheck extends HudWidget {
  checked: boolean;
}

export interface HudList extends HudWidget {
  items: readonly string[];
}

export interface HudText extends HudWidget {
  text: string;
}

export interface Hud {
  readonly view: UiView;
  readonly theme: Readonly<HudTheme>;
  bar(options: BarOptions): HudBar;
  slider(options: SliderOptions): HudSlider;
  button(options: ButtonOptions): HudButton;
  checkbox(options: CheckOptions): HudCheck;
  list(options: ListOptions): HudList;
  text(value: string, options?: TextOptions): HudText;
  /** Re-run the corner layout (automatic on resize and on every new widget). */
  layout(): void;
  dispose(): void;
}
