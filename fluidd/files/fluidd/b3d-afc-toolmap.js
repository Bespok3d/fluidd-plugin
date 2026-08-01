// Open Fluidd's own AFC lane assignment dialog when the printer is holding a print for its map.
//
// A print sent from a slicer with "start printing after upload" begins on the printer with no
// browser in the loop, so nothing opens that dialog and the file runs with whatever lane-to-tool
// map was left over. The afc-lite plugin keeps such a print from starting and raises
// holding_for_map on its _AFC_TOOLMAP macro. This watches for that flag, opens the dialog on the
// file being held back, lets the dialog's print button start it, and tells the printer to drop the
// print when the dialog is dismissed. Every browser that has Fluidd open gets the dialog, and every
// one of them clears it when any one of them answers.
//
// Nothing happens unless the printer raises the flag, which it only does when the owner turns the
// afc-lite setting on. Without afc-lite the macro does not exist and this stays inert.
//
// This file is copied into the vendored bundle by scripts/patch-fluidd.sh, which also adds the
// script tag that loads it, re-points the dialog's print button and hooks the dialog closing.
// Re-vendoring re-applies all of them.

(function bespok3dAfcToolmap() {
  var TOOLMAP_MACRO = 'gcode_macro _AFC_TOOLMAP'
  var TOOL_COUNT_MACRO = 'gcode_macro AFC_TOOLS_IN_PLAY'
  var WAIT_FOR_FLUIDD_MS = 250

  function fluiddRoot() {
    var appElement = document.querySelector('[data-app]')
    return appElement && appElement.__vue__ ? appElement.__vue__.$root : null
  }

  function printerObjectNamed(store, objectName) {
    return store.state.printer.printer[objectName]
  }

  function printerIsHoldingForMap(store) {
    var toolmap = printerObjectNamed(store, TOOLMAP_MACRO)
    return !!toolmap && Number(toolmap.holding_for_map) === 1
  }

  // Nothing has been selected while the print is held back, so print_stats.filename is empty. The
  // held request is the whole SDCARD_PRINT_FILE argument line, quoted or not.
  function fileBeingHeld(store) {
    var toolmap = printerObjectNamed(store, TOOLMAP_MACRO)
    var request = toolmap && toolmap.held_print ? String(toolmap.held_print) : ''
    var filename = request.match(/FILENAME\s*=\s*"?([^"]*)"?/i)
    return filename ? filename[1].trim() : ''
  }

  function openLaneAssignmentDialog(store) {
    var filename = fileBeingHeld(store)
    if (!filename || store.state.afc.dialog.show) return
    store.commit('afc/setDialogState', { show: true, filename: filename })
  }

  function closeLaneAssignmentDialog(store) {
    if (!store.state.afc.dialog.show) return
    store.commit('afc/setDialogState', { show: false, filename: '' })
  }

  // The dialog closes for three reasons: this browser answered it, another browser answered it, or
  // somebody dismissed it. Only the last one is a dismissal the printer has to be told about, and
  // the print button is the one caller of releaseHeldPrint, so it is what tells the other two apart.
  // The printer keeps room for 32 logical tools and every entry no file ever set still reads as fed
  // by the first lane, so on its own a lane cannot tell a tool this print does not use from one
  // mapped to it, and the panel lists T0 through T30 on lane one. Only the browser has the file, so
  // it says how far into that table the print about to start reaches.
  //
  // Empty when the printer has no afc-lite, which would reject the command, and empty when the
  // printer already holds the right count, so the dialog re-rendering does not re-send it.
  function toolsInPlayDeclaration(store, usedTools) {
    var toolCount = printerObjectNamed(store, TOOL_COUNT_MACRO)
    var toolsInPlay = usedTools.length ? Math.max.apply(null, usedTools) + 1 : 0
    if (!toolCount || Number(toolCount.count) === toolsInPlay) return ''
    return 'AFC_TOOLS_IN_PLAY COUNT=' + toolsInPlay
  }

  function heldPrintReleaser(store) {
    var released = false
    return {
      toolsInPlayDeclaration: function declareToolsInPlay(usedTools) {
        return toolsInPlayDeclaration(store, usedTools)
      },
      releaseHeldPrint: function releaseHeldPrint() {
        released = printerIsHoldingForMap(store)
        return released
      },
      heldPrintWasAbandoned: function heldPrintWasAbandoned() {
        return printerIsHoldingForMap(store) && !released
      },
      forgetRelease: function forgetRelease() {
        released = false
      }
    }
  }

  function watchForHeldPrints(store) {
    window.b3dAfcToolmap = heldPrintReleaser(store)
    store.watch(
      function heldPrint() {
        return printerIsHoldingForMap(store)
      },
      function onHeldPrint(isHolding) {
        if (isHolding) {
          window.b3dAfcToolmap.forgetRelease()
          openLaneAssignmentDialog(store)
          return
        }
        closeLaneAssignmentDialog(store)
      },
      { immediate: true }
    )
  }

  function whenFluiddIsReady() {
    var root = fluiddRoot()
    if (root && root.$store) {
      watchForHeldPrints(root.$store)
      return
    }
    window.setTimeout(whenFluiddIsReady, WAIT_FOR_FLUIDD_MS)
  }

  whenFluiddIsReady()
})()
