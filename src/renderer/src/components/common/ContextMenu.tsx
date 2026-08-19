import { useEffect, type ReactNode } from 'react'

export function ContextMenu({
  x,
  y,
  children,
  close,
  className = ''
}: {
  x: number
  y: number
  children: ReactNode
  close: () => void
  className?: string
}) {
  useEffect(() => {
    const onClose = () => close()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    document.addEventListener('pointerdown', onClose)
    document.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      document.removeEventListener('pointerdown', onClose)
      document.removeEventListener('keydown', onKey)
    }
  }, [close])

  return (
    <div
      className={`harmony-context-menu ${className}`.trim()}
      style={{
        left: Math.min(x, window.innerWidth - 300),
        top: Math.min(y, window.innerHeight - 280)
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  )
}
