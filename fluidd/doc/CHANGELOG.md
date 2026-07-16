# Changelog

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
