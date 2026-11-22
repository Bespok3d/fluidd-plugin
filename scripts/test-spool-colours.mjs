// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: GPL-3.0-only
// Every colour of a multi colour spool, in the Fluidd the plugin ships. This runs the shipped spool
// colours rule against a stand-in page and proves what a user sees: a multi colour spool is drawn in
// stripes, on its icons and on the Spoolman card's remaining-weight bar, the source naming more
// colours wins whichever it is, a one colour spool keeps upstream's look, and the bundle actually
// calls the rule from every spool view it was written for.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const pluginDir = process.argv[2]
if (!pluginDir) {
  console.error('usage: test-spool-colours.mjs <plugin-dir>')
  process.exit(2)
}

const authoredRule = readFileSync(join(pluginDir, 'patches/spool-colours.js'), 'utf8')
const shippedRule = readFileSync(join(pluginDir, 'files/fluidd/b3d-spool-colours.js'), 'utf8')
const shippedPage = readFileSync(join(pluginDir, 'files/fluidd/index.html'), 'utf8')
const shippedAssetsDir = join(pluginDir, 'files/fluidd/assets')

// A chunk name carries upstream's content hash, so it is found by its stable prefix.
function readShippedChunk(prefix, extension) {
  const chunkNames = readdirSync(shippedAssetsDir).filter(
    (fileName) => fileName.startsWith(`${prefix}-`) && fileName.endsWith(extension))
  if (chunkNames.length !== 1) {
    console.error(`expected one ${prefix} chunk in the vendored bundle, found ${chunkNames.length}`)
    process.exit(1)
  }
  return readFileSync(join(shippedAssetsDir, chunkNames[0]), 'utf8')
}

const shippedDashboard = readShippedChunk('Dashboard', '.js')
const shippedAppChunk = readShippedChunk('index', '.js')
const shippedVuetifyStyles = readShippedChunk('vuetify', '.css')

const TAG_SPOOL_ID = 89
const UPSTREAM_COLOUR = '#ffffff'

const failures = []

function fail(reason) {
  failures.push(reason)
}

function expect(holds, reason) {
  if (!holds) fail(reason)
}

function standInElement(tagName) {
  return {
    tagName,
    attributes: {},
    children: [],
    setAttribute(attributeName, attributeValue) {
      this.attributes[attributeName] = attributeValue
    },
    appendChild(child) {
      this.children.push(child)
      return child
    }
  }
}

function standInPage() {
  return {
    head: standInElement('head'),
    body: standInElement('body'),
    createElement: standInElement,
    createElementNS(namespace, tagName) {
      return standInElement(tagName)
    },
    createTextNode(text) {
      return { text }
    }
  }
}

function loadShippedRule() {
  const page = standInPage()
  const browserWindow = {}
  vm.runInNewContext(shippedRule, { window: browserWindow, document: page })
  return { spoolColours: browserWindow.b3dSpoolColours, page }
}

function spoolmanSpool(colours) {
  return { id: TAG_SPOOL_ID, filament: { colors: colours } }
}

function laneWithTag(colours) {
  return { spool_id: TAG_SPOOL_ID, colors: colours }
}

function printerWithLane(lane) {
  return { extruder: { temperature: 0 }, 'AFC_lane E0': lane }
}

function paintedGradients(page) {
  const paintStore = page.body.children[0]
  return paintStore ? paintStore.children[0].children : []
}

function stripeRules(page) {
  const ruleSheet = page.head.children[0]
  return ruleSheet ? ruleSheet.children.map((ruleText) => ruleText.text).join('\n') : ''
}

function stripeColoursOf(gradient) {
  return gradient.children.map((stripeStop) => stripeStop.attributes['stop-color'])
}

function checkTagSingleSpoolmanMulti() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000', '#00FF00', '#0000FF'])
  const lane = laneWithTag(['#FFFFFF'])
  const iconClass = spoolColours.iconClass(printerWithLane(lane), spool)
  const reelFill = spoolColours.laneReelFill(UPSTREAM_COLOUR, spool, lane)
  expect(iconClass === 'b3d-spool-colours-ff0000-00ff00-0000ff-icon',
    'a single colour tag flattens a three colour Spoolman spool on its icon')
  expect(reelFill === 'url(#b3d-spool-colours-ff0000-00ff00-0000ff)',
    'a single colour tag flattens a three colour Spoolman spool on its lane reel')
  const [gradient] = paintedGradients(page)
  expect(gradient && JSON.stringify(stripeColoursOf(gradient)) ===
    JSON.stringify(['#ff0000', '#ff0000', '#00ff00', '#00ff00', '#0000ff', '#0000ff']),
    'the stripes are not one hard edged band per Spoolman colour')
  expect(paintedGradients(page).length === 1,
    'the same colours are painted into the page more than once')
  expect(stripeRules(page).includes(
    '.b3d-spool-colours-ff0000-00ff00-0000ff-icon .v-icon__svg{fill:url(#b3d-spool-colours-ff0000-00ff00-0000ff)}'),
    'no rule fills a multi colour spool icon with its stripes')
}

function checkTagMultiSpoolmanSingle() {
  const { spoolColours } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000'])
  const lane = laneWithTag(['#112233', '#445566'])
  expect(spoolColours.iconClass(printerWithLane(lane), spool) === 'b3d-spool-colours-112233-445566-icon',
    'a single colour Spoolman spool flattens a two colour tag on its icon')
  expect(spoolColours.laneReelFill(UPSTREAM_COLOUR, spool, lane) === 'url(#b3d-spool-colours-112233-445566)',
    'a single colour Spoolman spool flattens a two colour tag on its lane reel')
}

function checkOneColourKeepsUpstream() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000'])
  const lane = laneWithTag(['#FF0000'])
  expect(spoolColours.iconClass(printerWithLane(lane), spool) === undefined,
    'a one colour spool icon is given stripes')
  expect(spoolColours.laneReelFill(UPSTREAM_COLOUR, spool, lane) === UPSTREAM_COLOUR,
    'a one colour lane reel does not keep upstream colour')
  expect(spoolColours.iconClass(printerWithLane(lane), null) === undefined,
    'a tool with no spool is given stripes')
  expect(page.body.children.length === 0, 'a page with one colour spools only is painted on')
}

function checkSpoolmanBarStripes() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000', '#00FF00', '#0000FF'])
  const barClass = spoolColours.barClass(printerWithLane(laneWithTag(['#FFFFFF'])), spool)
  expect(barClass === 'b3d-spool-colours-ff0000-00ff00-0000ff-bar',
    'a three colour spool does not give its remaining-weight bar stripes')
  const firstEdge = `${100 / 3}%`
  const secondEdge = `${200 / 3}%`
  const stripes = `linear-gradient(to right,#ff0000 0%,#ff0000 ${firstEdge},#00ff00 ${firstEdge},` +
    `#00ff00 ${secondEdge},#0000ff ${secondEdge},#0000ff 100%)`
  const bar = '.b3d-spool-colours-ff0000-00ff00-0000ff-bar'
  const filledPart = ' .v-progress-linear__determinate'
  const fadedTrack = ' .v-progress-linear__background'
  const reversedBar = `${bar}.v-progress-linear--reverse`
  expect(stripeRules(page).includes(
    `${bar}${filledPart},${bar}${fadedTrack}` +
    `{background-image:${stripes};background-size:100cqw 100%;transition-property:width,left,right}`),
    'the remaining-weight bar is not filled with one hard edged band per colour, in the icon order')
  expect(stripeRules(page).includes(`@supports (container-type:inline-size){${bar}{container-type:inline-size}`),
    'a browser without container sizes squeezes a full set of stripes into each part of the bar')
  expect(stripeRules(page).includes(`${bar}${fadedTrack},${reversedBar}${filledPart}{background-position:right}`) &&
    stripeRules(page).includes(`${reversedBar}${fadedTrack}{background-position:left}`),
    'the filled part and the faded track of the remaining-weight bar each squeeze in their own set of stripes')
}

function checkIconAloneWritesNoBarRule() {
  const { spoolColours, page } = loadShippedRule()
  spoolColours.iconClass(printerWithLane(laneWithTag([])), spoolmanSpool(['#FF0000', '#00FF00']))
  expect(!stripeRules(page).includes('-bar'), 'a spool icon writes a rule for a bar no spool shows')
}

function checkOneColourBarKeepsUpstream() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000'])
  expect(spoolColours.barClass(printerWithLane(laneWithTag(['#FF0000'])), spool) === undefined,
    'a one colour spool gives its remaining-weight bar stripes')
  expect(spoolColours.barClass(printerWithLane(laneWithTag(['#FF0000'])), null) === undefined,
    'no active spool gives the remaining-weight bar stripes')
  expect(page.head.children.length === 0, 'a one colour remaining-weight bar is painted on')
}

function checkBarColoursStayColours() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#ff0000}body{display:none', '#00FF00'])
  expect(spoolColours.barClass(printerWithLane(laneWithTag([])), spool) === undefined,
    'a spool colour that is not hex gives the remaining-weight bar stripes')
  expect(!stripeRules(page).includes('display:none'),
    'a spool colour writes its own text into the page style sheet')
  const rgbAndHexColours = spoolmanSpool(['rgb(255,0,0)', '#00FF00'])
  expect(spoolColours.barClass(printerWithLane(laneWithTag([])), rgbAndHexColours) === undefined,
    'a spool colour that is not hex is drawn on the remaining-weight bar as some other colour')
  const oneBadColourOfThree = spoolmanSpool(['#FF0000', 'rgb(0,0,255)', '#00FF00'])
  expect(spoolColours.iconClass(printerWithLane(laneWithTag([])), oneBadColourOfThree) ===
    'b3d-spool-colours-ff0000-00ff00-icon',
    'one colour that is not hex takes the stripes off the colours that are')
}

function checkIconAndBarAgree() {
  const { spoolColours, page } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000'])
  const tagWithoutHash = laneWithTag(['FF0000', '00ff0080'])
  const barClass = spoolColours.barClass(printerWithLane(tagWithoutHash), spool)
  const iconClass = spoolColours.iconClass(printerWithLane(tagWithoutHash), spool)
  const reelFill = spoolColours.laneReelFill(UPSTREAM_COLOUR, spool, tagWithoutHash)
  expect(reelFill === 'url(#b3d-spool-colours-ff0000-00ff0080)',
    'the lane reel is filled with colours the icon does not show')
  expect(barClass === 'b3d-spool-colours-ff0000-00ff0080-bar' && iconClass === 'b3d-spool-colours-ff0000-00ff0080-icon',
    'a tag colour written without a hash, or with four digits, is not drawn in stripes')
  const stopColours = paintedGradients(page)[0].children.map((stop) => stop.attributes['stop-color'])
  expect(stopColours.join(',') === '#ff0000,#ff0000,#00ff0080,#00ff0080',
    'the spool icon is filled with colours the bar does not show')
}

function checkOtherLaneSaysNothing() {
  const { spoolColours } = loadShippedRule()
  const spool = spoolmanSpool(['#FF0000'])
  const laneWithAnotherSpool = { spool_id: TAG_SPOOL_ID + 1, colors: ['#112233', '#445566'] }
  expect(spoolColours.iconClass(printerWithLane(laneWithAnotherSpool), spool) === undefined,
    'the tag of a lane holding another spool paints this spool')
}

function checkTheBundleCallsTheRule() {
  expect(authoredRule === shippedRule, 'the bundle carries an older spool colours rule than this repo wrote')
  expect(shippedPage.includes('<script src="./b3d-spool-colours.js"></script>'),
    'the page never loads the spool colours rule')
  expect(!shippedDashboard.includes('getSpoolColor(e){return e?.filament.color_hex??'),
    'the dashboard still draws a multi colour spool white')
  expect(!shippedAppChunk.includes('getSpoolColor(e){return e?.filament.color_hex??'),
    'the spool picker still draws a multi colour spool white')
  expect(shippedDashboard.split('class:window.b3dSpoolColours?.iconClass(').length - 1 === 4,
    'a dashboard spool icon does not ask for its stripes')
  expect(shippedAppChunk.includes('class:window.b3dSpoolColours?.iconClass('),
    'the spool picker icon does not ask for its stripes')
  expect(shippedDashboard.split('class:window.b3dSpoolColours?.barClass?.(').length - 1 === 2,
    'a Spoolman card remaining-weight bar does not ask for its stripes')
  expect(!shippedDashboard.includes('t(Te,{attrs:{value:e.activeSpool.progress,'),
    'the Spoolman card still draws a remaining-weight bar in one colour')
  expect(['.v-progress-linear__determinate{', '.v-progress-linear__background{',
    '.v-progress-linear--reverse .v-progress-linear__background{left:auto;right:0}',
    '.v-progress-linear--reverse .v-progress-linear__determinate{left:auto;right:0}'].every(
    (barPart) => shippedVuetifyStyles.includes(barPart)),
    'the shipped Vuetify bar no longer has the parts the stripes are laid on')
  expect(shippedDashboard.includes('window.b3dSpoolColours.laneReelFill(e.spoolColor,e.spool,e.lane)'),
    'the AFC lane reel does not ask for its stripes')
}

checkTagSingleSpoolmanMulti()
checkTagMultiSpoolmanSingle()
checkOneColourKeepsUpstream()
checkSpoolmanBarStripes()
checkOneColourBarKeepsUpstream()
checkBarColoursStayColours()
checkIconAloneWritesNoBarRule()
checkIconAndBarAgree()
checkOtherLaneSaysNothing()
checkTheBundleCallsTheRule()

for (const reason of failures) console.error(`  FAIL: ${reason}`)
process.exit(failures.length === 0 ? 0 : 1)
