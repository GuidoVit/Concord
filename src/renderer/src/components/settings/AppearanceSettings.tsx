interface AppearanceSettingsProps {
  primary: string
  secondary: string
  setPrimary: (
    value: string
  ) => void
  setSecondary: (
    value: string
  ) => void
  setPalette: (
    primary: string,
    secondary: string
  ) => void
  resetPalette: () => void
  commitPalette?: () => void
}

const PRESETS = [
  {
    name: 'Concord',
    primary: '#27e0b3',
    secondary: '#f6c945'
  },
  {
    name: 'Cyber',
    primary: '#8b5cff',
    secondary: '#36a3ff'
  },
  {
    name: 'Ocean',
    primary: '#22d3ee',
    secondary: '#3b82f6'
  },
  {
    name: 'Crimson',
    primary: '#ff4d6d',
    secondary: '#ff8fab'
  },
  {
    name: 'Sunset',
    primary: '#ff7a18',
    secondary: '#9b5cff'
  },
  {
    name: 'Mono',
    primary: '#e7ece9',
    secondary: '#8c9691'
  }
]

export function AppearanceSettings({
  primary,
  secondary,
  setPrimary,
  setSecondary,
  setPalette,
  resetPalette,
  commitPalette
}: AppearanceSettingsProps) {
  const commitCurrentPalette = () => {
    if (commitPalette) {
      commitCurrentPalette()
      return
    }

    localStorage.setItem('concord-theme-primary', primary)
    localStorage.setItem('concord-theme-secondary', secondary)

    window.dispatchEvent(
      new CustomEvent('concord-theme-change', {
        detail: { primary, secondary }
      })
    )
  }

  return (
    <section className="appearance-settings">
      <div className="appearance-heading">
        <div>
          <h3>Aparência</h3>
          <p>
            Personalize a paleta só no seu Concord.
          </p>
        </div>

        <button
          type="button"
          className="appearance-reset"
          onClick={resetPalette}
        >
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
            onInput={(event) =>
              setPrimary(
                event.currentTarget.value
              )
            }
            onChange={(event) => {
              setPrimary(
                event.currentTarget.value
              )

              commitCurrentPalette()
            }}
            onPointerUp={commitCurrentPalette}
            onTouchEnd={commitCurrentPalette}
            onKeyUp={commitCurrentPalette}
            aria-label="Cor principal do Concord"
          />

          <input
            className="color-hex-input"
            value={primary.toUpperCase()}
            readOnly
            aria-label="Código hexadecimal da cor principal"
          />
        </label>

        <label className="color-wheel-card">
          <span>Cor secundária</span>

          <input
            className="color-wheel"
            type="color"
            value={secondary}
            onInput={(event) =>
              setSecondary(
                event.currentTarget.value
              )
            }
            onChange={(event) => {
              setSecondary(
                event.currentTarget.value
              )

              commitCurrentPalette()
            }}
            onPointerUp={commitCurrentPalette}
            onTouchEnd={commitCurrentPalette}
            onKeyUp={commitCurrentPalette}
            aria-label="Cor secundária do Concord"
          />

          <input
            className="color-hex-input"
            value={secondary.toUpperCase()}
            readOnly
            aria-label="Código hexadecimal da cor secundária"
          />
        </label>
      </div>

      <div
        className="palette-preview"
        aria-hidden="true"
      >
        <div className="palette-preview-gradient" />
        <div className="palette-preview-chip primary-chip" />
        <div className="palette-preview-chip secondary-chip" />
      </div>

      <div className="appearance-presets">
        <span>Temas rápidos</span>

        <div className="appearance-preset-grid">
          {PRESETS.map(
            (
              preset
            ) => (
              <button
                type="button"
                className="appearance-preset"
                key={preset.name}
                onClick={() =>
                  setPalette(
                    preset.primary,
                    preset.secondary
                  )
                }
                title={`${preset.name}: ${preset.primary} + ${preset.secondary}`}
              >
                <span
                  className="appearance-preset-swatch"
                  style={{
                    background:
                      `linear-gradient(135deg, ${preset.secondary}, ${preset.primary})`
                  }}
                />

                {preset.name}
              </button>
            )
          )}
        </div>
      </div>
    </section>
  )
}
