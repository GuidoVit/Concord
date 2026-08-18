import {
  contextBridge,
  ipcRenderer
} from 'electron'

contextBridge.exposeInMainWorld(
  'concord',
  {
    version:
      '0.3.0',

    screenShare: {
      getSources:
        () =>
          ipcRenderer.invoke(
            'concord:get-screen-sources'
          ),

      selectSource:
        (
          sourceId: string
        ) =>
          ipcRenderer.invoke(
            'concord:select-screen-source',
            sourceId
          ),

      clearSource:
        () =>
          ipcRenderer.invoke(
            'concord:clear-screen-source'
          )
    }
  }
)