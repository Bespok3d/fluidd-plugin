// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: GPL-3.0-only
// Every colour of a multi colour spool, in the Fluidd the plugin ships. This runs the shipped spool
// colours rule against a stand-in page and proves what a user sees: a multi colour spool is drawn in
// stripes, the source naming more colours wins whichever it is, a one colour spool keeps upstream's
// look, and the bundle actually calls the rule from every spool view it was written for.
import { readFileSync } from 'node:fs'
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
const shippedDashboard = readFileSync(join(pluginDir, 'files/fluidd/assets/Dashboard-BLuHn2av.js'), 'utf8')
const shippedAppChunk = readFileSync(join(pluginDir, 'files/fluidd/assets/index-KkJYnUSX.js'), 'utf8')

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

function iconRules(page) {
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
    JSON.stringify(['#FF0000', '#FF0000', '#00FF00', '#00FF00', '#0000FF', '#0000FF']),
    'the stripes are not one hard edged band per Spoolman colour')
  expect(paintedGradients(page).length === 1,
    'the same colours are painted into the page more than once')
  expect(iconRules(page).includes(
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
  expect(shippedDashboard.includes('window.b3dSpoolColours.laneReelFill(e.spoolColor,e.spool,e.lane)'),
    'the AFC lane reel does not ask for its stripes')
}

checkTagSingleSpoolmanMulti()
checkTagMultiSpoolmanSingle()
checkOneColourKeepsUpstream()
checkOtherLaneSaysNothing()
checkTheBundleCallsTheRule()

for (const reason of failures) console.error(`  FAIL: ${reason}`)
process.exit(failures.length === 0 ? 0 : 1)
