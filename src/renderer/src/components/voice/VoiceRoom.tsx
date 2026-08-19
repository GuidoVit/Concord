import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent
} from 'react'
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client'

import type {
  ScreenShareQuality,
  User,
  VoiceParticipant
} from '../../types/harmony'
import {
  SCREEN_SHARE_PROFILES,
  type ActiveScreenShare
} from '../../hooks/useScreenShare'
import { ContextMenu } from '../common/ContextMenu'
import {
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
  UserPlusIcon,
  ZoomInIcon
} from '../common/Icons'
import { CallTimer } from './CallTimer'

interface VoiceRoomProps {
  activeVoiceName: string
  activeVoiceId?: string
  callStartedAt?: string | null

  muted: boolean
  deafened: boolean

  voiceConnected: boolean
  voiceConnecting: boolean
  voiceParticipants: VoiceParticipant[]

  participantVolumes: Record<string, number>
  screenShareVolumes: Record<string, number>
  selfMicGain: number

  screenSharing: boolean
  screenShareStarting: boolean

  screenShares: ActiveScreenShare[]
  selectedScreenShareIdentity: string
  selectScreenShare: (identity: string) => void

  screenQuality: ScreenShareQuality

  friends: User[]
  sendFriendRequest: (username: string) => Promise<unknown> | unknown

  connectVoice: (channelId: string) => void
  disconnectVoice: () => void

  toggleMicrophone: () => void
  toggleDeafen: () => void

  setParticipantVolume: (identity: string, volume: number) => void
  setScreenShareVolume: (identity: string, volume: number) => void
  setSelfMicGain: (gain: number) => void

  openScreenPicker: () => void
  stopScreenShare: () => void
}

type VoiceMenu = {
  kind: 'participant' | 'self' | 'screen'
  identity: string
  label: string
  username?: string
  x: number
  y: number
} | null

function ScreenVideo({
  track,
  className,
  zoom = 1,
  originX = 50,
  originY = 50
}: {
  track: RemoteVideoTrack | LocalVideoTrack
  className: string
  zoom?: number
  originX?: number
  originY?: number
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    video.autoplay = true
    video.playsInline = true
    video.muted = true

    try {
      track.attach(video)
      void video.play().catch(() => {})
    } catch (error) {
      console.warn('Harmony: não foi possível anexar a transmissão:', error)
    }

    return () => {
      try { track.detach(video) } catch {}
    }
  }, [track])

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      playsInline
      muted
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: `${originX}% ${originY}%`
      }}
    />
  )
}

export function VoiceRoom(props: VoiceRoomProps) {
  const {
    activeVoiceName,
    activeVoiceId,
    callStartedAt,
    muted,
    deafened,
    voiceConnected,
    voiceConnecting,
    voiceParticipants,
    participantVolumes,
    screenShareVolumes,
    selfMicGain,
    screenSharing,
    screenShareStarting,
    screenShares,
    selectedScreenShareIdentity,
    selectScreenShare,
    screenQuality,
    friends,
    sendFriendRequest,
    connectVoice,
    disconnectVoice,
    toggleMicrophone,
    toggleDeafen,
    setParticipantVolume,
    setScreenShareVolume,
    setSelfMicGain,
    openScreenPicker,
    stopScreenShare
  } = props

  const [menu, setMenu] = useState<VoiceMenu>(null)
  const [focusShare, setFocusShare] = useState(false)
  const [zoomByIdentity, setZoomByIdentity] = useState<
    Record<string, { scale: number; originX: number; originY: number }>
  >({})

  const profile = SCREEN_SHARE_PROFILES.find((item) => item.id === screenQuality)

  const selectedShare = useMemo(
    () =>
      screenShares.find((share) => share.identity === selectedScreenShareIdentity) ||
      screenShares[0] ||
      null,
    [screenShares, selectedScreenShareIdentity]
  )

  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends])
  const friendUsernames = useMemo(
    () => new Set(friends.map((friend) => friend.username.toLowerCase())),
    [friends]
  )

  useEffect(() => {
    if (!selectedShare) setFocusShare(false)
  }, [selectedShare])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusShare(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openParticipantMenu = (event: MouseEvent, participant: VoiceParticipant) => {
    event.preventDefault()
    event.stopPropagation()

    setMenu({
      kind: participant.isLocal ? 'self' : 'participant',
      identity: participant.identity,
      label: participant.name,
      username: participant.username,
      x: event.clientX,
      y: event.clientY
    })
  }

  const openScreenMenu = (event: MouseEvent, share: ActiveScreenShare) => {
    if (share.isLocal) return
    event.preventDefault()
    event.stopPropagation()

    setMenu({
      kind: 'screen',
      identity: share.identity,
      label: `Tela de ${share.name}`,
      x: event.clientX,
      y: event.clientY
    })
  }

  const menuVolume = menu
    ? menu.kind === 'participant'
      ? participantVolumes[menu.identity] ?? 1
      : menu.kind === 'screen'
        ? screenShareVolumes[menu.identity] ?? 1
        : selfMicGain
    : 1

  const updateMenuVolume = (value: number) => {
    if (!menu) return
    if (menu.kind === 'participant') setParticipantVolume(menu.identity, value)
    else if (menu.kind === 'screen') setScreenShareVolume(menu.identity, value)
    else setSelfMicGain(value)
  }

  const currentZoomState =
    selectedShare
      ? (
          zoomByIdentity[selectedShare.identity] ?? {
            scale: 1,
            originX: 50,
            originY: 50
          }
        )
      : {
          scale: 1,
          originX: 50,
          originY: 50
        }

  const zoomShare = (event: WheelEvent<HTMLDivElement>) => {
    if (!selectedShare) return

    event.preventDefault()
    event.stopPropagation()

    const viewport =
      event.currentTarget.querySelector<HTMLElement>('.screen-share-viewport')

    if (!viewport) return

    const rect = viewport.getBoundingClientRect()

    const originX =
      Math.max(
        0,
        Math.min(
          100,
          ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100
        )
      )

    const originY =
      Math.max(
        0,
        Math.min(
          100,
          ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100
        )
      )

    const delta = event.deltaY < 0 ? 0.12 : -0.12

    setZoomByIdentity((current) => {
      const previous =
        current[selectedShare.identity] ?? {
          scale: 1,
          originX: 50,
          originY: 50
        }

      const nextScale =
        Math.max(
          1,
          Math.min(
            3,
            Number((previous.scale + delta).toFixed(2))
          )
        )

      // Em 100% a transmissão sempre volta exatamente para o centro.
      // Acima de 100%, o ponto sob o cursor continua sendo a origem do zoom.
      if (nextScale <= 1) {
        return {
          ...current,
          [selectedShare.identity]: {
            scale: 1,
            originX: 50,
            originY: 50
          }
        }
      }

      return {
        ...current,
        [selectedShare.identity]: {
          scale: nextScale,
          originX,
          originY
        }
      }
    })
  }

  const hasShares = screenShares.length > 0
  const showShareRail = screenShares.length > 1 && !focusShare

  return (
    <section className={`voice-room${focusShare ? ' share-focus-mode' : ''}`}>
      <div className={`voice-center${hasShares ? ' has-screen-shares' : ''}`}>
        {!hasShares && (
          <>
            <div className={voiceConnected ? 'voice-orbit connected' : 'voice-orbit'}>
              {voiceConnected ? '◉' : '○'}
            </div>
            <h2>{activeVoiceName || 'Geral'}</h2>
            {voiceConnected && <CallTimer startedAt={callStartedAt} />}
          </>
        )}

        {!voiceConnected ? (
          <>
            <p>Entre no canal para conversar com a galera.</p>
            <div className="voice-controls">
              <button
                className="voice-button join-call"
                onClick={() => activeVoiceId && connectVoice(activeVoiceId)}
                disabled={voiceConnecting || !activeVoiceId}
              >
                {voiceConnecting ? 'Conectando...' : 'Entrar na call'}
              </button>
            </div>
          </>
        ) : (
          <>
            {selectedShare && (
              <div className={`screen-share-layout${showShareRail ? ' with-rail' : ''}`}>
                <div
                  className="screen-share-stage"
                  onContextMenu={(event) => openScreenMenu(event, selectedShare)}
                  onClick={() => setFocusShare((current) => !current)}
                  onWheel={zoomShare}
                  title={focusShare ? 'Clique para voltar' : 'Clique para focar • Scroll para zoom'}
                >
                  <div className="screen-share-head">
                    <div>
                      <strong>{selectedShare.name}</strong>
                      <span>está compartilhando</span>
                    </div>
                    <div className="screen-share-head-right">
                      <CallTimer startedAt={callStartedAt} />
                      <span className="stream-quality">
                        {profile
                          ? `${profile.height}p • ${profile.frameRate} FPS`
                          : 'Transmissão'}
                      </span>
                    </div>
                  </div>

                  <div className="screen-share-viewport">
                    <ScreenVideo
                      track={selectedShare.videoTrack}
                      className="screen-share-video"
                      zoom={currentZoomState.scale}
                      originX={currentZoomState.originX}
                      originY={currentZoomState.originY}
                    />
                    <div className="screen-zoom-indicator">
                      <ZoomInIcon /> {Math.round(currentZoomState.scale * 100)}%
                    </div>
                  </div>
                </div>

                {showShareRail && (
                  <aside className="screen-share-rail" aria-label="Transmissões ativas">
                    {screenShares.map((share, index) => {
                      const selected = share.identity === selectedShare.identity
                      return (
                        <button
                          key={share.identity}
                          type="button"
                          className={`screen-share-preview-card${selected ? ' selected' : ''}`}
                          title={`Assistir tela de ${share.name}`}
                          onClick={() => selectScreenShare(share.identity)}
                          onContextMenu={(event) => openScreenMenu(event, share)}
                        >
                          <div className="screen-share-preview-frame">
                            <ScreenVideo
                              track={share.videoTrack}
                              className="screen-share-preview-video"
                            />
                            <span className="screen-share-number">{index + 1}</span>
                          </div>
                          <div className="screen-share-preview-name">
                            <span>{share.name}</span>
                            {selected && <b>ATIVA</b>}
                          </div>
                        </button>
                      )
                    })}
                  </aside>
                )}
              </div>
            )}

            {!focusShare && (
              <>
                <div className="voice-participant-grid">
                  {voiceParticipants.map((participant) => {
                    const mutedParticipant = Boolean(participant.isMuted || participant.isDeafened)
                    const classes = [
                      'voice-person',
                      participant.isSpeaking && !mutedParticipant ? 'speaking' : '',
                      mutedParticipant ? 'muted-participant' : '',
                      participant.isDeafened ? 'deafened-participant' : ''
                    ].filter(Boolean).join(' ')

                    return (
                      <div
                        key={participant.identity}
                        className={classes}
                        onContextMenu={(event) => openParticipantMenu(event, participant)}
                      >
                        <div className="voice-avatar-wrap">
                          <div className="voice-avatar">
                            {participant.avatarUrl ? (
                              <img src={participant.avatarUrl} alt={participant.name} />
                            ) : (
                              participant.name.charAt(0).toUpperCase()
                            )}
                          </div>

                          {(participant.isMuted || participant.isDeafened) && (
                            <div className="voice-status-icons">
                              {participant.isMuted && (
                                <span
                                  className="voice-status-icon"
                                  title="Microfone mutado"
                                  aria-label="Microfone mutado"
                                >
                                  <MicOffIcon />
                                </span>
                              )}

                              {participant.isDeafened && (
                                <span
                                  className="voice-status-icon voice-status-icon-audio"
                                  title="Áudio desligado"
                                  aria-label="Áudio desligado"
                                >
                                  <HeadphonesOffIcon />
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <strong className="voice-person-name">{participant.name}</strong>
                        <span>
                          {participant.isDeafened
                            ? 'Áudio desligado'
                            : participant.isMuted
                              ? 'Microfone mutado'
                              : participant.isSpeaking
                                ? 'Falando'
                                : 'Na call'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="voice-controls icon-controls">
                  <button
                    className={`voice-icon-button${muted ? ' off' : ''}`}
                    onClick={toggleMicrophone}
                    title={muted ? 'Ativar microfone' : 'Mutar microfone'}
                    disabled={deafened}
                    aria-label={muted ? 'Ativar microfone' : 'Mutar microfone'}
                  >
                    {muted ? <MicOffIcon /> : <MicIcon />}
                  </button>

                  <button
                    className={`voice-icon-button${deafened ? ' off' : ''}`}
                    onClick={toggleDeafen}
                    title={deafened ? 'Ativar áudio dos usuários' : 'Desativar áudio dos usuários'}
                    aria-label={deafened ? 'Ativar áudio dos usuários' : 'Desativar áudio dos usuários'}
                  >
                    {deafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
                  </button>

                  <button
                    className={`voice-icon-button${screenSharing ? ' screen-active' : ''}`}
                    disabled={screenShareStarting}
                    onClick={screenSharing ? stopScreenShare : openScreenPicker}
                    title={screenSharing ? 'Parar transmissão' : 'Compartilhar tela'}
                    aria-label={screenSharing ? 'Parar transmissão' : 'Compartilhar tela'}
                  >
                    <ScreenIcon />
                  </button>

                  <button
                    className="voice-icon-button leave"
                    onClick={disconnectVoice}
                    title="Sair da call"
                    aria-label="Sair da call"
                  >
                    <PhoneOffIcon />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} close={() => setMenu(null)}>
          <strong>{menu.label}</strong>

          <span className="voice-context-label">
            {menu.kind === 'participant'
              ? 'Volume do usuário'
              : menu.kind === 'screen'
                ? 'Volume da transmissão'
                : 'Ganho do seu microfone'}
          </span>

          <div className="voice-context-slider-row">
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={Math.round(menuVolume * 100)}
              onChange={(event) => updateMenuVolume(Number(event.target.value) / 100)}
            />
            <b>{Math.round(menuVolume * 100)}%</b>
          </div>

          <div className="voice-context-scale">
            <span>0%</span>
            <span>100%</span>
            <span>250%</span>
          </div>

          {menu.kind !== 'self' && (
            <button
              type="button"
              onClick={() => updateMenuVolume(menuVolume === 0 ? 1 : 0)}
            >
              {menuVolume === 0 ? 'Restaurar volume' : 'Silenciar para mim'}
            </button>
          )}

          {menu.kind === 'participant' && (
            <button
              type="button"
              className="context-menu-with-icon"
              disabled={
                friendIds.has(menu.identity) ||
                Boolean(menu.username && friendUsernames.has(menu.username.toLowerCase())) ||
                !menu.username
              }
              onClick={async () => {
                if (!menu.username) return
                try {
                  await sendFriendRequest(menu.username)
                  setMenu(null)
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.')
                }
              }}
            >
              <UserPlusIcon />
              {friendIds.has(menu.identity) || Boolean(menu.username && friendUsernames.has(menu.username.toLowerCase()))
                ? 'Já é seu amigo'
                : menu.username
                  ? 'Adicionar amigo'
                  : 'Usuário sem nome disponível'}
            </button>
          )}
        </ContextMenu>
      )}
    </section>
  )
}
