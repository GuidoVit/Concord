import { useEffect, useState } from 'react'

export function WindowChrome() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.harmony.window.isMaximized().then(setMaximized)
    return window.harmony.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="window-chrome" aria-hidden="true">
      <div className="window-drag-region" />
      <div className="window-controls">
        <button
          className="window-control"
          type="button"
          title="Minimizar"
          aria-label="Minimizar"
          onClick={() => void window.harmony.window.minimize()}
        >
          <span className="window-minimize" />
        </button>

        <button
          className="window-control"
          type="button"
          title={maximized ? 'Restaurar' : 'Maximizar'}
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => void window.harmony.window.toggleMaximize()}
        >
          <span className={maximized ? 'window-restore' : 'window-maximize'} />
        </button>

        <button
          className="window-control close"
          type="button"
          title="Fechar"
          aria-label="Fechar"
          onClick={() => void window.harmony.window.close()}
        >
          <span className="window-close" />
        </button>
      </div>
    </div>
  )
}
