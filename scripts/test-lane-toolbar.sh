#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: GPL-3.0-only
# The spool bar under every AFC lane. This runs against the copy the plugin actually ships and
# proves two things a user sees: the strip's arrow points the way the bar will move, and adding a
# spool whose filament has no weight in Spoolman says so instead of reporting a plain success.
set -uo pipefail

PLUGIN_DIR="${1:?usage: test-lane-toolbar.sh <plugin-dir>}"
AUTHORED_TOOLBAR="$PLUGIN_DIR/patches/afc-lane-toolbar.js"
SHIPPED_TOOLBAR="$PLUGIN_DIR/files/fluidd/b3d-afc-lane-toolbar.js"

ARROW_FOLLOWS_THE_BAR='isOpen ? 0 : 180'
ARROW_AGAINST_THE_BAR='isOpen ? 180 : 0'

failures=0

fail() {
    echo "  FAIL: $1" >&2
    failures=$((failures + 1))
}

in_the_shipped_toolbar() {
    grep -Fq "$1" "$SHIPPED_TOOLBAR"
}

[ -f "$SHIPPED_TOOLBAR" ] || {
    echo "  FAIL: the lane toolbar is not in the vendored bundle" >&2
    exit 1
}

# An edit to the toolbar reaches a printer only once the patch script has put it in the bundle.
cmp -s "$AUTHORED_TOOLBAR" "$SHIPPED_TOOLBAR" ||
    fail "the bundle carries an older lane toolbar than this repo wrote"

# The strip's arrow says where the bar is going: up while the bar is open, because clicking it hides
# the buttons, and down while it is closed, because clicking it brings them back.
in_the_shipped_toolbar "$ARROW_FOLLOWS_THE_BAR" ||
    fail "the strip's arrow does not point the way the bar will move"
! in_the_shipped_toolbar "$ARROW_AGAINST_THE_BAR" ||
    fail "the strip's arrow points away from the way the bar will move"

# Spoolman can only report what is left on a spool whose filament carries a weight, so a spool made
# from a tag whose filament has none is not tracked at all and the user has to go and set it.
in_the_shipped_toolbar 'remaining_weight != null' ||
    fail "adding a spool no longer looks at whether Spoolman knows its weight"
in_the_shipped_toolbar 'Open that filament in Spoolman and give it a weight.' ||
    fail "adding a spool with no weight does not tell the user to set one in Spoolman"

[ "$failures" -eq 0 ]
