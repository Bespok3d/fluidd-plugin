// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: GPL-3.0-only
// A power device while its switch is on its way: the Power menu's row and the top bar's power button
// show a turning icon and take no clicks until Moonraker answers, and never for longer than the
// limit, since a wait is left behind when the connection drops mid-switch. This runs the rule file
// the plugin ships against a stand-in page and checks that the bundle draws both controls with it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const pluginDir = process.argv[2]
if (!pluginDir) {
  console.error('usage: test-power-toggle.mjs <plugin-dir>')
  process.exit(2)
}

const DEVICE = 'panda_pwr_usb_a'
const WAIT_NAME = `onDevicePowerToggle/${DEVICE}`
const SWITCH_WAIT_LIMIT_MS = 30000
const IDLE_ICON = '$powerOn'

const failures = []

function expect(holds, reason) {
  if (!holds) failures.push(reason)
}

function shipped(relativePath) {
  return readFileSync(join(pluginDir, 'files/fluidd', relativePath), 'utf8')
}

function loadRule(clock) {
  const page = {
    window: {},
    Date: { now: () => clock.now },
    setTimeout: (redraw, delay) => clock.redraws.push({ redraw, delay })
  }
  vm.runInNewContext(shipped('b3d-power-toggle.js'), page)
  return page.window.b3dPowerToggle
}

function standInComponent(openWaits, topNavPowerToggle) {
  return {
    $waits: { onDevicePowerToggle: 'onDevicePowerToggle' },
    $typedGetters: { 'wait/hasWait': (waitName) => openWaits.has(waitName) },
    $forceUpdate() { this.redrawn = true },
    topNavPowerToggle
  }
}

function checkIdleDeviceIsUpstreams(rule, component) {
  expect(!rule.isSwitching(component, DEVICE), 'a device with no switch on its way reads as switching')
  expect(rule.icon(component, DEVICE, IDLE_ICON) === IDLE_ICON, 'an idle device loses its power icon')
  expect(rule.iconClass(component, DEVICE).spin === false, 'an idle device turns')
}

function checkSwitchingDeviceTurnsAndLocks(rule, component, clock) {
  expect(rule.isSwitching(component, DEVICE), 'a device whose switch is on its way takes clicks')
  expect(rule.icon(component, DEVICE, IDLE_ICON) === '$loading', 'a switching device shows no turning icon')
  expect(rule.iconClass(component, DEVICE).spin === true, 'a switching device does not turn')
  expect(clock.redraws.some((scheduled) => scheduled.delay >= SWITCH_WAIT_LIMIT_MS),
    'nothing redraws the control when the limit passes')
}

function checkStuckWaitIsReleasedAtTheLimit(rule, component, clock) {
  clock.now += SWITCH_WAIT_LIMIT_MS - 1
  expect(rule.isSwitching(component, DEVICE), 'the control unlocks before the limit')
  clock.now += 2
  expect(!rule.isSwitching(component, DEVICE), 'a wait left behind keeps the control locked past the limit')
  clock.redraws.forEach((scheduled) => scheduled.redraw())
  expect(component.redrawn === true, 'the control is not redrawn at the limit')
}

function checkTopBarFollowsOnlyAMoonrakerDevice(rule) {
  const pin = standInComponent(new Set(), { type: 'klipper', device: { name: 'caselight' } })
  const moonraker = standInComponent(new Set(), { type: 'moonraker', device: { device: DEVICE } })
  expect(rule.topBarDeviceName(pin) === null, 'a Klipper pin in the top bar is treated as a power device')
  expect(rule.topBarDeviceName(moonraker) === DEVICE, 'the top bar does not follow its power device')
  expect(rule.topBarDeviceName(standInComponent(new Set(), null)) === null,
    'an empty top bar setting names a device')
}

// A Fluidd that renamed its waits still takes the bundle patches, which never mention them, so the
// rule must read such a page as idle and leave the controls as upstream draws them.
function checkRenamedWaitsFallBackToUpstream(rule) {
  const withoutTheGetter = { ...standInComponent(new Set([WAIT_NAME]), null), $typedGetters: {} }
  const withoutTheWaitNames = { ...standInComponent(new Set([WAIT_NAME]), null), $waits: {} }
  ;[withoutTheGetter, withoutTheWaitNames].forEach((renamedPage) => {
    try {
      expect(!rule.isSwitching(renamedPage, DEVICE), 'a page with renamed waits locks the control')
      expect(rule.icon(renamedPage, DEVICE, IDLE_ICON) === IDLE_ICON,
        'a page with renamed waits loses the power icon')
    } catch (failure) {
      failures.push(`a page with renamed waits fails while drawing the control: ${failure.message}`)
    }
  })
}

function checkBundleDrawsBothControlsWithTheRule() {
  const assetsDir = join(pluginDir, 'files/fluidd/assets')
  const appChunk = readdirSync(assetsDir).find((fileName) => fileName.startsWith('index-') && fileName.endsWith('.js'))
  const appCode = readFileSync(join(assetsDir, appChunk), 'utf8')
  expect(appCode.includes('||!!window.b3dPowerToggle?.isSwitching(e,n.device),'),
    'the Power menu row takes clicks while switching')
  expect(appCode.includes('window.b3dPowerToggle.icon(e,n.device,e.getPowerIcon(n))'),
    'the Power menu row does not turn while switching')
  expect(appCode.includes('disabled:e.topNavPowerDeviceDisabled||!!window.b3dPowerToggle?.isSwitching('),
    'the top bar power button takes clicks while switching')
  expect(appCode.includes('window.b3dPowerToggle.icon(e,window.b3dPowerToggle.topBarDeviceName(e),'),
    'the top bar power button does not turn while switching')
  expect(shipped('index.html').includes('<script src="./b3d-power-toggle.js"></script>'),
    'the page never loads the rule file')
  const serviceWorker = shipped('sw.js')
  expect(!serviceWorker.includes(`{"revision":null,"url":"assets/${appChunk}"}`),
    'a browser holding the old app chunk would keep serving it')
}

const clock = { now: 1000, redraws: [] }
const rule = loadRule(clock)
const openWaits = new Set()
const component = standInComponent(openWaits, null)

checkIdleDeviceIsUpstreams(rule, component)
openWaits.add(WAIT_NAME)
checkSwitchingDeviceTurnsAndLocks(rule, component, clock)
checkStuckWaitIsReleasedAtTheLimit(rule, component, clock)
openWaits.delete(WAIT_NAME)
checkIdleDeviceIsUpstreams(rule, component)
checkTopBarFollowsOnlyAMoonrakerDevice(rule)
checkRenamedWaitsFallBackToUpstream(rule)
checkBundleDrawsBothControlsWithTheRule()

failures.forEach((reason) => console.error(`  FAIL: ${reason}`))
process.exit(failures.length === 0 ? 0 : 1)
