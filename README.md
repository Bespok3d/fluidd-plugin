# fluidd-plugin

Modern Fluidd v1.37.0: replaces the stock SM build.

A solo Bespok3d plugin repo: it ships one plugin (`fluidd`) and publishes a single index atom into `Bespok3d/main-index/atoms/`.

## Layout

```text
fluidd-plugin/
  fluidd/                  # the plugin; its dir name is the manifest .name
    manifest.json
    files/              # payload the daemon places on the printer
    doc/README.md       # rendered in-app; not deployed
  scripts/{pack.sh,generate-atom.mjs}
  .github/workflows/release.yml
  dist/                 # build output (gitignored)
```

The plugin declares WHAT (destination classes + restart hooks), never paths or raw commands; the
printer-side adapter realizes it. See `Bespok3d/doc/anatomy-of-a-plugin.md`.

## Build locally

```sh
sh scripts/pack.sh                              # -> dist/fluidd-<ver>.b3
node scripts/generate-atom.mjs --plugin fluidd     # -> dist/fluidd.atom.json
```

## Releasing

Bump `fluidd/manifest.json` `version` and push to `main`. CI packs the `.b3`, cuts a release, and
commits the atom into `Bespok3d/main-index/atoms/fluidd.atom.json`. Secret: `MAIN_INDEX_TOKEN`
(contents:write on main-index). Signing deferred.
## Maintainership

These plugins are published and maintained by the Bespok3d org, and several of them repackage or
build on upstream source material. If you own the source material a plugin is based on and would
rather manage it yourself, you are welcome to contact the org to claim it back. The one condition is
that it stays actively maintained: a claimed plugin left to rot will be reclaimed so users are never
stranded on an abandoned package.
