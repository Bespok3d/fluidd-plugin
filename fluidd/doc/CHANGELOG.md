# Changelog

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
