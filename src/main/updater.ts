import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type AppUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'

export type ConcordUpdaterState = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
}

const state: ConcordUpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function getUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

function broadcast(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('concord:update-state', { ...state })
  }
}

function setState(patch: Partial<ConcordUpdaterState>): void {
  Object.assign(state, patch)
  broadcast()
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Erro desconhecido ao atualizar.')
}

export function registerUpdaterHandlers(): void {
  const autoUpdater = getUpdater()

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: undefined })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({
      status: 'available',
      availableVersion: info.version,
      error: undefined,
      percent: 0
    })
  })

  autoUpdater.on('update-not-available', () => {
    setState({
      status: 'up-to-date',
      availableVersion: undefined,
      error: undefined,
      percent: undefined
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setState({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent)),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
      error: undefined
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setState({
      status: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      error: undefined
    })
  })

  autoUpdater.on('error', (error) => {
    setState({ status: 'error', error: safeError(error) })
  })

  ipcMain.handle('concord:update:get-state', () => ({ ...state }))

  ipcMain.handle('concord:update:check', async () => {
    if (!app.isPackaged) {
      setState({ status: 'up-to-date', error: undefined })
      return { ...state }
    }

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      setState({ status: 'error', error: safeError(error) })
    }

    return { ...state }
  })

  ipcMain.handle('concord:update:download', async () => {
    if (!app.isPackaged) return false

    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (error) {
      setState({ status: 'error', error: safeError(error) })
      return false
    }
  })

  ipcMain.handle('concord:update:install', () => {
    if (!app.isPackaged) return false
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return true
  })
}

export function scheduleUpdateChecks(): void {
  if (!app.isPackaged) return

  const autoUpdater = getUpdater()

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      setState({ status: 'error', error: safeError(error) })
    })
  }, 5000)

  setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {})
  }, 30 * 60 * 1000)
}
