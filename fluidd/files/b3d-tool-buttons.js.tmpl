// Which tool buttons Fluidd's tool row keeps.
//
// The U1 keeps room for 32 logical tools and registers a T0 to T31 gcode macro for every one of
// them, so the row lists 32 buttons on a printer with 4 lanes. With the setting on, a tool whose
// number is past the printer's own extruder count is dropped from the row. Nothing else changes:
// the tools are still there and a macro can still call them.
//
// The value below is written when the plugin is installed, from the plugin's
// "Hide unused tool buttons" setting, and rewritten when that setting is changed.

window.b3dToolButtons = {
  hideVirtualTools: "$FLUIDD_HIDE_VIRTUAL_TOOLS" === "on",

  keepsToolButton: function keepsToolButton(toolCommand, extrudersOnPrinter) {
    if (!window.b3dToolButtons.hideVirtualTools) {
      return true;
    }
    var lanesOnPrinter = (extrudersOnPrinter || []).length;
    if (lanesOnPrinter === 0) {
      return true;
    }
    return /^T\d+$/i.test(toolCommand) && Number(toolCommand.substring(1)) < lanesOnPrinter;
  }
};
