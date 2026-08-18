import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client'

import type {
  ScreenShareQuality,
  VoiceParticipant
} from '../../types/concord'
import {
  SCREEN_SHARE_PROFILES,
  type ActiveScreenShare
} from '../../hooks/useScreenShare'

interface VoiceRoomProps {
  activeVoiceName: string
  activeVoiceId?: string

  muted: boolean
  deafened: boolean

  voiceConnected: boolean
  voiceConnecting: boolean
  voiceParticipants: VoiceParticipant[]

  participantVolumes: Record<string, number>
  screenShareVolumes: Record<string, number>

  screenSharing: boolean
  screenShareStarting: boolean

  screenShares: ActiveScreenShare[]
  selectedScreenShareIdentity: string
  selectScreenShare: (identity: string) => void

  screenQuality: ScreenShareQuality

  connectVoice: (channelId: string) => void
  disconnectVoice: () => void

  toggleMicrophone: () => void
  toggleDeafen: () => void

  setParticipantVolume: (identity: string, volume: number) => void
  setScreenShareVolume: (identity: string, volume: number) => void

  openScreenPicker: () => void
  stopScreenShare: () => void
}

type VolumeMenu =
  | {
      kind: 'participant'
      identity: string
      label: string
      x: number
      y: number
    }
  | {
      kind: 'screen'
      identity: string
      label: string
      x: number
      y: number
    }
  | null

function ScreenVideo({
  track,
  className,
  muted = true
}: {
  track: RemoteVideoTrack | LocalVideoTrack
  className: string
  muted?: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    video.autoplay = true
    video.playsInline = true
    video.muted = muted

    try {
      track.attach(video)
      void video.play().catch(() => {})
    } catch (error) {
      console.warn('Concord: não foi possível anexar a transmissão:', error)
    }

    return () => {
      try {
        track.detach(video)
      } catch {
        // A transmissão pode ter terminado antes do componente desmontar.
      }
    }
  }, [track, muted])

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      playsInline
      muted={muted}
    />
  )
}

export function VoiceRoom(props: VoiceRoomProps) {
  const {
    activeVoiceName,
    activeVoiceId,

    muted,
    deafened,

    voiceConnected,
    voiceConnecting,
    voiceParticipants,

    participantVolumes,
    screenShareVolumes,

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

    setParticipantVolume,
    setScreenShareVolume,

    openScreenPicker,
    stopScreenShare
  } = props

  const [volumeMenu, setVolumeMenu] = useState<VolumeMenu>(null)

  const profile = SCREEN_SHARE_PROFILES.find(
    (item) => item.id === screenQuality
  )

  const selectedShare = useMemo(
    () =>
      screenShares.find(
        (share) => share.identity === selectedScreenShareIdentity
      ) ||
      screenShares[0] ||
      null,
    [screenShares, selectedScreenShareIdentity]
  )

  useEffect(() => {
    const close = () => setVolumeMenu(null)

    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    document.addEventListener('click', close)

    return () => {
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      document.removeEventListener('click', close)
    }
  }, [])

  const openParticipantMenu = (
    event: MouseEvent,
    participant: VoiceParticipant
  ) => {
    if (participant.isLocal) return

    event.preventDefault()
    event.stopPropagation()

    setVolumeMenu({
      kind: 'participant',
      identity: participant.identity,
      label: participant.name,
      x: Math.min(event.clientX, window.innerWidth - 290),
      y: Math.min(event.clientY, window.innerHeight - 190)
    })
  }

  const openScreenMenu = (
    event: MouseEvent,
    share: ActiveScreenShare
  ) => {
    if (share.isLocal) return

    event.preventDefault()
    event.stopPropagation()

    setVolumeMenu({
      kind: 'screen',
      identity: share.identity,
      label: `Tela de ${share.name}`,
      x: Math.min(event.clientX, window.innerWidth - 290),
      y: Math.min(event.clientY, window.innerHeight - 190)
    })
  }

  const menuVolume = volumeMenu
    ? volumeMenu.kind === 'participant'
      ? participantVolumes[volumeMenu.identity] ?? 1
      : screenShareVolumes[volumeMenu.identity] ?? 1
    : 1

  const updateMenuVolume = (value: number) => {
    if (!volumeMenu) return

    if (volumeMenu.kind === 'participant') {
      setParticipantVolume(volumeMenu.identity, value)
    } else {
      setScreenShareVolume(volumeMenu.identity, value)
    }
  }

  const hasShares = screenShares.length > 0
  const showShareRail = screenShares.length > 1

  return (
    <section className="voice-room">
      <div
        className="voice-center"
        style={
          hasShares
            ? {
                width: '100%',
                maxWidth: 'none',
                paddingInline: 20
              }
            : undefined
        }
      >
        {!hasShares && (
          <>
            <div
              className={
                voiceConnected
                  ? 'voice-orbit connected'
                  : 'voice-orbit'
              }
            >
              {voiceConnected ? '◉' : '○'}
            </div>

            <h2>{activeVoiceName || 'Geral'}</h2>
          </>
        )}

        {!voiceConnected ? (
          <>
            <p>Entre no canal para conversar com a galera.</p>

            <div className="voice-controls">
              <button
                className="voice-button share"
                onClick={() =>
                  activeVoiceId &&
                  connectVoice(activeVoiceId)
                }
                disabled={
                  voiceConnecting ||
                  !activeVoiceId
                }
              >
                {voiceConnecting
                  ? 'Conectando...'
                  : 'Entrar na call'}
              </button>
            </div>
          </>
        ) : (
          <>
            {selectedShare && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: showShareRail
                    ? 'minmax(0, 1fr) 190px'
                    : 'minmax(0, 1fr)',
                  gap: 12,
                  width: '100%',
                  maxWidth: 1280,
                  minHeight: 0,
                  alignItems: 'stretch'
                }}
              >
                <div
                  className="screen-share-stage"
                  onContextMenu={(event) =>
                    openScreenMenu(event, selectedShare)
                  }
                  style={{
                    minWidth: 0,
                    margin: 0
                  }}
                >
                  <div className="screen-share-head">
                    <div>
                      <strong>{selectedShare.name}</strong>
                      <span>está compartilhando</span>
                    </div>

                    <span className="stream-quality">
                      {profile
                        ? `${profile.height}p • ${profile.frameRate} FPS`
                        : 'Transmissão'}
                    </span>
                  </div>

                  <ScreenVideo
                    track={selectedShare.videoTrack}
                    className="screen-share-video"
                  />
                </div>

                {showShareRail && (
                  <aside
                    aria-label="Transmissões ativas"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      overflowY: 'auto',
                      maxHeight: 560,
                      minWidth: 0,
                      paddingRight: 2
                    }}
                  >
                    {screenShares.map((share, index) => {
                      const selected =
                        share.identity === selectedShare.identity

                      return (
                        <button
                          key={share.identity}
                          type="button"
                          title={`Assistir tela de ${share.name}`}
                          onClick={() =>
                            selectScreenShare(share.identity)
                          }
                          onContextMenu={(event) =>
                            openScreenMenu(event, share)
                          }
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: 6,
                            borderRadius: 12,
                            border: selected
                              ? '2px solid #35e6b4'
                              : '1px solid rgba(255,255,255,.12)',
                            background: selected
                              ? 'rgba(53,230,180,.09)'
                              : '#10161a',
                            color: 'inherit',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: selected
                              ? '0 0 0 1px rgba(53,230,180,.15)'
                              : 'none'
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              overflow: 'hidden',
                              aspectRatio: '16 / 9',
                              borderRadius: 8,
                              background: '#050708'
                            }}
                          >
                            <ScreenVideo
                              track={share.videoTrack}
                              className="screen-share-preview-video"
                            />

                            <span
                              style={{
                                position: 'absolute',
                                left: 6,
                                top: 6,
                                display: 'grid',
                                placeItems: 'center',
                                minWidth: 22,
                                height: 22,
                                paddingInline: 5,
                                borderRadius: 999,
                                background: 'rgba(0,0,0,.72)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 800
                              }}
                            >
                              {index + 1}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 6,
                              minWidth: 0
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 12,
                                fontWeight: selected ? 800 : 650
                              }}
                            >
                              {share.name}
                            </span>

                            {selected && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: 9,
                                  fontWeight: 900,
                                  color: '#35e6b4'
                                }}
                              >
                                ATIVA
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </aside>
                )}
              </div>
            )}

            <div className="voice-participant-grid">
              {voiceParticipants.map((participant) => (
                <div
                  key={participant.identity}
                  className={
                    participant.isSpeaking
                      ? 'voice-person speaking'
                      : 'voice-person'
                  }
                  onContextMenu={(event) =>
                    openParticipantMenu(event, participant)
                  }
                >
                  <div className="voice-avatar">
                    {participant.avatarUrl ? (
                      <img
                        src={participant.avatarUrl}
                        alt={participant.name}
                      />
                    ) : (
                      participant.name
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <strong className="voice-person-name">
                    {participant.name}
                  </strong>

                  <span>
                    {participant.isSpeaking
                      ? 'Falando'
                      : 'Na call'}
                  </span>
                </div>
              ))}
            </div>

            <div className="voice-controls">
              <button
                className={
                  muted
                    ? 'voice-button off'
                    : 'voice-button'
                }
                onClick={toggleMicrophone}
              >
                {muted
                  ? 'Mic desligado'
                  : 'Microfone'}
              </button>

              <button
                className={
                  deafened
                    ? 'voice-button off'
                    : 'voice-button'
                }
                onClick={toggleDeafen}
              >
                {deafened
                  ? 'Áudio desligado'
                  : 'Áudio'}
              </button>

              <button
                className={
                  screenSharing
                    ? 'voice-button screen-active'
                    : 'voice-button screen-share'
                }
                disabled={screenShareStarting}
                onClick={
                  screenSharing
                    ? stopScreenShare
                    : openScreenPicker
                }
              >
                {screenShareStarting
                  ? 'Preparando...'
                  : screenSharing
                    ? 'Parar transmissão'
                    : 'Compartilhar tela'}
              </button>

              <button
                className="voice-button leave"
                onClick={disconnectVoice}
              >
                Sair da call
              </button>
            </div>
          </>
        )}
      </div>

      {volumeMenu && (
        <div
          className="voice-context-menu"
          style={{
            left: volumeMenu.x,
            top: volumeMenu.y
          }}
          onClick={(event) =>
            event.stopPropagation()
          }
          onContextMenu={(event) =>
            event.preventDefault()
          }
        >
          <strong>{volumeMenu.label}</strong>

          <span className="voice-context-label">
            {volumeMenu.kind === 'participant'
              ? 'Volume do usuário'
              : 'Volume da transmissão'}
          </span>

          <div className="voice-context-slider-row">
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={Math.round(menuVolume * 100)}
              onChange={(event) =>
                updateMenuVolume(
                  Number(event.target.value) / 100
                )
              }
            />

            <b>{Math.round(menuVolume * 100)}%</b>
          </div>

          <div className="voice-context-scale">
            <span>0%</span>
            <span>100%</span>
            <span>250%</span>
          </div>

          <button
            type="button"
            onClick={() =>
              updateMenuVolume(
                menuVolume === 0 ? 1 : 0
              )
            }
          >
            {menuVolume === 0
              ? 'Restaurar volume'
              : 'Silenciar para mim'}
          </button>
        </div>
      )}
    </section>
  )
}
