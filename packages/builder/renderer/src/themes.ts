import type { Theme } from './resolve/theme';

/** Starter token sets — the shell milestone owns the full design system later. */
export const lightTheme: Theme = {
  surface: '#ffffff',
  surfaceInverse: '#111827',
  text: '#111827',
  textInverse: '#f9fafb',
  textMuted: '#6b7280',
  accent: '#4f46e5',
  accentText: '#ffffff',
  radius: '12px',
  gap: '16px',
};

export const darkTheme: Theme = {
  surface: '#0b1120',
  surfaceInverse: '#f9fafb',
  text: '#e5e7eb',
  textInverse: '#111827',
  textMuted: '#9ca3af',
  accent: '#818cf8',
  accentText: '#0b1120',
  radius: '12px',
  gap: '16px',
};
