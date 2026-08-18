import type { MessageAttachment } from '../../types/concord'

export function MessageAttachmentView({
  attachment
}: {
  attachment?: MessageAttachment | null
}) {
  if (!attachment?.dataUrl) return null

  if (attachment.kind === 'video') {
    return (
      <video
        className="message-media message-video"
        src={attachment.dataUrl}
        controls
        playsInline
        preload="metadata"
      />
    )
  }

  return (
    <img
      className={attachment.kind === 'sticker' ? 'message-media message-sticker' : 'message-media message-image'}
      src={attachment.dataUrl}
      alt={attachment.name || (attachment.kind === 'sticker' ? 'GIF' : 'Imagem')}
    />
  )
}
