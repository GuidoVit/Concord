import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  shell
} from 'electron'

import { join } from 'path'

import {
  electronApp,
  optimizer,
  is
} from '@electron-toolkit/utils'

let selectedScreenSourceId: string | null = null

// ======================================================
// COMPARTILHAMENTO DE TELA
// ======================================================

function registerScreenShareHandlers(): void {
  ipcMain.handle(
    'concord:get-screen-sources',
    async () => {
      const sources =
        await desktopCapturer.getSources({
          types: [
            'screen',
            'window'
          ],

          thumbnailSize: {
            width: 480,
            height: 270
          },

          fetchWindowIcons: true
        })

      return sources.map(
        (source) => ({
          id: source.id,

          name: source.name,

          thumbnail:
            source.thumbnail.toDataURL(),

          appIcon:
            source.appIcon?.toDataURL() ??
            null
        })
      )
    }
  )

  ipcMain.handle(
    'concord:select-screen-source',
    (
      _event,
      sourceId: string
    ) => {
      selectedScreenSourceId =
        sourceId

      return true
    }
  )

  ipcMain.handle(
    'concord:clear-screen-source',
    () => {
      selectedScreenSourceId =
        null

      return true
    }
  )
}

// ======================================================
// JANELA PRINCIPAL
// ======================================================

function createWindow(): void {
  const mainWindow =
    new BrowserWindow({
      width: 1400,
      height: 900,

      minWidth: 1000,
      minHeight: 650,

      show: false,

      autoHideMenuBar: true,

      title: 'Concord',

      /*
       * Ícone do Concord.
       *
       * Depois de criar:
       *
       * resources/concord-icon.ico
       *
       * o Windows passa a usar
       * o ícone próprio do Concord.
       */
      icon: join(
        __dirname,
        '../../resources/concord-icon.ico'
      ),

      backgroundColor:
        '#080c0e',

      webPreferences: {
        preload: join(
          __dirname,
          '../preload/index.js'
        ),

        sandbox: false,

        contextIsolation: true,

        nodeIntegration: false
      }
    })

  // ====================================================
  // AUTORIZAÇÃO DE CAPTURA
  // ====================================================

  mainWindow
    .webContents
    .session
    .setDisplayMediaRequestHandler(
      async (
        _request,
        callback
      ) => {
        try {
          if (
            !selectedScreenSourceId
          ) {
            callback({})

            return
          }

          const sources =
            await desktopCapturer.getSources({
              types: [
                'screen',
                'window'
              ]
            })

          const source =
            sources.find(
              (item) =>
                item.id ===
                selectedScreenSourceId
            )

          if (!source) {
            selectedScreenSourceId =
              null

            callback({})

            return
          }

          callback({
            video: source
          })
        } catch (error) {
          console.error(
            'Concord: erro ao autorizar compartilhamento:',
            error
          )

          callback({})
        }
      }
    )

  // ====================================================
  // MOSTRA QUANDO ESTIVER PRONTA
  // ====================================================

  mainWindow.on(
    'ready-to-show',
    () => {
      mainWindow.show()
    }
  )

  // ====================================================
  // LINKS EXTERNOS
  // ====================================================

  mainWindow
    .webContents
    .setWindowOpenHandler(
      (details) => {
        shell.openExternal(
          details.url
        )

        return {
          action: 'deny'
        }
      }
    )

  // ====================================================
  // DEV / PRODUÇÃO
  // ====================================================

  if (
    is.dev &&
    process.env[
      'ELECTRON_RENDERER_URL'
    ]
  ) {
    mainWindow.loadURL(
      process.env[
        'ELECTRON_RENDERER_URL'
      ]
    )
  } else {
    mainWindow.loadFile(
      join(
        __dirname,
        '../renderer/index.html'
      )
    )
  }
}

// ======================================================
// ELECTRON
// ======================================================

app.whenReady().then(() => {
  /*
   * Identidade do Concord no Windows.
   */
  electronApp.setAppUserModelId(
    'com.concord.app'
  )

  // ====================================================
  // IPC
  // ====================================================

  registerScreenShareHandlers()

  // ====================================================
  // ATALHOS
  // ====================================================

  app.on(
    'browser-window-created',
    (
      _,
      window
    ) => {
      optimizer.watchWindowShortcuts(
        window
      )
    }
  )

  // ====================================================
  // CRIA O CONCORD
  // ====================================================

  createWindow()

  // ====================================================
  // MACOS
  // ====================================================

  app.on(
    'activate',
    () => {
      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {
        createWindow()
      }
    }
  )
})

// ======================================================
// FECHAR
// ======================================================

app.on(
  'window-all-closed',
  () => {
    if (
      process.platform !==
      'darwin'
    ) {
      app.quit()
    }
  }
)