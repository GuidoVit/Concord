import type { UpdaterState as HarmonyUpdaterState } from '../../types/harmony'

interface UpdateBannerProps {
  state: HarmonyUpdaterState
  visible: boolean
  download: () => Promise<boolean>
  install: () => Promise<boolean>
  dismiss: () => void
}

function formatBytes(value?: number) {
  if (!value) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

export function UpdateBanner({ state, visible, download, install, dismiss }: UpdateBannerProps) {
  if (!visible) return null

  const downloading = state.status === 'downloading'
  const downloaded = state.status === 'downloaded'
  const errored = state.status === 'error'
  const percent = Math.round(state.percent || 0)

  return (
    <aside className={`update-banner ${downloaded ? 'ready' : ''} ${errored ? 'error' : ''}`}>
      <div className="update-banner-copy">
        <strong>
          {downloaded
            ? 'Atualização pronta'
            : errored
              ? 'Não foi possível atualizar'
              : `Harmony ${state.availableVersion || ''} disponível`}
        </strong>
        <span>
          {downloading
            ? `Baixando ${percent}%${state.total ? ` • ${formatBytes(state.transferred)} de ${formatBytes(state.total)}` : ''}`
            : downloaded
              ? 'Reinicie para instalar a nova versão.'
              : errored
                ? state.error || 'Tente novamente em alguns instantes.'
                : 'Uma versão mais recente está disponível.'}
        </span>
        {downloading && (
          <div className="update-progress">
            <i style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      <div className="update-banner-actions">
        {!downloading && !downloaded && !errored && (
          <button type="button" className="update-primary" onClick={() => void download()}>
            Atualizar
          </button>
        )}
        {downloaded && (
          <button type="button" className="update-primary" onClick={() => void install()}>
            Reiniciar e atualizar
          </button>
        )}
        {!downloading && (
          <button type="button" className="update-secondary" onClick={dismiss}>
            Depois
          </button>
        )}
      </div>
    </aside>
  )
}
