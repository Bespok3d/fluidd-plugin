#!/bin/sh
# Apply every Bespok3d modification to the vendored upstream Fluidd bundle.
#
# The bundle in files/fluidd/ is upstream's own build. These are the only edits
# this plugin makes to it, and each one exists because upstream has not taken
# the change yet. Every patch is literal text, idempotent, and fails loudly if
# its upstream text is gone: a minified chunk that changed shape must be
# re-derived by hand, never skipped silently.
#
# fetch-fluidd.sh runs this automatically after extracting a new release, so a
# re-vendor never loses a patch. Run it directly to re-check an existing tree.
#
# Usage: ./scripts/patch-fluidd.sh            apply (and re-check) every patch
#        ./scripts/patch-fluidd.sh --verify   check only, change nothing
#
# The gate runs --verify, so a vendored bundle that lost a patch fails the build.

set -eu

VERIFY_ONLY=""
if [ "${1:-}" = "--verify" ]; then
  VERIFY_ONLY="yes"
fi

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$PLUGIN_DIR/files/fluidd/assets"
# A patch that does not depend on the Fluidd version is applied to every channel this repo vendors,
# not only to the one this script sits in.
REPO_ROOT="$(cd "$PLUGIN_DIR/.." && pwd)"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "ERROR: $ASSETS_DIR not found; run ./scripts/fetch-fluidd.sh first" >&2
  exit 1
fi

# Upstream chunk filenames carry a content hash that changes every release, so
# each chunk is found by its stable prefix and must resolve to exactly one file.
resolve_chunk() {
  prefix="$1"
  # shellcheck disable=SC2086 # the glob is the point: it resolves the hashed chunk name
  set -- $ASSETS_DIR/$prefix-*.js
  if [ ! -f "$1" ]; then
    echo "ERROR: no chunk matching $prefix-*.js in $ASSETS_DIR" >&2
    exit 1
  fi
  if [ "$#" -ne 1 ]; then
    echo "ERROR: $# chunks match $prefix-*.js; expected exactly one" >&2
    exit 1
  fi
  echo "$1"
}

# A file this plugin adds to the bundle, rather than an edit to upstream's own text. The vendored
# tree is deleted and re-extracted on a re-vendor, so the file has to be put back the same way a
# patch is.
install_file() {
  label="$1"
  source_file="$2"
  destination="$3"

  if cmp -s "$source_file" "$destination"; then
    echo "  $label: present"
    return 0
  fi

  if [ -n "$VERIFY_ONLY" ]; then
    echo "ERROR: $label: $(basename "$destination") is missing or out of date" >&2
    echo "  Run ./scripts/patch-fluidd.sh to install it." >&2
    exit 1
  fi

  cp "$source_file" "$destination"
  echo "  $label: installed"
}

apply_patch() {
  label="$1"
  chunk="$2"
  upstream_text="$3"
  patched_text="$4"

  # grep -F reads a newline as the start of another pattern, so a two-line patched_text matches
  # when only its first line is there and the patch silently reports itself present.
  case "$upstream_text$patched_text" in
    *"
"*)
      echo "ERROR: $label: a patch's text must be one line" >&2
      exit 1
      ;;
  esac

  if grep -qF "$patched_text" "$chunk"; then
    echo "  $label: present"
    return 0
  fi

  if [ -n "$VERIFY_ONLY" ]; then
    echo "ERROR: $label: missing from $(basename "$chunk")" >&2
    echo "  Run ./scripts/patch-fluidd.sh to apply it." >&2
    exit 1
  fi

  if ! grep -qF "$upstream_text" "$chunk"; then
    echo "ERROR: $label: upstream text not found in $(basename "$chunk")" >&2
    echo "  Upstream changed this code. Re-derive the patch by hand, then" >&2
    echo "  update this script. Do not skip it." >&2
    exit 1
  fi

  UPSTREAM_TEXT="$upstream_text" PATCHED_TEXT="$patched_text" \
    perl -0777 -i -pe 's/\Q$ENV{UPSTREAM_TEXT}\E/$ENV{PATCHED_TEXT}/g' "$chunk"

  if ! grep -qF "$patched_text" "$chunk"; then
    echo "ERROR: $label: replacement did not land in $(basename "$chunk")" >&2
    exit 1
  fi
  echo "  $label: applied"
}

DASHBOARD_CHUNK="$(resolve_chunk Dashboard)"
INDEX_CHUNK="$(resolve_chunk index)"
AFC_DIALOG_CHUNK="$(resolve_chunk AfcPrintStartDialogTool)"

echo "Checking Bespok3d patches in $ASSETS_DIR..."

# 1. AFC lane Eject gating. Upstream enables Eject only when the lane's tool is
#    NOT loaded, which is backwards for a toolchanger: on the U1 a lane can only
#    be ejected while its tool is mounted. Ours also locks Eject while a print
#    is running, matching Load/Unload, and stays usable while paused.
#    Upstream PR fluidd-core/fluidd#1899. See doc/CHANGELOG.md 0.1.2 and 0.1.4.
apply_patch "AFC eject gating" "$DASHBOARD_CHUNK" \
  'disabled:e.toolLoaded||!e.laneRunout&&e.toolLoaded' \
  'disabled:!e.laneActive||e.printerPrinting'

# 2. AFC print-start dialog trigger. Upstream opens the dialog only when the
#    file's metadata carries a per-tool weight list named `filament_weights`.
#    Snapmaker's Moonraker publishes the same list as `filament_weight`, so the
#    dialog never opened on a U1. Accept either name.
# shellcheck disable=SC2016 # the backticks are JavaScript string literals in the bundle, not shell
apply_patch "AFC dialog trigger" "$INDEX_CHUNK" \
  'shouldShowAfcDialog(e){return this.afc!=null&&(e!=null&&`filament_weights`in e?(e.filament_weights??[]).filter(e=>e>0):[]).length>0}' \
  'shouldShowAfcDialog(e){return this.afc!=null&&(e?.filament_weights??e?.filament_weight??[]).filter(e=>e>0).length>0}'

# 3. Which tools the file actually uses, same field-name reason as 2.
#
#    This is also the one place that knows both which tools the file uses and
#    how to talk to the printer, so it is where the count is declared. The U1
#    keeps room for 32 logical tools and every entry no file ever set reads as
#    fed by the first lane, so without the count the AFC panel lists T0 through
#    T30 on lane one. The watcher returns an empty command when the printer has
#    no afc-lite or already holds the right count, so nothing is sent twice and
#    a printer without the plugin is never sent a command it would reject.
apply_patch "AFC dialog tool list" "$INDEX_CHUNK" \
  'get usedTools(){return(this.currentFile?.filament_weights??[]).reduce((e,t,n)=>(t>0&&e.push(n),e),[])}' \
  'get usedTools(){let e=(this.currentFile?.filament_weights??this.currentFile?.filament_weight??[]).reduce((t,n,r)=>(n>0&&t.push(r),t),[]),b3dToolsInPlay=window.b3dAfcToolmap?.toolsInPlayDeclaration(e)??"";return b3dToolsInPlay&&w.printerGcodeScript(b3dToolsInPlay),e}'

# 4. The per-tool row inside the dialog. Same field-name reason as 2, plus:
#    Snapmaker's Moonraker publishes filament_name and filament_type as one
#    semicolon-joined string, not a list, so indexing them by tool yielded a
#    single character. Fluidd already ships getStringArray for exactly this and
#    uses it on the history path; use it here too when the value is a string.
#
#    The colour is worse than a name-only mismatch. Upstream reads
#    `filament_colors`, which on a U1 is not the file's colours at all: the
#    printer builds that list from the spools sitting in its own lanes, so the
#    dialog showed the lane colours and not the ones the file was sliced with.
#    The slicer's own per-filament colours arrive as `filament_colour`, one
#    semicolon-joined string, split the same way. Fall back to the old field,
#    which is all a non-Snapmaker Moonraker publishes.
# shellcheck disable=SC2016 # $filters is a Vue property name and the backticks are JavaScript, not shell
apply_patch "AFC dialog tool row" "$AFC_DIALOG_CHUNK" \
  'let e=this.file.filament_colors??[],t=this.file.filament_name??[],n=this.file.filament_type??[],r=this.file.filament_weights??[];' \
  'let e=this.file.filament_colour?this.$filters.getStringArray(this.file.filament_colour):this.file.filament_colors??[],t=Array.isArray(this.file.filament_name)?this.file.filament_name:this.$filters.getStringArray(this.file.filament_name??``),n=Array.isArray(this.file.filament_type)?this.file.filament_type:this.$filters.getStringArray(this.file.filament_type??``),r=this.file.filament_weights??this.file.filament_weight??[];'

# 5. Open that dialog for a print the printer is already holding. A print sent from a slicer with
#    "start printing after upload" never reaches a browser, so upstream's trigger (opening the
#    dialog from the file list) never fires and the file runs with whatever map was left over. The
#    afc-lite plugin keeps such a print from starting and raises a flag; the watcher below opens
#    the dialog on it. Inert on a printer without afc-lite, which never raises the flag.
install_file "AFC toolmap watcher" \
  "$PLUGIN_DIR/patches/afc-toolmap.js" \
  "$PLUGIN_DIR/files/fluidd/b3d-afc-toolmap.js"

apply_patch "AFC toolmap watcher loaded" "$PLUGIN_DIR/files/fluidd/index.html" \
  '<div id="app"></div>' \
  '<div id="app"></div><script src="./b3d-afc-toolmap.js"></script>'

# 6. The dialog's print button. A held print has not started yet and its file has not been
#    selected, so upstream's call would start it without the map that was just made; releasing the
#    hold is what starts it. With no print held, and on a bundle where the watcher never loaded,
#    this is upstream's own behaviour.
# shellcheck disable=SC2016 # the backticks are a JavaScript string literal in the bundle, not shell
apply_patch "AFC toolmap release" "$INDEX_CHUNK" \
  'handlePrint(){this.filename&&(w.printerPrintStart(this.filename),' \
  'handlePrint(){this.filename&&(window.b3dAfcToolmap?.releaseHeldPrint()?w.printerGcodeScript(`AFC_TOOLMAP_GO`):w.printerPrintStart(this.filename),'

# 7. The dialog being dismissed. A held print waits for an answer and never starts by itself, so
#    closing the dialog without printing has to tell the printer to drop it, or the file stays held
#    and the dialog comes back on the next browser reload. The watcher answers false here when the
#    print button is what closed the dialog, and on a bundle where the watcher never loaded.
# shellcheck disable=SC2016 # the backticks are a JavaScript string literal in the bundle, not shell
apply_patch "AFC toolmap dismissal" "$INDEX_CHUNK" \
  'onOpenChange(e){e&&this.filename&&this.currentFile==null&&w.serverFilesMetadata(this.filename)}' \
  'onOpenChange(e){!e&&window.b3dAfcToolmap?.heldPrintWasAbandoned()&&w.printerGcodeScript(`AFC_TOOLMAP_CANCEL`),e&&this.filename&&this.currentFile==null&&w.serverFilesMetadata(this.filename)}'

# 8. Moonraker's subscription cache. Snapmaker's firmware answers printer.objects.subscribe out of
#    another connection's cached status whenever every object asked for is already covered, and
#    Moonraker never caches configfile.settings. The second browser to open the page, and every
#    later subscribe the first one makes, therefore gets a configfile with the settings stripped
#    out: the Tune page empties and the extruder controls vanish. Asking as well for one object
#    name the printer has never heard of, different on every call, means no other subscription can
#    cover the request and the printer is asked for real. Klipper answers an unknown object with
#    nothing and logs nothing, so this costs one empty entry in the reply.
#
#    The name has to be new on every call, not once per page load: the connection's own previous
#    subscription counts as covering it, so a page that reused one name lost its settings again on
#    its second subscribe. Measured on the bench printer.
# shellcheck disable=SC2016 # $( and the backticks are JavaScript in the bundle, not shell
CACHE_BUST_UPSTREAM='printerObjectsSubscribe(e,t){return $(`printer.objects.subscribe`,{dispatch:`printer/onPrinterObjectsSubscribe`,...t,params:{objects:e}})}'
# shellcheck disable=SC2016 # $( and the backticks are JavaScript in the bundle, not shell
CACHE_BUST_PATCHED='printerObjectsSubscribe(e,t){return $(`printer.objects.subscribe`,{dispatch:`printer/onPrinterObjectsSubscribe`,...t,params:{objects:Object.assign({},e,{["b3d_cachebust_"+Math.random().toString(36).slice(2,10)]:null})}})}'

channels_cache_busted=0
for socket_chunk in "$REPO_ROOT"/*/files/fluidd/assets/socketActions-*.js; do
  [ -f "$socket_chunk" ] || continue

  channel_path="${socket_chunk#"$REPO_ROOT"/}"
  channel="${channel_path%%/*}"

  apply_patch "Moonraker cache bust ($channel)" "$socket_chunk" \
    "$CACHE_BUST_UPSTREAM" \
    "$CACHE_BUST_PATCHED"

  # Fluidd's service worker precaches the hashed chunk with a null revision, which tells it the URL
  # can never change its contents. A browser that already holds this build would go on serving the
  # unpatched chunk from its own cache forever; giving the entry a revision is what makes it fetch
  # ours. Bump the revision string whenever the patch above changes.
  apply_patch "Moonraker cache bust served fresh ($channel)" "${socket_chunk%/assets/*}/sw.js" \
    "{\"revision\":null,\"url\":\"assets/$(basename "$socket_chunk")\"}" \
    "{\"revision\":\"b3d-cachebust-1\",\"url\":\"assets/$(basename "$socket_chunk")\"}"

  channels_cache_busted=$((channels_cache_busted + 1))
done

if [ "$channels_cache_busted" -eq 0 ]; then
  echo "ERROR: Moonraker cache bust: no vendored Fluidd bundle found under $REPO_ROOT" >&2
  exit 1
fi

echo "Done. All Bespok3d patches are present."
