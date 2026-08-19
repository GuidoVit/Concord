import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  shell
} from 'electron'

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  electronApp,
  is
} from '@electron-toolkit/utils'

import {
  registerUpdaterHandlers,
  scheduleUpdateChecks,
  stopUpdateChecks
} from './updater'

let selectedScreenSourceId: string | null = null

// A identidade visual muda para Harmony, mas mantemos o diretório de dados
// da instalação antiga. Assim login, localStorage, paleta, volumes e updater
// continuam intactos depois da atualização Concord -> Harmony.
const legacyUserDataPath = join(app.getPath('appData'), 'Concord')
app.setPath('userData', legacyUserDataPath)
app.setName('Harmony')

// Mantemos este namespace de IPC por compatibilidade com instalações antigas.
const IPC_PREFIX = 'concord'

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'harmony-settings.json')
}

function readBootSettings(): { videoCompatibilityMode?: boolean } {
  try {
    const file = settingsFilePath()
    if (!existsSync(file)) return {}
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function writeBootSettings(patch: { videoCompatibilityMode?: boolean }): void {
  const current = readBootSettings()
  writeFileSync(settingsFilePath(), JSON.stringify({ ...current, ...patch }, null, 2), 'utf8')
}

const bootSettings = readBootSettings()

// Precisa ser definido antes de app.ready. É um fallback para GPUs/drivers que
// criam manchas ou quadros corrompidos durante captura WebRTC.
if (bootSettings.videoCompatibilityMode) {
  app.disableHardwareAcceleration()
}

// Harmony é um cliente de voz desktop; áudio remoto pode tocar sem gesto extra.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function registerScreenShareHandlers(): void {
  ipcMain.handle(`${IPC_PREFIX}:get-screen-sources`, async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.toDataURL() ?? null
    }))
  })

  ipcMain.handle(`${IPC_PREFIX}:select-screen-source`, (_event, sourceId: string) => {
    selectedScreenSourceId = sourceId
    return true
  })

  ipcMain.handle(`${IPC_PREFIX}:clear-screen-source`, () => {
    selectedScreenSourceId = null
    return true
  })
}

function registerWindowHandlers(): void {
  ipcMain.handle(`${IPC_PREFIX}:window:minimize`, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
    return true
  })

  ipcMain.handle(`${IPC_PREFIX}:window:toggle-maximize`, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    window.isMaximized() ? window.unmaximize() : window.maximize()
    return window.isMaximized()
  })

  ipcMain.handle(`${IPC_PREFIX}:window:is-maximized`, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  ipcMain.handle(`${IPC_PREFIX}:window:close`, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
    return true
  })
}

function registerCompatibilityHandlers(): void {
  ipcMain.handle(`${IPC_PREFIX}:compatibility:get-video-mode`, () => {
    return Boolean(readBootSettings().videoCompatibilityMode)
  })

  ipcMain.handle(`${IPC_PREFIX}:compatibility:set-video-mode`, (_event, enabled: boolean) => {
    writeBootSettings({ videoCompatibilityMode: Boolean(enabled) })
    return true
  })

  ipcMain.handle(`${IPC_PREFIX}:compatibility:relaunch`, () => {
    app.relaunch()
    app.exit(0)
    return true
  })
}

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const initialWidth = Math.min(Math.max(Math.round(width * 0.9), 1100), width)
  const initialHeight = Math.min(Math.max(Math.round(height * 0.9), 700), height)

  const mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: Math.min(1100, width),
    minHeight: Math.min(700, height),
    center: true,
    show: false,
    frame: false,
    transparent: false,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    title: 'Harmony',
    // O arquivo antigo é mantido para a atualização não exigir migrar recursos.
    icon: join(__dirname, '../../resources/concord-icon.ico'),
    backgroundColor: '#080c0e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (width <= 1600 || height <= 900) {
    mainWindow.maximize()
  }

  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        if (!selectedScreenSourceId) {
          callback({})
          return
        }

        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window']
        })

        const source = sources.find((item) => item.id === selectedScreenSourceId)

        if (!source) {
          selectedScreenSourceId = null
          callback({})
          return
        }

        // O loopback nativo do Electron captura o áudio do endpoint do Windows.
        // A proteção anti-eco no renderer impede que as vozes recebidas pelo
        // Harmony retornem ao sistema enquanto o loopback estiver ativo.
        if (request.audioRequested && process.platform === 'win32') {
          callback({ video: source, audio: 'loopback' })
          return
        }

        callback({ video: source })
      } catch (error) {
        console.error('Harmony: erro ao autorizar compartilhamento:', error)
        callback({})
      }
    }
  )

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(`${IPC_PREFIX}:window:maximized`, true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(`${IPC_PREFIX}:window:maximized`, false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function releaseSystemHooks(): void {
  try {
    // Mesmo que nenhuma versão atual registre atalhos globais, esta limpeza
    // defensiva libera qualquer registro legado que ainda pertença ao processo.
    globalShortcut.unregisterAll()
  } catch (error) {
    console.error('Harmony: erro ao liberar atalhos globais:', error)
  }

  stopUpdateChecks()
  selectedScreenSourceId = null
}

app.on('before-quit', releaseSystemHooks)
app.on('will-quit', releaseSystemHooks)

app.whenReady().then(() => {
  // ID legado preservado para manter a continuidade da instalação/updater.
  electronApp.setAppUserModelId('com.concord.app')

  registerScreenShareHandlers()
  registerWindowHandlers()
  registerCompatibilityHandlers()
  registerUpdaterHandlers()

  // Não usamos o helper watchWindowShortcuts aqui.
  // O Harmony não deve interceptar atalhos gerais do Windows ou de outros apps.
  createWindow()
  scheduleUpdateChecks()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    releaseSystemHooks()
    app.quit()
  }
})
