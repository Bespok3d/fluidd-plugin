// Every colour of a spool, in Fluidd's spool views. A dual, tri colour or gradient spool carries
// several colours: Spoolman files them as a list and leaves the single colour empty, and the printer
// reads them off an RFID tag. Upstream draws a spool in one colour only, so a multi colour spool
// came out white. Here the spool icons, the Spoolman card's remaining-weight bar and the AFC lane
// reel are painted in stripes, one per colour.
//
// The richest record wins. A spool's colours come from Spoolman and from the lane it sits on, which
// holds what the tag said; whichever names more colours is the one drawn, so a multi colour spool is
// never flattened to one colour by the other source. A tie keeps Spoolman's colours.
(function attachSpoolColours() {
  var SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
  var LANE_OBJECT_PREFIX = 'AFC_lane '
  var PAINT_NAME_PREFIX = 'b3d-spool-colours-'
  var ICON_CLASS_SUFFIX = '-icon'
  var BAR_CLASS_SUFFIX = '-bar'
  // Spoolman keeps a colour as six hex digits, or eight with transparency; a tag gives six.
  var HEX_COLOUR = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i

  // A stripe pattern is drawn into the page once and reused by every view that shows the same
  // colours, so it is remembered by its name.
  var paintedNames = {}
  var paintedBars = {}
  var paintStore = null

  function isHexColour(colour) {
    return HEX_COLOUR.test(String(colour))
  }

  function hexDigitsOf(colour) {
    return String(colour).replace('#', '').toLowerCase()
  }

  // Every view takes a spool's colours as '#' and lower case hex, so the icon, the bar and the reel
  // of one spool always agree, and a colour is safe in a style sheet. A colour that is not hex is
  // left out, never drawn as some other colour.
  function hexColours(colours) {
    return colours.filter(isHexColour).map(function withHash(colour) {
      return '#' + hexDigitsOf(colour)
    })
  }

  function spoolmanColours(spool) {
    return hexColours((spool && spool.filament && spool.filament.colors) || [])
  }

  function laneColours(lane) {
    return hexColours((lane && lane.colors) || [])
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
    return PAINT_NAME_PREFIX + colours.map(hexDigitsOf).join('-')
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
    var stripeRules = document.createElement('style')
    document.head.appendChild(stripeRules)
    return { gradients: gradients, stripeRules: stripeRules }
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

  // A progress bar is an html box, which an svg gradient cannot fill, so it takes the same stripes as
  // a css gradient.
  function barStripes(colours) {
    var cssStops = stripeStops(colours).map(function cssStop(stripeStop) {
      return stripeStop.colour + ' ' + stripeStop.offset
    })
    return 'linear-gradient(to right,' + cssStops.join(',') + ')'
  }

  // Vuetify paints a bar's filled part, and the faded track after it, with its colour, which takes a
  // plain colour only. The stripes are laid over both, each sized to the whole bar and pinned to its
  // own end of it, so the two parts show one set of stripes that stays put as the spool empties.
  // Only the parts' edges animate: an animated stripe size would slide the two parts apart on resize.
  // A reversed bar, which right to left languages get too, swaps the two ends. A browser without
  // container sizes would squeeze a full set of stripes into each part, so it keeps upstream's colour.
  function barRule(name, colours) {
    var barSelector = '.' + name + BAR_CLASS_SUFFIX
    var reversedBar = barSelector + '.v-progress-linear--reverse'
    var filledPart = ' .v-progress-linear__determinate'
    var fadedTrack = ' .v-progress-linear__background'
    return '@supports (container-type:inline-size){' +
      barSelector + '{container-type:inline-size}' +
      barSelector + filledPart + ',' + barSelector + fadedTrack + '{background-image:' +
      barStripes(colours) + ';background-size:100cqw 100%;transition-property:width,left,right}' +
      barSelector + fadedTrack + ',' + reversedBar + filledPart + '{background-position:right}' +
      reversedBar + fadedTrack + '{background-position:left}}'
  }

  function paintStripes(colours) {
    var name = paintName(colours)
    if (paintedNames[name]) return name
    paintStore = paintStore || createPaintStore()
    paintStore.gradients.appendChild(stripeGradient(name, colours))
    paintStore.stripeRules.appendChild(document.createTextNode(iconRule(name)))
    paintedNames[name] = true
    return name
  }

  // Only the active spool has a bar, so its rule is written for that spool alone.
  function paintBar(colours) {
    var name = paintStripes(colours)
    if (paintedBars[name]) return name
    paintStore.stripeRules.appendChild(document.createTextNode(barRule(name, colours)))
    paintedBars[name] = true
    return name
  }

  // No class for a spool of one colour: upstream's own colour already draws it.
  function iconClass(printerObjects, spool) {
    var colours = coloursOfSpool(printerObjects, spool)
    if (colours.length < 2) return undefined
    return paintStripes(colours) + ICON_CLASS_SUFFIX
  }

  function barClass(printerObjects, spool) {
    var colours = coloursOfSpool(printerObjects, spool)
    if (colours.length < 2) return undefined
    return paintBar(colours) + BAR_CLASS_SUFFIX
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
    barClass: barClass,
    laneReelFill: laneReelFill
  }
})()
