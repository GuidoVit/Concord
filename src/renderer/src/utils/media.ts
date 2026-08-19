import { API } from '../config/api'
import type { AttachmentKind, MessageAttachment } from '../types/harmony'

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024

function detectKind(file: File): AttachmentKind {
  const lowerName = file.name.toLowerCase()

  if (file.type === 'image/gif' || lowerName.endsWith('.gif')) {
    return 'sticker'
  }

  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type.startsWith('video/')) {
    return 'video'
  }

  throw new Error('Envie uma imagem, GIF ou vídeo.')
}

export async function fileToAttachment(file: File): Promise<MessageAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('O arquivo deve ter no máximo 100 MB.')
  }

  const kind = detectKind(file)
  const token = localStorage.getItem('harmony_token') ?? localStorage.getItem('concord_token')

  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'X-Harmony-File-Name': encodeURIComponent(file.name),
    'X-Harmony-File-Type': file.type || 'application/octet-stream',
    'X-Harmony-File-Kind': kind
  })

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers,
    body: file
  })

  const raw = await response.text()
  let data: any = {}

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('O servidor retornou uma resposta inválida durante o upload.')
    }
  }

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar o arquivo.')
  }

  return data.attachment as MessageAttachment
}
