import { baseConfig } from '@craftkit/eslint-config/base';

/*
  pixi-studio:engine-libs (2026-10-10): this package now carries vendored third-party source
  (vendor/particle-emitter, vendor/webgl-noise, vendor/simplex-noise, vendor/zzfx). ESLint 10
  resolves the config nearest each file, and the base config's `vendor/**` ignore is relative to
  the config file, so this package-level config makes that ignore cover ./vendor. The package has
  no React or stories, so the base rules are the whole set (as in code-runtime).
*/
export default [...baseConfig];
