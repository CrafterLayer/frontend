// Side-effect CSS imports carry no type declarations (TS 6 / TS2882).
declare module '*.css';

// Vite injects import.meta.env at build time. Typed as unknown values so every
// reader proves the shape it needs instead of trusting ambient any.
interface ImportMeta {
  readonly env: Readonly<Record<string, unknown>>;
}
