# Fluidd

Swaps the Snapmaker-shipped Fluidd web UI for the current upstream release.

## What you get

- Input-shaper graphs.
- Integrated config and G-code editors.
- Tool-colour preview.
- A modern bed-mesh visualizer.

## How it works

Snapmaker serves `/home/lava/fluidd` through nginx. This plugin symlinks that path to a
Bespok3d-managed copy of upstream Fluidd v1.37.0. Nothing in the nginx config is touched.

## Uninstall

Removing the plugin deletes the symlink, and the overlay filesystem falls back to the
Snapmaker-shipped copy automatically. No backup is needed.

## After installing or updating: refresh the browser

Fluidd is a PWA: your browser caches its assets through a service worker, so a freshly
installed or updated Fluidd may keep showing the old version until the cache clears. If the UI
looks unchanged after an install/update:

1. Hard-refresh the page (Ctrl/Cmd + Shift + R), possibly more than once.
2. If it still looks stale, open the browser's DevTools, go to **Application > Service Workers**
   and **Unregister**, then **Application > Storage > Clear site data**, and reload.

This is a browser caching quirk, not a failed install.

## Notes

- Snapmaker U1.
- Pairs with **Mainsail** if you want both frontends side by side on different ports.
