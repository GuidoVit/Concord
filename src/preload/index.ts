import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('concord', {
  version: '1.1.0',

  screenShare: {
    getSources: () => ipcRenderer.invoke('concord:get-screen-sources'),
    selectSource: (sourceId: string) => ipcRenderer.invoke('concord:select-screen-source', sourceId),
    clearSource: () => ipcRenderer.invoke('concord:clear-screen-source')
  },

  window: {
    minimize: () => ipcRenderer.invoke('concord:window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('concord:window:toggle-maximize'),
    isMaximized: () => ipcRenderer.invoke('concord:window:is-maximized'),
    close: () => ipcRenderer.invoke('concord:window:close'),
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: unknown, maximized: boolean) => callback(maximized)
      ipcRenderer.on('concord:window:maximized', listener)
      return () => ipcRenderer.removeListener('concord:window:maximized', listener)
    }
  },

  updater: {
    getState: () => ipcRenderer.invoke('concord:update:get-state'),
    check: () => ipcRenderer.invoke('concord:update:check'),
    download: () => ipcRenderer.invoke('concord:update:download'),
    install: () => ipcRenderer.invoke('concord:update:install'),
    onState: (callback: (state: unknown) => void) => {
      const listener = (_event: unknown, state: unknown) => callback(state)
      ipcRenderer.on('concord:update-state', listener)
      return () => ipcRenderer.removeListener('concord:update-state', listener)
    }
  }
})
