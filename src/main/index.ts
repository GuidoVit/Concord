import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  shell,
  screen
} from 'electron'

import { join } from 'path'

import {
  electronApp,
  optimizer,
  is
} from '@electron-toolkit/utils'

import {
  registerUpdaterHandlers,
  scheduleUpdateChecks
} from './updater'

let selectedScreenSourceId: string | null = null

app.commandLine.appendSwitch(
  'autoplay-policy',
  'no-user-gesture-required'
)

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

function registerWindowHandlers(): void {
  ipcMain.handle(
    'concord:window:minimize',
    (event) => {
      BrowserWindow
        .fromWebContents(
          event.sender
        )
        ?.minimize()

      return true
    }
  )

  ipcMain.handle(
    'concord:window:toggle-maximize',
    (event) => {
      const window =
        BrowserWindow
          .fromWebContents(
            event.sender
          )

      if (!window) {
        return false
      }

      if (
        window.isMaximized()
      ) {
        window.unmaximize()
      } else {
        window.maximize()
      }

      return window.isMaximized()
    }
  )

  ipcMain.handle(
    'concord:window:is-maximized',
    (event) => {
      return (
        BrowserWindow
          .fromWebContents(
            event.sender
          )
          ?.isMaximized() ??
        false
      )
    }
  )

  ipcMain.handle(
    'concord:window:close',
    (event) => {
      BrowserWindow
        .fromWebContents(
          event.sender
        )
        ?.close()

      return true
    }
  )
}

function createWindow(): void {
  const primaryDisplay =
    screen.getPrimaryDisplay()

  const {
    width,
    height
  } =
    primaryDisplay.workAreaSize

  const initialWidth =
    Math.min(
      Math.max(
        Math.round(
          width * 0.9
        ),
        1200
      ),
      width
    )

  const initialHeight =
    Math.min(
      Math.max(
        Math.round(
          height * 0.9
        ),
        700
      ),
      height
    )

  const mainWindow =
    new BrowserWindow({
      width:
        initialWidth,

      height:
        initialHeight,

      minWidth:
        1100,

      minHeight:
        700,

      center: true,

      show: false,

      frame: false,

      transparent: false,

      autoHideMenuBar: true,

      resizable: true,

      maximizable: true,

      fullscreenable: true,

      title:
        'Concord',

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

        contextIsolation:
          true,

        nodeIntegration:
          false
      }
    })

  /*
   * Em telas menores, já abre maximizado.
   */
  if (
    width <= 1600 ||
    height <= 900
  ) {
    mainWindow.maximize()
  }

  mainWindow
    .webContents
    .session
    .setDisplayMediaRequestHandler(
      async (
        request,
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
            await desktopCapturer
              .getSources({
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

          if (
            request.audioRequested &&
            process.platform ===
              'win32'
          ) {
            callback({
              video: source,
              audio:
                'loopback'
            })

            return
          }

          callback({
            video: source
          })
        } catch (
          error
        ) {
          console.error(
            'Concord: erro ao autorizar compartilhamento:',
            error
          )

          callback({})
        }
      }
    )

  mainWindow.on(
    'ready-to-show',
    () => {
      mainWindow.show()
    }
  )

  mainWindow.on(
    'maximize',
    () => {
      mainWindow
        .webContents
        .send(
          'concord:window:maximized',
          true
        )
    }
  )

  mainWindow.on(
    'unmaximize',
    () => {
      mainWindow
        .webContents
        .send(
          'concord:window:maximized',
          false
        )
    }
  )

  mainWindow
    .webContents
    .setWindowOpenHandler(
      (details) => {
        shell.openExternal(
          details.url
        )

        return {
          action:
            'deny'
        }
      }
    )

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

app
  .whenReady()
  .then(() => {
    electronApp
      .setAppUserModelId(
        'com.concord.app'
      )

    registerScreenShareHandlers()
    registerWindowHandlers()
    registerUpdaterHandlers()

    app.on(
      'browser-window-created',
      (
        _,
        window
      ) => {
        optimizer
          .watchWindowShortcuts(
            window
          )
      }
    )

    createWindow()

    scheduleUpdateChecks()

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