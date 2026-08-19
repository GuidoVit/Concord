import { ElectronAPI } from '@electron-toolkit/preload'

export interface HarmonyScreenSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

export interface HarmonyUpdaterState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
}

export interface HarmonyBridge {
  version: string
  screenShare: {
    getSources: () => Promise<HarmonyScreenSource[]>
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
  compatibility: {
    getVideoMode: () => Promise<boolean>
    setVideoMode: (enabled: boolean) => Promise<boolean>
    relaunch: () => Promise<boolean>
  }
  updater: {
    getState: () => Promise<HarmonyUpdaterState>
    check: () => Promise<HarmonyUpdaterState>
    download: () => Promise<boolean>
    install: () => Promise<boolean>
    onState: (callback: (state: HarmonyUpdaterState) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    harmony: HarmonyBridge
    concord: HarmonyBridge
  }
}

export {}
