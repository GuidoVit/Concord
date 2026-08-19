import { useCallback, useEffect, useState } from 'react'
import type { UpdaterState as HarmonyUpdaterState } from '../types/harmony'

const initialState: HarmonyUpdaterState = {
  status: 'idle',
  currentVersion: window.harmony?.version || '1.0.0'
}

export function useUpdater() {
  const [state, setState] = useState<HarmonyUpdaterState>(initialState)
  const [dismissedVersion, setDismissedVersion] = useState('')

  useEffect(() => {
    let mounted = true

    void window.harmony.updater.getState().then((next) => {
      if (mounted) setState(next)
    })

    const unsubscribe = window.harmony.updater.onState((next) => {
      setState(next)
      if (next.availableVersion && next.availableVersion !== dismissedVersion) {
        setDismissedVersion('')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [dismissedVersion])

  const check = useCallback(() => window.harmony.updater.check(), [])
  const download = useCallback(() => window.harmony.updater.download(), [])
  const install = useCallback(() => window.harmony.updater.install(), [])
  const dismiss = useCallback(() => {
    if (state.availableVersion) setDismissedVersion(state.availableVersion)
  }, [state.availableVersion])

  const visible =
    Boolean(state.availableVersion) &&
    state.availableVersion !== dismissedVersion &&
    ['available', 'downloading', 'downloaded', 'error'].includes(state.status)

  return { state, visible, check, download, install, dismiss }
}
