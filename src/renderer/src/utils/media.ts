import type { MessageAttachment } from '../types/concord'

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024

export async function fileToAttachment(file: File): Promise<MessageAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('O arquivo deve ter no máximo 100 MB.')
  }

  const isGif =
    file.type === 'image/gif' ||
    file.name.toLowerCase().endsWith('.gif')

  const isImage =
    file.type.startsWith('image/')

  const isVideo =
    file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    throw new Error(
      'Envie uma imagem, GIF ou vídeo.'
    )
  }

  const dataUrl =
    await new Promise<string>(
      (resolve, reject) => {
        const reader =
          new FileReader()

        reader.onload = () =>
          resolve(
            String(
              reader.result || ''
            )
          )

        reader.onerror = () =>
          reject(
            new Error(
              'Não foi possível ler o arquivo.'
            )
          )

        reader.readAsDataURL(
          file
        )
      }
    )

  return {
    kind:
      isGif
        ? 'sticker'
        : isVideo
          ? 'video'
          : 'image',

    dataUrl,
    name: file.name,
    mimeType: file.type
  }
}