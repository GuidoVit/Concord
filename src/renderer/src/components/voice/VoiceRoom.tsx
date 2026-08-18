import { useEffect, useState, type MouseEvent, type RefObject } from 'react'
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client'
import type { ScreenShareQuality, VoiceParticipant } from '../../types/concord'
import { SCREEN_SHARE_PROFILES } from '../../hooks/useScreenShare'

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
  screenTrack: RemoteVideoTrack | LocalVideoTrack | null
  screenSharerName: string
  screenSharerIdentity: string
  screenQuality: ScreenShareQuality
  screenVideoRef: RefObject<HTMLVideoElement | null>
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
    screenTrack,
    screenSharerName,
    screenSharerIdentity,
    screenQuality,
    screenVideoRef,
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
  const profile = SCREEN_SHARE_PROFILES.find((item) => item.id === screenQuality)

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

  const openParticipantMenu = (event: MouseEvent, participant: VoiceParticipant) => {
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

  const openScreenMenu = (event: MouseEvent) => {
    if (!screenSharerIdentity) return
    const sharer = voiceParticipants.find((participant) => participant.identity === screenSharerIdentity)
    if (sharer?.isLocal) return

    event.preventDefault()
    event.stopPropagation()
    setVolumeMenu({
      kind: 'screen',
      identity: screenSharerIdentity,
      label: `Tela de ${screenSharerName || 'participante'}`,
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

  return (
    <section className="voice-room">
      <div className="voice-center">
        {!screenTrack && (
          <>
            <div className={voiceConnected ? 'voice-orbit connected' : 'voice-orbit'}>
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
                onClick={() => activeVoiceId && connectVoice(activeVoiceId)}
                disabled={voiceConnecting || !activeVoiceId}
              >
                {voiceConnecting ? 'Conectando...' : 'Entrar na call'}
              </button>
            </div>
          </>
        ) : (
          <>
            {screenTrack && (
              <div className="screen-share-stage" onContextMenu={openScreenMenu}>
                <div className="screen-share-head">
                  <div>
                    <strong>{screenSharerName}</strong>
                    <span>está compartilhando</span>
                  </div>
                  <span className="stream-quality">
                    {profile ? `${profile.height}p • ${profile.frameRate} FPS` : 'Transmissão'}
                  </span>
                </div>
                <video ref={screenVideoRef} className="screen-share-video" autoPlay playsInline />
              </div>
            )}

            <div className="voice-participant-grid">
              {voiceParticipants.map((participant) => (
                <div
                  key={participant.identity}
                  className={participant.isSpeaking ? 'voice-person speaking' : 'voice-person'}
                  onContextMenu={(event) => openParticipantMenu(event, participant)}
                >
                  <div className="voice-avatar">
                    {participant.avatarUrl ? (
                      <img src={participant.avatarUrl} alt={participant.name} />
                    ) : (
                      participant.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <strong className="voice-person-name">{participant.name}</strong>
                  <span>{participant.isSpeaking ? 'Falando' : 'Na call'}</span>
                </div>
              ))}
            </div>

            <div className="voice-controls">
              <button className={muted ? 'voice-button off' : 'voice-button'} onClick={toggleMicrophone}>
                {muted ? 'Mic desligado' : 'Microfone'}
              </button>
              <button className={deafened ? 'voice-button off' : 'voice-button'} onClick={toggleDeafen}>
                {deafened ? 'Áudio desligado' : 'Áudio'}
              </button>
              <button
                className={screenSharing ? 'voice-button screen-active' : 'voice-button screen-share'}
                disabled={screenShareStarting}
                onClick={screenSharing ? stopScreenShare : openScreenPicker}
              >
                {screenShareStarting
                  ? 'Preparando...'
                  : screenSharing
                    ? 'Parar transmissão'
                    : 'Compartilhar tela'}
              </button>
              <button className="voice-button leave" onClick={disconnectVoice}>
                Sair da call
              </button>
            </div>
          </>
        )}
      </div>

      {volumeMenu && (
        <div
          className="voice-context-menu"
          style={{ left: volumeMenu.x, top: volumeMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <strong>{volumeMenu.label}</strong>
          <span className="voice-context-label">
            {volumeMenu.kind === 'participant' ? 'Volume do usuário' : 'Volume da transmissão'}
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

          <button type="button" onClick={() => updateMenuVolume(menuVolume === 0 ? 1 : 0)}>
            {menuVolume === 0 ? 'Restaurar volume' : 'Silenciar para mim'}
          </button>
        </div>
      )}
    </section>
  )
}
