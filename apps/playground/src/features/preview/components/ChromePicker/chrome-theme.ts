export type ChromeChoice = 'system' | 'light' | 'dark';

/**
 * The prop `BuilderTheme` wants. `system` becomes `undefined` — omitting the
 * prop is how a host says "follow the machine", and passing a string is how it
 * says "override the machine".
 */
export function chromeThemeFor(choice: ChromeChoice): 'light' | 'dark' | undefined {
  return choice === 'system' ? undefined : choice;
}
