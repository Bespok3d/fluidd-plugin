#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: GPL-3.0-only
# This plugin's own gate: it must pass from this repo's root, with no sibling repo cloned except
# lib_bespok3d. This repo ships config, assets and shell only, so its gate is the shared detectors.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The shared gate helpers and the detectors that enforce a workspace-wide rule live in one place.
# See lib_bespok3d/tooling/README.md. This is the only line that knows where they are.
B3D_TOOLING="${B3D_TOOLING:-$REPO_ROOT/lib_bespok3d/tooling}"
# lib_bespok3d is a submodule. A clone made without it leaves an empty directory here, so say what
# is actually wrong instead of letting every check below fail on a missing file.
if [ ! -f "$B3D_TOOLING/gate-lib.sh" ] || [ ! -f "$B3D_TOOLING/release-trigger-detector.mjs" ] || [ ! -f "$B3D_TOOLING/manifest-origin-detector.mjs" ]; then
    echo "The shared gate helpers are missing or older than the checks this gate runs:" >&2
    echo "the lib_bespok3d submodule is not checked out, or is pinned to an older commit." >&2
    echo "Run this once from the repo root, then try again:" >&2
    echo "  git submodule sync --recursive && git submodule update --init --recursive" >&2
    echo "See CONTRIBUTING.md for the full environment setup." >&2
    exit 1
fi

# shellcheck source=/dev/null
. "$B3D_TOOLING/gate-lib.sh"

cd "$REPO_ROOT" || exit 1

echo ""
echo "fluidd-plugin gate"

release_trigger_check "$REPO_ROOT"
manifest_origin_check "$REPO_ROOT"
workflow_pinning_check "$REPO_ROOT"
em_dash_check "$REPO_ROOT"
shellcheck_repo "$REPO_ROOT"
# The vendored bundle is upstream's build plus this plugin's own patches. Re-vendoring wipes the
# tree, so the gate proves every patch is still in it.
run_check "Bespok3d patches in the Fluidd bundle" \
    "$REPO_ROOT/fluidd/scripts/patch-fluidd.sh" --verify

# AFC Lite refuses a hand-typed weight, so a lane with no Spoolman spool must not be offered a
# weight box: everything a user could type in it comes back as an error.
run_check "lane weight box" \
    bash "$REPO_ROOT/scripts/test-weight-box.sh" "$REPO_ROOT/fluidd"
# The spool bar under each lane, as the user meets it: the strip's arrow and what adding a spool
# says back when Spoolman cannot know its weight.
run_check "lane toolbar" \
    bash "$REPO_ROOT/scripts/test-lane-toolbar.sh" "$REPO_ROOT/fluidd"
# A spool added in Spoolman has to show in the picker without reloading the page, whichever way the
# picker was opened.
run_check "spool picker refresh" \
    bash "$REPO_ROOT/scripts/test-spool-picker-refresh.sh" "$REPO_ROOT/fluidd"

gate_summary || exit 1
