// A power device while its switch is on its way. Fluidd asks Moonraker to switch a power device and
// keeps a wait named after the device until Moonraker answers, which for a switch that has to be
// confirmed by the device (a Panda PWR's USB port, say) is a second or two. Upstream marks the Power
// menu's row as loading, which its list row does not draw, and the top bar's power button shows
// nothing at all. Here both show a turning icon in place of the power icon, and take no clicks,
// until the answer comes.
//
// Fluidd removes the wait when Moonraker answers, and drops every wait when the connection drops.
// A Moonraker that never answers would still leave it open, so a control stays locked for at most
// SWITCH_WAIT_LIMIT_MS, and then is drawn and clickable as upstream draws it, waiting or not.
//
// The waits are read through Fluidd's own names for them, which patch-fluidd.sh never sees: a
// Fluidd that renamed them would still take the patches. So a page without them reads every device
// as idle, and the controls are drawn as upstream draws them, rather than failing while drawn.
(function attachPowerToggle() {
  var SWITCH_WAIT_LIMIT_MS = 30000
  var TURNING_ICON = '$loading'
  var TURNING_CLASS = 'spin'
  var MOONRAKER_DEVICE = 'moonraker'

  // When this page first saw each wait, so the limit counts from the click and not from now.
  var firstSeenByWaitName = {}

  function waitNameFor(component, deviceName) {
    var waitNames = component.$waits
    if (!waitNames || !waitNames.onDevicePowerToggle) return null
    return waitNames.onDevicePowerToggle + '/' + deviceName
  }

  function waitIsOpen(component, waitName) {
    var getters = component.$typedGetters
    var hasWait = getters && getters['wait/hasWait']
    return typeof hasWait === 'function' && hasWait(waitName) === true
  }

  // Nothing else redraws the control when the limit passes, so it is asked to redraw itself then.
  function startTheClock(component, waitName) {
    firstSeenByWaitName[waitName] = Date.now()
    setTimeout(function redrawAtTheLimit() {
      component.$forceUpdate()
    }, SWITCH_WAIT_LIMIT_MS + 50)
  }

  function isSwitching(component, deviceName) {
    if (!deviceName) return false
    var waitName = waitNameFor(component, deviceName)
    if (!waitName || !waitIsOpen(component, waitName)) {
      delete firstSeenByWaitName[waitName]
      return false
    }
    if (firstSeenByWaitName[waitName] === undefined) startTheClock(component, waitName)
    return Date.now() - firstSeenByWaitName[waitName] < SWITCH_WAIT_LIMIT_MS
  }

  // The top bar's button can be a Klipper pin instead, which Fluidd switches without a wait.
  function topBarDeviceName(component) {
    var topBarToggle = component.topNavPowerToggle
    if (!topBarToggle || topBarToggle.type !== MOONRAKER_DEVICE || !topBarToggle.device) return null
    return topBarToggle.device.device
  }

  function icon(component, deviceName, idleIcon) {
    return isSwitching(component, deviceName) ? TURNING_ICON : idleIcon
  }

  function iconClass(component, deviceName) {
    var classes = {}
    classes[TURNING_CLASS] = isSwitching(component, deviceName)
    return classes
  }

  window.b3dPowerToggle = {
    isSwitching: isSwitching,
    icon: icon,
    iconClass: iconClass,
    topBarDeviceName: topBarDeviceName
  }
})()
