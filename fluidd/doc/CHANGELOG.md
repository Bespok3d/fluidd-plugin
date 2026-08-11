# Changelog

## 0.1.6

- New FilaMan spool card, bottom right corner, showing the filament name and colour assigned to
  each extruder (falling back to the bare spool id if the filament lookup fails), a button to
  clear that assignment, and a button to manually repeat the startup repush instead of restarting
  Moonraker. No spool picker: assigning a spool to an extruder stays FilaMan's own job. FilaMan is
  an NFC/RFID filament tracking system with its own Moonraker component (the separate filaman
  Bespok3d plugin), independent of Spoolman, so the card polls that component's own endpoints
  directly rather than reading Fluidd's Spoolman panel or its Vuex store. Adds one script tag and
  one new file to the vendored bundle; no Vuex or dialog patch, and no manifest or config change.
  Inert on a printer without the filaman plugin installed: the card's first request fails and it
  never appears. The repush button needs filaman 0.2.0 or newer (its `/repush` endpoint); on an
  older filaman it silently does nothing. Fluidd stays v1.37.3.

## 0.1.5

- Vendored Fluidd bumped v1.37.2 to v1.37.3. Upstream adds an AFC print-start dialog, a
  retract/extrude indicator, French, Slovenian and Thai translations, and a rename fix.
- Re-applied the toolchanger Eject gating patch (`laneActive`, plus the actively-printing lock from
  0.1.4) to the new bundle; behavior unchanged. Upstream PR fluidd-core/fluidd#1899, which would
  retire this patch, is still open, so the patch stays.
- The new AFC print-start dialog now opens on a U1, names each tool's filament, and shows each tool
  in the colour the file was sliced with. Snapmaker's Moonraker publishes the per-tool weight list
  as `filament_weight` where Fluidd reads `filament_weights`, so the dialog never opened and the
  print fell through to the Spoolman spool-selection panel; it also publishes filament names and
  types as one semicolon-joined string rather than a list, so each row showed a single character;
  and the swatches used to show the spools sitting in the printer's lanes, which matched the file
  only by luck.
- A print sent straight from the slicer with "start printing after upload" now opens that dialog
  too. Such a print starts on the printer with no browser involved, so nothing opened the dialog and
  the file ran with whatever lane-to-tool map was left over. With the AFC Lite plugin 0.1.10 or
  newer and its **Filament to tools mapper** setting on, the printer holds
  the print before it starts and this opens the dialog on the file being held. The dialog's print
  button releases that hold, cancelling drops the held print, and every browser with Fluidd open
  clears its own dialog when any one of them answers. Nothing changes for a print you start from the
  file list.
- The AFC panel no longer lists T0 through T30 on the first lane. The printer keeps room for 32
  logical tools and every one your file does not use reads as fed by lane E0, so the dialog now
  tells the printer how many tools the file uses. That part needs AFC Lite 0.1.10 or newer; with an
  older one the panel keeps listing the unused tools.
- The Tune page and the extruder controls no longer empty out when the printer is open in a second
  browser or a second tab. Snapmaker's firmware was answering Fluidd out of another tab's cached
  status, and that cache never holds the printer's configuration, so Fluidd found no extruders in
  it. Fluidd now asks in a way the firmware cannot answer from that cache.
- New **Hide unused tool buttons** setting, off by default. The printer's firmware keeps room for 32
  logical tools and registers a macro for each, so the tool row listed 32 buttons on a 4 lane
  machine. With the setting on the row shows one button per lane the printer actually has. The tools
  are still there and a macro can still call them, and the count comes from the printer rather than
  from a number written into the plugin. Reload the page after changing it.
- A browser that already had Fluidd open now picks up a Bespok3d patch instead of serving the old
  page from its own cache. Fluidd's service worker is told the main page and the dashboard code can
  never change, so a patched build reached only a browser that had never seen the printer before.
- Patching the vendored bundle is now a script, `scripts/patch-fluidd.sh`, run automatically by
  `scripts/fetch-fluidd.sh`. A re-vendor can no longer silently drop a patch, and a patch whose
  upstream code moved fails the run instead. The gate runs the same script in `--verify` mode, so a
  bundle missing a patch is a red build.

## 0.1.4

- AFC panel: the lane Eject button is now also disabled while the printer is
  actively printing, reusing Fluidd's own `printerPrinting` state so it matches
  the Load/Unload buttons. Eject stays available while the print is paused, so
  filament can still be swapped mid-print. Extends the existing `laneActive`
  eject patch in the vendored bundle (no re-vendor; Fluidd stays v1.37.2).

## 0.1.3

- Vendored Fluidd bumped v1.37.0 to v1.37.2. Notable upstream change for us:
  the AFC panel can now show a filament name from `lane.filament_name` when no
  Spoolman spool resolves (fluidd-core/fluidd#1860).
- Re-applied the toolchanger Eject gating patch (`laneActive`) from 0.1.2 to
  the new bundle; behavior unchanged.

## 0.1.2

- AFC panel fix for toolchangers: the lane Eject button now enables only when
  that lane's tool is mounted on the carrier (`laneActive`) instead of on
  filament state (`tool_loaded`). On a toolchanger the upstream behavior greyed
  Eject out exactly when a tool was mounted and loaded. Mirrors the same patch in
  the mainsail plugin; paired with afc-lite, Eject docks (parks) the mounted tool.

## 0.1.1

- Publishing from bundled to online official registry.

## 0.1.0

- First release. Replaces the stock outdated Fluidd with upstream Fluidd v1.37.0
  via symlink; uninstall reverts cleanly through overlayfs.
