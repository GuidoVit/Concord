import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RemoteAudioTrack,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track
} from 'livekit-client'

import type { ConcordServer, User, VoiceParticipant } from '../types/concord'
import { playCallSound } from '../utils/callSounds'

type ApiRequest = (endpoint: string, options?: RequestInit) => Promise<any>

interface UseVoiceOptions {
  user: User | null
  apiRequest: ApiRequest
}

type RemoteAudioPipeline = {
  source: MediaStreamAudioSourceNode
  gain: GainNode
  compressor: DynamicsCompressorNode
  trim: GainNode
  identity: string
  trackSource: Track.Source
}

const clampVolume = (volume: number) => Math.max(0, Math.min(2.5, volume))

export function useVoice({ user, apiRequest }: UseVoiceOptions) {
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null)
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [voiceConnecting, setVoiceConnecting] = useState(false)
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([])
  const [connectedServerId, setConnectedServerId] = useState('')
  const [connectedChannelId, setConnectedChannelId] = useState('')

  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('concord-participant-volumes') || '{}')
    } catch {
      return {}
    }
  })

  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('concord-screen-volumes') || '{}')
    } catch {
      return {}
    }
  })

  // Medidor do próprio microfone.
  const audioContextRef = useRef<AudioContext | null>(null)
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const meterTrackRef = useRef<MediaStreamTrack | null>(null)
  const meterFrameRef = useRef<number | null>(null)
  const localSpeakingRef = useRef(false)
  const lastVoiceTimeRef = useRef(0)
  const mutedRef = useRef(false)

  // Mixer remoto. Um único AudioContext reduz custo de CPU e permite ganho > 100%.
  const remoteAudioContextRef = useRef<AudioContext | null>(null)
  const remoteMasterRef = useRef<GainNode | null>(null)
  const remotePipelinesRef = useRef<Map<string, RemoteAudioPipeline>>(new Map())
  const remoteTracksRef = useRef<Map<string, RemoteAudioTrack>>(new Map())
  const deafenedRef = useRef(false)
  const activeScreenShareIdentityRef = useRef('')

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  useEffect(() => {
    deafenedRef.current = deafened
  }, [deafened])

  const syncVoiceParticipants = useCallback(
    (room: Room) => {
      const participants: VoiceParticipant[] = []
      const local = room.localParticipant

      participants.push({
        identity: local.identity,
        name: local.name || user?.displayName || 'Você',
        isSpeaking: localSpeakingRef.current,
        avatarUrl: user?.avatarUrl || '',
        isLocal: true
      })

      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        let avatarUrl = ''

        try {
          const metadata = participant.metadata ? JSON.parse(participant.metadata) : null
          avatarUrl = typeof metadata?.avatarUrl === 'string' ? metadata.avatarUrl : ''
        } catch {
          avatarUrl = ''
        }

        participants.push({
          identity: participant.identity,
          name: participant.name || participant.identity,
          isSpeaking: participant.isSpeaking,
          avatarUrl,
          isLocal: false
        })
      })

      setVoiceParticipants(participants)
    },
    [user?.avatarUrl, user?.displayName]
  )

  const updateLocalSpeaking = useCallback((room: Room, speaking: boolean) => {
    if (localSpeakingRef.current === speaking) return

    localSpeakingRef.current = speaking
    setVoiceParticipants((current) =>
      current.map((participant) =>
        participant.identity === room.localParticipant.identity
          ? { ...participant, isSpeaking: speaking }
          : participant
      )
    )
  }, [])

  const stopLocalVoiceMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current)
      meterFrameRef.current = null
    }

    try {
      microphoneSourceRef.current?.disconnect()
    } catch {
      // sem ação
    }

    microphoneSourceRef.current = null
    meterTrackRef.current?.stop()
    meterTrackRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    localSpeakingRef.current = false
    lastVoiceTimeRef.current = 0
  }, [])

  const startLocalVoiceMeter = useCallback(
    async (room: Room) => {
      stopLocalVoiceMeter()

      try {
        let localTrack: any = null

        for (let attempt = 0; attempt < 20; attempt++) {
          const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
          if (publication?.track) {
            localTrack = publication.track
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        if (!localTrack?.mediaStreamTrack) return

        const meterTrack = localTrack.mediaStreamTrack.clone()
        meterTrackRef.current = meterTrack

        const stream = new MediaStream([meterTrack])
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        if (audioContext.state === 'suspended') await audioContext.resume()

        const source = audioContext.createMediaStreamSource(stream)
        microphoneSourceRef.current = source

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.05
        source.connect(analyser)

        const samples = new Float32Array(analyser.fftSize)
        const threshold = 0.008
        const hold = 150

        const analyse = () => {
          analyser.getFloatTimeDomainData(samples)

          let sum = 0
          for (let index = 0; index < samples.length; index++) {
            sum += samples[index] * samples[index]
          }

          const rms = Math.sqrt(sum / samples.length)
          const now = performance.now()

          if (rms > threshold && !mutedRef.current) {
            lastVoiceTimeRef.current = now
            updateLocalSpeaking(room, true)
          } else if (now - lastVoiceTimeRef.current > hold) {
            updateLocalSpeaking(room, false)
          }

          meterFrameRef.current = requestAnimationFrame(analyse)
        }

        analyse()
      } catch (error) {
        console.error('Erro no medidor:', error)
      }
    },
    [stopLocalVoiceMeter, updateLocalSpeaking]
  )

  const getRemoteAudioContext = useCallback(async () => {
    let context = remoteAudioContextRef.current

    if (!context || context.state === 'closed') {
      context = new AudioContext({ latencyHint: 'interactive' })
      remoteAudioContextRef.current = context

      const master = context.createGain()
      master.gain.value = deafened ? 0 : 1
      master.connect(context.destination)
      remoteMasterRef.current = master
    }

    if (context.state === 'suspended') {
      await context.resume().catch(() => {})
    }

    return context
  }, [deafened])

  const pipelineKey = useCallback((identity: string, source: Track.Source) => `${identity}:${source}`, [])

  const removeRemotePipeline = useCallback(
    (identity: string, source: Track.Source) => {
      const key = pipelineKey(identity, source)
      const pipeline = remotePipelinesRef.current.get(key)
      if (!pipeline) return

      try { pipeline.source.disconnect() } catch {}
      try { pipeline.gain.disconnect() } catch {}
      try { pipeline.compressor.disconnect() } catch {}
      try { pipeline.trim.disconnect() } catch {}

      remotePipelinesRef.current.delete(key)
    },
    [pipelineKey]
  )

  const clearRemoteAudio = useCallback(async () => {
    remotePipelinesRef.current.forEach((pipeline) => {
      try { pipeline.source.disconnect() } catch {}
      try { pipeline.gain.disconnect() } catch {}
      try { pipeline.compressor.disconnect() } catch {}
      try { pipeline.trim.disconnect() } catch {}
    })
    remotePipelinesRef.current.clear()
    remoteTracksRef.current.clear()

    try { remoteMasterRef.current?.disconnect() } catch {}
    remoteMasterRef.current = null

    const context = remoteAudioContextRef.current
    remoteAudioContextRef.current = null
    if (context && context.state !== 'closed') await context.close().catch(() => {})

    document.querySelectorAll('audio[data-concord-audio="true"]').forEach((element) => element.remove())
  }, [])

  const createRemotePipeline = useCallback(
    async (
      track: RemoteAudioTrack,
      identity: string,
      source: Track.Source,
      volume: number
    ) => {
      const key = pipelineKey(identity, source)
      const safeVolume = clampVolume(volume)

      remoteTracksRef.current.set(key, track)
      removeRemotePipeline(identity, source)

      // LiveKit recomenda anexar faixas de áudio a um elemento de mídia. Mantemos
      // esse caminho como reprodução principal até 100%, pois é o mais confiável
      // com autoplay/WebRTC no Electron.
      document
        .querySelectorAll<HTMLAudioElement>(
          `audio[data-concord-identity="${CSS.escape(identity)}"][data-concord-source="${source}"]`
        )
        .forEach((element) => element.remove())

      const element = track.attach()
      element.autoplay = true
      element.preload = 'auto'
      element.volume = Math.min(1, safeVolume)
      element.muted = deafenedRef.current
      element.setAttribute('data-concord-audio', 'true')
      element.setAttribute('data-concord-identity', identity)
      element.setAttribute('data-concord-source', source)
      element.style.display = 'none'
      document.body.appendChild(element)
      void element.play().catch(() => {})

      // Até 100% não há motivo para passar por WebAudio.
      if (safeVolume <= 1) return

      try {
        const context = await getRemoteAudioContext()
        const master = remoteMasterRef.current
        const mediaTrack = track.mediaStreamTrack

        // Se o Chromium não liberou o AudioContext, mantemos o elemento HTML em
        // 100% em vez de deixar a call completamente silenciosa.
        if (!master || !mediaTrack || context.state !== 'running') {
          element.volume = 1
          element.muted = deafenedRef.current
          return
        }

        const mediaStream = new MediaStream([mediaTrack])
        const sourceNode = context.createMediaStreamSource(mediaStream)
        const gain = context.createGain()
        const compressor = context.createDynamicsCompressor()
        const trim = context.createGain()

        gain.gain.value = safeVolume
        compressor.threshold.value = -10
        compressor.knee.value = 18
        compressor.ratio.value = 10
        compressor.attack.value = 0.003
        compressor.release.value = 0.2
        trim.gain.value = 0.92

        sourceNode.connect(gain)
        gain.connect(compressor)
        compressor.connect(trim)
        trim.connect(master)

        // Evita áudio duplicado: acima de 100% o WebAudio passa a ser a saída.
        element.muted = true

        remotePipelinesRef.current.set(key, {
          source: sourceNode,
          gain,
          compressor,
          trim,
          identity,
          trackSource: source
        })
      } catch (error) {
        console.warn('Concord: não foi possível ativar boost de áudio:', error)
        element.volume = 1
        element.muted = deafenedRef.current
      }
    },
    [getRemoteAudioContext, pipelineKey, removeRemotePipeline]
  )

  const applyAudioVolume = useCallback(
    (identity: string, source: Track.Source, volume: number) => {
      const safe = clampVolume(volume)
      const key = pipelineKey(identity, source)
      const pipeline = remotePipelinesRef.current.get(key)
      const track = remoteTracksRef.current.get(key)
      const elements = Array.from(
        document.querySelectorAll<HTMLAudioElement>(
          `audio[data-concord-identity="${CSS.escape(identity)}"][data-concord-source="${source}"]`
        )
      )

      if (safe <= 1) {
        if (pipeline) removeRemotePipeline(identity, source)
        elements.forEach((element) => {
          element.muted = deafenedRef.current
          element.volume = safe
          void element.play().catch(() => {})
        })
        return
      }

      if (pipeline) {
        const now = pipeline.gain.context.currentTime
        pipeline.gain.gain.cancelScheduledValues(now)
        pipeline.gain.gain.setTargetAtTime(safe, now, 0.015)
        elements.forEach((element) => {
          element.muted = true
        })
        return
      }

      // O usuário acabou de passar de 100%: cria a cadeia de boost sob demanda.
      if (track) {
        void createRemotePipeline(track, identity, source, safe)
      } else {
        elements.forEach((element) => {
          element.volume = 1
          element.muted = deafenedRef.current
        })
      }
    },
    [createRemotePipeline, pipelineKey, removeRemotePipeline]
  )

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const safe = clampVolume(volume)
      setParticipantVolumes((current) => {
        const next = { ...current, [identity]: safe }
        localStorage.setItem('concord-participant-volumes', JSON.stringify(next))
        return next
      })
      applyAudioVolume(identity, Track.Source.Microphone, safe)
    },
    [applyAudioVolume]
  )

  const setScreenShareVolume = useCallback(
    (identity: string, volume: number) => {
      const safe = clampVolume(volume)

      setScreenShareVolumes((current) => {
        const next = { ...current, [identity]: safe }
        localStorage.setItem('concord-screen-volumes', JSON.stringify(next))
        return next
      })

      // O volume configurado é preservado para cada transmissão, mas somente
      // a transmissão principal selecionada pode produzir áudio.
      applyAudioVolume(
        identity,
        Track.Source.ScreenShareAudio,
        activeScreenShareIdentityRef.current === identity ? safe : 0
      )
    },
    [applyAudioVolume]
  )

  const setActiveScreenShareAudio = useCallback(
    (identity: string) => {
      activeScreenShareIdentityRef.current = identity

      remoteTracksRef.current.forEach((_track, key) => {
        const suffix = `:${Track.Source.ScreenShareAudio}`
        if (!key.endsWith(suffix)) return

        const trackIdentity = key.slice(0, -suffix.length)
        const volume =
          trackIdentity === identity
            ? (screenShareVolumes[trackIdentity] ?? 1)
            : 0

        applyAudioVolume(trackIdentity, Track.Source.ScreenShareAudio, volume)
      })
    },
    [applyAudioVolume, screenShareVolumes]
  )

  const disconnectVoice = useCallback(async () => {
    const shouldPlayLeaveSound = voiceConnected || Boolean(livekitRoom)

    stopLocalVoiceMeter()
    if (livekitRoom) await livekitRoom.disconnect()
    await clearRemoteAudio()

    setLivekitRoom(null)
    setVoiceConnected(false)
    setVoiceConnecting(false)
    setVoiceParticipants([])
    setConnectedServerId('')
    setConnectedChannelId('')
    activeScreenShareIdentityRef.current = ''
    setMuted(false)
    setDeafened(false)
    mutedRef.current = false

    if (shouldPlayLeaveSound) playCallSound('leave')
  }, [clearRemoteAudio, livekitRoom, stopLocalVoiceMeter, voiceConnected])

  const connectVoice = useCallback(
    async (server: ConcordServer, channelId?: string) => {
      if (voiceConnected || voiceConnecting) return

      try {
        setVoiceConnecting(true)

        // A entrada na call nasce de um clique. Aproveitamos esse gesto para
        // liberar o AudioContext antes de qualquer await de rede.
        void getRemoteAudioContext()

        const voiceChannel = (server.channels ?? []).find(
          (channel) => channel.type === 'voice' && (!channelId || channel.id === channelId)
        )

        const roomName = voiceChannel
          ? `server-${server.id}-channel-${voiceChannel.id}`
          : `server-${server.id}-geral`

        const data = await apiRequest('/livekit/token', {
          method: 'POST',
          body: JSON.stringify({ roomName })
        })

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true
        })

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (!(track instanceof RemoteAudioTrack)) return

          const source = publication.source
          const identity = participant.identity
          const volume =
            source === Track.Source.ScreenShareAudio
              ? (
                  activeScreenShareIdentityRef.current === identity
                    ? (screenShareVolumes[identity] ?? 1)
                    : 0
                )
              : (participantVolumes[identity] ?? 1)

          void createRemotePipeline(track, identity, source, volume)
        })

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (!(track instanceof RemoteAudioTrack)) return
          removeRemotePipeline(participant.identity, publication.source)
          remoteTracksRef.current.delete(pipelineKey(participant.identity, publication.source))
          track.detach().forEach((element) => element.remove())
        })

        room.on(RoomEvent.ParticipantConnected, () => syncVoiceParticipants(room))
        room.on(RoomEvent.ParticipantDisconnected, () => syncVoiceParticipants(room))
        room.on(RoomEvent.ActiveSpeakersChanged, () => syncVoiceParticipants(room))

        room.on(RoomEvent.Disconnected, () => {
          stopLocalVoiceMeter()
          void clearRemoteAudio()
          setVoiceConnected(false)
          setLivekitRoom(null)
          setVoiceParticipants([])
          setConnectedServerId('')
          setConnectedChannelId('')
        })

        await room.connect(data.url, data.token)
        await room.startAudio().catch(() => {})
        await room.localParticipant.setMicrophoneEnabled(true)

        setLivekitRoom(room)
        setVoiceConnected(true)
        setConnectedServerId(server.id)
        setConnectedChannelId(voiceChannel?.id || '')
        playCallSound('join')

        setMuted(false)
        mutedRef.current = false
        syncVoiceParticipants(room)
        setTimeout(() => startLocalVoiceMeter(room), 250)
      } catch (error) {
        console.error(error)
        alert(error instanceof Error ? error.message : 'Não foi possível entrar na call.')
      } finally {
        setVoiceConnecting(false)
      }
    },
    [
      apiRequest,
      clearRemoteAudio,
      createRemotePipeline,
      getRemoteAudioContext,
      participantVolumes,
      pipelineKey,
      removeRemotePipeline,
      screenShareVolumes,
      startLocalVoiceMeter,
      stopLocalVoiceMeter,
      syncVoiceParticipants,
      voiceConnected,
      voiceConnecting
    ]
  )

  const toggleMicrophone = useCallback(async () => {
    if (!livekitRoom) return

    const newMuted = !muted
    await livekitRoom.localParticipant.setMicrophoneEnabled(!newMuted)

    setMuted(newMuted)
    mutedRef.current = newMuted
    playCallSound(newMuted ? 'mute' : 'unmute')

    if (newMuted) {
      updateLocalSpeaking(livekitRoom, false)
      stopLocalVoiceMeter()
    } else {
      setTimeout(() => startLocalVoiceMeter(livekitRoom), 250)
    }
  }, [livekitRoom, muted, startLocalVoiceMeter, stopLocalVoiceMeter, updateLocalSpeaking])

  const toggleDeafen = useCallback(() => {
    const newValue = !deafened
    setDeafened(newValue)
    deafenedRef.current = newValue
    playCallSound(newValue ? 'deafen' : 'undeafen')

    const master = remoteMasterRef.current
    if (master) {
      const now = master.context.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setTargetAtTime(newValue ? 0 : 1, now, 0.012)
    }

    document.querySelectorAll<HTMLAudioElement>('audio[data-concord-audio="true"]').forEach((element) => {
      const identity = element.getAttribute('data-concord-identity') || ''
      const source = (element.getAttribute('data-concord-source') || '') as Track.Source
      const boosted = remotePipelinesRef.current.has(pipelineKey(identity, source))
      element.muted = newValue || boosted
      if (!newValue && !boosted) void element.play().catch(() => {})
    })
  }, [deafened, pipelineKey])

  return {
    muted,
    deafened,
    livekitRoom,
    voiceConnected,
    voiceConnecting,
    voiceParticipants,
    connectedServerId,
    connectedChannelId,
    participantVolumes,
    screenShareVolumes,
    setParticipantVolume,
    setScreenShareVolume,
    setActiveScreenShareAudio,
    connectVoice,
    disconnectVoice,
    toggleMicrophone,
    toggleDeafen
  }
}
