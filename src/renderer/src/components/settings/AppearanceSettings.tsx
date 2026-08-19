import { useEffect, useState } from 'react'

interface AppearanceSettingsProps {
  primary: string
  secondary: string
  setPrimary: (value: string) => void
  setSecondary: (value: string) => void
  setPalette: (primary: string, secondary: string) => void
  resetPalette: () => void
  commitPalette: () => void
  joinMuted: boolean
  setJoinMuted: (value: boolean) => void
}

const PRESETS = [
  { name: 'Harmony', primary: '#27e0b3', secondary: '#f6c945' },
  { name: 'Cyber', primary: '#8b5cff', secondary: '#36a3ff' },
  { name: 'Ocean', primary: '#22d3ee', secondary: '#3b82f6' },
  { name: 'Crimson', primary: '#ff4d6d', secondary: '#ff8fab' },
  { name: 'Sunset', primary: '#ff7a18', secondary: '#9b5cff' },
  { name: 'Mono', primary: '#e7ece9', secondary: '#8c9691' }
]

export function AppearanceSettings({
  primary,
  secondary,
  setPrimary,
  setSecondary,
  setPalette,
  resetPalette,
  commitPalette,
  joinMuted,
  setJoinMuted
}: AppearanceSettingsProps) {
  const [compatibilityMode, setCompatibilityMode] = useState(false)
  const [compatibilityChanged, setCompatibilityChanged] = useState(false)

  useEffect(() => {
    void window.harmony.compatibility.getVideoMode().then((enabled) => {
      setCompatibilityMode(enabled)
    })
  }, [])

  const changeCompatibility = async (enabled: boolean) => {
    setCompatibilityMode(enabled)
    await window.harmony.compatibility.setVideoMode(enabled)
    setCompatibilityChanged(true)
  }

  return (
    <section className="appearance-settings">
      <div className="appearance-heading">
        <div>
          <h3>Aparência</h3>
          <p>Personalize a paleta só no seu Harmony.</p>
        </div>

        <button type="button" className="appearance-reset" onClick={resetPalette}>
          Restaurar padrão
        </button>
      </div>

      <div className="color-wheel-grid">
        <label className="color-wheel-card">
          <span>Cor principal</span>
          <input
            className="color-wheel"
            type="color"
            value={primary}
            onInput={(event) => setPrimary(event.currentTarget.value)}
            onChange={(event) => {
              setPrimary(event.currentTarget.value)
              requestAnimationFrame(commitPalette)
            }}
            onPointerUp={commitPalette}
            onTouchEnd={commitPalette}
            onKeyUp={commitPalette}
            aria-label="Cor principal do Harmony"
          />
          <input className="color-hex-input" value={primary.toUpperCase()} readOnly />
        </label>

        <label className="color-wheel-card">
          <span>Cor secundária</span>
          <input
            className="color-wheel"
            type="color"
            value={secondary}
            onInput={(event) => setSecondary(event.currentTarget.value)}
            onChange={(event) => {
              setSecondary(event.currentTarget.value)
              requestAnimationFrame(commitPalette)
            }}
            onPointerUp={commitPalette}
            onTouchEnd={commitPalette}
            onKeyUp={commitPalette}
            aria-label="Cor secundária do Harmony"
          />
          <input className="color-hex-input" value={secondary.toUpperCase()} readOnly />
        </label>
      </div>

      <div className="palette-preview" aria-hidden="true">
        <div className="palette-preview-gradient" />
        <div className="palette-preview-chip primary-chip" />
        <div className="palette-preview-chip secondary-chip" />
      </div>

      <div className="appearance-presets">
        <span>Temas rápidos</span>
        <div className="appearance-preset-grid">
          {PRESETS.map((preset) => (
            <button
              type="button"
              className="appearance-preset"
              key={preset.name}
              onClick={() => setPalette(preset.primary, preset.secondary)}
            >
              <span
                className="appearance-preset-swatch"
                style={{ background: `linear-gradient(135deg, ${preset.secondary}, ${preset.primary})` }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-subsection call-settings-section">
        <div className="appearance-heading compact-heading">
          <div>
            <h3>Chamadas</h3>
            <p>Preferências locais de voz e compartilhamento.</p>
          </div>
        </div>

        <label className="settings-toggle-row">
          <div>
            <strong>Entrar com microfone desligado</strong>
            <span>Novas calls começam com seu microfone mutado.</span>
          </div>
          <input
            type="checkbox"
            checked={joinMuted}
            onChange={(event) => setJoinMuted(event.currentTarget.checked)}
          />
        </label>

        <label className="settings-toggle-row">
          <div>
            <strong>Modo de compatibilidade de vídeo</strong>
            <span>
              Use se aparecerem manchas, quadros amarelos ou outros artefatos de GPU no compartilhamento. Requer reiniciar o Harmony.
            </span>
          </div>
          <input
            type="checkbox"
            checked={compatibilityMode}
            onChange={(event) => void changeCompatibility(event.currentTarget.checked)}
          />
        </label>

        {compatibilityChanged && (
          <button
            type="button"
            className="compatibility-restart"
            onClick={() => void window.harmony.compatibility.relaunch()}
          >
            Reiniciar Harmony para aplicar
          </button>
        )}
      </div>
    </section>
  )
}
