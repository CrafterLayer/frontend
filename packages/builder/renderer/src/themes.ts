/*
  The starter themes now live at layer 0 (`@craftkit/builder-schema`), beside the
  token types that moved there before them. This module re-exports rather than
  redeclares — the same shape `resolve/theme.ts` takes for `Theme` and
  `TokenName` — so every existing import keeps working and there is exactly one
  set of starter values in the repository.
*/
export { darkTheme, lightTheme } from '@craftkit/builder-schema';
