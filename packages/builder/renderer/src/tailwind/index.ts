/*
  The Tailwind bridge's public surface.

  The stylesheet itself is imported by the APPLICATION, not from here: Tailwind
  has to see `@theme` in a file its own build processes, and a TS re-export
  would hide it from that scan. Apps import
  `@craftkit/builder-renderer/tailwind.css`.
*/
export {
  TAILWIND_NAMESPACE,
  buildTailwindThemeCss,
  tailwindVarName,
  type TailwindBinding,
  type TailwindNamespace,
} from './token-bridge';
