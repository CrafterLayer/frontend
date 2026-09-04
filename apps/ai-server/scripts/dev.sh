#!/bin/sh
# One `vite build --watch` is the single source of builds: an initial build,
# then a fast incremental rebuild on every source change. `node --watch`
# starts only once dist/main.js exists, then restarts itself on every rebuild.
# Starting node in parallel with vite's own initial build (instead of waiting
# for it) raced Node's --watch restart cleanup into EADDRINUSE on first launch.
# `trap ... kill 0` cleans up both background jobs on Ctrl+C, SIGTERM, or a crash.
set -e
trap 'kill 0' EXIT INT TERM

vite build --watch --mode development &
VITE_PID=$!

while [ ! -f dist/main.js ]; do
  kill -0 "$VITE_PID" 2>/dev/null || { echo "vite build failed before producing dist/main.js" >&2; exit 1; }
  sleep 0.1
done

node --watch --env-file-if-exists=.env dist/main.js &
wait
