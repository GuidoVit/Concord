import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import {
  readFile,
  writeFile,
  unlink
} from 'node:fs/promises'

const input =
  './resources/concord-mascot.png'

const temp =
  './resources/concord-icon-temp.png'

// Sempre sobrescreve o mesmo ícone
const output =
  './resources/concord-icon.ico'

// ======================================================
// CONFIGURAÇÕES
// ======================================================

// Tamanho externo do ícone.
// NÃO diminuir: queremos manter o círculo grande.
const SIZE = 256

// Tamanho do mascote DENTRO do círculo.
// Altere somente este valor para ajustar a carinha.
//
// 180 = menor
// 190 = atual
// 200 = maior
const INNER_SIZE = 190

// Cor do fundo circular
const BACKGROUND = '#07191b'

// ======================================================
// 1. LÊ A IMAGEM ORIGINAL
// ======================================================

const metadata =
  await sharp(input).metadata()

if (
  !metadata.width ||
  !metadata.height
) {
  throw new Error(
    'Não foi possível ler concord-mascot.png'
  )
}

// ======================================================
// 2. RECORTA A ÁREA CENTRAL DA IMAGEM ORIGINAL
// ======================================================

const cropWidth =
  Math.round(
    metadata.width * 0.70
  )

const cropHeight =
  Math.round(
    metadata.height * 0.70
  )

const left =
  Math.round(
    (metadata.width - cropWidth) / 2
  )

const top =
  Math.round(
    (metadata.height - cropHeight) / 2
  )

// ======================================================
// 3. PREPARA O MASCOTE
// ======================================================

const mascot =
  await sharp(input)
    .extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight
    })
    .resize(
      INNER_SIZE,
      INNER_SIZE,
      {
        fit: 'contain'
      }
    )
    .png()
    .toBuffer()

// ======================================================
// 4. CRIA O CÍRCULO EXTERNO
//
// O círculo permanece 256x256.
// Somente o mascote interno é menor.
// ======================================================

const circle =
  Buffer.from(`
    <svg
      width="${SIZE}"
      height="${SIZE}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="${SIZE / 2}"
        cy="${SIZE / 2}"
        r="${SIZE / 2}"
        fill="${BACKGROUND}"
      />
    </svg>
  `)

// ======================================================
// 5. POSIÇÃO CENTRAL DO MASCOTE
// ======================================================

const mascotLeft =
  Math.round(
    (SIZE - INNER_SIZE) / 2
  )

const mascotTop =
  Math.round(
    (SIZE - INNER_SIZE) / 2
  )

// ======================================================
// 6. CRIA O ÍCONE
//
// Fora do círculo = transparente
// Dentro do círculo = fundo escuro
// Mascote = menor e centralizado
// ======================================================

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,

    background: {
      r: 0,
      g: 0,
      b: 0,
      alpha: 0
    }
  }
})
  .composite([
    {
      input: circle,
      left: 0,
      top: 0
    },

    {
      input: mascot,
      left: mascotLeft,
      top: mascotTop
    }
  ])
  .png()
  .toFile(temp)

// ======================================================
// 7. CONVERTE PNG -> ICO
// ======================================================

const png =
  await readFile(temp)

const ico =
  await pngToIco(png)

await writeFile(
  output,
  ico
)

// ======================================================
// 8. REMOVE O PNG TEMPORÁRIO
// ======================================================

await unlink(temp)

console.log(
  '✅ concord-icon.ico atualizado!'
)

console.log(
  `⭕ Círculo externo: ${SIZE}px`
)

console.log(
  `🐱 Mascote interno: ${INNER_SIZE}px`
)