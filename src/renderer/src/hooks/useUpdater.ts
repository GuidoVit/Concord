import { useCallback, useEffect, useState } from 'react'
import type { UpdaterState as ConcordUpdaterState } from '../types/concord'

const initialState: ConcordUpdaterState = {
  status: 'idle',
  currentVersion: window.concord?.version || '1.0.0'
}

export function useUpdater() {
  const [state, setState] = useState<ConcordUpdaterState>(initialState)
  const [dismissedVersion, setDismissedVersion] = useState('')

  useEffect(() => {
    let mounted = true

    void window.concord.updater.getState().then((next) => {
      if (mounted) setState(next)
    })

    const unsubscribe = window.concord.updater.onState((next) => {
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

  const check = useCallback(() => window.concord.updater.check(), [])
  const download = useCallback(() => window.concord.updater.download(), [])
  const install = useCallback(() => window.concord.updater.install(), [])
  const dismiss = useCallback(() => {
    if (state.availableVersion) setDismissedVersion(state.availableVersion)
  }, [state.availableVersion])

  const visible =
    Boolean(state.availableVersion) &&
    state.availableVersion !== dismissedVersion &&
    ['available', 'downloading', 'downloaded', 'error'].includes(state.status)

  return { state, visible, check, download, install, dismiss }
}
