import { API } from '../../config/api'
import type { MessageAttachment } from '../../types/concord'

function attachmentSource(attachment: MessageAttachment): string {
  if (attachment.url) {
    return attachment.url.startsWith('/') ? `${API}${attachment.url}` : attachment.url
  }

  return attachment.dataUrl || ''
}

export function MessageAttachmentView({
  attachment
}: {
  attachment?: MessageAttachment | null
}) {
  if (!attachment) return null

  const src = attachmentSource(attachment)
  if (!src) return null

  if (attachment.kind === 'video') {
    return (
      <video
        className="message-media message-video"
        src={src}
        controls
        playsInline
        preload="metadata"
      />
    )
  }

  return (
    <img
      className={attachment.kind === 'sticker' ? 'message-media message-sticker' : 'message-media message-image'}
      src={src}
      alt={attachment.name || (attachment.kind === 'sticker' ? 'GIF' : 'Imagem')}
      loading="lazy"
    />
  )
}
