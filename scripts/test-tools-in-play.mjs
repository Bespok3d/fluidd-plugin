// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: GPL-3.0-only
// The AFC print dialog tells the printer how many tools the file uses. Fluidd 1.38 opens that dialog
// before the file's metadata has loaded, and a file not known yet reads as using no tools, so the
// printer would be told the file uses none. This runs the tool list the plugin ships and proves the
// count is sent only once the file is known.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const pluginDir = process.argv[2]
if (!pluginDir) {
  console.error('usage: test-tools-in-play.mjs <plugin-dir>')
  process.exit(2)
}

const TOOL_LIST_GETTER = /get usedTools\(\)\{[^}]*\}/
const SOCKET_SENDING_THE_COUNT = /&&(\w+)\.printerGcodeScript\(b3dToolsInPlay\)/
const TOOLS_IN_PLAY_COMMAND = 'AFC_TOOLS_IN_PLAY COUNT=2'
const FILE_USING_TOOLS_ZERO_AND_ONE = { filament_weight: [12.5, 3.1] }

const failures = []

function expect(holds, reason) {
  if (!holds) failures.push(reason)
}

function shippedToolListGetter() {
  const assetsDir = join(pluginDir, 'files/fluidd/assets')
  const appChunkNames = readdirSync(assetsDir).filter(
    (fileName) => fileName.startsWith('index-') && fileName.endsWith('.js'))
  const getters = appChunkNames.map(
    (chunkName) => readFileSync(join(assetsDir, chunkName), 'utf8').match(TOOL_LIST_GETTER)?.[0])
  return getters.find(Boolean)
}

// The bundle's minifier picks the socket object's name, so it is read from the getter itself.
function socketNameIn(getter) {
  return getter.match(SOCKET_SENDING_THE_COUNT)?.[1]
}

function standInPage(getter, sentCommands) {
  return {
    [socketNameIn(getter)]: { printerGcodeScript: (command) => sentCommands.push(command) },
    window: { b3dAfcToolmap: { toolsInPlayDeclaration: () => TOOLS_IN_PLAY_COMMAND } }
  }
}

function dialogFor(getter, currentFile, sentCommands) {
  const dialog = vm.runInNewContext(`({currentFile:null,${getter}})`, standInPage(getter, sentCommands))
  dialog.currentFile = currentFile
  return dialog
}

function checkFileNotKnownSendsNothing(getter) {
  const sentCommands = []
  const usedTools = dialogFor(getter, undefined, sentCommands).usedTools
  expect(usedTools.length === 0, 'a file not known yet reads as using tools')
  expect(sentCommands.length === 0,
    'the printer is told a file uses no tools before the file is known')
}

function checkKnownFileSendsItsCount(getter) {
  const sentCommands = []
  const usedTools = dialogFor(getter, FILE_USING_TOOLS_ZERO_AND_ONE, sentCommands).usedTools
  expect(usedTools.join(',') === '0,1', 'a U1 file does not read as using its tools')
  expect(sentCommands.join() === TOOLS_IN_PLAY_COMMAND,
    'the printer is not told how many tools a known file uses')
}

const getter = shippedToolListGetter()
if (!getter || !socketNameIn(getter)) {
  console.error('  FAIL: the shipped bundle has no patched AFC dialog tool list, so this test proves nothing')
  process.exit(1)
}

checkFileNotKnownSendsNothing(getter)
checkKnownFileSendsItsCount(getter)

failures.forEach((reason) => console.error(`  FAIL: ${reason}`))
process.exit(failures.length ? 1 : 0)
