# @craftkit/builder-pixi-assets

PixiJS [AssetPack](https://pixijs.io/assetpack/docs/guide/getting-started/pixi/) for CraftKit: a
**build-time** pipeline that turns a folder of raw game art into what a PixiJS page loads fast.
Node only. Nothing here ships to a page; the page side is PixiJS's own `Assets`.

| In (raw folder)                 | Out                                                                    |
| ------------------------------- | ---------------------------------------------------------------------- |
| `game{m}/hero.png`              | `hero-<hash>.webp`, `hero-<hash>.png` and `@0.5x` copies of each       |
| `game{m}/ui{tps}/btn-a.png` …   | one texture atlas `ui-<hash>.json` + its sheet (WebP and PNG, 1×/0.5×) |
| `game{m}/jump.wav`              | compressed audio (ffmpeg)                                              |
| `game{m}/font.ttf`              | `woff2`                                                                |
| —                               | `manifest.json`: bundle `game` naming every asset                      |

## Folder tags

| Tag         | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `{m}`       | the folder is a manifest bundle (`Assets.loadBundle('game')`)            |
| `{tps}`     | the folder's images become one texture atlas (a spritesheet)             |
| `{fix}`     | one resolution only                                                      |
| `{nomip}`   | no smaller copies                                                        |
| `{jpg}`     | an atlas saved as JPEG                                                   |
| `{copy}`    | copied as is                                                             |
| `{ignore}`  | left out                                                                 |
| `{mIgnore}` | processed, but kept out of the manifest                                  |

## Run it

```sh
# once
pnpm --filter @craftkit/builder-pixi-assets assets build --entry raw-assets --output public/assets
# while editing art
pnpm --filter @craftkit/builder-pixi-assets assets watch --entry raw-assets --output public/assets
```

Flags: `--avif` also writes AVIF, `--no-cache-bust` keeps stable file names, `--strict` fails on
any asset error (use it in CI). A build ends with one line per bundle:
`game: 4 assets (json, png, webp; 1x, 0.5x)`.

In a Vite app, the plugin watches during `vite dev` and runs once before `vite build`:

```ts
// vite.config.ts
import { pixiAssetsPlugin } from '@craftkit/builder-pixi-assets/vite';

export default defineConfig({ plugins: [pixiAssetsPlugin({ entry: './raw-assets' })] });
```

Without `output`, files go to `<publicDir>/assets/`. From code: `new AssetPack(pixiAssetsConfig({
entry, output })).run()`.

## Load it in a page

```js
const url = 'https://cdn.example.com/game/manifest.json';
await PIXI.Assets.init({
  manifest: url,
  basePath: url.slice(0, url.lastIndexOf('/') + 1),
  // Half-size art on phones; the browser takes the first format it supports.
  texturePreference: {
    resolution: matchMedia('(max-width: 640px)').matches ? 0.5 : 1,
    format: ['avif', 'webp', 'png'],
  },
});
await PIXI.Assets.loadBundle('game');
app.stage.addChild(PIXI.Sprite.from('hero'), PIXI.Sprite.from('btn-a'));
```

Studio scenes load only `https:`, `data:` and `blob:` addresses, so publish the output folder to
an https host (a CDN, the site's own domain) and give the scene the manifest's https address. The
Agent knows this pattern (`craftkit.pixi-v8-text-assets`).

## Defaults

`pixiPipes` from `@assetpack/core/pixi` with: resolutions `{ default: 1, low: 0.5 }`; WebP beside
PNG/JPEG, AVIF off; atlas frames and manifest aliases named by file name without extension;
content hashes in file names; AssetPack's cache in `.assetpack`.

## Licences

`@assetpack/core` is MIT (© 2022 PixiJS). Its helpers run at build time only and never ship: sharp
(Apache-2.0, prebuilt libvips), ffmpeg through `@ffmpeg-installer` (LGPL-2.1 wrapper around a GPLv3
binary). The ffmpeg package's only install script is `chmod u+x ffmpeg`; `cpu-features` (an
optional node-gyp build of the GPU texture encoder) is declined. Chokidar is pinned to 4.0.1, the
last attested 4.x, because the workspace refuses unattested releases (`trustPolicy: no-downgrade`).
