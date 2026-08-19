import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'

import type {
  HarmonyServer,
  MessageAttachment,
  ScreenShareQuality,
  ServerMessage,
  User,
  VoiceParticipant
} from '../../types/harmony'
import { apiRequest } from '../../services/apiClient'
import { fileToAttachment } from '../../utils/media'
import { Avatar } from '../common/Avatar'
import { MessageAttachmentView } from '../common/MessageAttachmentView'
import { Modal } from '../common/Modal'
import { ContextMenu } from '../common/ContextMenu'
import { CopyIcon, MessageIcon, SettingsIcon, UsersIcon } from '../common/Icons'
import { VoiceRoom } from '../voice/VoiceRoom'
import type { ActiveScreenShare } from '../../hooks/useScreenShare'
import { useVoicePresence } from '../../hooks/useVoicePresence'
import { CallTimer } from '../voice/CallTimer'

export function ServerScreen({
  server,
  user,
  friends,
  sendFriendRequest,
  muted,
  deafened,
  voiceConnected,
  voiceConnecting,
  voiceParticipants,
  connectedServerId,
  connectedChannelId,
  participantVolumes,
  screenShareVolumes,
  selfMicGain,
  setParticipantVolume,
  setScreenShareVolume,
  setSelfMicGain,
  screenSharing,
  screenShareStarting,
  screenShares,
  selectedScreenShareIdentity,
  selectScreenShare,
  screenQuality,
  connectVoice,
  disconnectVoice,
  toggleMicrophone,
  toggleDeafen,
  openScreenPicker,
  stopScreenShare,
  copyInvite,
  onServerChange,
  onServerDeleted
}: {
  server: HarmonyServer
  user: User | null
  friends: User[]
  sendFriendRequest: (username: string) => Promise<unknown> | unknown
  muted: boolean
  deafened: boolean
  voiceConnected: boolean
  voiceConnecting: boolean
  voiceParticipants: VoiceParticipant[]
  connectedServerId: string
  connectedChannelId: string
  participantVolumes: Record<string, number>
  screenShareVolumes: Record<string, number>
  selfMicGain: number
  setParticipantVolume: (identity: string, volume: number) => void
  setScreenShareVolume: (identity: string, volume: number) => void
  setSelfMicGain: (gain: number) => void
  screenSharing: boolean
  screenShareStarting: boolean
  screenShares: ActiveScreenShare[]
  selectedScreenShareIdentity: string
  selectScreenShare: (identity: string) => void
  screenQuality: ScreenShareQuality
  connectVoice: (channelId: string) => Promise<void> | void
  disconnectVoice: () => Promise<void> | void
  toggleMicrophone: () => void
  toggleDeafen: () => void
  openScreenPicker: () => void
  stopScreenShare: () => void
  copyInvite: () => void
  onServerChange: (server: HarmonyServer) => void
  onServerDeleted: () => void
}) {
  const channels = server.channels ?? []
  const voiceChannels = channels.filter((channel) => channel.type === 'voice')
  const textChannels = channels.filter((channel) => channel.type === 'text')
  const connectedHere = voiceConnected && connectedServerId === server.id

  const [activeVoiceId, setActiveVoiceId] = useState('')
  const [activeTextId, setActiveTextId] = useState(textChannels[0]?.id ?? '')
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channelType, setChannelType] = useState<'voice' | 'text'>('text')
  const [channelName, setChannelName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [serverName, setServerName] = useState(server.name)
  const [serverIcon, setServerIcon] = useState(server.iconUrl ?? '')
  const [chatMessages, setChatMessages] = useState<ServerMessage[]>([])
  const [chatText, setChatText] = useState('')
  const [chatAttachment, setChatAttachment] = useState<MessageAttachment | null>(null)
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const [members, setMembers] = useState<Array<User & { role?: string }>>([])
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({})
  const [serverMenu, setServerMenu] = useState<{ x: number; y: number } | null>(null)
  const [textMenu, setTextMenu] = useState<{ x: number; y: number; channelId: string; name: string } | null>(null)
  const [quickMessageChannel, setQuickMessageChannel] = useState<{ id: string; name: string } | null>(null)
  const [quickMessage, setQuickMessage] = useState('')

  const { presence, refresh: refreshVoicePresence } = useVoicePresence(server.id)

  const isOwner = user?.id === server.ownerId

  const refreshServer = useCallback(async () => {
    const data = await apiRequest(`/servers/${server.id}`)
    onServerChange(data.server)
    setMembers(data.members ?? [])
  }, [server.id, onServerChange])

  const loadUnread = useCallback(async () => {
    try {
      const data = await apiRequest(`/servers/${server.id}/unread`)
      setUnreadByChannel(data.unread ?? {})
    } catch {}
  }, [server.id])

  const loadChat = useCallback(async () => {
    if (!activeTextId) {
      setChatMessages([])
      return
    }

    const data = await apiRequest(`/servers/${server.id}/channels/${activeTextId}/messages`)
    setChatMessages(data.messages ?? [])
    setUnreadByChannel((current) => ({ ...current, [activeTextId]: 0 }))
  }, [server.id, activeTextId])

  useEffect(() => {
    setServerName(server.name)
    setServerIcon(server.iconUrl ?? '')
  }, [server.id, server.name, server.iconUrl])

  useEffect(() => {
    void refreshServer()
    void loadUnread()
    void refreshVoicePresence()
  }, [server.id, refreshServer, loadUnread, refreshVoicePresence])

  useEffect(() => {
    if (connectedHere && connectedChannelId) {
      setActiveTextId('')
      setActiveVoiceId(connectedChannelId)
      return
    }

    setActiveVoiceId('')
    setActiveTextId(textChannels[0]?.id ?? '')
  }, [server.id, connectedHere, connectedChannelId])

  useEffect(() => {
    if (activeTextId && !activeVoiceId) void loadChat()
  }, [activeTextId, activeVoiceId, loadChat])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadUnread()
      if (activeTextId && !activeVoiceId) void loadChat()
    }, 1500)

    return () => window.clearInterval(interval)
  }, [activeTextId, activeVoiceId, loadChat, loadUnread])

  async function createChannel() {
    if (!channelName.trim()) return

    const data = await apiRequest(`/servers/${server.id}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name: channelName, type: channelType })
    })

    onServerChange(data.server)
    setChannelName('')
    setShowChannelModal(false)

    if (channelType === 'text') {
      setActiveVoiceId('')
      setActiveTextId(data.channel.id)
    } else {
      setActiveTextId('')
      setActiveVoiceId(data.channel.id)
    }
  }

  async function removeChannel(channelId: string) {
    if (!confirm('Excluir este canal?')) return

    const data = await apiRequest(`/servers/${server.id}/channels/${channelId}`, {
      method: 'DELETE'
    })

    onServerChange(data.server)
    if (activeTextId === channelId) setActiveTextId('')
    if (activeVoiceId === channelId) setActiveVoiceId('')
    void loadUnread()
  }

  async function pickChatAttachment(file?: File) {
    if (!file) return

    try {
      setAttachmentLoading(true)
      setChatAttachment(await fileToAttachment(file))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.')
    } finally {
      setAttachmentLoading(false)
    }
  }

  async function sendServerMessage(event: FormEvent) {
    event.preventDefault()
    if (!activeTextId || (!chatText.trim() && !chatAttachment)) return

    const text = chatText.trim()
    const attachment = chatAttachment
    setChatText('')
    setChatAttachment(null)

    try {
      await apiRequest(`/servers/${server.id}/channels/${activeTextId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text, attachment })
      })
      await loadChat()
      await loadUnread()
    } catch (error) {
      setChatText(text)
      setChatAttachment(attachment)
      alert(error instanceof Error ? error.message : 'Erro ao enviar mensagem.')
    }
  }

  async function sendQuickMessage(event: FormEvent) {
    event.preventDefault()
    if (!quickMessageChannel || !quickMessage.trim()) return

    const content = quickMessage.trim()
    try {
      await apiRequest(`/servers/${server.id}/channels/${quickMessageChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })
      setQuickMessage('')
      setQuickMessageChannel(null)
      await loadUnread()
      if (activeTextId === quickMessageChannel.id) await loadChat()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao enviar mensagem rápida.')
    }
  }

  async function saveServer() {
    if (!isOwner) return
    const data = await apiRequest(`/servers/${server.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: serverName, iconUrl: serverIcon })
    })

    onServerChange(data.server)
    setShowSettings(false)
  }

  async function deleteServer() {
    if (!isOwner || !confirm(`Excluir "${server.name}" permanentemente?`)) return

    try {
      await apiRequest(`/servers/${server.id}`, { method: 'DELETE' })
      onServerDeleted()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível excluir o servidor.')
    }
  }

  async function changeRole(memberId: string, role: string) {
    if (!isOwner) return
    await apiRequest(`/servers/${server.id}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    })
    await refreshServer()
  }

  function pickIcon(file?: File) {
    if (!file || !isOwner) return
    if (file.size > 1024 * 1024) return alert('Use uma imagem de até 1 MB.')

    const reader = new FileReader()
    reader.onload = () => setServerIcon(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  function openServerContext(event: MouseEvent) {
    event.preventDefault()
    setServerMenu({ x: event.clientX, y: event.clientY })
  }

  const activeText = textChannels.find((channel) => channel.id === activeTextId)
  const activeVoice = voiceChannels.find((channel) => channel.id === activeVoiceId)
  const activePresence = activeVoice ? presence[activeVoice.id] : undefined

  const channelParticipants = useCallback(
    (channelId: string) => {
      const isCurrent = connectedHere && connectedChannelId === channelId
      if (isCurrent) return voiceParticipants

      return (presence[channelId]?.participants ?? []).map((participant) => ({
        identity: participant.identity,
        name: participant.name,
        username: participant.username,
        avatarUrl: participant.avatarUrl,
        isSpeaking: false,
        isLocal: participant.identity === user?.id,
        isMuted: participant.isMuted,
        isDeafened: participant.isDeafened
      } satisfies VoiceParticipant))
    },
    [connectedHere, connectedChannelId, presence, user?.id, voiceParticipants]
  )

  return (
    <div className="server-page discord-server-page">
      <div className="server-layout">
        <aside className="channels discord-channels">
          <div className="compact-server-head" onContextMenu={openServerContext}>
            <div className="compact-server-title">
              <Avatar name={server.name} image={server.iconUrl} />
              <strong title={server.name}>{server.name}</strong>
            </div>
            <div className="compact-server-actions">
              <button className="compact-invite" title={`Convite: ${server.inviteCode}`} onClick={copyInvite}>＋</button>
              {isOwner && <button className="compact-settings" title="Configurações" onClick={() => setShowSettings(true)}>⚙</button>}
            </div>
          </div>

          <div className="channel-category">
            <span>CANAIS DE TEXTO</span>
            {isOwner && <button onClick={() => { setChannelType('text'); setShowChannelModal(true) }}>+</button>}
          </div>

          {textChannels.map((channel) => {
            const unread = unreadByChannel[channel.id] || 0
            const selected = activeTextId === channel.id

            return (
              <div className="channel-row" key={channel.id}>
                <button
                  className={`${selected ? 'channel active' : 'channel'} ${unread > 0 && !selected ? 'channel unread' : ''}`}
                  onClick={() => {
                    setActiveVoiceId('')
                    setActiveTextId(channel.id)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setTextMenu({ x: event.clientX, y: event.clientY, channelId: channel.id, name: channel.name })
                  }}
                >
                  <span># {channel.name}</span>
                  {unread > 0 && !selected && <small className="unread-count">{unread}</small>}
                </button>

                {isOwner && textChannels.length > 1 && (
                  <button className="channel-delete" onClick={(event) => { event.stopPropagation(); void removeChannel(channel.id) }}>✕</button>
                )}
              </div>
            )
          })}

          <div className="channel-category voice-category">
            <span>CANAIS DE VOZ</span>
            {isOwner && <button onClick={() => { setChannelType('voice'); setShowChannelModal(true) }}>+</button>}
          </div>

          {voiceChannels.map((channel) => {
            const isThisConnectedCall = connectedHere && connectedChannelId === channel.id
            const participantsHere = channelParticipants(channel.id)
            const channelPresence = presence[channel.id]

            return (
              <div className="voice-channel-block" key={channel.id}>
                <div className="channel-row">
                  <button
                    className={activeVoiceId === channel.id ? 'channel active' : 'channel'}
                    onClick={async () => {
                      setActiveTextId('')
                      setActiveVoiceId(channel.id)

                      if (isThisConnectedCall) return
                      if (voiceConnected) await disconnectVoice()
                      await connectVoice(channel.id)
                      window.setTimeout(() => void refreshVoicePresence(), 400)
                    }}
                  >
                    <span>🔊 {channel.name}</span>
                    {participantsHere.length > 0 && (
                      <small className="channel-live">
                        ● {participantsHere.length}
                        <CallTimer startedAt={channelPresence?.startedAt} />
                      </small>
                    )}
                  </button>

                  {isOwner && voiceChannels.length > 1 && (
                    <button className="channel-delete" onClick={(event) => { event.stopPropagation(); void removeChannel(channel.id) }}>✕</button>
                  )}
                </div>

                {participantsHere.length > 0 && (
                  <div className="channel-participants">
                    {participantsHere.map((participant) => (
                      <div
                        key={participant.identity}
                        className={`channel-participant${participant.isSpeaking ? ' speaking' : ''}${participant.isMuted || participant.isDeafened ? ' muted' : ''}`}
                      >
                        <Avatar name={participant.name} image={participant.avatarUrl} />
                        <span>{participant.name}</span>
                        {(participant.isMuted || participant.isDeafened) && (
                          <small className="channel-participant-muted">{participant.isDeafened ? '🎧' : '🎙'}</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        {activeText ? (
          <section className="server-chat">
            <header className="server-chat-header">
              <strong># {activeText.name}</strong>
              <span>Converse com os membros do servidor</span>
            </header>

            <div className="server-chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <b>Bem-vindo a #{activeText.name}</b>
                  <span>Este é o começo deste canal.</span>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div className="server-message" key={message.id}>
                    <Avatar name={message.author?.displayName || '?'} image={message.author?.avatarUrl} />
                    <div>
                      <div className="server-message-meta">
                        <strong>{message.author?.displayName || 'Usuário'}</strong>
                        <small>{new Date(message.createdAt).toLocaleString()}</small>
                      </div>
                      {message.content && <p>{message.content}</p>}
                      <MessageAttachmentView attachment={message.attachment} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {chatAttachment && (
              <div className="composer-attachment-preview server-attachment-preview">
                <MessageAttachmentView attachment={chatAttachment} />
                <div>
                  <strong>
                    {chatAttachment.kind === 'sticker'
                      ? 'GIF / figurinha'
                      : chatAttachment.kind === 'video'
                        ? 'Vídeo'
                        : 'Imagem'}
                  </strong>
                  <span>{chatAttachment.name}</span>
                </div>
                <button type="button" onClick={() => setChatAttachment(null)}>×</button>
              </div>
            )}

            <form className="server-chat-input" onSubmit={(event) => void sendServerMessage(event)}>
              <label className="composer-file-button" title="Enviar imagem, vídeo ou GIF">
                +
                <input
                  type="file"
                  accept="image/*,video/*,.gif"
                  onChange={(event) => {
                    void pickChatAttachment(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              <input
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                placeholder={`Conversar em #${activeText.name}`}
              />
              <button type="submit" disabled={attachmentLoading || (!chatText.trim() && !chatAttachment)}>
                {attachmentLoading ? 'Lendo...' : 'Enviar'}
              </button>
            </form>
          </section>
        ) : (
          <VoiceRoom
            activeVoiceName={activeVoice?.name || 'Canal de voz'}
            activeVoiceId={activeVoice?.id}
            callStartedAt={activePresence?.startedAt}
            muted={muted}
            deafened={deafened}
            voiceConnected={connectedHere}
            voiceConnecting={voiceConnecting}
            voiceParticipants={connectedHere ? voiceParticipants : []}
            participantVolumes={participantVolumes}
            screenShareVolumes={screenShareVolumes}
            selfMicGain={selfMicGain}
            setParticipantVolume={setParticipantVolume}
            setScreenShareVolume={setScreenShareVolume}
            setSelfMicGain={setSelfMicGain}
            screenSharing={connectedHere && screenSharing}
            screenShareStarting={screenShareStarting}
            screenShares={connectedHere ? screenShares : []}
            selectedScreenShareIdentity={selectedScreenShareIdentity}
            selectScreenShare={selectScreenShare}
            screenQuality={screenQuality}
            friends={friends}
            sendFriendRequest={sendFriendRequest}
            connectVoice={connectVoice}
            disconnectVoice={disconnectVoice}
            toggleMicrophone={toggleMicrophone}
            toggleDeafen={toggleDeafen}
            openScreenPicker={openScreenPicker}
            stopScreenShare={stopScreenShare}
          />
        )}
      </div>

      {serverMenu && (
        <ContextMenu x={serverMenu.x} y={serverMenu.y} close={() => setServerMenu(null)}>
          <strong>{server.name}</strong>
          {isOwner && (
            <button type="button" className="context-menu-with-icon" onClick={() => { setServerMenu(null); setShowSettings(true) }}>
              <SettingsIcon /> Configurações do servidor
            </button>
          )}
          <button type="button" className="context-menu-with-icon" onClick={() => { copyInvite(); setServerMenu(null) }}>
            <CopyIcon /> Copiar convite
          </button>
          <button type="button" className="context-menu-with-icon" onClick={() => { setServerMenu(null); setShowSettings(true) }}>
            <UsersIcon /> Membros do servidor
          </button>
        </ContextMenu>
      )}

      {textMenu && (
        <ContextMenu x={textMenu.x} y={textMenu.y} close={() => setTextMenu(null)}>
          <strong># {textMenu.name}</strong>
          <button
            type="button"
            className="context-menu-with-icon"
            onClick={() => {
              setQuickMessageChannel({ id: textMenu.channelId, name: textMenu.name })
              setTextMenu(null)
            }}
          >
            <MessageIcon /> Mensagem rápida
          </button>
        </ContextMenu>
      )}

      {quickMessageChannel && (
        <Modal title={`Mensagem rápida em #${quickMessageChannel.name}`} close={() => setQuickMessageChannel(null)}>
          <form className="quick-message-form" onSubmit={(event) => void sendQuickMessage(event)}>
            <textarea
              autoFocus
              value={quickMessage}
              onChange={(event) => setQuickMessage(event.target.value)}
              placeholder="Escreva sem precisar abrir o canal..."
              maxLength={4000}
            />
            <button className="primary" type="submit" disabled={!quickMessage.trim()}>Enviar</button>
          </form>
        </Modal>
      )}

      {showChannelModal && (
        <Modal title={`Criar canal de ${channelType === 'voice' ? 'voz' : 'texto'}`} close={() => setShowChannelModal(false)}>
          <input className="modal-input" value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Nome do canal" />
          <button className="primary" onClick={() => void createChannel()}>Criar canal</button>
        </Modal>
      )}

      {showSettings && (
        <Modal title={isOwner ? 'Configurações do servidor' : 'Membros do servidor'} close={() => setShowSettings(false)}>
          {isOwner && (
            <>
              <label className="settings-label">Nome do servidor</label>
              <input className="modal-input" value={serverName} onChange={(event) => setServerName(event.target.value)} />

              <label className="settings-label">Foto do servidor</label>
              <input className="modal-file" type="file" accept="image/*" onChange={(event) => pickIcon(event.target.files?.[0])} />
              {serverIcon && <img className="settings-image-preview" src={serverIcon} alt="Prévia" />}
              <button className="primary" onClick={() => void saveServer()}>Salvar alterações</button>
            </>
          )}

          <div className="settings-members">
            <h3>Membros e cargos</h3>
            {members.map((member) => (
              <div className="settings-member" key={member.id}>
                <Avatar name={member.displayName} image={member.avatarUrl} />
                <div>
                  <strong>{member.displayName}</strong>
                  <small>@{member.username}</small>
                </div>
                {member.id === server.ownerId ? (
                  <span className="owner-badge">DONO</span>
                ) : isOwner ? (
                  <select value={member.role || 'member'} onChange={(event) => void changeRole(member.id, event.target.value)}>
                    <option value="member">Membro</option>
                    <option value="moderator">Moderador</option>
                    <option value="admin">Administrador</option>
                  </select>
                ) : (
                  <span className="member-role-readonly">{member.role || 'membro'}</span>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <button className="danger-button" onClick={() => void deleteServer()}>
              Excluir servidor permanentemente
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
