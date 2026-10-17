// Side-effect CSS imports carry no type declarations (TS 6 / TS2882).
declare module '*.css';

// Vite injects import.meta.env at build time. Typed as unknown values so every
// reader proves the shape it needs instead of trusting ambient any. The agent
// panel's keys (VITE_AGENT_PANEL, VITE_AGENT_LOCALE, VITE_AI_EDIT_MODEL,
// VITE_AI_EDIT_EFFORT) are read and narrowed in app/agent-host.ts, documented in
// .env.example.
interface ImportMeta {
  readonly env: Readonly<Record<string, unknown>>;
}

// Vite's raw imports: the file's text as a string (Tailwind's theme.css for live utilities).
declare module '*?raw' {
  const content: string;
  export default content;
}
