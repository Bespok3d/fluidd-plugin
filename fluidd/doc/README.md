# Fluidd

Swaps the Snapmaker-shipped Fluidd web UI for the current upstream release.

## What you get

- Input-shaper graphs.
- Integrated config and G-code editors.
- Tool-colour preview.
- A modern bed-mesh visualizer.
- A print-start dialog that maps the file's tools onto your AFC lanes before the print begins.

## Mapping lanes for a print sent from the slicer

The lane assignment dialog opens when you start a print from the file list. A print sent from the
slicer with "start printing after upload" begins on the printer with no browser involved, so nothing
opened it and the file ran with whatever map was left over.

Install the AFC Lite plugin and turn on its **Filament to tools mapper** setting, and the printer
keeps that print from starting. Fluidd then opens the same dialog on the
file being held back, and its print button sets the map and starts it. The print waits as long as it
takes, and cancelling the dialog drops it instead of starting it.

Nothing changes without AFC Lite and that setting: the printer never holds a print, and starting one
from the file list works exactly as before.

## Hiding the tool buttons your printer has no lane for

The U1's firmware keeps room for 32 logical tools and registers a macro for every one of them, so the
tool row lists 32 buttons on a printer with 4 lanes.

Turn on the plugin's **Hide unused tool buttons** setting and the row shows one button per lane the
printer actually has. Nothing is removed from the printer: the tools are still there and a macro can
still call them. The count comes from the printer, so a machine with a different number of lanes
shows its own. Reload the page after changing the setting.

## The spool bar under a lane

On a printer running the Bespok3d Spoolman plugin, every lane in the AFC panel carries a small bar
with three buttons:

- **Add spool**: makes a new Spoolman spool from the tag on the lane, ties the tag to it, and puts
  it on the lane.
- **Update spool data**: pick a spool, and the tag's data is written onto it.
- **Link spool**: pick a spool, and the tag is tied to it.

Picking a spool uses Fluidd's own spool list, the same one the lane's reel opens.

The bar opens itself on a lane whose spool Spoolman does not know, and sits collapsed as a thin
strip otherwise. Click the strip to open or close it.

Without the Spoolman plugin there is no bar and no buttons in the panel header: those are its
commands, and the panel looks exactly as upstream draws it.

## Configuration

- **Fluidd port** (default `80`): the port Fluidd is served on.
- **Hide unused tool buttons** (default `off`): see above.

## How it works

Snapmaker serves `/home/lava/fluidd` through nginx. This plugin symlinks that path to a
Bespok3d-managed copy of upstream Fluidd v1.37.3. Nothing in the nginx config is touched.

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
