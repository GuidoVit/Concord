import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

export const DEFAULT_PRIMARY = '#27e0b3'
export const DEFAULT_SECONDARY = '#f6c945'

const PRIMARY_KEY = 'concord-theme-primary'
const SECONDARY_KEY = 'concord-theme-secondary'

function normalizeHex(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  }
}

function mix(
  hex: string,
  target: '#000000' | '#ffffff',
  amount: number
) {
  const source = hexToRgb(hex)
  const destination = hexToRgb(target)
  const ratio = Math.max(0, Math.min(1, amount))

  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * ratio)
      .toString(16)
      .padStart(2, '0')

  return `#${channel(source.r, destination.r)}${channel(source.g, destination.g)}${channel(source.b, destination.b)}`
}

function applyVisualPalette(
  primary: string,
  secondary: string
) {
  const root = document.documentElement
  const primaryRgb = hexToRgb(primary)
  const secondaryRgb = hexToRgb(secondary)

  root.style.setProperty('--mint', primary)
  root.style.setProperty('--mint-bright', mix(primary, '#ffffff', 0.22))
  root.style.setProperty('--mint-dark', mix(primary, '#000000', 0.30))
  root.style.setProperty(
    '--mint-rgb',
    `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`
  )

  root.style.setProperty('--solar', secondary)
  root.style.setProperty('--solar-bright', mix(secondary, '#ffffff', 0.20))
  root.style.setProperty('--solar-dark', mix(secondary, '#000000', 0.25))
  root.style.setProperty(
    '--solar-rgb',
    `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`
  )

  root.style.setProperty(
    '--concord-gradient',
    `linear-gradient(135deg, ${secondary}, ${primary})`
  )
}

function notifyMascot(
  primary: string,
  secondary: string
) {
  window.dispatchEvent(
    new CustomEvent('concord-theme-change', {
      detail: { primary, secondary }
    })
  )
}

export function useThemePalette() {
  const [primary, setPrimaryState] = useState(() =>
    normalizeHex(
      localStorage.getItem(PRIMARY_KEY) || '',
      DEFAULT_PRIMARY
    )
  )

  const [secondary, setSecondaryState] = useState(() =>
    normalizeHex(
      localStorage.getItem(SECONDARY_KEY) || '',
      DEFAULT_SECONDARY
    )
  )

  const latestRef = useRef({
    primary,
    secondary
  })

  const frameRef = useRef<number | null>(null)

  const queueVisualUpdate = useCallback(
    (
      nextPrimary: string,
      nextSecondary: string
    ) => {
      latestRef.current = {
        primary: nextPrimary,
        secondary: nextSecondary
      }

      if (frameRef.current !== null) {
        return
      }

      frameRef.current =
        window.requestAnimationFrame(() => {
          frameRef.current = null

          const latest = latestRef.current

          applyVisualPalette(
            latest.primary,
            latest.secondary
          )
        })
    },
    []
  )

  useEffect(() => {
    applyVisualPalette(
      primary,
      secondary
    )

    /*
     * Ao abrir o Concord, o mascote recebe apenas
     * a última paleta já salva.
     */
    notifyMascot(
      primary,
      secondary
    )

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(
          frameRef.current
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * Durante o arraste:
   * - muda o CSS imediatamente
   * - NÃO salva
   * - NÃO recolore o mascote
   */
  const setPrimary = useCallback(
    (value: string) => {
      const nextPrimary =
        normalizeHex(
          value,
          DEFAULT_PRIMARY
        )

      setPrimaryState(
        nextPrimary
      )

      queueVisualUpdate(
        nextPrimary,
        latestRef.current.secondary
      )
    },
    [
      queueVisualUpdate
    ]
  )

  const setSecondary = useCallback(
    (value: string) => {
      const nextSecondary =
        normalizeHex(
          value,
          DEFAULT_SECONDARY
        )

      setSecondaryState(
        nextSecondary
      )

      queueVisualUpdate(
        latestRef.current.primary,
        nextSecondary
      )
    },
    [
      queueVisualUpdate
    ]
  )

  /*
   * Chamado somente quando o usuário termina
   * de escolher a cor.
   */
  const commitPalette = useCallback(
    () => {
      const latest =
        latestRef.current

      localStorage.setItem(
        PRIMARY_KEY,
        latest.primary
      )

      localStorage.setItem(
        SECONDARY_KEY,
        latest.secondary
      )

      notifyMascot(
        latest.primary,
        latest.secondary
      )
    },
    []
  )

  const setPalette = useCallback(
    (
      primaryValue: string,
      secondaryValue: string
    ) => {
      const nextPrimary =
        normalizeHex(
          primaryValue,
          DEFAULT_PRIMARY
        )

      const nextSecondary =
        normalizeHex(
          secondaryValue,
          DEFAULT_SECONDARY
        )

      setPrimaryState(
        nextPrimary
      )

      setSecondaryState(
        nextSecondary
      )

      latestRef.current = {
        primary: nextPrimary,
        secondary: nextSecondary
      }

      applyVisualPalette(
        nextPrimary,
        nextSecondary
      )

      localStorage.setItem(
        PRIMARY_KEY,
        nextPrimary
      )

      localStorage.setItem(
        SECONDARY_KEY,
        nextSecondary
      )

      /*
       * Presets são cliques únicos,
       * então o mascote pode atualizar imediatamente.
       */
      notifyMascot(
        nextPrimary,
        nextSecondary
      )
    },
    []
  )

  const resetPalette = useCallback(
    () => {
      setPalette(
        DEFAULT_PRIMARY,
        DEFAULT_SECONDARY
      )
    },
    [
      setPalette
    ]
  )

  return {
    primary,
    secondary,
    setPrimary,
    setSecondary,
    setPalette,
    resetPalette,
    commitPalette
  }
}
