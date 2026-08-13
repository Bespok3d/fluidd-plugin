// A small floating card showing each extruder's assigned FilaMan spool, with a button to clear it
// and a button to manually repeat the startup repush.
//
// FilaMan is an NFC/RFID filament tracking system with its own Moonraker component (the filaman
// Bespok3d plugin), independent of Spoolman. It talks to Fluidd's built in Spoolman panel not at
// all, since that panel only lights up for a component actually named spoolman. This card is its
// own thing instead: it polls the filaman component's own REST endpoints directly and renders
// itself, without reading or writing anything in Fluidd's Vuex store. Deliberately no spool
// picker here: assigning a spool to an extruder is FilaMan's own job (an NFC tap, or its own
// app), this card only shows and clears what is already assigned.
//
// Inert on a printer without the filaman Moonraker component: the first status request 404s (or
// otherwise fails), the card is never created, and nothing polls again until the next page load.
//
// This file is copied into the vendored bundle by scripts/patch-fluidd.sh, which also adds the
// script tag that loads it. Re-vendoring re-applies both.

(function bespok3dFilamanCard() {
  var STATUS_PATH = '/server/filaman/status'
  var SPOOL_ID_PATH = '/server/filaman/spool_id'
  var REPUSH_PATH = '/server/filaman/repush'
  var PROXY_PATH = '/server/filaman/proxy'
  var POLL_INTERVAL_MS = 5000
  var CARD_ELEMENT_ID = 'b3d-filaman-card'

  var spoolDetailsById = {}
  var spoolDetailFetchesInFlight = {}

  function requestJson(path, requestInit) {
    return window.fetch(path, requestInit).then(function readBody(response) {
      if (!response.ok) throw new Error('filaman request failed: ' + response.status)
      return response.json()
    })
  }

  function unwrapMoonrakerResult(body) {
    return body.result || body
  }

  function fetchStatus() {
    return requestJson(STATUS_PATH, { credentials: 'same-origin' }).then(unwrapMoonrakerResult)
  }

  function clearExtruderSpool(extruderName) {
    var query = '?extruder=' + encodeURIComponent(extruderName)
    return requestJson(SPOOL_ID_PATH + query, { method: 'POST', credentials: 'same-origin' })
  }

  function repushAssignedSpools() {
    return requestJson(REPUSH_PATH, { method: 'POST', credentials: 'same-origin' })
  }

  // FilaMan's REST API nests a spool's consumption log under /api/v1/spools/{id}/consumptions,
  // so the spool itself is expected at /api/v1/spools/{id}. Routed through the filaman
  // component's own proxy endpoint, which already holds the credentials this card does not have.
  function fetchSpoolDetail(spoolId) {
    return requestJson(PROXY_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_method: 'GET',
        path: '/api/v1/spools/' + spoolId,
        use_v2_response: true
      })
    })
      .then(unwrapMoonrakerResult)
      .then(function readProxyResult(proxyResult) {
        if (proxyResult.error) throw new Error(proxyResult.error.message || 'proxy error')
        return spoolDetailFromApiSpool(proxyResult.response)
      })
  }

  function normalizedColorHex(hex) {
    return hex.charAt(0) === '#' ? hex : '#' + hex
  }

  function spoolDetailFromApiSpool(apiSpool) {
    var filament = apiSpool.filament || {}
    var colorEntry = (filament.colors || [])[0]
    var initialTotalWeightG = filament.initial_total_weight_g != null
      ? filament.initial_total_weight_g
      : apiSpool.initial_total_weight_g
    var emptySpoolWeightG = apiSpool.empty_spool_weight_g
    var initialWeightG = (initialTotalWeightG != null && emptySpoolWeightG != null)
      ? Math.max(initialTotalWeightG - emptySpoolWeightG, 0)
      : filament.raw_material_weight_g

    return {
      name: filament.designation || null,
      colorHex: colorEntry && colorEntry.color && colorEntry.color.hex_code
        ? normalizedColorHex(colorEntry.color.hex_code)
        : null,
      remainingWeightG: apiSpool.remaining_weight_g != null ? apiSpool.remaining_weight_g : null,
      initialWeightG: initialWeightG != null ? initialWeightG : null
    }
  }

  function spoolDetail(spoolId) {
    var cached = spoolDetailsById[spoolId]
    if (cached) return cached

    if (!spoolDetailFetchesInFlight[spoolId]) {
      spoolDetailFetchesInFlight[spoolId] = true
      fetchSpoolDetail(spoolId).then(function cacheDetail(detail) {
        delete spoolDetailFetchesInFlight[spoolId]
        spoolDetailsById[spoolId] = detail
        poll()
      }, function keepShowingSpoolId() {
        // Detail lookup failed (backend unreachable, or this FilaMan version has no per-spool
        // GET). Not fatal: the row below falls back to the bare spool id. Retried next poll.
        delete spoolDetailFetchesInFlight[spoolId]
      })
    }
    return null
  }

  function cardElement() {
    var existing = document.getElementById(CARD_ELEMENT_ID)
    if (existing) return existing

    var card = document.createElement('div')
    card.id = CARD_ELEMENT_ID
    card.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:9999;' +
      'background:#1e1e20;color:#fff;border:1px solid #3a3a3d;border-radius:8px;' +
      'padding:10px 12px;font:13px/1.4 sans-serif;min-width:200px;max-width:300px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.5)'
    document.body.appendChild(card)
    return card
  }

  function removeCardElement() {
    var existing = document.getElementById(CARD_ELEMENT_ID)
    if (existing) existing.remove()
  }

  function iconButtonElement(label, onClick) {
    var button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.cssText =
      'background:none;border:1px solid #555;border-radius:4px;' +
      'color:#fff;cursor:pointer;font-size:11px;padding:1px 6px'
    button.addEventListener('click', onClick)
    return button
  }

  function headingElement() {
    var heading = document.createElement('div')
    heading.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px'

    var title = document.createElement('span')
    title.style.cssText = 'font-weight:600'
    title.textContent = 'FilaMan'
    heading.appendChild(title)

    heading.appendChild(iconButtonElement('repush', function onRepushClicked() {
      repushAssignedSpools().then(poll, poll)
    }))
    return heading
  }

  function colorDotElement(colorHex) {
    var dot = document.createElement('span')
    dot.style.cssText =
      'display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;' +
      'background:' + colorHex + ';border:1px solid rgba(255,255,255,.3)'
    return dot
  }

  function weightFractionText(detail) {
    if (detail.remainingWeightG == null || detail.initialWeightG == null) return null
    return Math.round(detail.remainingWeightG) + 'g / ' + Math.round(detail.initialWeightG) + 'g'
  }

  function spoolRowElement(extruderName, spoolId) {
    var row = document.createElement('div')
    row.style.cssText = 'margin:4px 0'

    var mainLine = document.createElement('div')
    mainLine.style.cssText = 'display:flex;align-items:center;justify-content:space-between'

    var nameCell = document.createElement('span')
    nameCell.style.cssText = 'display:flex;align-items:center;overflow:hidden'

    var extruderLabel = document.createElement('strong')
    extruderLabel.style.cssText = 'margin-right:6px'
    extruderLabel.textContent = extruderName
    nameCell.appendChild(extruderLabel)

    var detail = spoolId == null ? null : spoolDetail(spoolId)
    var nameText = document.createElement('span')
    nameText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
    if (spoolId == null) {
      nameText.textContent = 'no spool'
      nameText.style.opacity = '.7'
    } else {
      if (detail && detail.colorHex) nameCell.appendChild(colorDotElement(detail.colorHex))
      nameText.textContent = (detail && detail.name) || ('#' + spoolId)
    }
    nameCell.appendChild(nameText)
    mainLine.appendChild(nameCell)

    if (spoolId != null) {
      mainLine.appendChild(iconButtonElement('clear', function onClearClicked() {
        clearExtruderSpool(extruderName).then(poll, poll)
      }))
    }
    row.appendChild(mainLine)

    var weightText = detail ? weightFractionText(detail) : null
    if (weightText) {
      var weightLine = document.createElement('div')
      weightLine.style.cssText = 'opacity:.7;font-size:11px'
      weightLine.textContent = weightText
      row.appendChild(weightLine)
    }

    return row
  }

  function renderStatus(status) {
    var extruderSpools = status.extruder_spools || {}
    var extruderNames = Object.keys(extruderSpools)
    var card = cardElement()
    card.textContent = ''
    card.appendChild(headingElement())

    if (!extruderNames.length) {
      var emptyState = document.createElement('div')
      emptyState.style.cssText = 'opacity:.7'
      emptyState.textContent = 'no extruders reported'
      card.appendChild(emptyState)
      return
    }
    extruderNames.forEach(function appendRow(extruderName) {
      card.appendChild(spoolRowElement(extruderName, extruderSpools[extruderName]))
    })
  }

  function poll() {
    fetchStatus().then(renderStatus, removeCardElement)
  }

  function whenDocumentIsReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback)
      return
    }
    callback()
  }

  whenDocumentIsReady(function start() {
    poll()
    window.setInterval(poll, POLL_INTERVAL_MS)
  })
})()
