import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RemoteAudioTrack,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track
} from 'livekit-client'

import type { HarmonyServer, User, VoiceParticipant } from '../types/harmony'
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
const clampMicGain = (gain: number) => Math.max(0, Math.min(2.5, gain))

function readJsonSetting<T>(primary: string, legacy: string, fallback: T): T {
  try {
    const value = localStorage.getItem(primary) ?? localStorage.getItem(legacy)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function readBooleanSetting(primary: string, legacy: string, fallback: boolean) {
  const value = localStorage.getItem(primary) ?? localStorage.getItem(legacy)
  if (value === null) return fallback
  return value === 'true'
}

export function useVoice({ user, apiRequest }: UseVoiceOptions) {
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null)
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [voiceConnecting, setVoiceConnecting] = useState(false)
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([])
  const [connectedServerId, setConnectedServerId] = useState('')
  const [connectedChannelId, setConnectedChannelId] = useState('')

  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>(() =>
    readJsonSetting('harmony-participant-volumes', 'concord-participant-volumes', {})
  )

  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>(() =>
    readJsonSetting('harmony-screen-volumes', 'concord-screen-volumes', {})
  )

  const [selfMicGain, setSelfMicGainState] = useState(() => {
    const saved = Number(
      localStorage.getItem('harmony-self-mic-gain') ??
      localStorage.getItem('concord-self-mic-gain') ??
      '1'
    )
    return Number.isFinite(saved) ? clampMicGain(saved) : 1
  })

  const [joinMuted, setJoinMutedState] = useState(() =>
    readBooleanSetting('harmony-join-muted', 'concord-join-muted', false)
  )

  // Medidor do próprio microfone.
  const audioContextRef = useRef<AudioContext | null>(null)
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const meterTrackRef = useRef<MediaStreamTrack | null>(null)
  const meterFrameRef = useRef<number | null>(null)
  const localSpeakingRef = useRef(false)
  const lastVoiceTimeRef = useRef(0)
  const mutedRef = useRef(false)
  const deafenedRef = useRef(false)
  const micMutedBeforeDeafenRef = useRef(false)

  // Microfone processado para permitir ganho individual do próprio usuário.
  const micProcessContextRef = useRef<AudioContext | null>(null)
  const micProcessSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micProcessGainRef = useRef<GainNode | null>(null)
  const micProcessCompressorRef = useRef<DynamicsCompressorNode | null>(null)
  const micRawTrackRef = useRef<MediaStreamTrack | null>(null)

  // Mixer remoto. O áudio de participantes e de compartilhamento é separado.
  const remoteAudioContextRef = useRef<AudioContext | null>(null)
  const remoteMasterRef = useRef<GainNode | null>(null)
  const remotePipelinesRef = useRef<Map<string, RemoteAudioPipeline>>(new Map())
  const remoteTracksRef = useRef<Map<string, RemoteAudioTrack>>(new Map())
  const activeScreenShareIdentityRef = useRef('')

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  useEffect(() => {
    deafenedRef.current = deafened
  }, [deafened])

  const getParticipantFlags = useCallback((participant: RemoteParticipant) => {
    const micPublication = participant.getTrackPublication(Track.Source.Microphone)
    const attrs = participant.attributes ?? {}

    return {
      isMuted:
        micPublication?.isMuted ??
        attrs['harmony.muted'] === 'true',
      isDeafened: attrs['harmony.deafened'] === 'true'
    }
  }, [])

  const syncVoiceParticipants = useCallback(
    (room: Room) => {
      const participants: VoiceParticipant[] = []
      const local = room.localParticipant

      participants.push({
        identity: local.identity,
        name: local.name || user?.displayName || 'Você',
        username: user?.username,
        isSpeaking: localSpeakingRef.current,
        avatarUrl: user?.avatarUrl || '',
        isLocal: true,
        isMuted: mutedRef.current,
        isDeafened: deafenedRef.current
      })

      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        let avatarUrl = ''
        let username = ''

        try {
          const metadata = participant.metadata ? JSON.parse(participant.metadata) : null
          avatarUrl = typeof metadata?.avatarUrl === 'string' ? metadata.avatarUrl : ''
          username = typeof metadata?.username === 'string' ? metadata.username : ''
        } catch {
          avatarUrl = ''
          username = ''
        }

        const flags = getParticipantFlags(participant)

        participants.push({
          identity: participant.identity,
          name: participant.name || participant.identity,
          username,
          isSpeaking: participant.isSpeaking,
          avatarUrl,
          isLocal: false,
          ...flags
        })
      })

      setVoiceParticipants(participants)
    },
    [getParticipantFlags, user?.avatarUrl, user?.displayName, user?.username]
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

    try { microphoneSourceRef.current?.disconnect() } catch {}

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
        console.error('Harmony: erro no medidor do microfone:', error)
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
      master.gain.value = 1
      master.connect(context.destination)
      remoteMasterRef.current = master
    }

    if (context.state === 'suspended') {
      await context.resume().catch(() => {})
    }

    return context
  }, [])

  const pipelineKey = useCallback(
    (identity: string, source: Track.Source) => `${identity}:${source}`,
    []
  )

  const voiceOutputSuppressed = useCallback(
    (source: Track.Source) =>
      source === Track.Source.Microphone &&
      deafenedRef.current,
    []
  )

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

    document.querySelectorAll('audio[data-harmony-audio="true"], audio[data-concord-audio="true"]')
      .forEach((element) => element.remove())
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
      const suppressed = voiceOutputSuppressed(source)
      const effectiveVolume = suppressed ? 0 : safeVolume

      remoteTracksRef.current.set(key, track)
      removeRemotePipeline(identity, source)

      document
        .querySelectorAll<HTMLAudioElement>(
          `audio[data-harmony-identity="${CSS.escape(identity)}"][data-harmony-source="${source}"], ` +
          `audio[data-concord-identity="${CSS.escape(identity)}"][data-concord-source="${source}"]`
        )
        .forEach((element) => element.remove())

      const element = track.attach()
      element.autoplay = true
      element.preload = 'auto'
      element.volume = Math.min(1, effectiveVolume)
      element.muted = effectiveVolume === 0
      element.setAttribute('data-harmony-audio', 'true')
      element.setAttribute('data-harmony-identity', identity)
      element.setAttribute('data-harmony-source', source)
      element.style.display = 'none'
      document.body.appendChild(element)
      void element.play().catch(() => {})

      if (effectiveVolume <= 1) return

      try {
        const context = await getRemoteAudioContext()
        const master = remoteMasterRef.current
        const mediaTrack = track.mediaStreamTrack

        if (!master || !mediaTrack || context.state !== 'running') {
          element.volume = 1
          element.muted = false
          return
        }

        const mediaStream = new MediaStream([mediaTrack])
        const sourceNode = context.createMediaStreamSource(mediaStream)
        const gain = context.createGain()
        const compressor = context.createDynamicsCompressor()
        const trim = context.createGain()

        gain.gain.value = effectiveVolume
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
        console.warn('Harmony: não foi possível ativar boost de áudio:', error)
        element.volume = Math.min(1, effectiveVolume)
        element.muted = effectiveVolume === 0
      }
    },
    [getRemoteAudioContext, pipelineKey, removeRemotePipeline, voiceOutputSuppressed]
  )

  const applyAudioVolume = useCallback(
    (identity: string, source: Track.Source, volume: number) => {
      const configured = clampVolume(volume)
      const safe = voiceOutputSuppressed(source) ? 0 : configured
      const key = pipelineKey(identity, source)
      const pipeline = remotePipelinesRef.current.get(key)
      const track = remoteTracksRef.current.get(key)
      const elements = Array.from(
        document.querySelectorAll<HTMLAudioElement>(
          `audio[data-harmony-identity="${CSS.escape(identity)}"][data-harmony-source="${source}"], ` +
          `audio[data-concord-identity="${CSS.escape(identity)}"][data-concord-source="${source}"]`
        )
      )

      if (safe <= 1) {
        if (pipeline) removeRemotePipeline(identity, source)
        elements.forEach((element) => {
          element.muted = safe === 0
          element.volume = safe
          if (safe > 0) void element.play().catch(() => {})
        })
        return
      }

      if (pipeline) {
        const now = pipeline.gain.context.currentTime
        pipeline.gain.gain.cancelScheduledValues(now)
        pipeline.gain.gain.setTargetAtTime(safe, now, 0.015)
        elements.forEach((element) => { element.muted = true })
        return
      }

      if (track) {
        void createRemotePipeline(track, identity, source, safe)
      } else {
        elements.forEach((element) => {
          element.volume = 1
          element.muted = false
        })
      }
    },
    [createRemotePipeline, pipelineKey, removeRemotePipeline, voiceOutputSuppressed]
  )

  const refreshRemoteAudioState = useCallback(() => {
    remoteTracksRef.current.forEach((_track, key) => {
      const screenSuffix = `:${Track.Source.ScreenShareAudio}`
      const micSuffix = `:${Track.Source.Microphone}`

      if (key.endsWith(screenSuffix)) {
        const identity = key.slice(0, -screenSuffix.length)
        const volume =
          activeScreenShareIdentityRef.current === identity
            ? (screenShareVolumes[identity] ?? 1)
            : 0
        applyAudioVolume(identity, Track.Source.ScreenShareAudio, volume)
      } else if (key.endsWith(micSuffix)) {
        const identity = key.slice(0, -micSuffix.length)
        applyAudioVolume(identity, Track.Source.Microphone, participantVolumes[identity] ?? 1)
      }
    })
  }, [applyAudioVolume, participantVolumes, screenShareVolumes])

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const safe = clampVolume(volume)
      setParticipantVolumes((current) => {
        const next = { ...current, [identity]: safe }
        localStorage.setItem('harmony-participant-volumes', JSON.stringify(next))
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
        localStorage.setItem('harmony-screen-volumes', JSON.stringify(next))
        localStorage.setItem('concord-screen-volumes', JSON.stringify(next))
        return next
      })

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
      refreshRemoteAudioState()
    },
    [refreshRemoteAudioState]
  )

  const setSelfMicGain = useCallback((value: number) => {
    const safe = clampMicGain(value)
    setSelfMicGainState(safe)
    localStorage.setItem('harmony-self-mic-gain', String(safe))
    localStorage.setItem('concord-self-mic-gain', String(safe))

    const gain = micProcessGainRef.current
    if (gain) {
      const now = gain.context.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setTargetAtTime(safe, now, 0.02)
    }
  }, [])

  const setJoinMuted = useCallback((value: boolean) => {
    setJoinMutedState(value)
    localStorage.setItem('harmony-join-muted', String(value))
    localStorage.setItem('concord-join-muted', String(value))
  }, [])

  const cleanupProcessedMicrophone = useCallback(async () => {
    try { micProcessSourceRef.current?.disconnect() } catch {}
    micProcessSourceRef.current = null
    micProcessGainRef.current = null
    try { micProcessCompressorRef.current?.disconnect() } catch {}
    micProcessCompressorRef.current = null

    micRawTrackRef.current?.stop()
    micRawTrackRef.current = null

    const context = micProcessContextRef.current
    micProcessContextRef.current = null
    if (context && context.state !== 'closed') await context.close().catch(() => {})
  }, [])

  const setupProcessedMicrophone = useCallback(
    async (room: Room, startMuted: boolean) => {
      await cleanupProcessedMicrophone()

      try {
        const input = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          },
          video: false
        })

        const rawTrack = input.getAudioTracks()[0]
        if (!rawTrack) throw new Error('Nenhum microfone disponível.')

        const context = new AudioContext({ latencyHint: 'interactive' })
        if (context.state === 'suspended') await context.resume().catch(() => {})

        const source = context.createMediaStreamSource(new MediaStream([rawTrack]))
        const gain = context.createGain()
        const compressor = context.createDynamicsCompressor()
        const destination = context.createMediaStreamDestination()

        gain.gain.value = selfMicGain
        compressor.threshold.value = -8
        compressor.knee.value = 12
        compressor.ratio.value = 8
        compressor.attack.value = 0.003
        compressor.release.value = 0.16

        source.connect(gain)
        gain.connect(compressor)
        compressor.connect(destination)

        const processedTrack = destination.stream.getAudioTracks()[0]
        const publication = await room.localParticipant.publishTrack(processedTrack, {
          source: Track.Source.Microphone,
          name: 'harmony-microphone'
        })

        micProcessContextRef.current = context
        micProcessSourceRef.current = source
        micProcessGainRef.current = gain
        micProcessCompressorRef.current = compressor
        micRawTrackRef.current = rawTrack

        if (startMuted) {
          rawTrack.enabled = false
          await publication.mute()
        } else {
          rawTrack.enabled = true
        }
      } catch (error) {
        console.warn('Harmony: ganho processado indisponível; usando microfone padrão.', error)
        await room.localParticipant.setMicrophoneEnabled(!startMuted)
      }
    },
    [cleanupProcessedMicrophone, selfMicGain]
  )

  const publishLocalState = useCallback(
    async (room: Room, nextMuted: boolean, nextDeafened: boolean) => {
      try {
        await room.localParticipant.setAttributes({
          'harmony.muted': String(nextMuted),
          'harmony.deafened': String(nextDeafened)
        })
      } catch (error) {
        console.warn('Harmony: não foi possível sincronizar estado de mute:', error)
      }
    },
    []
  )

  const setMicrophoneMuted = useCallback(
    async (room: Room, nextMuted: boolean) => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
      const rawTrack = micRawTrackRef.current

      if (publication) {
        if (rawTrack) rawTrack.enabled = !nextMuted
        if (nextMuted) await publication.mute()
        else await publication.unmute()
      } else {
        await room.localParticipant.setMicrophoneEnabled(!nextMuted)
      }

      setMuted(nextMuted)
      mutedRef.current = nextMuted

      if (nextMuted) {
        updateLocalSpeaking(room, false)
        stopLocalVoiceMeter()
      } else {
        window.setTimeout(() => startLocalVoiceMeter(room), 250)
      }

      await publishLocalState(room, nextMuted, deafenedRef.current)
      syncVoiceParticipants(room)
    },
    [publishLocalState, startLocalVoiceMeter, stopLocalVoiceMeter, syncVoiceParticipants, updateLocalSpeaking]
  )

  const disconnectVoice = useCallback(async () => {
    const shouldPlayLeaveSound = voiceConnected || Boolean(livekitRoom)

    stopLocalVoiceMeter()
    if (livekitRoom) await livekitRoom.disconnect()
    await clearRemoteAudio()
    await cleanupProcessedMicrophone()

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
    deafenedRef.current = false
    micMutedBeforeDeafenRef.current = false

    if (shouldPlayLeaveSound) playCallSound('leave')
  }, [clearRemoteAudio, cleanupProcessedMicrophone, livekitRoom, stopLocalVoiceMeter, voiceConnected])

  const connectVoice = useCallback(
    async (server: HarmonyServer, channelId?: string) => {
      if (voiceConnected || voiceConnecting) return

      try {
        setVoiceConnecting(true)
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

        const resync = () => syncVoiceParticipants(room)
        room.on(RoomEvent.ParticipantConnected, resync)
        room.on(RoomEvent.ParticipantDisconnected, resync)
        room.on(RoomEvent.ActiveSpeakersChanged, resync)
        room.on(RoomEvent.TrackMuted, resync as never)
        room.on(RoomEvent.TrackUnmuted, resync as never)
        room.on(RoomEvent.ParticipantAttributesChanged, resync as never)

        room.on(RoomEvent.Disconnected, () => {
          stopLocalVoiceMeter()
          void clearRemoteAudio()
          void cleanupProcessedMicrophone()
          setVoiceConnected(false)
          setLivekitRoom(null)
          setVoiceParticipants([])
          setConnectedServerId('')
          setConnectedChannelId('')
              })

        await room.connect(data.url, data.token)
        await room.startAudio().catch(() => {})

        const startMuted = joinMuted
        await setupProcessedMicrophone(room, startMuted)

        setLivekitRoom(room)
        setVoiceConnected(true)
        setConnectedServerId(server.id)
        setConnectedChannelId(voiceChannel?.id || '')
        playCallSound('join')

        setMuted(startMuted)
        mutedRef.current = startMuted
        setDeafened(false)
        deafenedRef.current = false
        micMutedBeforeDeafenRef.current = false
        await publishLocalState(room, startMuted, false)
        syncVoiceParticipants(room)

        if (!startMuted) {
          window.setTimeout(() => startLocalVoiceMeter(room), 250)
        }
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
      cleanupProcessedMicrophone,
      createRemotePipeline,
      getRemoteAudioContext,
      joinMuted,
      participantVolumes,
      pipelineKey,
      publishLocalState,
      removeRemotePipeline,
      screenShareVolumes,
      setupProcessedMicrophone,
      startLocalVoiceMeter,
      stopLocalVoiceMeter,
      syncVoiceParticipants,
      voiceConnected,
      voiceConnecting
    ]
  )

  const toggleMicrophone = useCallback(async () => {
    if (!livekitRoom) return

    // Como no Discord, não é possível reabrir o mic enquanto estiver ensurdecido.
    if (deafenedRef.current && mutedRef.current) return

    await setMicrophoneMuted(livekitRoom, !mutedRef.current)
  }, [livekitRoom, setMicrophoneMuted])

  const toggleDeafen = useCallback(async () => {
    if (!livekitRoom) return

    const nextDeafened = !deafenedRef.current

    if (nextDeafened) {
      micMutedBeforeDeafenRef.current = mutedRef.current

      if (!mutedRef.current) {
        await setMicrophoneMuted(livekitRoom, true)
      }

      setDeafened(true)
      deafenedRef.current = true

      await publishLocalState(livekitRoom, mutedRef.current, true)
      refreshRemoteAudioState()
      syncVoiceParticipants(livekitRoom)
      return
    }

    setDeafened(false)
    deafenedRef.current = false

    const shouldRestoreMicrophone = !micMutedBeforeDeafenRef.current

    if (shouldRestoreMicrophone && mutedRef.current) {
      await setMicrophoneMuted(livekitRoom, false)
    } else {
      await publishLocalState(livekitRoom, mutedRef.current, false)
      syncVoiceParticipants(livekitRoom)
    }

    micMutedBeforeDeafenRef.current = false
    refreshRemoteAudioState()
  }, [
    livekitRoom,
    publishLocalState,
    refreshRemoteAudioState,
    setMicrophoneMuted,
    syncVoiceParticipants
  ])

  useEffect(() => {
    return () => {
      stopLocalVoiceMeter()
      void clearRemoteAudio()
      void cleanupProcessedMicrophone()
    }
  }, [clearRemoteAudio, cleanupProcessedMicrophone, stopLocalVoiceMeter])

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
    selfMicGain,
    joinMuted,
    connectVoice,
    disconnectVoice,
    toggleMicrophone,
    toggleDeafen,
    setParticipantVolume,
    setScreenShareVolume,
    setActiveScreenShareAudio,
    setSelfMicGain,
    setJoinMuted
  }
}
