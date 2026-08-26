// Side-effect CSS imports (component styles, src/build.ts bundle entry) carry no
// type declarations; TypeScript 6 rejects them (TS2882) without this ambient module.
declare module '*.css';
