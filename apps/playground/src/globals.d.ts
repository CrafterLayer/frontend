// Side-effect CSS imports carry no type declarations (TS 6 / TS2882).
declare module '*.css';

// Vite injects import.meta.env at build time. Typed as unknown values so every
// reader proves the shape it needs instead of trusting ambient any.
interface ImportMeta {
  readonly env: Readonly<Record<string, unknown>>;
}

// Vite's raw imports: the file's text as a string (Tailwind's theme.css for live utilities).
declare module '*?raw' {
  const content: string;
  export default content;
}
