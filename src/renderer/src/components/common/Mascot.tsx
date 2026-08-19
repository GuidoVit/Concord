import {
  useEffect,
  useRef,
  useState
} from 'react'

interface MascotProps {
  alt?: string
  className?: string
}

const SOURCE = './concord-mascot.png' // arquivo legado; mantém compatibilidade com instalações existentes
const DEFAULT_PRIMARY = '#27e0b3'
const DEFAULT_SECONDARY = '#f6c945'

const CACHE_LIMIT = 24

type RGB = {
  r: number
  g: number
  b: number
}

type PreparedPixel = {
  index: number
  originalR: number
  originalG: number
  originalB: number
  brightness: number
  saturationWeight: number
  target: 'primary' | 'secondary'
}

let sourceImagePromise:
  Promise<HTMLImageElement> | null =
  null

let preparedCanvas:
  HTMLCanvasElement | null =
  null

let preparedContext:
  CanvasRenderingContext2D | null =
  null

let originalFrame:
  ImageData | null =
  null

let preparedPixels:
  PreparedPixel[] | null =
  null

const mascotCache =
  new Map<string, string>()

function hexToRgb(
  hex: string
): RGB {
  const clean =
    hex.replace('#', '')

  return {
    r: Number.parseInt(
      clean.slice(0, 2),
      16
    ),

    g: Number.parseInt(
      clean.slice(2, 4),
      16
    ),

    b: Number.parseInt(
      clean.slice(4, 6),
      16
    )
  }
}

function rgbToHsv(
  r: number,
  g: number,
  b: number
) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255

  const max =
    Math.max(
      rr,
      gg,
      bb
    )

  const min =
    Math.min(
      rr,
      gg,
      bb
    )

  const delta =
    max - min

  let h = 0

  if (delta !== 0) {
    if (max === rr) {
      h =
        60 *
        (
          (
            (gg - bb) /
            delta
          ) %
          6
        )
    } else if (
      max === gg
    ) {
      h =
        60 *
        (
          (bb - rr) /
          delta +
          2
        )
    } else {
      h =
        60 *
        (
          (rr - gg) /
          delta +
          4
        )
    }
  }

  if (h < 0) {
    h += 360
  }

  return {
    h,
    s:
      max === 0
        ? 0
        : delta / max,
    v: max
  }
}

function loadSourceImage() {
  if (
    sourceImagePromise
  ) {
    return sourceImagePromise
  }

  sourceImagePromise =
    new Promise(
      (
        resolve,
        reject
      ) => {
        const image =
          new Image()

        image.onload =
          () =>
            resolve(
              image
            )

        image.onerror =
          () =>
            reject(
              new Error(
                'Não foi possível carregar o mascote.'
              )
            )

        image.src =
          SOURCE
      }
    )

  return sourceImagePromise
}

/*
 * Faz a análise cara do PNG UMA única vez.
 * Depois cada troca de cor altera somente os pixels
 * verdes/amarelos já catalogados.
 */
async function prepareMascot() {
  if (
    preparedCanvas &&
    preparedContext &&
    originalFrame &&
    preparedPixels
  ) {
    return
  }

  const image =
    await loadSourceImage()

  const canvas =
    document.createElement(
      'canvas'
    )

  canvas.width =
    image.naturalWidth

  canvas.height =
    image.naturalHeight

  const context =
    canvas.getContext(
      '2d',
      {
        willReadFrequently:
          true
      }
    )

  if (!context) {
    throw new Error(
      'Canvas indisponível.'
    )
  }

  context.drawImage(
    image,
    0,
    0
  )

  const frame =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

  const pixels =
    frame.data

  const catalog:
    PreparedPixel[] =
    []

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const alpha =
      pixels[index + 3]

    if (alpha < 8) {
      continue
    }

    const r =
      pixels[index]

    const g =
      pixels[index + 1]

    const b =
      pixels[index + 2]

    const hsv =
      rgbToHsv(
        r,
        g,
        b
      )

    /*
     * Preto, cinza, branco e sombras neutras
     * permanecem originais.
     */
    if (
      hsv.s < 0.20 ||
      hsv.v < 0.12
    ) {
      continue
    }

    let target:
      'primary' |
      'secondary' |
      null =
      null

    if (
      hsv.h >= 100 &&
      hsv.h <= 195
    ) {
      target =
        'primary'
    } else if (
      hsv.h >= 30 &&
      hsv.h < 100
    ) {
      target =
        'secondary'
    }

    if (!target) {
      continue
    }

    catalog.push({
      index,

      originalR: r,
      originalG: g,
      originalB: b,

      brightness:
        Math.max(
          0.18,
          Math.min(
            1.15,
            hsv.v /
              0.88
          )
        ),

      saturationWeight:
        Math.max(
          0.35,
          Math.min(
            1,
            hsv.s
          )
        ),

      target
    })
  }

  preparedCanvas =
    canvas

  preparedContext =
    context

  originalFrame =
    frame

  preparedPixels =
    catalog
}

function tintChannel(
  original: number,
  target: number,
  brightness: number,
  saturationWeight: number
) {
  return Math.min(
    255,
    Math.round(
      target *
        brightness *
        saturationWeight +
      original *
        (
          1 -
          saturationWeight
        )
    )
  )
}

function rememberCache(
  key: string,
  value: string
) {
  if (
    mascotCache.has(
      key
    )
  ) {
    mascotCache.delete(
      key
    )
  }

  mascotCache.set(
    key,
    value
  )

  while (
    mascotCache.size >
    CACHE_LIMIT
  ) {
    const oldest =
      mascotCache
        .keys()
        .next()
        .value

    if (
      typeof oldest ===
      'string'
    ) {
      mascotCache.delete(
        oldest
      )
    } else {
      break
    }
  }
}

async function buildMascot(
  primary: string,
  secondary: string
) {
  const cacheKey =
    `${primary}|${secondary}`

  const cached =
    mascotCache.get(
      cacheKey
    )

  if (cached) {
    return cached
  }

  await prepareMascot()

  if (
    !preparedCanvas ||
    !preparedContext ||
    !originalFrame ||
    !preparedPixels
  ) {
    return SOURCE
  }

  /*
   * Clona o frame original já carregado.
   * Não decodifica a imagem novamente.
   */
  const nextFrame =
    new ImageData(
      new Uint8ClampedArray(
        originalFrame.data
      ),
      originalFrame.width,
      originalFrame.height
    )

  const data =
    nextFrame.data

  const primaryRgb =
    hexToRgb(
      primary
    )

  const secondaryRgb =
    hexToRgb(
      secondary
    )

  for (
    const pixel
    of preparedPixels
  ) {
    const target =
      pixel.target ===
      'primary'
        ? primaryRgb
        : secondaryRgb

    data[
      pixel.index
    ] =
      tintChannel(
        pixel.originalR,
        target.r,
        pixel.brightness,
        pixel.saturationWeight
      )

    data[
      pixel.index +
        1
    ] =
      tintChannel(
        pixel.originalG,
        target.g,
        pixel.brightness,
        pixel.saturationWeight
      )

    data[
      pixel.index +
        2
    ] =
      tintChannel(
        pixel.originalB,
        target.b,
        pixel.brightness,
        pixel.saturationWeight
      )
  }

  preparedContext
    .putImageData(
      nextFrame,
      0,
      0
    )

  const result =
    preparedCanvas
      .toDataURL(
        'image/png'
      )

  rememberCache(
    cacheKey,
    result
  )

  return result
}

export function Mascot({
  alt = 'Harmony',
  className
}: MascotProps) {
  const [
    src,
    setSrc
  ] =
    useState(
      SOURCE
    )

  const generationRef =
    useRef(0)

  useEffect(() => {
    let mounted =
      true

    /*
     * Pré-carrega e analisa o PNG em idle time,
     * antes do usuário começar a arrastar o seletor.
     */
    const warmup = () => {
      void prepareMascot()
    }

    const idleWindow =
      window as Window & {
        requestIdleCallback?: (
          callback: IdleRequestCallback
        ) => number
        cancelIdleCallback?: (
          id: number
        ) => void
      }

    const usesIdleCallback =
      typeof idleWindow.requestIdleCallback === 'function'

    const idleId:
      number | ReturnType<typeof setTimeout> =
      usesIdleCallback
        ? idleWindow.requestIdleCallback!(warmup)
        : setTimeout(warmup, 0)

    const refresh =
      async (
        primary?: string,
        secondary?: string
      ) => {
        const generation =
          ++generationRef.current

        const nextPrimary =
          primary ||
          localStorage.getItem('harmony-theme-primary') ||
          localStorage.getItem('concord-theme-primary') ||
          DEFAULT_PRIMARY

        const nextSecondary =
          secondary ||
          localStorage.getItem('harmony-theme-secondary') ||
          localStorage.getItem('concord-theme-secondary') ||
          DEFAULT_SECONDARY

        try {
          const next =
            await buildMascot(
              nextPrimary,
              nextSecondary
            )

          /*
           * Se outra cor chegou enquanto processávamos,
           * ignora a geração antiga.
           */
          if (
            mounted &&
            generation ===
              generationRef.current
          ) {
            setSrc(
              next
            )
          }
        } catch {
          if (
            mounted &&
            generation ===
              generationRef.current
          ) {
            setSrc(
              SOURCE
            )
          }
        }
      }

    const onThemeChange =
      (
        event: Event
      ) => {
        const custom =
          event as
            CustomEvent<{
              primary?: string
              secondary?: string
            }>

        void refresh(
          custom.detail
            ?.primary,
          custom.detail
            ?.secondary
        )
      }

    void refresh()

    window.addEventListener(
      'harmony-theme-change',
      onThemeChange
    )

    return () => {
      mounted =
        false

      generationRef.current++

      window.removeEventListener(
        'harmony-theme-change',
        onThemeChange
      )

      if (
        usesIdleCallback &&
        typeof idleWindow.cancelIdleCallback === 'function'
      ) {
        idleWindow.cancelIdleCallback(idleId as number)
      } else {
        clearTimeout(
          idleId as ReturnType<typeof setTimeout>
        )
      }
    }
  }, [])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
    />
  )
}
