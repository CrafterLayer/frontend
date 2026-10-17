// Side-effect CSS imports carry no type declarations (TS 6 / TS2882).
declare module '*.css';

// Static publishers need the original CSS text, including rules Tailwind cannot synthesize.
declare module '*.css?raw' {
  const css: string;
  export default css;
}
