import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LocalVideoTrack,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track
} from 'livekit-client'

import type {
  ScreenShareProfile,
  ScreenShareQuality,
  ScreenSource,
  User
} from '../types/concord'

interface UseScreenShareOptions {
  livekitRoom: Room | null
  voiceConnected: boolean
  user: User | null
  onActiveScreenShareChange?: (identity: string) => void
}

export interface ActiveScreenShare {
  identity: string
  name: string
  videoTrack: RemoteVideoTrack | LocalVideoTrack
  isLocal: boolean
}

export const SCREEN_SHARE_PROFILES: ScreenShareProfile[] = [
  {
    id: 'performance',
    label: 'Desempenho',
    detail: '720p • 30 FPS • ideal para jogos pesados',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_500_000
  },
  {
    id: 'balanced',
    label: 'Balanceado',
    detail: '1080p • 30 FPS • recomendado',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4_500_000
  },
  {
    id: 'quality',
    label: 'Fluido',
    detail: '1080p • 60 FPS',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 7_500_000
  },
  {
    id: 'ultra',
    label: 'Máxima qualidade',
    detail: '1440p • 60 FPS • exige mais do PC/rede',
    width: 2560,
    height: 1440,
    frameRate: 60,
    maxBitrate: 12_000_000
  }
]

export function useScreenShare({
  livekitRoom,
  voiceConnected,
  user,
  onActiveScreenShareChange
}: UseScreenShareOptions) {
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([])
  const [showScreenPicker, setShowScreenPicker] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [screenShareStarting, setScreenShareStarting] = useState(false)
  const [screenShares, setScreenShares] = useState<ActiveScreenShare[]>([])
  const [selectedScreenShareIdentity, setSelectedScreenShareIdentity] = useState('')
  const [screenQuality, setScreenQuality] = useState<ScreenShareQuality>(
    () =>
      (localStorage.getItem('concord-screen-quality') as ScreenShareQuality) ||
      'balanced'
  )

  // Mantido por compatibilidade com componentes antigos. A nova VoiceRoom
  // cria refs próprios para a transmissão principal e para cada preview.
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  const selectedIdentityRef = useRef('')
  const screenSharesRef = useRef<ActiveScreenShare[]>([])

  useEffect(() => {
    selectedIdentityRef.current = selectedScreenShareIdentity
    onActiveScreenShareChange?.(selectedScreenShareIdentity)
  }, [selectedScreenShareIdentity, onActiveScreenShareChange])

  useEffect(() => {
    screenSharesRef.current = screenShares
  }, [screenShares])

  const selectScreenShare = useCallback((identity: string) => {
    if (!identity) {
      setSelectedScreenShareIdentity('')
      return
    }

    const exists = screenSharesRef.current.some(
      (share) => share.identity === identity
    )

    if (exists) {
      setSelectedScreenShareIdentity(identity)
    }
  }, [])

  const upsertShare = useCallback((share: ActiveScreenShare) => {
    setScreenShares((current) => {
      const existingIndex = current.findIndex(
        (item) => item.identity === share.identity
      )

      const next =
        existingIndex === -1
          ? [...current, share]
          : current.map((item, index) =>
              index === existingIndex ? share : item
            )

      screenSharesRef.current = next

      // Uma nova transmissão nunca sobrepõe automaticamente a que o usuário
      // já estava assistindo. Ela só vira principal se não havia nenhuma.
      if (
        !selectedIdentityRef.current ||
        !next.some((item) => item.identity === selectedIdentityRef.current)
      ) {
        const first = next[0]?.identity || ''
        selectedIdentityRef.current = first
        setSelectedScreenShareIdentity(first)
      }

      return next
    })
  }, [])

  const removeShare = useCallback((identity: string) => {
    setScreenShares((current) => {
      const next = current.filter((share) => share.identity !== identity)
      screenSharesRef.current = next

      if (selectedIdentityRef.current === identity) {
        const replacement = next[0]?.identity || ''
        selectedIdentityRef.current = replacement
        setSelectedScreenShareIdentity(replacement)
      }

      return next
    })
  }, [])

  const clearShares = useCallback(() => {
    screenSharesRef.current = []
    selectedIdentityRef.current = ''
    setScreenShares([])
    setSelectedScreenShareIdentity('')
  }, [])

  useEffect(() => {
    if (!livekitRoom) {
      setScreenSharing(false)
      clearShares()
      setShowScreenPicker(false)
      return
    }

    const addRemoteShare = (
      track: RemoteVideoTrack,
      participant: {
        identity: string
        name?: string
      }
    ) => {
      upsertShare({
        identity: participant.identity,
        name: participant.name || participant.identity,
        videoTrack: track,
        isLocal: false
      })
    }

    const subscribed = (
      track: unknown,
      publication: { source: Track.Source },
      participant: { identity: string; name?: string }
    ) => {
      if (
        track instanceof RemoteVideoTrack &&
        publication.source === Track.Source.ScreenShare
      ) {
        addRemoteShare(track, participant)
      }
    }

    const unsubscribed = (
      track: unknown,
      publication: { source: Track.Source },
      participant: { identity: string }
    ) => {
      if (
        track instanceof RemoteVideoTrack &&
        publication.source === Track.Source.ScreenShare
      ) {
        removeShare(participant.identity)
      }
    }

    const localPublished = (publication: {
      source: Track.Source
      track?: unknown
    }) => {
      if (
        publication.source === Track.Source.ScreenShare &&
        publication.track instanceof LocalVideoTrack
      ) {
        upsertShare({
          identity: livekitRoom.localParticipant.identity,
          name: user?.displayName || livekitRoom.localParticipant.name || 'Você',
          videoTrack: publication.track,
          isLocal: true
        })
        setScreenSharing(true)
      }
    }

    const localUnpublished = (publication: { source: Track.Source }) => {
      if (publication.source === Track.Source.ScreenShare) {
        removeShare(livekitRoom.localParticipant.identity)
        setScreenSharing(false)
      }
    }

    const participantDisconnected = (participant: { identity: string }) => {
      removeShare(participant.identity)
    }

    const disconnected = () => {
      setScreenSharing(false)
      clearShares()
      setShowScreenPicker(false)
    }

    // Recupera transmissões já ativas quando o usuário volta de DM/outro server.
    livekitRoom.remoteParticipants.forEach((participant) => {
      const track =
        participant.getTrackPublication(Track.Source.ScreenShare)?.track

      if (track instanceof RemoteVideoTrack) {
        addRemoteShare(track, participant)
      }
    })

    const localTrack =
      livekitRoom.localParticipant.getTrackPublication(
        Track.Source.ScreenShare
      )?.track

    if (localTrack instanceof LocalVideoTrack) {
      upsertShare({
        identity: livekitRoom.localParticipant.identity,
        name: user?.displayName || livekitRoom.localParticipant.name || 'Você',
        videoTrack: localTrack,
        isLocal: true
      })
      setScreenSharing(true)
    }

    livekitRoom.on(RoomEvent.TrackSubscribed, subscribed as never)
    livekitRoom.on(RoomEvent.TrackUnsubscribed, unsubscribed as never)
    livekitRoom.on(RoomEvent.LocalTrackPublished, localPublished as never)
    livekitRoom.on(RoomEvent.LocalTrackUnpublished, localUnpublished as never)
    livekitRoom.on(RoomEvent.ParticipantDisconnected, participantDisconnected as never)
    livekitRoom.on(RoomEvent.Disconnected, disconnected)

    return () => {
      livekitRoom.off(RoomEvent.TrackSubscribed, subscribed as never)
      livekitRoom.off(RoomEvent.TrackUnsubscribed, unsubscribed as never)
      livekitRoom.off(RoomEvent.LocalTrackPublished, localPublished as never)
      livekitRoom.off(RoomEvent.LocalTrackUnpublished, localUnpublished as never)
      livekitRoom.off(
        RoomEvent.ParticipantDisconnected,
        participantDisconnected as never
      )
      livekitRoom.off(RoomEvent.Disconnected, disconnected)
    }
  }, [
    livekitRoom,
    user?.displayName,
    upsertShare,
    removeShare,
    clearShares
  ])

  const selectedScreenShare = useMemo(
    () =>
      screenShares.find(
        (share) => share.identity === selectedScreenShareIdentity
      ) ||
      screenShares[0] ||
      null,
    [screenShares, selectedScreenShareIdentity]
  )

  // Campos antigos continuam existindo para não quebrar outros componentes.
  const screenTrack = selectedScreenShare?.videoTrack ?? null
  const screenSharerName = selectedScreenShare?.name ?? ''
  const screenSharerIdentity = selectedScreenShare?.identity ?? ''

  const openScreenPicker = useCallback(async () => {
    if (!livekitRoom || !voiceConnected) return

    try {
      const sources = await window.concord.screenShare.getSources()
      setScreenSources(sources)
      setShowScreenPicker(true)
    } catch (error) {
      console.error(
        'Concord: não foi possível carregar as fontes de compartilhamento:',
        error
      )
    }
  }, [livekitRoom, voiceConnected])

  const startScreenShare = useCallback(
    async (
      source: ScreenSource,
      quality: ScreenShareQuality = screenQuality
    ) => {
      if (!livekitRoom) return

      const profile =
        SCREEN_SHARE_PROFILES.find((item) => item.id === quality) ||
        SCREEN_SHARE_PROFILES[1]

      setScreenShareStarting(true)
      setScreenQuality(quality)
      localStorage.setItem('concord-screen-quality', quality)

      try {
        await window.concord.screenShare.selectSource(source.id)

        let publication: any
        let audioAvailable = true

        try {
          // Primeira tentativa: vídeo + áudio do sistema.
          publication =
            await livekitRoom.localParticipant.setScreenShareEnabled(
              true,
              {
                audio: true,
                video: true,
                contentHint: 'motion',
                systemAudio: 'include',
                resolution: {
                  width: profile.width,
                  height: profile.height,
                  frameRate: profile.frameRate
                }
              },
              {
                simulcast: true,
                screenShareEncoding: {
                  maxBitrate: profile.maxBitrate,
                  maxFramerate: profile.frameRate,
                  priority: 'high'
                }
              }
            )
        } catch (audioError) {
          console.warn(
            'Concord: áudio do compartilhamento indisponível. Tentando somente vídeo.',
            audioError
          )

          audioAvailable = false

          try {
            await livekitRoom.localParticipant.setScreenShareEnabled(false)
          } catch {
            // A primeira tentativa pode falhar antes de publicar.
          }

          // Fallback: o compartilhamento continua somente com vídeo.
          publication =
            await livekitRoom.localParticipant.setScreenShareEnabled(
              true,
              {
                audio: false,
                video: true,
                contentHint: 'motion',
                resolution: {
                  width: profile.width,
                  height: profile.height,
                  frameRate: profile.frameRate
                }
              },
              {
                simulcast: true,
                screenShareEncoding: {
                  maxBitrate: profile.maxBitrate,
                  maxFramerate: profile.frameRate,
                  priority: 'high'
                }
              }
            )
        }

        const localIdentity = livekitRoom.localParticipant.identity
        const localVideoTrack =
          publication?.track instanceof LocalVideoTrack
            ? publication.track
            : livekitRoom.localParticipant.getTrackPublication(
                Track.Source.ScreenShare
              )?.track

        if (localVideoTrack instanceof LocalVideoTrack) {
          upsertShare({
            identity: localIdentity,
            name: user?.displayName || livekitRoom.localParticipant.name || 'Você',
            videoTrack: localVideoTrack,
            isLocal: true
          })

          // Quem começou a compartilhar passa a ver a própria tela como
          // principal, sem alterar a seleção dos outros participantes.
          selectedIdentityRef.current = localIdentity
          setSelectedScreenShareIdentity(localIdentity)
        }

        setScreenSharing(true)
        setShowScreenPicker(false)

        if (!audioAvailable) {
          window.setTimeout(() => {
            alert(
              'A tela está sendo compartilhada, mas o áudio do sistema não pôde ser capturado neste computador.'
            )
          }, 150)
        }
      } catch (error) {
        console.error(
          'Concord: erro ao iniciar compartilhamento:',
          error
        )

        try {
          await livekitRoom.localParticipant.setScreenShareEnabled(false)
        } catch {
          // Ignora.
        }

        try {
          await window.concord.screenShare.clearSource()
        } catch {
          // Ignora.
        }

        removeShare(livekitRoom.localParticipant.identity)
        setScreenSharing(false)

        alert(
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar o compartilhamento.'
        )
      } finally {
        setScreenShareStarting(false)
      }
    },
    [
      livekitRoom,
      screenQuality,
      user?.displayName,
      upsertShare,
      removeShare
    ]
  )

  const stopScreenShare = useCallback(async () => {
    if (!livekitRoom) return

    try {
      await livekitRoom.localParticipant.setScreenShareEnabled(false)
    } finally {
      try {
        await window.concord.screenShare.clearSource()
      } catch {
        // Ignora.
      }

      removeShare(livekitRoom.localParticipant.identity)
      setScreenSharing(false)
    }
  }, [livekitRoom, removeShare])

  const cleanupBeforeDisconnect = useCallback(async () => {
    if (livekitRoom && screenSharing) {
      try {
        await livekitRoom.localParticipant.setScreenShareEnabled(false)
      } catch {
        // Ignora.
      }
    }

    try {
      await window.concord.screenShare.clearSource()
    } catch {
      // Ignora.
    }

    setScreenSharing(false)
    clearShares()
    setShowScreenPicker(false)
  }, [livekitRoom, screenSharing, clearShares])

  return {
    screenSources,
    showScreenPicker,
    setShowScreenPicker,

    screenSharing,
    screenShareStarting,

    screenShares,
    selectedScreenShareIdentity,
    selectScreenShare,

    // Compatibilidade
    screenTrack,
    screenSharerName,
    screenSharerIdentity,

    screenQuality,
    screenVideoRef,

    openScreenPicker,
    startScreenShare,
    stopScreenShare,
    cleanupBeforeDisconnect
  }
}
