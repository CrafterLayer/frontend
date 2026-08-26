export type TokenName =
  | 'surface'
  | 'surfaceInverse'
  | 'text'
  | 'textInverse'
  | 'textMuted'
  | 'accent'
  | 'accentText'
  | 'radius'
  | 'gap';

/** A theme is a complete token assignment; blocks consume ONLY var(--t-…) names. */
export type Theme = Record<TokenName, string>;

const kebab = (name: string): string => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

export function tokenCssName(name: TokenName): string {
  return `--t-${kebab(name)}`;
}

/** Serialize a theme into one managed `:root { … }` rule for the preview frame. */
export function themeToCssVars(theme: Theme): string {
  const declarations = (Object.entries(theme) as [TokenName, string][])
    .map(([name, value]) => `${tokenCssName(name)}: ${value};`)
    .join(' ');
  return `:root { ${declarations} }`;
}
