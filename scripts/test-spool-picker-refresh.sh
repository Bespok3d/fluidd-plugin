#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: GPL-3.0-only
# The spool picker listed what the browser fetched from Spoolman when the page loaded, so a spool
# added in Spoolman after that was missing from it until the page was reloaded. This runs against
# the bundle this plugin actually ships and proves both ways into the picker, upstream's own lane
# button and the spool bar Bespok3d puts under the lane, read Spoolman again as they open it.
set -uo pipefail

PLUGIN_DIR="${1:?usage: test-spool-picker-refresh.sh <plugin-dir>}"
LANE_TOOLBAR="$PLUGIN_DIR/files/fluidd/b3d-afc-lane-toolbar.js"

# shellcheck disable=SC2016 # the backticks are a JavaScript string literal in the bundle, not shell
PICKER_READS_SPOOLMAN='this.$typedDispatch(`spoolman/init`),this.$typedCommit(`spoolman/setDialogState`,'

failures=0

fail() {
    echo "  FAIL: $1" >&2
    failures=$((failures + 1))
}

# The chunk name carries upstream's content hash, so it is found by its stable prefix.
dashboard_chunk="$(echo "$PLUGIN_DIR"/files/fluidd/assets/Dashboard-*.js)"
[ -f "$dashboard_chunk" ] || {
    echo "  FAIL: no Dashboard chunk in the vendored bundle" >&2
    exit 1
}

reads_before_opening="$(grep -oF "$PICKER_READS_SPOOLMAN" "$dashboard_chunk" | wc -l | tr -d ' ')"
[ "$reads_before_opening" = 1 ] ||
    fail "the lane's own spool button opens the picker without reading Spoolman again"

# The spool bar opens the same picker itself, so it needs the same read; the order matters, because
# a read fired after the picker is already drawn leaves the stale list on screen.
picker_from_the_bar="$(sed -n '/function pickSpoolThen/,/^  }$/p' "$LANE_TOOLBAR")"
# shellcheck disable=SC2016 # $typedCommit is a Vue property in the script, not a shell variable
case "$picker_from_the_bar" in
    '') fail "the lane toolbar has no pickSpoolThen, so this test proves nothing" ;;
    *refreshSpoolList*'$typedCommit'*) ;;
    *) fail "the spool bar opens the picker without reading Spoolman again first" ;;
esac

[ "$failures" -eq 0 ]
