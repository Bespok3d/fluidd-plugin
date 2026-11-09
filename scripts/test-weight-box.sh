#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: GPL-3.0-only
# The lane filament dialog offers a weight box, and AFC Lite refuses SET_WEIGHT outright, so on a
# lane with no Spoolman spool that box could only ever answer with an error. This runs against the
# bundle this plugin actually ships and proves the box is drawn only for a lane on a Spoolman spool,
# that Set does not wait for a weight, and that a browser already holding the old code is
# handed the new one instead of serving its own.
set -uo pipefail

PLUGIN_DIR="${1:?usage: test-weight-box.sh <plugin-dir>}"
SERVICE_WORKER="$PLUGIN_DIR/files/fluidd/sw.js"

# shellcheck disable=SC2016 # the backticks are JavaScript string literals in the bundle, not shell
WEIGHT_ROW='t(I,{attrs:{title:e.$t(`app.afc.Weight`)'
# shellcheck disable=SC2016 # as above
WEIGHT_ROW_ON_A_SPOOLMAN_SPOOL='e.hasSpoolId?[t(A,{staticClass:`my-3`}),'"$WEIGHT_ROW"
# The getter that decides whether Set can be pressed, read up to the end of its one expression.
SET_BUTTON_RULE='get disableSetBtn\(\)\{return[^}]*\}'

failures=0

fail() {
    echo "  FAIL: $1" >&2
    failures=$((failures + 1))
}

count_in_dashboard_chunk() {
    grep -oF "$1" "$dashboard_chunk" | wc -l | tr -d ' '
}

# The chunk name carries upstream's content hash, so it is found by its stable prefix.
dashboard_chunk="$(echo "$PLUGIN_DIR"/files/fluidd/assets/Dashboard-*.js)"
[ -f "$dashboard_chunk" ] || {
    echo "  FAIL: no Dashboard chunk in the vendored bundle" >&2
    exit 1
}

weight_rows="$(count_in_dashboard_chunk "$WEIGHT_ROW")"
rows_on_a_spoolman_spool="$(count_in_dashboard_chunk "$WEIGHT_ROW_ON_A_SPOOLMAN_SPOOL")"

[ "$weight_rows" = 1 ] || fail "the dialog draws the weight box $weight_rows times, expected once"
[ "$weight_rows" = "$rows_on_a_spoolman_spool" ] ||
    fail "the weight box is drawn on a lane with no Spoolman spool, where the printer refuses it"

# Upstream greys Set out until a weight is typed, and the printer reports no lane weight and refuses
# one typed in, so Set must not wait for a weight on any lane.
set_button_rule="$(grep -oE "$SET_BUTTON_RULE" "$dashboard_chunk")"
set_button_rules="$(printf '%s' "$set_button_rule" | grep -c 'get disableSetBtn')"
[ "$set_button_rules" = 1 ] || fail "the dialog has $set_button_rules rules for its Set button, expected one"
case "$set_button_rule" in
    *'!this.weight'*) fail "Set waits for a weight the printer never reports and refuses when typed" ;;
esac

# The service worker only refetches a file whose revision string changed, and upstream lists this
# chunk with a null revision, meaning its contents can never change. A browser that already holds
# this build would go on drawing the box the printer refuses.
chunk_name="$(basename "$dashboard_chunk")"
precache_entry="$(grep -oE "\{\"revision\":[^,]*,\"url\":\"assets/$chunk_name\"\}" "$SERVICE_WORKER")"
case "$precache_entry" in
    '') fail "the dashboard chunk is not in the service worker's precache list" ;;
    *'"revision":null'*) fail "a browser holding the old dashboard chunk would keep serving it" ;;
esac

[ "$failures" -eq 0 ]
