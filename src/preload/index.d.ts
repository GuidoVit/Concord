import {
  ElectronAPI
} from '@electron-toolkit/preload'

export interface ConcordScreenSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

declare global {
  interface Window {
    electron: ElectronAPI

    api: unknown

    concord: {
      version: string

      screenShare: {
        getSources:
          () =>
            Promise<
              ConcordScreenSource[]
            >

        selectSource:
          (
            sourceId: string
          ) =>
            Promise<boolean>

        clearSource:
          () =>
            Promise<boolean>
      }
    }
  }
}

export {}