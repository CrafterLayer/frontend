/*
  lindenmayer 1.5.4 ships plain JavaScript without types (mural libraries 2, 2026-10-13). Only what
  `studio/libs/lsys/grow.ts` drives is declared: a string axiom rewritten by productions whose
  successors are strings or functions (ours draw from a seeded generator — the library's own
  weighted successors call Math.random, so they are never handed to it).
*/
declare module 'lindenmayer' {
  export interface LSystemProduction {
    successor: string | (() => string);
  }
  export interface LSystemOptions {
    axiom: string;
    productions?: Record<string, LSystemProduction>;
    branchSymbols?: string;
    ignoredSymbols?: string;
    allowClassicSyntax?: boolean;
    forceObjects?: false;
  }
  export default class LSystem {
    constructor(options: LSystemOptions);
    /** Rewrite once, returning the new axiom. */
    applyProductions(): string;
    getString(): string;
  }
}
