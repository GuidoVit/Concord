import { useEffect, useMemo, useState } from 'react'

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

export function CallTimer({ startedAt }: { startedAt?: string | null }) {
  const start = useMemo(() => {
    if (!startedAt) return 0
    const parsed = new Date(startedAt).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }, [startedAt])

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!start) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [start])

  if (!start) return null

  return <span className="call-life">{formatDuration(now - start)}</span>
}
