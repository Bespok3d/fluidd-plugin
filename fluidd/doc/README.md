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

## Notes

- Snapmaker U1.
- Pairs with **Mainsail** if you want both frontends side by side on different ports.
