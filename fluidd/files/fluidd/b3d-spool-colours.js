// Every colour of a spool, in Fluidd's spool views. A dual, tri colour or gradient spool carries
// several colours: Spoolman files them as a list and leaves the single colour empty, and the printer
// reads them off an RFID tag. Upstream draws a spool in one colour only, so a multi colour spool
// came out white. Here the spool icons and the AFC lane reel are painted in stripes, one per colour.
//
// The richest record wins. A spool's colours come from Spoolman and from the lane it sits on, which
// holds what the tag said; whichever names more colours is the one drawn, so a multi colour spool is
// never flattened to one colour by the other source. A tie keeps Spoolman's colours.
(function attachSpoolColours() {
  var SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
  var LANE_OBJECT_PREFIX = 'AFC_lane '
  var PAINT_NAME_PREFIX = 'b3d-spool-colours-'
  var ICON_CLASS_SUFFIX = '-icon'
  var NOT_A_HEX_DIGIT = /[^0-9a-f]/g

  // A stripe pattern is drawn into the page once and reused by every view that shows the same
  // colours, so it is remembered by its name.
  var paintedNames = {}
  var paintStore = null

  function spoolmanColours(spool) {
    return (spool && spool.filament && spool.filament.colors) || []
  }

  function laneColours(lane) {
    return (lane && lane.colors) || []
  }

  function richestColours(spoolColours, coloursOnLane) {
    return coloursOnLane.length > spoolColours.length ? coloursOnLane : spoolColours
  }

  function laneHoldingSpool(printerObjects, spoolId) {
    var objects = printerObjects || {}
    var laneObjectName = Object.keys(objects).find(function holdsTheSpool(objectName) {
      return objectName.indexOf(LANE_OBJECT_PREFIX) === 0 && objects[objectName].spool_id === spoolId
    })
    return laneObjectName ? objects[laneObjectName] : null
  }

  function coloursOfSpool(printerObjects, spool) {
    if (!spool) return []
    var lane = laneHoldingSpool(printerObjects, spool.id)
    return richestColours(spoolmanColours(spool), laneColours(lane))
  }

  function paintName(colours) {
    var hexDigits = colours.map(function hexOnly(colour) {
      return String(colour).toLowerCase().replace(NOT_A_HEX_DIGIT, '')
    })
    return PAINT_NAME_PREFIX + hexDigits.join('-')
  }

  // Two stops per colour at the same edges give hard stripes instead of a blend between colours.
  function stripeStops(colours) {
    var stripeWidth = 100 / colours.length
    return colours.flatMap(function stripeEdges(colour, position) {
      return [
        { offset: position * stripeWidth + '%', colour: colour },
        { offset: (position + 1) * stripeWidth + '%', colour: colour }
      ]
    })
  }

  // Not display:none: a gradient inside a hidden svg is not painted by every browser.
  function createPaintStore() {
    var store = document.createElementNS(SVG_NAMESPACE, 'svg')
    store.setAttribute('width', '0')
    store.setAttribute('height', '0')
    store.setAttribute('aria-hidden', 'true')
    store.setAttribute('style', 'position:absolute')
    var gradients = document.createElementNS(SVG_NAMESPACE, 'defs')
    store.appendChild(gradients)
    document.body.appendChild(store)
    var iconRules = document.createElement('style')
    document.head.appendChild(iconRules)
    return { gradients: gradients, iconRules: iconRules }
  }

  function stripeGradient(name, colours) {
    var gradient = document.createElementNS(SVG_NAMESPACE, 'linearGradient')
    gradient.setAttribute('id', name)
    stripeStops(colours).forEach(function addStop(stripeStop) {
      var stop = document.createElementNS(SVG_NAMESPACE, 'stop')
      stop.setAttribute('offset', stripeStop.offset)
      stop.setAttribute('stop-color', stripeStop.colour)
      gradient.appendChild(stop)
    })
    return gradient
  }

  // Vuetify fills an svg icon with its text colour, and its icon colour takes a plain colour only,
  // so the stripes reach an icon through a class whose rule fills the svg with them instead.
  function iconRule(name) {
    return '.' + name + ICON_CLASS_SUFFIX + ' .v-icon__svg{fill:url(#' + name + ')}'
  }

  function paintStripes(colours) {
    var name = paintName(colours)
    if (paintedNames[name]) return name
    paintStore = paintStore || createPaintStore()
    paintStore.gradients.appendChild(stripeGradient(name, colours))
    paintStore.iconRules.appendChild(document.createTextNode(iconRule(name)))
    paintedNames[name] = true
    return name
  }

  // No class for a spool of one colour: upstream's own icon colour already draws it.
  function iconClass(printerObjects, spool) {
    var colours = coloursOfSpool(printerObjects, spool)
    if (colours.length < 2) return undefined
    return paintStripes(colours) + ICON_CLASS_SUFFIX
  }

  // The reel fills its filament with the colour it is given, so the stripes go in as the fill.
  function laneReelFill(upstreamColour, spool, lane) {
    var colours = richestColours(spoolmanColours(spool), laneColours(lane))
    if (colours.length < 2) return upstreamColour
    return 'url(#' + paintStripes(colours) + ')'
  }

  window.b3dSpoolColours = {
    coloursOfSpool: coloursOfSpool,
    iconClass: iconClass,
    laneReelFill: laneReelFill
  }
})()
