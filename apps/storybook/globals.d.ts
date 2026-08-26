// Side-effect CSS imports (e.g. `@craftkit/ui/styles.css` in .storybook/preview.ts)
// have no type declarations; TypeScript 6 rejects them without this ambient module.
declare module '*.css';
