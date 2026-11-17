// On the iPhone app, Gild's data is kept in a file in the app's own storage,
// not only in the web view's localStorage. iOS can clear a web view's
// storage when it decides to, and for Gild that would be every transaction.
//
// db.js keeps using localStorage exactly as before. This module:
// - before the app starts, loads the saved file back into localStorage
//   (the file wins, it is the copy iOS won't touch);
// - after any change to a Gild key (ft_*), writes the file again, a moment
//   later so a burst of changes is one write, and at once when the app goes
//   to the background.
// In a browser none of this runs and nothing changes.
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const isNativeApp = Capacitor.isNativePlatform()

// Library is private to the app, survives updates and reinstalls from Xcode,
// and is included in the phone's iCloud backup. It never shows in Files.
const DATA_DIR = Directory.Library
const DATA_FILE = 'gild-data.json'
const TEMP_FILE = 'gild-data.tmp.json'
const PREFIX = 'ft_'
const WRITE_DELAY_MS = 300

function snapshot() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREFIX)) data[key] = localStorage.getItem(key)
  }
  return data
}

// null only when the file genuinely isn't there. Any other failure (a read
// error, a half-written file) throws, so startup never mistakes "couldn't read
// it" for "first launch" and writes an empty copy over the saved data.
async function readFile(path) {
  let data
  try {
    ;({ data } = await Filesystem.readFile({ path, directory: DATA_DIR, encoding: Encoding.UTF8 }))
  } catch (err) {
    if (/does not exist|no such file|not found|ENOENT/i.test(String(err?.message || err))) return null
    throw err
  }
  return JSON.parse(data)
}

// Write to a temporary file first and swap it in, so a write cut short
// (the app killed halfway) never leaves a half-written data file.
async function writeSnapshot() {
  const text = JSON.stringify(snapshot())
  await Filesystem.writeFile({ path: TEMP_FILE, directory: DATA_DIR, data: text, encoding: Encoding.UTF8 })
  try {
    await Filesystem.deleteFile({ path: DATA_FILE, directory: DATA_DIR })
  } catch {
    // Nothing there yet.
  }
  await Filesystem.rename({ from: TEMP_FILE, to: DATA_FILE, directory: DATA_DIR, toDirectory: DATA_DIR })
}

let timer = null
let writing = null
let dirty = false

async function flush() {
  clearTimeout(timer)
  timer = null
  if (writing) {
    // A write is already running: run one more after it, with the latest data.
    dirty = true
    return writing
  }
  writing = (async () => {
    do {
      dirty = false
      try {
        await writeSnapshot()
      } catch (err) {
        console.error('Gild: saving data on the device failed', err)
      }
    } while (dirty)
  })()
  try {
    await writing
  } finally {
    writing = null
  }
}

function scheduleWrite() {
  clearTimeout(timer)
  timer = setTimeout(flush, WRITE_DELAY_MS)
}

function watchLocalStorage() {
  const proto = Storage.prototype
  const setItem = proto.setItem
  const removeItem = proto.removeItem
  const clear = proto.clear
  proto.setItem = function (key, value) {
    setItem.call(this, key, value)
    if (this === localStorage && String(key).startsWith(PREFIX)) scheduleWrite()
  }
  proto.removeItem = function (key) {
    removeItem.call(this, key)
    if (this === localStorage && String(key).startsWith(PREFIX)) scheduleWrite()
  }
  proto.clear = function () {
    clear.call(this)
    if (this === localStorage) scheduleWrite()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', () => flush())
}

// Call once, before db.js is imported (it reads localStorage on import).
export async function loadDeviceData() {
  if (!isNativeApp) return
  // If the app was killed between writing the temporary file and swapping
  // it in, the temporary file is the newest complete copy.
  const saved = (await readFile(DATA_FILE)) || (await readFile(TEMP_FILE))
  if (saved && typeof saved === 'object') {
    for (const key of Object.keys(snapshot())) localStorage.removeItem(key)
    for (const [key, value] of Object.entries(saved)) {
      if (key.startsWith(PREFIX) && typeof value === 'string') localStorage.setItem(key, value)
    }
  }
  watchLocalStorage()
  // First launch: save whatever is there now, so the file exists from the start.
  if (!saved) await flush()
}

// Backups on the phone: saved into Gild's folder in the Files app
// (On My iPhone → GILD). With share, the share sheet opens as well, to
// send the file anywhere (AirDrop, Mail, Save to Files elsewhere).
export async function saveBackupFile(filename, text, { share = false } = {}) {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    directory: Directory.Documents,
    data: text,
    encoding: Encoding.UTF8
  })
  if (share) {
    try {
      await Share.share({ title: filename, files: [uri] })
    } catch {
      // Closing the share sheet without picking anything lands here. The
      // file is already saved in Files, so there is nothing to undo.
    }
  }
  return uri
}
