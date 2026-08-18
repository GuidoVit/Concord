import { ElectronAPI } from '@electron-toolkit/preload'

export interface ConcordScreenSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

export interface ConcordUpdaterState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown

    concord: {
      version: string

      screenShare: {
        getSources: () => Promise<ConcordScreenSource[]>
        selectSource: (sourceId: string) => Promise<boolean>
        clearSource: () => Promise<boolean>
      }

      window: {
        minimize: () => Promise<boolean>
        toggleMaximize: () => Promise<boolean>
        isMaximized: () => Promise<boolean>
        close: () => Promise<boolean>
        onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
      }

      updater: {
        getState: () => Promise<ConcordUpdaterState>
        check: () => Promise<ConcordUpdaterState>
        download: () => Promise<boolean>
        install: () => Promise<boolean>
        onState: (callback: (state: ConcordUpdaterState) => void) => () => void
      }
    }
  }
}

export {}
