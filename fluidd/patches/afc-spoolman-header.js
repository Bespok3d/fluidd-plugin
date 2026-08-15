// The Bespok3d Spoolman buttons in the AFC unit header. The Spoolman Klipper helper registers the
// SH_ gcode commands, and Klipper publishes every registered command in its gcode object, so a
// printer without that plugin offers none of them and the header stays exactly as upstream drew it.
(function attachAfcSpoolmanHeader() {
  var SPOOLMAN_ACTIONS = [
    {
      command: 'SH_CLEAR_ALL_SPOOLS',
      label: 'Clear all spools',
      askFirst: 'Clear the spool on every lane?'
    },
    { command: 'SH_DETECT_SPOOLS', label: 'Detect spools', askFirst: null },
    { command: 'SH_CLEAR_ACTIVE_SPOOL', label: 'Clear active', askFirst: null }
  ]

  // Vue's render helper leaves a children array exactly as it is handed over unless it is told to
  // normalize it, and a plain string left sitting in that array is later treated as an element and
  // throws, taking the whole page down. 2 is Vue's always-normalize, which turns the label into the
  // text node it is meant to be.
  var NORMALIZE_CHILDREN = 2

  function commandsThePrinterKnows(unitHeader) {
    return unitHeader.$typedGetters['printer/getAvailableCommands'] || {}
  }

  function runSpoolmanAction(unitHeader, action) {
    if (action.askFirst && !window.confirm(action.askFirst)) return
    unitHeader.sendGcode(action.command)
  }

  function buttonClass(unitHeader) {
    var theme = unitHeader.$vuetify.theme.dark ? 'theme--dark' : 'theme--light'
    return 'v-btn v-btn--text v-btn--rounded v-size--small ml-2 ' + theme
  }

  function spoolmanButton(createElement, unitHeader, action) {
    return createElement(
      'button',
      {
        class: buttonClass(unitHeader),
        attrs: { type: 'button' },
        on: {
          click: function onSpoolmanButtonClick() {
            runSpoolmanAction(unitHeader, action)
          }
        }
      },
      [createElement('span', { class: 'v-btn__content' }, [action.label], NORMALIZE_CHILDREN)]
    )
  }

  function headerButtons(createElement, unitHeader) {
    var registered = commandsThePrinterKnows(unitHeader)
    return SPOOLMAN_ACTIONS.filter(function isRegistered(action) {
      return action.command in registered
    }).map(function drawButton(action) {
      return spoolmanButton(createElement, unitHeader, action)
    })
  }

  window.b3dAfcSpoolmanHeader = { headerButtons: headerButtons }
})()
