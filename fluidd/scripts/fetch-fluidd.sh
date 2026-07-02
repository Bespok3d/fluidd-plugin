#!/bin/sh
# Download the pinned upstream Fluidd release, verify sha256, and extract into
# files/fluidd/. Run this once after cloning, or whenever VERSION is bumped.
# NOTE: re-vendoring drops the AFC eject patch in assets/Dashboard-*.js; re-apply
# it (see doc/CHANGELOG.md 0.1.2) and run the afc-lite frontend guard test.
#
# Usage: ./scripts/fetch-fluidd.sh

set -eu

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$PLUGIN_DIR/VERSION"
TARGET_DIR="$PLUGIN_DIR/files/fluidd"

if [ ! -f "$VERSION_FILE" ]; then
  echo "ERROR: $VERSION_FILE not found" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$VERSION_FILE"

if [ -z "${FLUIDD_VERSION:-}" ] || [ -z "${FLUIDD_SHA256:-}" ]; then
  echo "ERROR: VERSION must set FLUIDD_VERSION and FLUIDD_SHA256" >&2
  exit 1
fi

URL="https://github.com/fluidd-core/fluidd/releases/download/${FLUIDD_VERSION}/fluidd.zip"
ZIP_PATH="$(mktemp -t fluidd-XXXXXX).zip"
trap 'rm -f "$ZIP_PATH"' EXIT

echo "Downloading Fluidd ${FLUIDD_VERSION}..."
curl -fsSL -o "$ZIP_PATH" "$URL"

echo "Verifying sha256..."
actual=$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')
if [ "$actual" != "$FLUIDD_SHA256" ]; then
  echo "ERROR: sha256 mismatch" >&2
  echo "  expected: $FLUIDD_SHA256" >&2
  echo "  actual:   $actual" >&2
  exit 1
fi

echo "Extracting into $TARGET_DIR..."
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
unzip -q "$ZIP_PATH" -d "$TARGET_DIR"

if [ ! -f "$TARGET_DIR/index.html" ]; then
  echo "ERROR: $TARGET_DIR/index.html missing after extract" >&2
  exit 1
fi

echo "Done. Fluidd ${FLUIDD_VERSION} extracted to $TARGET_DIR"
