import { useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { DirectMessage, MessageAttachment, User } from '../../types/harmony'
import { fileToAttachment } from '../../utils/media'
import { Avatar } from '../common/Avatar'
import { MessageAttachmentView } from '../common/MessageAttachmentView'

export function DirectMessageScreen({
  user,
  friend,
  messages,
  messageText,
  setMessageText,
  sendMessage,
  messagesEndRef
}: {
  user: User | null
  friend: User
  messages: DirectMessage[]
  messageText: string
  setMessageText: (value: string) => void
  sendMessage: (event: FormEvent, attachment?: MessageAttachment | null) => Promise<boolean>
  messagesEndRef: RefObject<HTMLDivElement | null>
}) {
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null)
  const [attachmentLoading, setAttachmentLoading] = useState(false)

  async function pickAttachment(file?: File) {
    if (!file) return

    try {
      setAttachmentLoading(true)
      setAttachment(await fileToAttachment(file))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.')
    } finally {
      setAttachmentLoading(false)
    }
  }

  async function submit(event: FormEvent) {
    const sent = await sendMessage(event, attachment)
    if (sent) setAttachment(null)
  }

  return (
    <div className="dm-page">
      <header className="dm-header">
        <Avatar name={friend.displayName} image={friend.avatarUrl} />
        <div>
          <strong>{friend.displayName}</strong>
          <span>@{friend.username}</span>
        </div>
      </header>

      <div className="dm-messages">
        {messages.length === 0 && (
          <div className="dm-start">
            <Avatar name={friend.displayName} image={friend.avatarUrl} />
            <h2>{friend.displayName}</h2>
            <p>Esse é o começo da conversa de vocês.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const mine = message.senderId === user?.id
          const previous = messages[index - 1]
          const grouped = previous && previous.senderId === message.senderId

          return (
            <div
              key={message.id}
              className={mine ? `dm-message mine ${grouped ? 'grouped' : ''}` : `dm-message ${grouped ? 'grouped' : ''}`}
            >
              {!grouped && (
                <Avatar
                  name={mine ? user?.displayName || 'Você' : friend.displayName}
                  image={mine ? user?.avatarUrl : friend.avatarUrl}
                />
              )}

              <div className="dm-message-body">
                {!grouped && (
                  <div className="dm-message-meta">
                    <strong>{mine ? user?.displayName : friend.displayName}</strong>
                    <span>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}

                {message.content && <p>{message.content}</p>}
                <MessageAttachmentView attachment={message.attachment} />
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {attachment && (
        <div className="composer-attachment-preview">
          <MessageAttachmentView attachment={attachment} />
          <div>
            <strong>{attachment.kind === 'sticker' ? 'GIF / figurinha' : attachment.kind === 'video' ? 'Vídeo' : 'Imagem'}</strong>
            <span>{attachment.name}</span>
          </div>
          <button type="button" onClick={() => setAttachment(null)}>×</button>
        </div>
      )}

      <form className="dm-composer" onSubmit={(event) => void submit(event)}>
        <label className="composer-file-button" title="Enviar imagem, vídeo ou GIF">
          +
          <input
            type="file"
            accept="image/*,video/*,.gif"
            onChange={(event) => {
              void pickAttachment(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </label>

        <input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder={`Mensagem para @${friend.username}`}
          autoFocus
        />

        <button type="submit" disabled={attachmentLoading || (!messageText.trim() && !attachment)}>
          {attachmentLoading ? 'Lendo...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
