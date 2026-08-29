---
name: dev-browser
description: Browser automation with persistent page state, wired for the CraftKit frontend monorepo. Use when users ask to navigate websites, fill forms, take screenshots, extract web data, test web apps, or automate browser workflows. Trigger phrases include "go to [url]", "click on", "fill out the form", "take a screenshot", "scrape", "automate", "test the website", "log into", "open the playground", or any browser interaction request.
---

# Dev Browser (CraftKit frontend)

CLI that drives a real browser from sandboxed JavaScript. Scripts run in QuickJS — **not** Node: no `require`, `fetch`, `fs`, or `process`. A `browser` global is preconnected; a background daemon manages instances and named pages.

Run `dev-browser --help` for the full API.

## Project setup

Use the named browser profile `craftkit` so pages, cookies, and profile state persist across sessions:

```bash
dev-browser --browser craftkit <<'EOF'
  const page = await browser.getPage("playground");
  await page.goto("http://localhost:5173/");
  console.log(await page.title());   // CraftKit Builder Playground
EOF
```

`getPage("playground")` reuses the same tab every run — no reload storms, no orphan tabs.

## Start the dev server first

The playground is **not** running by default. A `localhost` navigation with no server fails as a connection error that looks like a dev-browser bug but isn't.

```bash
cd apps/playground
pnpm exec vite --port 5173 --strictPort
```

Use `pnpm exec vite`, not `pnpm dev` — the `dev` script is `vite --open`, which pops a real browser window you don't want during automation.

Check before assuming it's up:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null && echo UP || echo DOWN
```

## Never use `npx` in this repo

Root `package.json` sets `devEngines.packageManager = pnpm@11.23.0` with `onFail: "error"`, so npm hard-fails `EBADDEVENGINES` for any `npx`/`npm` call whose cwd resolves to the repo root. Use `pnpm exec`, or a globally installed absolute binary path.

This is why an `npx`-based MCP server dies here with an unhelpful `CONNECTION_CLOSED`. See the `playwright` entry in `.mcp.json` for the working pattern.

## Screenshots and files

`saveScreenshot` and `writeFile`/`readFile` are async and confined to `~/.dev-browser/tmp/`.

```bash
dev-browser --browser craftkit <<'EOF'
  const page = await browser.getPage("playground");
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  const path = await saveScreenshot(await page.screenshot({ fullPage: true }), "playground.png");
  console.log(path);
EOF
```

Then read that path back with the Read tool to actually look at the result.

## Catching app errors

Attach listeners **before** `goto`, or you miss everything from the initial load:

```js
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(r.status() + " " + r.url()); });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
console.log(errors.length ? errors.join("\n") : "clean");
```

Note: a first cold load right after a lockfile change reports a transient 404 while Vite re-optimizes dependencies. Re-run before treating it as a real failure.

## Housekeeping

- `dev-browser browsers` — list managed instances
- `dev-browser status` — daemon state
- `dev-browser stop` — stop daemon and all browsers (do this if the daemon goes stale after a CLI upgrade)

Pages from `getPage`/`newPage` are full Playwright `Page` objects: https://playwright.dev/docs/api/class-page
