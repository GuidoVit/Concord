import {
  FormEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import {
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteParticipant,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track
} from 'livekit-client'

import './App.css'

type AuthMode =
  'login' |
  'register'

type Screen =
  'auth' |
  'home' |
  'friends' |
  'dm' |
  'server'

interface User {
  id: string
  username: string
  displayName: string
  createdAt: string
  avatarUrl?: string
}

interface FriendRequest {
  id: string
  user: User
}

interface ConcordServer {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: string[]
  iconUrl?: string
  memberRoles?: Record<string, string>

  channels: {
    id: string
    name: string
    type: 'voice' | 'text'
  }[]
}

interface VoiceParticipant {
  identity: string
  name: string
  isSpeaking: boolean
}

interface ScreenSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

interface DirectMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  read: boolean
  createdAt: string
}

interface Conversation {
  friend: User
  lastMessage:
    DirectMessage | null
  unread: number
}

const API = 'https://study-statutory-publication-program.trycloudflare.com'

function App() {
  const [
    screen,
    setScreen
  ] =
    useState<Screen>(
      'auth'
    )

  const [
    authMode,
    setAuthMode
  ] =
    useState<AuthMode>(
      'login'
    )

  const [
    user,
    setUser
  ] =
    useState<User | null>(
      null
    )

  const [
    username,
    setUsername
  ] =
    useState('')

  const [
    displayName,
    setDisplayName
  ] =
    useState('')

  const [
    password,
    setPassword
  ] =
    useState('')

  const [
    confirmPassword,
    setConfirmPassword
  ] =
    useState('')

  const [
    loading,
    setLoading
  ] =
    useState(false)

  const [
    error,
    setError
  ] =
    useState('')

  const [
    friends,
    setFriends
  ] =
    useState<User[]>([])

  const [
    requests,
    setRequests
  ] =
    useState<
      FriendRequest[]
    >([])

  const [
    friendUsername,
    setFriendUsername
  ] =
    useState('')

  const [
    servers,
    setServers
  ] =
    useState<
      ConcordServer[]
    >([])

  const [
    selectedServer,
    setSelectedServer
  ] =
    useState<
      ConcordServer |
      null
    >(null)

  const [
    showCreateServer,
    setShowCreateServer
  ] =
    useState(false)

  const [
    showJoinServer,
    setShowJoinServer
  ] =
    useState(false)

  const [
    newServerName,
    setNewServerName
  ] =
    useState('')

  const [
    inviteCode,
    setInviteCode
  ] =
    useState('')

  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')

  async function saveProfile() {
    try {
      const data = await apiRequest('/profile', { method: 'PATCH', body: JSON.stringify({ username: profileUsername, displayName: profileDisplayName, avatarUrl: profileAvatar }) })
      setUser(data.user)
      setShowProfileSettings(false)
    } catch (error) { alert(error instanceof Error ? error.message : 'Erro ao salvar perfil.') }
  }

  function openProfileSettings() {
    setProfileUsername(user?.username || '')
    setProfileDisplayName(user?.displayName || '')
    setProfileAvatar(user?.avatarUrl || '')
    setShowProfileSettings(true)
  }

  function pickProfileAvatar(file?: File) {
    if (!file) return
    if (file.size > 1024 * 1024) return alert('Use uma imagem de até 1 MB.')
    const reader = new FileReader()
    reader.onload = () => setProfileAvatar(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  // ====================================================
  // DIRECT MESSAGES
  // ====================================================

  const [
    conversations,
    setConversations
  ] =
    useState<
      Conversation[]
    >([])

  const [
    selectedFriend,
    setSelectedFriend
  ] =
    useState<User | null>(
      null
    )

  const [
    messages,
    setMessages
  ] =
    useState<
      DirectMessage[]
    >([])

  const [
    messageText,
    setMessageText
  ] =
    useState('')

  const [
    unreadMessages,
    setUnreadMessages
  ] =
    useState(0)

const [
  ,
  setPreviousUnread
] =
  useState(0)

  // ====================================================
  // VOICE
  // ====================================================

  const [
    muted,
    setMuted
  ] =
    useState(false)

  const [
    deafened,
    setDeafened
  ] =
    useState(false)

  const [
    livekitRoom,
    setLivekitRoom
  ] =
    useState<Room | null>(
      null
    )

  const [
    voiceConnected,
    setVoiceConnected
  ] =
    useState(false)

  const [
    voiceConnecting,
    setVoiceConnecting
  ] =
    useState(false)

  const [
    voiceParticipants,
    setVoiceParticipants
  ] =
    useState<
      VoiceParticipant[]
    >([])

  // ====================================================
  // SCREEN SHARE
  // ====================================================

  const [
    screenSources,
    setScreenSources
  ] =
    useState<
      ScreenSource[]
    >([])

  const [
    showScreenPicker,
    setShowScreenPicker
  ] =
    useState(false)

  const [
    screenSharing,
    setScreenSharing
  ] =
    useState(false)

  const [
    screenShareStarting,
    setScreenShareStarting
  ] =
    useState(false)

  const [
    screenTrack,
    setScreenTrack
  ] =
    useState<
      RemoteVideoTrack |
      LocalVideoTrack |
      null
    >(null)

  const [
    screenSharerName,
    setScreenSharerName
  ] =
    useState('')

  const screenVideoRef =
    useRef<
      HTMLVideoElement |
      null
    >(null)

  // ====================================================
  // LOCAL VOICE METER
  // ====================================================

  const audioContextRef =
    useRef<
      AudioContext |
      null
    >(null)

  const microphoneSourceRef =
    useRef<
      MediaStreamAudioSourceNode |
      null
    >(null)

  const meterTrackRef =
    useRef<
      MediaStreamTrack |
      null
    >(null)

  const meterFrameRef =
    useRef<
      number |
      null
    >(null)

  const localSpeakingRef =
    useRef(false)

  const lastVoiceTimeRef =
    useRef(0)

  const mutedRef =
    useRef(false)

  const messagesEndRef =
    useRef<
      HTMLDivElement |
      null
    >(null)

  const currentScreenRef =
    useRef<Screen>(
      screen
    )

  const selectedFriendRef =
    useRef<User | null>(
      null
    )

  useEffect(() => {
    mutedRef.current =
      muted
  }, [muted])

  useEffect(() => {
    currentScreenRef.current =
      screen
  }, [screen])

  useEffect(() => {
    selectedFriendRef.current =
      selectedFriend
  }, [selectedFriend])

  function token() {
    return localStorage
      .getItem(
        'concord_token'
      )
  }

  // ====================================================
  // API
  // ====================================================

  const apiRequest =
    useCallback(
      async (
        endpoint: string,
        options:
          RequestInit = {}
      ) => {
        const headers =
          new Headers(
            options.headers
          )

        headers.set(
          'Content-Type',
          'application/json'
        )

        const savedToken =
          localStorage
            .getItem(
              'concord_token'
            )

        if (savedToken) {
          headers.set(
            'Authorization',
            `Bearer ${savedToken}`
          )
        }

        const response =
          await fetch(
            `${API}${endpoint}`,
            {
              ...options,
              headers
            }
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
            'Algo deu errado.'
          )
        }

        return data
      },
      []
    )

  // ====================================================
  // LOADERS
  // ====================================================

  const loadFriends =
    useCallback(
      async () => {
        try {
          const data =
            await apiRequest(
              '/friends'
            )

          setFriends(
            data.friends
          )

          setRequests(
            data.incoming
          )
        } catch {
          // nada
        }
      },
      [apiRequest]
    )

  const loadServers =
    useCallback(
      async () => {
        try {
          const data =
            await apiRequest(
              '/servers'
            )

          setServers(
            data.servers
          )
        } catch {
          // nada
        }
      },
      [apiRequest]
    )

  const loadConversations =
    useCallback(
      async () => {
        if (!token()) {
          return
        }

        try {
          const data =
            await apiRequest(
              '/messages'
            )

          setConversations(
            data.conversations
          )

          const total =
            Number(
              data.unreadTotal ||
              0
            )

          setUnreadMessages(
            total
          )

          setPreviousUnread(
            (oldValue) => {
              if (
                total >
                  oldValue &&
                currentScreenRef
                  .current ===
                  'server'
              ) {
                // O badge no mascote
                // atualiza imediatamente.
              }

              return total
            }
          )
        } catch {
          // nada
        }
      },
      [apiRequest]
    )

  const loadMessages =
    useCallback(
      async (
        friendId: string
      ) => {
        try {
          const data =
            await apiRequest(
              `/messages/${friendId}`
            )

          setMessages(
            data.messages
          )

          setTimeout(
            () => {
              messagesEndRef
                .current
                ?.scrollIntoView({
                  behavior:
                    'smooth'
                })
            },
            20
          )
        } catch {
          // nada
        }
      },
      [apiRequest]
    )

  // ====================================================
  // RESTORE
  // ====================================================

  const restoreSession =
    useCallback(
      async () => {
        if (!token()) {
          return
        }

        try {
          const data =
            await apiRequest(
              '/auth/me'
            )

          setUser(
            data.user
          )

          setScreen(
            'home'
          )

          await Promise.all([
            loadFriends(),
            loadServers(),
            loadConversations()
          ])
        } catch {
          localStorage
            .removeItem(
              'concord_token'
            )
        }
      },
      [
        apiRequest,
        loadFriends,
        loadServers,
        loadConversations
      ]
    )

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // ====================================================
  // POLLING DE DMs
  //
  // Nesta etapa usamos polling leve.
  // Depois podemos trocar por WebSocket.
  // ====================================================

  useEffect(() => {
    if (!user) {
      return
    }

    const interval =
      window.setInterval(
        async () => {
          await loadConversations()

          const friend =
            selectedFriendRef
              .current

          if (
            currentScreenRef
              .current ===
              'dm' &&
            friend
          ) {
            await loadMessages(
              friend.id
            )

            await loadConversations()
          }
        },
        1500
      )

    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [
    user,
    loadConversations,
    loadMessages
  ])

  // ====================================================
  // SCREEN VIDEO
  // ====================================================

  useEffect(() => {
    const video =
      screenVideoRef.current

    if (
      !video ||
      !screenTrack
    ) {
      return
    }

    screenTrack.attach(
      video
    )

    video.autoplay =
      true

    video.playsInline =
      true

    video.muted =
      screenTrack instanceof
      LocalVideoTrack

    return () => {
      screenTrack.detach(
        video
      )
    }
  }, [screenTrack])

  // ====================================================
  // VOICE HELPERS
  // ====================================================

  function syncVoiceParticipants(
    room: Room
  ) {
    const participants:
      VoiceParticipant[] = []

    const local =
      room.localParticipant

    participants.push({
      identity:
        local.identity,

      name:
        local.name ||
        user?.displayName ||
        'Você',

      isSpeaking:
        localSpeakingRef.current
    })

    room.remoteParticipants
      .forEach(
        (
          participant:
            RemoteParticipant
        ) => {
          participants.push({
            identity:
              participant.identity,

            name:
              participant.name ||
              participant.identity,

            isSpeaking:
              participant
                .isSpeaking
          })
        }
      )

    setVoiceParticipants(
      participants
    )
  }

  function updateLocalSpeaking(
    room: Room,
    speaking: boolean
  ) {
    if (
      localSpeakingRef
        .current ===
      speaking
    ) {
      return
    }

    localSpeakingRef.current =
      speaking

    setVoiceParticipants(
      (current) =>
        current.map(
          (participant) =>
            participant
              .identity ===
            room
              .localParticipant
              .identity
              ? {
                  ...participant,
                  isSpeaking:
                    speaking
                }
              : participant
        )
    )
  }

  async function startLocalVoiceMeter(
    room: Room
  ) {
    stopLocalVoiceMeter()

    try {
      let localTrack:
        any = null

      for (
        let attempt = 0;
        attempt < 20;
        attempt++
      ) {
        const publication =
          room
            .localParticipant
            .getTrackPublication(
              Track.Source
                .Microphone
            )

        if (
          publication?.track
        ) {
          localTrack =
            publication.track

          break
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              100
            )
        )
      }

      if (!localTrack) {
        return
      }

      const mediaTrack =
        localTrack
          .mediaStreamTrack

      if (!mediaTrack) {
        return
      }

      const meterTrack =
        mediaTrack.clone()

      meterTrackRef.current =
        meterTrack

      const stream =
        new MediaStream([
          meterTrack
        ])

      const audioContext =
        new AudioContext()

      audioContextRef.current =
        audioContext

      if (
        audioContext.state ===
        'suspended'
      ) {
        await audioContext
          .resume()
      }

      const source =
        audioContext
          .createMediaStreamSource(
            stream
          )

      microphoneSourceRef.current =
        source

      const analyser =
        audioContext
          .createAnalyser()

      analyser.fftSize =
        256

      analyser
        .smoothingTimeConstant =
        0.05

      source.connect(
        analyser
      )

      const samples =
        new Float32Array(
          analyser.fftSize
        )

      const threshold =
        0.008

      const hold =
        150

      const analyse =
        () => {
          analyser
            .getFloatTimeDomainData(
              samples
            )

          let sum =
            0

          for (
            let i = 0;
            i <
            samples.length;
            i++
          ) {
            sum +=
              samples[i] *
              samples[i]
          }

          const rms =
            Math.sqrt(
              sum /
              samples.length
            )

          const now =
            performance.now()

          if (
            rms >
              threshold &&
            !mutedRef.current
          ) {
            lastVoiceTimeRef
              .current =
              now

            updateLocalSpeaking(
              room,
              true
            )
          } else if (
            now -
              lastVoiceTimeRef
                .current >
            hold
          ) {
            updateLocalSpeaking(
              room,
              false
            )
          }

          meterFrameRef.current =
            requestAnimationFrame(
              analyse
            )
        }

      analyse()
    } catch (
      error
    ) {
      console.error(
        'Erro no medidor:',
        error
      )
    }
  }

  function stopLocalVoiceMeter() {
    if (
      meterFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        meterFrameRef.current
      )

      meterFrameRef.current =
        null
    }

    try {
      microphoneSourceRef
        .current
        ?.disconnect()
    } catch {
      // nada
    }

    microphoneSourceRef.current =
      null

    meterTrackRef.current
      ?.stop()

    meterTrackRef.current =
      null

    audioContextRef.current
      ?.close()
      .catch(
        () => {}
      )

    audioContextRef.current =
      null

    localSpeakingRef.current =
      false

    lastVoiceTimeRef.current =
      0
  }

  // ====================================================
  // AUTH
  // ====================================================

  async function handleLogin(
    event: FormEvent
  ) {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const data =
        await apiRequest(
          '/auth/login',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                username,
                password
              })
          }
        )

      localStorage
        .setItem(
          'concord_token',
          data.token
        )

      setUser(
        data.user
      )

      setScreen(
        'home'
      )

      await Promise.all([
        loadFriends(),
        loadServers(),
        loadConversations()
      ])
    } catch (
      error
    ) {
      setError(
        error instanceof
          Error
          ? error.message
          : 'Erro ao entrar.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(
    event: FormEvent
  ) {
    event.preventDefault()

    setError('')

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'As senhas não são iguais.'
      )

      return
    }

    setLoading(true)

    try {
      const data =
        await apiRequest(
          '/auth/register',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                username,
                displayName,
                password
              })
          }
        )

      localStorage
        .setItem(
          'concord_token',
          data.token
        )

      setUser(
        data.user
      )

      setScreen(
        'home'
      )

      await Promise.all([
        loadFriends(),
        loadServers(),
        loadConversations()
      ])
    } catch (
      error
    ) {
      setError(
        error instanceof
          Error
          ? error.message
          : 'Erro ao criar conta.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function disconnectVoice() {
    const shouldPlayLeaveSound = voiceConnected || Boolean(livekitRoom)

    stopLocalVoiceMeter()

    if (
      livekitRoom &&
      screenSharing
    ) {
      try {
        await livekitRoom
          .localParticipant
          .setScreenShareEnabled(
            false
          )
      } catch {
        // nada
      }
    }

    try {
      await window.concord
        .screenShare
        .clearSource()
    } catch {
      // nada
    }

    if (livekitRoom) {
      await livekitRoom
        .disconnect()
    }

    document
      .querySelectorAll(
        'audio[data-concord-audio="true"]'
      )
      .forEach(
        (element) =>
          element.remove()
      )

    setLivekitRoom(
      null
    )

    setVoiceConnected(
      false
    )

    setVoiceConnecting(
      false
    )

    setVoiceParticipants(
      []
    )

    setMuted(false)
    setDeafened(false)

    setScreenSharing(
      false
    )

    setScreenTrack(
      null
    )

    setScreenSharerName(
      ''
    )

    mutedRef.current =
      false

    if (shouldPlayLeaveSound) {
      playCallSound('leave')
    }
  }

  function logout() {
    disconnectVoice()

    localStorage
      .removeItem(
        'concord_token'
      )

    setUser(null)
    setFriends([])
    setRequests([])
    setServers([])
    setConversations([])
    setMessages([])
    setUnreadMessages(0)
    setSelectedFriend(null)
    setSelectedServer(null)

    setScreen(
      'auth'
    )
  }

  // ====================================================
  // FRIENDS
  // ====================================================

  async function sendFriendRequest() {
    if (
      !friendUsername
        .trim()
    ) {
      return
    }

    try {
      await apiRequest(
        '/friends/request',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              username:
                friendUsername
            })
        }
      )

      setFriendUsername(
        ''
      )

      alert(
        'Pedido enviado!'
      )
    } catch (
      error
    ) {
      alert(
        error instanceof
          Error
          ? error.message
          : 'Erro.'
      )
    }
  }

  async function acceptFriend(
    id: string
  ) {
    await apiRequest(
      `/friends/${id}/accept`,
      {
        method:
          'POST'
      }
    )

    await loadFriends()
    await loadConversations()
  }

  async function declineFriend(
    id: string
  ) {
    await apiRequest(
      `/friends/${id}`,
      {
        method:
          'DELETE'
      }
    )

    await loadFriends()
  }

  // ====================================================
  // SERVERS
  // ====================================================

  async function createServer() {
    if (
      !newServerName
        .trim()
    ) {
      return
    }

    try {
      const data =
        await apiRequest(
          '/servers',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                name:
                  newServerName
              })
          }
        )

      setNewServerName('')
      setShowCreateServer(false)

      await loadServers()

      setSelectedServer(
        data.server
      )

      setScreen(
        'server'
      )
    } catch (
      error
    ) {
      alert(
        error instanceof
          Error
          ? error.message
          : 'Erro.'
      )
    }
  }

  async function joinServer() {
    try {
      const data =
        await apiRequest(
          '/servers/join',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                inviteCode
              })
          }
        )

      setInviteCode('')
      setShowJoinServer(false)

      await loadServers()

      setSelectedServer(
        data.server
      )

      setScreen(
        'server'
      )
    } catch (
      error
    ) {
      alert(
        error instanceof
          Error
          ? error.message
          : 'Erro.'
      )
    }
  }

  async function copyInvite() {
    if (!selectedServer) {
      return
    }

    await navigator
      .clipboard
      .writeText(
        selectedServer
          .inviteCode
      )
  }

  async function openServer(
    server:
      ConcordServer
  ) {
    if (
      selectedServer?.id !==
        server.id &&
      voiceConnected
    ) {
      await disconnectVoice()
    }

    setSelectedServer(
      server
    )

    setScreen(
      'server'
    )
  }

  // ====================================================
  // DIRECT MESSAGES
  // ====================================================

  async function openDirectMessage(
    friend: User
  ) {
    setSelectedFriend(
      friend
    )

    setScreen(
      'dm'
    )

    await loadMessages(
      friend.id
    )

    await loadConversations()
  }

  async function sendMessage(
    event?: FormEvent
  ) {
    event?.preventDefault()

    if (
      !selectedFriend ||
      !messageText.trim()
    ) {
      return
    }

    const text =
      messageText.trim()

    setMessageText('')

    try {
      await apiRequest(
        `/messages/${selectedFriend.id}`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              content:
                text
            })
        }
      )

      await loadMessages(
        selectedFriend.id
      )

      await loadConversations()
    } catch (
      error
    ) {
      setMessageText(
        text
      )

      alert(
        error instanceof
          Error
          ? error.message
          : 'Erro ao enviar mensagem.'
      )
    }
  }

  function goHome() {
    setSelectedServer(
      null
    )

    setScreen(
      'home'
    )

    loadConversations()
  }

  // ====================================================
  // VOICE
  // ====================================================

  async function connectVoice(
    server:
      ConcordServer,
    channelId?: string
  ) {
    if (
      voiceConnected ||
      voiceConnecting
    ) {
      return
    }

    try {
      setVoiceConnecting(
        true
      )

      const voiceChannel =
        (server.channels ?? [])
          .find(
            (channel) =>
              channel.type === 'voice' &&
              (!channelId || channel.id === channelId)
          )

      const roomName =
        voiceChannel
          ? `server-${server.id}-channel-${voiceChannel.id}`
          : `server-${server.id}-geral`

      const data =
        await apiRequest(
          '/livekit/token',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                roomName
              })
          }
        )

      const room =
        new Room({
          adaptiveStream:
            true,

          dynacast:
            true
        })

      room.on(
        RoomEvent.TrackSubscribed,
        (
          track,
          publication,
          participant
        ) => {
          if (
            track instanceof
            RemoteAudioTrack
          ) {
            const element =
              track.attach()

            element.autoplay =
              true

            element.setAttribute(
              'data-concord-audio',
              'true'
            )

            element.muted =
              deafened

            document.body
              .appendChild(
                element
              )
          }

          if (
            track instanceof
              RemoteVideoTrack &&
            publication.source ===
              Track.Source
                .ScreenShare
          ) {
            setScreenTrack(
              track
            )

            setScreenSharerName(
              participant.name ||
              participant.identity
            )
          }
        }
      )

      room.on(
        RoomEvent.TrackUnsubscribed,
        (
          track,
          publication
        ) => {
          track
            .detach()
            .forEach(
              (element) =>
                element.remove()
            )

          if (
            track instanceof
              RemoteVideoTrack &&
            publication.source ===
              Track.Source
                .ScreenShare
          ) {
            setScreenTrack(
              null
            )

            setScreenSharerName(
              ''
            )
          }
        }
      )

      room.on(
        RoomEvent.ParticipantConnected,
        () =>
          syncVoiceParticipants(
            room
          )
      )

      room.on(
        RoomEvent.ParticipantDisconnected,
        () =>
          syncVoiceParticipants(
            room
          )
      )

      room.on(
        RoomEvent.ActiveSpeakersChanged,
        () =>
          syncVoiceParticipants(
            room
          )
      )

      room.on(
        RoomEvent.LocalTrackUnpublished,
        (
          publication
        ) => {
          if (
            publication.source ===
            Track.Source
              .ScreenShare
          ) {
            setScreenSharing(
              false
            )

            setScreenTrack(
              null
            )

            setScreenSharerName(
              ''
            )
          }
        }
      )

      room.on(
        RoomEvent.Disconnected,
        () => {
          stopLocalVoiceMeter()

          setVoiceConnected(
            false
          )

          setLivekitRoom(
            null
          )

          setVoiceParticipants(
            []
          )

          setScreenSharing(
            false
          )

          setScreenTrack(
            null
          )
        }
      )

      await room.connect(
        data.url,
        data.token
      )

      await room
        .localParticipant
        .setMicrophoneEnabled(
          true
        )

      setLivekitRoom(
        room
      )

      setVoiceConnected(
        true
      )

      playCallSound('join')

      setMuted(false)

      mutedRef.current =
        false

      syncVoiceParticipants(
        room
      )

      setTimeout(
        () =>
          startLocalVoiceMeter(
            room
          ),
        250
      )
    } catch (
      error
    ) {
      console.error(
        error
      )

      alert(
        error instanceof
          Error
          ? error.message
          : 'Não foi possível entrar na call.'
      )
    } finally {
      setVoiceConnecting(
        false
      )
    }
  }

  async function toggleMicrophone() {
    if (!livekitRoom) {
      return
    }

    const newMuted =
      !muted

    await livekitRoom
      .localParticipant
      .setMicrophoneEnabled(
        !newMuted
      )

    setMuted(
      newMuted
    )

    mutedRef.current =
      newMuted

    playCallSound(newMuted ? 'mute' : 'unmute')

    if (newMuted) {
      updateLocalSpeaking(
        livekitRoom,
        false
      )

      stopLocalVoiceMeter()
    } else {
      setTimeout(
        () =>
          startLocalVoiceMeter(
            livekitRoom
          ),
        250
      )
    }
  }

  function toggleDeafen() {
    const newValue =
      !deafened

    setDeafened(
      newValue
    )

    playCallSound(newValue ? 'deafen' : 'undeafen')

    document
      .querySelectorAll(
        'audio[data-concord-audio="true"]'
      )
      .forEach(
        (element) => {
          ;(
            element as
              HTMLAudioElement
          ).muted =
            newValue
        }
      )
  }

  // ====================================================
  // SCREEN SHARE
  // ====================================================

  async function openScreenPicker() {
    if (
      !livekitRoom ||
      !voiceConnected
    ) {
      return
    }

    try {
      const sources =
        await window.concord
          .screenShare
          .getSources()

      setScreenSources(
        sources
      )

      setShowScreenPicker(
        true
      )
    } catch (
      error
    ) {
      console.error(
        error
      )
    }
  }

  async function startScreenShare(
    source:
      ScreenSource
  ) {
    if (!livekitRoom) {
      return
    }

    try {
      setScreenShareStarting(
        true
      )

      await window.concord
        .screenShare
        .selectSource(
          source.id
        )

      const publication =
        await livekitRoom
          .localParticipant
          .setScreenShareEnabled(
            true,
            {
              audio: false,
              video: true,

              contentHint:
                'motion',

              resolution: {
                width:
                  1920,

                height:
                  1080,

                frameRate:
                  60
              }
            }
          )

      if (
        publication?.track instanceof
        LocalVideoTrack
      ) {
        setScreenTrack(
          publication.track
        )
      }

      setScreenSharing(
        true
      )

      setScreenSharerName(
        user?.displayName ||
        'Você'
      )

      setShowScreenPicker(
        false
      )
    } catch (
      error
    ) {
      console.error(
        error
      )
    } finally {
      setScreenShareStarting(
        false
      )
    }
  }

  async function stopScreenShare() {
    if (!livekitRoom) {
      return
    }

    await livekitRoom
      .localParticipant
      .setScreenShareEnabled(
        false
      )

    await window.concord
      .screenShare
      .clearSource()

    setScreenSharing(
      false
    )

    setScreenTrack(
      null
    )

    setScreenSharerName(
      ''
    )
  }

  // ====================================================
  // AUTH SCREEN
  // ====================================================

  if (
    screen ===
    'auth'
  ) {
    return (
      <div className="app auth-screen">
        <div className="solar-glow" />

        <header className="auth-header">
          <Logo />
        </header>

        <main className="auth-main">
          <section className="auth-card">

            <div className="auth-mascot">
              <img
                src="/concord-mascot.png"
                alt="Concord"
              />
            </div>

            <h1>
              {authMode ===
              'login'
                ? 'Bem-vindo de volta'
                : 'Crie seu Concord'}
            </h1>

            <p>
              {authMode ===
              'login'
                ? 'Sua galera tá te esperando.'
                : 'Escolha como você vai aparecer por aqui.'}
            </p>

            <form
              onSubmit={
                authMode ===
                'login'
                  ? handleLogin
                  : handleRegister
              }
            >
              {authMode ===
                'register' && (
                <Field
                  label="NOME"
                  value={
                    displayName
                  }
                  setValue={
                    setDisplayName
                  }
                  placeholder="Como seus amigos vão te ver"
                />
              )}

              <Field
                label="USUÁRIO"
                value={
                  username
                }
                setValue={
                  setUsername
                }
                placeholder="seuusuario"
                prefix="@"
              />

              <Field
                label="SENHA"
                value={
                  password
                }
                setValue={
                  setPassword
                }
                placeholder="••••••••"
                type="password"
              />

              {authMode ===
                'register' && (
                <Field
                  label="CONFIRMAR SENHA"
                  value={
                    confirmPassword
                  }
                  setValue={
                    setConfirmPassword
                  }
                  placeholder="••••••••"
                  type="password"
                />
              )}

              {error && (
                <div className="error-box">
                  {error}
                </div>
              )}

              <button
                className="primary"
                disabled={
                  loading
                }
              >
                {loading
                  ? 'Aguarde...'
                  : authMode ===
                    'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </form>

            <div className="divider">
              <span />
              OU
              <span />
            </div>

            <button
              className="secondary full"
              onClick={() => {
                setError('')

                setAuthMode(
                  authMode ===
                    'login'
                    ? 'register'
                    : 'login'
                )
              }}
            >
              {authMode ===
              'login'
                ? 'Criar uma conta'
                : 'Já tenho uma conta'}
            </button>

          </section>
        </main>
      </div>
    )
  }

  const insideServer =
    screen ===
    'server'

  // ====================================================
  // APP
  // ====================================================

  return (
    <div
      className={
        insideServer
          ? 'app shell server-mode'
          : 'app shell'
      }
    >

      {/* ===============================================
          SERVER RAIL
      =============================================== */}

      <aside className="server-rail">

        <button
          className="rail-logo mascot-rail concord-home-button"
          onClick={
            goHome
          }
          title="Mensagens diretas"
        >
          <img
            src="/concord-mascot.png"
            alt="Concord"
            className="rail-mascot-image"
          />

          {unreadMessages >
            0 && (
            <span className="concord-unread-badge">
              {unreadMessages >
              99
                ? '99+'
                : unreadMessages}
            </span>
          )}
        </button>

        <div className="rail-line" />

        {servers.map(
          (server) => (
            <button
              key={
                server.id
              }
              className={
                selectedServer?.id ===
                  server.id &&
                screen ===
                  'server'
                  ? 'server-circle active'
                  : 'server-circle'
              }
              title={
                server.name
              }
              onClick={() =>
                openServer(
                  server
                )
              }
            >
              {server.iconUrl ? (
                <img src={server.iconUrl} alt={server.name} className="server-circle-image" />
              ) : (server.name.charAt(0).toUpperCase())}
            </button>
          )
        )}

        <button
          className="server-circle add"
          onClick={() =>
            setShowCreateServer(
              true
            )
          }
          title="Criar servidor"
        >
          +
        </button>

        <button
          className="server-circle join"
          onClick={() =>
            setShowJoinServer(
              true
            )
          }
          title="Entrar em servidor"
        >
          ↳
        </button>

      </aside>

      {/* ===============================================
          SOCIAL SIDEBAR
          SOME COMPLETAMENTE DENTRO DE SERVIDOR
      =============================================== */}

      {!insideServer && (
        <aside className="sidebar">

          <div className="sidebar-title">
            <strong>
              Concord
            </strong>
          </div>

          <nav>

            <button
              className={
                screen ===
                  'home'
                  ? 'nav active'
                  : 'nav'
              }
              onClick={
                goHome
              }
            >
              ⌂ Início
            </button>

            <button
              className={
                screen ===
                  'friends'
                  ? 'nav active'
                  : 'nav'
              }
              onClick={() => {
                loadFriends()
                setScreen(
                  'friends'
                )
              }}
            >
              ◎ Amigos

              {requests.length >
                0 && (
                <span className="badge">
                  {
                    requests.length
                  }
                </span>
              )}
            </button>

          </nav>

          <div className="sidebar-label">
            MENSAGENS DIRETAS
          </div>

          <div className="dm-sidebar-list">

            {conversations.map(
              (
                conversation
              ) => (
                <button
                  key={
                    conversation
                      .friend.id
                  }
                  className={
                    selectedFriend?.id ===
                      conversation
                        .friend.id &&
                    screen ===
                      'dm'
                      ? 'dm-sidebar-item active'
                      : 'dm-sidebar-item'
                  }
                  onClick={() =>
                    openDirectMessage(
                      conversation.friend
                    )
                  }
                >
                  <Avatar
                    name={
                      conversation
                        .friend
                        .displayName
                    }
                  />

                  <div className="dm-sidebar-info">
                    <strong>
                      {
                        conversation
                          .friend
                          .displayName
                      }
                    </strong>

                    <small>
                      {conversation
                        .lastMessage
                        ?.content ||
                        `@${conversation.friend.username}`}
                    </small>
                  </div>

                  {conversation
                    .unread >
                    0 && (
                    <span className="dm-unread">
                      {conversation
                        .unread >
                      99
                        ? '99+'
                        : conversation
                            .unread}
                    </span>
                  )}

                </button>
              )
            )}

            {conversations.length ===
              0 && (
              <p className="empty-small">
                Seus amigos aparecerão aqui.
              </p>
            )}

          </div>

          <div className="profile">

            <button className="profile-avatar-button" onClick={openProfileSettings} title="Editar perfil"><Avatar name={user?.displayName || '?'} image={user?.avatarUrl} /></button>

            <div>
              <strong>
                {
                  user
                    ?.displayName
                }
              </strong>

              <small>
                @
                {
                  user
                    ?.username
                }
              </small>
            </div>

            <button
              onClick={
                logout
              }
              title="Sair"
            >
              ↪
            </button>

          </div>

        </aside>
      )}

      {/* ===============================================
          MAIN
      =============================================== */}

      <main className="main">

        {screen ===
          'home' && (
          <Home
            user={
              user
            }
            friends={
              friends
            }
            openCreate={() =>
              setShowCreateServer(
                true
              )
            }
            openJoin={() =>
              setShowJoinServer(
                true
              )
            }
            openFriends={() =>
              setScreen(
                'friends'
              )
            }
          />
        )}

        {screen ===
          'friends' && (
          <Friends
            friends={
              friends
            }
            requests={
              requests
            }
            friendUsername={
              friendUsername
            }
            setFriendUsername={
              setFriendUsername
            }
            sendFriendRequest={
              sendFriendRequest
            }
            acceptFriend={
              acceptFriend
            }
            declineFriend={
              declineFriend
            }
            openDirectMessage={
              openDirectMessage
            }
          />
        )}

        {screen ===
          'dm' &&
          selectedFriend && (
          <DirectMessageScreen
            user={
              user
            }
            friend={
              selectedFriend
            }
            messages={
              messages
            }
            messageText={
              messageText
            }
            setMessageText={
              setMessageText
            }
            sendMessage={
              sendMessage
            }
            messagesEndRef={
              messagesEndRef
            }
          />
        )}

        {screen ===
          'server' &&
          selectedServer && (
          <ServerScreen
            server={
              selectedServer
            }
            muted={
              muted
            }
            deafened={
              deafened
            }
            voiceConnected={
              voiceConnected
            }
            voiceConnecting={
              voiceConnecting
            }
            voiceParticipants={
              voiceParticipants
            }
            screenSharing={
              screenSharing
            }
            screenShareStarting={
              screenShareStarting
            }
            screenTrack={
              screenTrack
            }
            screenSharerName={
              screenSharerName
            }
            screenVideoRef={
              screenVideoRef
            }
            connectVoice={(channelId) => connectVoice(selectedServer, channelId)}
            disconnectVoice={
              disconnectVoice
            }
            toggleMicrophone={
              toggleMicrophone
            }
            toggleDeafen={
              toggleDeafen
            }
            openScreenPicker={
              openScreenPicker
            }
            stopScreenShare={
              stopScreenShare
            }
            copyInvite={copyInvite}
            user={user}
            onServerChange={(nextServer) => { setSelectedServer(nextServer); setServers((current) => current.map((item) => item.id === nextServer.id ? nextServer : item)) }}
            onServerDeleted={() => { setSelectedServer(null); setScreen('home'); void loadServers() }}
          />
        )}

      </main>

      {/* ===============================================
          SCREEN PICKER
      =============================================== */}

      {showScreenPicker && (
        <Modal
          title="O que você quer compartilhar?"
          close={() =>
            setShowScreenPicker(
              false
            )
          }
        >
          <p>
            Escolha uma tela, janela ou jogo.
          </p>

          <div className="screen-source-grid">

            {screenSources.map(
              (source) => (
                <button
                  key={
                    source.id
                  }
                  className="screen-source-card"
                  disabled={
                    screenShareStarting
                  }
                  onClick={() =>
                    startScreenShare(
                      source
                    )
                  }
                >
                  <div className="screen-source-preview">
                    <img
                      src={
                        source.thumbnail
                      }
                      alt={
                        source.name
                      }
                    />
                  </div>

                  <div className="screen-source-name">

                    {source.appIcon && (
                      <img
                        src={
                          source.appIcon
                        }
                        alt=""
                      />
                    )}

                    <span>
                      {
                        source.name
                      }
                    </span>

                  </div>
                </button>
              )
            )}

          </div>

        </Modal>
      )}

      {showProfileSettings && (
        <Modal title="Meu perfil" close={() => setShowProfileSettings(false)}>
          <label className="settings-label">Nome de exibição</label>
          <input className="modal-input" value={profileDisplayName} onChange={(e) => setProfileDisplayName(e.target.value)} />
          <label className="settings-label">Nome de usuário</label>
          <input className="modal-input" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} />
          <label className="settings-label">Foto de perfil</label>
          <input className="modal-file" type="file" accept="image/*" onChange={(e) => pickProfileAvatar(e.target.files?.[0])} />
          {profileAvatar && <img className="settings-image-preview profile-preview" src={profileAvatar} alt="Prévia" />}
          <button className="primary" onClick={() => void saveProfile()}>Salvar perfil</button>
        </Modal>
      )}

      {showCreateServer && (
        <Modal
          title="Criar servidor"
          close={() =>
            setShowCreateServer(
              false
            )
          }
        >
          <p>
            Dê um nome para o espaço da sua galera.
          </p>

          <input
            className="modal-input"
            value={
              newServerName
            }
            onChange={
              (event) =>
                setNewServerName(
                  event.target
                    .value
                )
            }
            placeholder="Ex: Os de Sempre"
          />

          <button
            className="primary"
            onClick={
              createServer
            }
          >
            Criar servidor
          </button>
        </Modal>
      )}

      {showJoinServer && (
        <Modal
          title="Entrar em servidor"
          close={() =>
            setShowJoinServer(
              false
            )
          }
        >
          <p>
            Cole o código que seu amigo mandou.
          </p>

          <input
            className="modal-input code"
            value={
              inviteCode
            }
            onChange={
              (event) =>
                setInviteCode(
                  event.target
                    .value
                    .toUpperCase()
                )
            }
            placeholder="A1B2C3D4"
          />

          <button
            className="primary"
            onClick={
              joinServer
            }
          >
            Entrar
          </button>
        </Modal>
      )}

    </div>
  )
}

// ======================================================
// DIRECT MESSAGE SCREEN
// ======================================================

function DirectMessageScreen({
  user,
  friend,
  messages,
  messageText,
  setMessageText,
  sendMessage,
  messagesEndRef
}: {
  user:
    User | null

  friend:
    User

  messages:
    DirectMessage[]

  messageText:
    string

  setMessageText:
    (
      value: string
    ) => void

  sendMessage:
    (
      event:
        FormEvent
    ) => void

  messagesEndRef:
    RefObject<
      HTMLDivElement |
      null
    >
}) {
  return (
    <div className="dm-page">

      <header className="dm-header">

        <Avatar
          name={
            friend.displayName
          }
        />

        <div>
          <strong>
            {
              friend.displayName
            }
          </strong>

          <span>
            @
            {
              friend.username
            }
          </span>
        </div>

      </header>

      <div className="dm-messages">

        {messages.length ===
          0 && (
          <div className="dm-start">

            <Avatar
              name={
                friend.displayName
              }
            />

            <h2>
              {
                friend.displayName
              }
            </h2>

            <p>
              Esse é o começo da conversa de vocês.
            </p>

          </div>
        )}

        {messages.map(
          (
            message,
            index
          ) => {
            const mine =
              message.senderId ===
              user?.id

            const previous =
              messages[
                index - 1
              ]

            const grouped =
              previous &&
              previous.senderId ===
                message.senderId

            return (
              <div
                key={
                  message.id
                }
                className={
                  mine
                    ? `dm-message mine ${grouped ? 'grouped' : ''}`
                    : `dm-message ${grouped ? 'grouped' : ''}`
                }
              >
                {!grouped && (
                  <Avatar
                    name={
                      mine
                        ? user
                            ?.displayName ||
                          'Você'
                        : friend
                            .displayName
                    }
                  />
                )}

                <div className="dm-message-body">

                  {!grouped && (
                    <div className="dm-message-meta">

                      <strong>
                        {mine
                          ? user
                              ?.displayName
                          : friend
                              .displayName}
                      </strong>

                      <span>
                        {new Date(
                          message.createdAt
                        ).toLocaleTimeString(
                          [],
                          {
                            hour:
                              '2-digit',
                            minute:
                              '2-digit'
                          }
                        )}
                      </span>

                    </div>
                  )}

                  <p>
                    {
                      message.content
                    }
                  </p>

                </div>
              </div>
            )
          }
        )}

        <div
          ref={
            messagesEndRef
          }
        />

      </div>

      <form
        className="dm-composer"
        onSubmit={
          sendMessage
        }
      >

        <input
          value={
            messageText
          }
          onChange={
            (event) =>
              setMessageText(
                event.target
                  .value
              )
          }
          placeholder={`Mensagem para @${friend.username}`}
          autoFocus
        />

        <button
          type="submit"
          disabled={
            !messageText
              .trim()
          }
        >
          Enviar
        </button>

      </form>

    </div>
  )
}

// ======================================================
// LOGO
// ======================================================

function Logo() {
  return (
    <div className="logo">

      <div className="logo-mascot">
        <img
          src="/concord-mascot.png"
          alt="Mascote Concord"
        />
      </div>

      <div>
        <strong>
          Concord
        </strong>

        <span>
          PLAY • TALK • SHARE
        </span>
      </div>

    </div>
  )
}

// ======================================================
// FIELD
// ======================================================

function Field({
  label,
  value,
  setValue,
  placeholder,
  type = 'text',
  prefix
}: {
  label: string
  value: string

  setValue:
    (
      value: string
    ) => void

  placeholder:
    string

  type?:
    string

  prefix?:
    string
}) {
  return (
    <label className="field">

      <span>
        {label}
      </span>

      <div className="field-inner">

        {prefix && (
          <b>
            {prefix}
          </b>
        )}

        <input
          type={
            type
          }
          value={
            value
          }
          placeholder={
            placeholder
          }
          onChange={
            (event) =>
              setValue(
                event.target
                  .value
              )
          }
        />

      </div>

    </label>
  )
}

// ======================================================
// HOME
// ======================================================

function Home({
  user,
  friends,
  openCreate,
  openJoin,
  openFriends
}: {
  user:
    User | null

  friends:
    User[]

  openCreate:
    () => void

  openJoin:
    () => void

  openFriends:
    () => void
}) {
  return (
    <div className="page">

      <header className="page-header">

        <p className="overline">
          CONCORD
        </p>

        <h1>
          E aí,{' '}
          {
            user
              ?.displayName
          }
          .
        </h1>

        <span>
          Onde a call começa antes do jogo.
        </span>

      </header>

      <section className="quick-grid">

        <button
          className="quick-card solar"
          onClick={
            openCreate
          }
        >
          <div className="quick-icon">
            +
          </div>

          <div>
            <strong>
              Criar servidor
            </strong>

            <span>
              Monte o espaço da sua galera
            </span>
          </div>
        </button>

        <button
          className="quick-card mint"
          onClick={
            openJoin
          }
        >
          <div className="quick-icon">
            ↳
          </div>

          <div>
            <strong>
              Entrar por convite
            </strong>

            <span>
              Já recebeu um código?
            </span>
          </div>
        </button>

      </section>

      <section className="section">

        <div className="section-head">

          <div>
            <h2>
              Amigos
            </h2>

            <span>
              {
                Array.isArray(friends)
                  ? friends.length
                  : 0
              } adicionados
            </span>
          </div>

          <button
            className="secondary"
            onClick={
              openFriends
            }
          >
            Ver amigos
          </button>

        </div>

        {(friends ?? []).length === 0 ? (
          <div className="empty-state">

            <div>
              ◌
            </div>

            <h3>
              Ainda tá quieto por aqui.
            </h3>

            <p>
              Adicione sua galera e comece um servidor.
            </p>

            <button
              className="primary small"
              onClick={
                openFriends
              }
            >
              Adicionar amigo
            </button>

          </div>
        ) : (
          <div className="friend-grid">

            {(friends ?? []).map((friend) => (
                <FriendCard
                  key={
                    friend.id
                  }
                  friend={
                    friend
                  }
                />
              )
            )}

          </div>
        )}

      </section>

    </div>
  )
}

// ======================================================
// FRIENDS
// ======================================================

function Friends({
  friends,
  requests,
  friendUsername,
  setFriendUsername,
  sendFriendRequest,
  acceptFriend,
  declineFriend,
  openDirectMessage
}: {
  friends:
    User[]

  requests:
    FriendRequest[]

  friendUsername:
    string

  setFriendUsername:
    (
      value: string
    ) => void

  sendFriendRequest:
    () => void

  acceptFriend:
    (
      id: string
    ) => void

  declineFriend:
    (
      id: string
    ) => void

  openDirectMessage:
    (
      friend: User
    ) => void
}) {
  return (
    <div className="page">

      <header className="page-header compact">

        <p className="overline">
          SUA GALERA
        </p>

        <h1>
          Amigos
        </h1>

      </header>

      <div className="add-friend">

        <div>
          <strong>
            Adicionar amigo
          </strong>

          <span>
            Use o @username exato.
          </span>
        </div>

        <div className="friend-input">

          <b>
            @
          </b>

          <input
            value={
              friendUsername
            }
            onChange={
              (event) =>
                setFriendUsername(
                  event.target
                    .value
                )
            }
            placeholder="username"
          />

          <button
            onClick={
              sendFriendRequest
            }
          >
            Enviar
          </button>

        </div>
      </div>

      {requests.length >
        0 && (
        <section className="section">

          <div className="section-head">
            <h2>
              Pedidos
            </h2>
          </div>

          <div className="request-list">

            {requests.map(
              (request) => (
                <div
                  className="request"
                  key={
                    request.id
                  }
                >

                  <Avatar
                    name={
                      request
                        .user
                        .displayName
                    }
                  />

                  <div>
                    <strong>
                      {
                        request
                          .user
                          .displayName
                      }
                    </strong>

                    <span>
                      @
                      {
                        request
                          .user
                          .username
                      }
                    </span>
                  </div>

                  <div className="request-actions">

                    <button
                      className="accept"
                      onClick={() =>
                        acceptFriend(
                          request.id
                        )
                      }
                    >
                      ✓
                    </button>

                    <button
                      className="decline"
                      onClick={() =>
                        declineFriend(
                          request.id
                        )
                      }
                    >
                      ×
                    </button>

                  </div>
                </div>
              )
            )}

          </div>
        </section>
      )}

      <section className="section">

        <div className="section-head">
          <h2>
            Todos
          </h2>
        </div>

        {(friends ?? []).length === 0 ? (
          <div className="empty-state mini">
            <h3>
              Nenhum amigo ainda.
            </h3>
          </div>
        ) : (
          <div className="friend-grid">

            {(friends ?? []).map((friend) => (
                <FriendCard
                  key={
                    friend.id
                  }
                  friend={
                    friend
                  }
                  onClick={() =>
                    openDirectMessage(
                      friend
                    )
                  }
                />
              )
            )}

          </div>
        )}

      </section>

    </div>
  )
}

// ======================================================
// FRIEND CARD
// ======================================================

function FriendCard({
  friend,
  onClick
}: {
  friend:
    User

  onClick?:
    () => void
}) {
  return (
    <button
      className="friend-card"
      onClick={
        onClick
      }
    >
      <Avatar name={friend.displayName} image={friend.avatarUrl} />

      <div>
        <strong>
          {
            friend.displayName
          }
        </strong>

        <span>
          @
          {
            friend.username
          }
        </span>
      </div>

      <div className="online-dot" />

    </button>
  )
}

// ======================================================
// AVATAR
// ======================================================

function Avatar({ name, image }: { name: string; image?: string }) {
  return (
    <div className="avatar">
      {image ? <img src={image} alt={name} /> : name.charAt(0).toUpperCase()}
    </div>
  )
}

// ======================================================
// SERVER
// ======================================================

function playCallSound(
  sound: 'join' | 'leave' | 'mute' | 'unmute' | 'deafen' | 'undeafen'
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0.12
    master.connect(context.destination)

    const patterns: Record<typeof sound, Array<[number, number, number]>> = {
      join: [[520, 0, 0.08], [720, 0.09, 0.12]],
      leave: [[620, 0, 0.08], [420, 0.09, 0.12]],
      mute: [[520, 0, 0.07], [330, 0.08, 0.10]],
      unmute: [[330, 0, 0.07], [520, 0.08, 0.10]],
      deafen: [[600, 0, 0.06], [450, 0.07, 0.06], [300, 0.14, 0.10]],
      undeafen: [[300, 0, 0.06], [450, 0.07, 0.06], [600, 0.14, 0.10]]
    }

    const now = context.currentTime

    for (const [frequency, delay, duration] of patterns[sound]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(1, now + delay + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration)

      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + duration + 0.02)
    }

    const totalDuration = Math.max(...patterns[sound].map(([, delay, duration]) => delay + duration))
    window.setTimeout(() => void context.close(), (totalDuration + 0.15) * 1000)
  } catch (error) {
    console.warn('Erro ao tocar som da call:', error)
  }
}

function ServerScreen({
  server, user, muted, deafened, voiceConnected, voiceConnecting,
  voiceParticipants, screenSharing, screenShareStarting, screenTrack,
  screenSharerName, screenVideoRef, connectVoice, disconnectVoice,
  toggleMicrophone, toggleDeafen, openScreenPicker, stopScreenShare,
  copyInvite, onServerChange, onServerDeleted
}: {
  server: ConcordServer
  user: User | null
  muted: boolean
  deafened: boolean
  voiceConnected: boolean
  voiceConnecting: boolean
  voiceParticipants: VoiceParticipant[]
  screenSharing: boolean
  screenShareStarting: boolean
  screenTrack: RemoteVideoTrack | LocalVideoTrack | null
  screenSharerName: string
  screenVideoRef: RefObject<HTMLVideoElement | null>
  connectVoice: (channelId: string) => void
  disconnectVoice: () => void
  toggleMicrophone: () => void
  toggleDeafen: () => void
  openScreenPicker: () => void
  stopScreenShare: () => void
  copyInvite: () => void
  onServerChange: (server: ConcordServer) => void
  onServerDeleted: () => void
}) {
  const channels = server.channels ?? []
  const voiceChannels = channels.filter((c) => c.type === 'voice')
  const textChannels = channels.filter((c) => c.type === 'text')
  const [activeVoiceId, setActiveVoiceId] = useState(voiceChannels[0]?.id ?? '')
  const [activeTextId, setActiveTextId] = useState(textChannels[0]?.id ?? '')
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channelType, setChannelType] = useState<'voice' | 'text'>('text')
  const [channelName, setChannelName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [serverName, setServerName] = useState(server.name)
  const [serverIcon, setServerIcon] = useState(server.iconUrl ?? '')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatText, setChatText] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const isOwner = user?.id === server.ownerId

  const request = useCallback(
    async (
      path: string,
      options: RequestInit = {}
    ) => {
      const token = localStorage.getItem('concord_token')

      const headers = new Headers(options.headers)

      if (token) {
        headers.set(
          'Authorization',
          `Bearer ${token}`
        )
      }

      if (options.body !== undefined && options.body !== null) {
        headers.set(
          'Content-Type',
          'application/json'
        )
      }

      const response = await fetch(
        `${API}${path}`,
        {
          ...options,
          headers
        }
      )

      const text = await response.text()

      let data: any = {}

      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          data = {
            error: text
          }
        }
      }

      if (!response.ok) {
        console.error(
          'Erro da API:',
          response.status,
          response.statusText,
          data
        )

        throw new Error(
          data?.message ||
          data?.error ||
          `Erro ${response.status}: ${response.statusText}`
        )
      }

      return data
    },
    []
  )

  const refreshServer = useCallback(async () => {
    const data = await request(`/servers/${server.id}`)
    onServerChange(data.server)
    setMembers(data.members ?? [])
  }, [request, server.id, onServerChange])

  const loadChat = useCallback(async () => {
    if (!activeTextId) return setChatMessages([])
    const data = await request(`/servers/${server.id}/channels/${activeTextId}/messages`)
    setChatMessages(data.messages ?? [])
  }, [request, server.id, activeTextId])

  useEffect(() => { void refreshServer() }, [server.id])
  useEffect(() => {
  if (activeVoiceId) {
    return
  }

  if (activeTextId) {
    void loadChat()
    return
  }

  if (textChannels[0]) {
    setActiveTextId(textChannels[0].id)
  }
}, [
  activeTextId,
  activeVoiceId,
  server.id,
  channels.length
])

  async function createChannel() {
    if (!channelName.trim()) return
    const data = await request(`/servers/${server.id}/channels`, { method: 'POST', body: JSON.stringify({ name: channelName, type: channelType }) })
    onServerChange(data.server)
    setChannelName('')
    setShowChannelModal(false)
    if (channelType === 'text') setActiveTextId(data.channel.id)
    else setActiveVoiceId(data.channel.id)
  }

  async function removeChannel(channelId: string) {
    if (!confirm('Excluir este canal?')) return
    const data = await request(`/servers/${server.id}/channels/${channelId}`, { method: 'DELETE' })
    onServerChange(data.server)
    if (activeTextId === channelId) setActiveTextId('')
    if (activeVoiceId === channelId) setActiveVoiceId('')
  }

  async function sendServerMessage(event: FormEvent) {
    event.preventDefault()
    if (!activeTextId || !chatText.trim()) return
    await request(`/servers/${server.id}/channels/${activeTextId}/messages`, { method: 'POST', body: JSON.stringify({ content: chatText.trim() }) })
    setChatText('')
    await loadChat()
  }

  async function saveServer() {
    const data = await request(`/servers/${server.id}`, { method: 'PATCH', body: JSON.stringify({ name: serverName, iconUrl: serverIcon }) })
    onServerChange(data.server)
    setShowSettings(false)
  }

  async function deleteServer() {
    const confirmed = confirm(
      `Excluir "${server.name}" permanentemente?`
    )

    if (!confirmed) return

    try {
      await request(
        `/servers/${server.id}`,
        {
          method: 'DELETE'
        }
      )

      onServerDeleted()
    } catch (error) {
      console.error(
        'Erro ao excluir servidor:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o servidor.'
      )
    }
  }

  async function changeRole(memberId: string, role: string) {
    await request(`/servers/${server.id}/members/${memberId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
    await refreshServer()
  }

  function pickIcon(file?: File) {
    if (!file) return
    if (file.size > 1024 * 1024) return alert('Use uma imagem de até 1 MB.')
    const reader = new FileReader()
    reader.onload = () => setServerIcon(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const activeText = textChannels.find((c) => c.id === activeTextId)
  const activeVoice = voiceChannels.find((c) => c.id === activeVoiceId) ?? voiceChannels[0]

  return (
    <div className="server-page discord-server-page">
      <header className="server-header">
        <div className="server-title-wrap">
          {server.iconUrl ? <img className="server-header-icon" src={server.iconUrl} alt="" /> : <div className="server-header-fallback">{server.name.charAt(0).toUpperCase()}</div>}
          <div><p className="overline">SERVIDOR</p><h1>{server.name}</h1></div>
        </div>
        <div className="server-header-actions">
          <button className="invite" onClick={copyInvite}>Convite: <strong>{server.inviteCode}</strong></button>
          {isOwner && <button className="server-settings-button" onClick={() => setShowSettings(true)}>⚙</button>}
        </div>
      </header>

      <div className="server-layout">
        <aside className="channels discord-channels">
          <div className="channel-category"><span>CANAIS DE TEXTO</span>{isOwner && <button onClick={() => { setChannelType('text'); setShowChannelModal(true) }}>+</button>}</div>
          {textChannels.map((channel) => <div className="channel-row" key={channel.id}><button className={activeTextId === channel.id ? 'channel active' : 'channel'} onClick={() => {
  setActiveVoiceId('')
  setActiveTextId(channel.id)
}}># {channel.name}</button>{isOwner && <button className="channel-delete" onClick={() => void removeChannel(channel.id)}>×</button>}</div>)}
          {textChannels.length === 0 && <p className="channel-empty">Nenhum canal de texto</p>}

          <div className="channel-category voice-category"><span>CANAIS DE VOZ</span>{isOwner && <button onClick={() => { setChannelType('voice'); setShowChannelModal(true) }}>+</button>}</div>
          {voiceChannels.map((channel) => (
  <div className="channel-row" key={channel.id}>
    <button
      className={activeVoice?.id === channel.id ? 'channel active' : 'channel'}
      onClick={async () => {
        // Sai imediatamente do chat de texto
        setActiveTextId('')

        // Define a tela/canal de voz selecionado
        setActiveVoiceId(channel.id)

        // Se já estiver conectado exatamente nessa call,
        // apenas abre novamente a tela dela
        if (activeVoice?.id === channel.id && voiceConnected) {
          return
        }

        // Se estiver em outra call, desconecta primeiro
        if (voiceConnected) {
          await disconnectVoice()
        }

        // Entra automaticamente na call clicada
        await connectVoice(channel.id)
      }}
    >
      🔊 {channel.name}

      {voiceConnected && activeVoice?.id === channel.id && (
        <small className="channel-live">
          ● AO VIVO
        </small>
      )}
    </button>

    {isOwner && voiceChannels.length > 1 && (
      <button
        className="channel-delete"
        onClick={(event) => {
          event.stopPropagation()
          void removeChannel(channel.id)
        }}
      >
        ✕
      </button>
    )}
  </div>
))}
          {voiceConnected && <div className="channel-participants">{(voiceParticipants ?? []).map((participant) => <div key={participant.identity} className={participant.isSpeaking ? 'channel-participant speaking' : 'channel-participant'}><span className="participant-dot"/><span>{participant.name}</span></div>)}</div>}
        </aside>

        {activeText ? (
          <section className="server-chat">
            <header className="server-chat-header"><strong># {activeText.name}</strong><span>Converse com os membros do servidor</span></header>
            <div className="server-chat-messages">{chatMessages.length === 0 ? <div className="chat-empty"><b>Bem-vindo a #{activeText.name}</b><span>Este é o começo deste canal.</span></div> : chatMessages.map((message) => <div className="server-message" key={message.id}><Avatar name={message.author?.displayName || '?'} image={message.author?.avatarUrl}/><div><div className="server-message-meta"><strong>{message.author?.displayName || 'Usuário'}</strong><small>{new Date(message.createdAt).toLocaleString()}</small></div><p>{message.content}</p></div></div>)}</div>
            <form className="server-chat-input" onSubmit={sendServerMessage}><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder={`Conversar em #${activeText.name}`}/><button type="submit">Enviar</button></form>
          </section>
        ) : (
          <section className="voice-room"><div className="voice-center">
            {!screenTrack && <><div className={voiceConnected ? 'voice-orbit connected' : 'voice-orbit'}>{voiceConnected ? '◉' : '○'}</div><h2>{activeVoice?.name || 'Geral'}</h2></>}
            {!voiceConnected ? <><p>Entre no canal para conversar com a galera.</p><div className="voice-controls"><button className="voice-button share" onClick={() => activeVoice && connectVoice(activeVoice.id)} disabled={voiceConnecting || !activeVoice}>{voiceConnecting ? 'Conectando...' : 'Entrar na call'}</button></div></> : <>
              {screenTrack && <div className="screen-share-stage"><div className="screen-share-head"><div><strong>{screenSharerName}</strong><span>está compartilhando</span></div><span className="stream-quality">1080p • até 60 FPS</span></div><video ref={screenVideoRef} className="screen-share-video" autoPlay playsInline/></div>}
              <div className="voice-participant-grid">{(voiceParticipants ?? []).map((participant) => <div key={participant.identity} className={participant.isSpeaking ? 'voice-person speaking' : 'voice-person'}><div className="voice-avatar">{participant.name.charAt(0).toUpperCase()}</div><strong className="voice-person-name">{participant.name}</strong><span>{participant.isSpeaking ? 'Falando' : 'Na call'}</span></div>)}</div>
              <div className="voice-controls"><button className={muted ? 'voice-button off' : 'voice-button'} onClick={toggleMicrophone}>{muted ? 'Mic desligado' : 'Microfone'}</button><button className={deafened ? 'voice-button off' : 'voice-button'} onClick={toggleDeafen}>{deafened ? 'Áudio desligado' : 'Áudio'}</button><button className={screenSharing ? 'voice-button screen-active' : 'voice-button screen-share'} disabled={screenShareStarting} onClick={screenSharing ? stopScreenShare : openScreenPicker}>{screenShareStarting ? 'Preparando...' : screenSharing ? 'Parar transmissão' : 'Compartilhar tela'}</button><button className="voice-button leave" onClick={disconnectVoice}>Sair da call</button></div>
            </>}
          </div></section>
        )}
      </div>

      {showChannelModal && <Modal title={`Criar canal de ${channelType === 'voice' ? 'voz' : 'texto'}`} close={() => setShowChannelModal(false)}><input className="modal-input" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Nome do canal"/><button className="primary" onClick={() => void createChannel()}>Criar canal</button></Modal>}
      {showSettings && <Modal title="Configurações do servidor" close={() => setShowSettings(false)}><label className="settings-label">Nome do servidor</label><input className="modal-input" value={serverName} onChange={(e) => setServerName(e.target.value)}/><label className="settings-label">Foto do servidor</label><input className="modal-file" type="file" accept="image/*" onChange={(e) => pickIcon(e.target.files?.[0])}/>{serverIcon && <img className="settings-image-preview" src={serverIcon} alt="Prévia"/>}<button className="primary" onClick={() => void saveServer()}>Salvar alterações</button><div className="settings-members"><h3>Membros e cargos</h3>{members.map((member) => <div className="settings-member" key={member.id}><Avatar name={member.displayName} image={member.avatarUrl}/><div><strong>{member.displayName}</strong><small>@{member.username}</small></div>{member.id === server.ownerId ? <span className="owner-badge">DONO</span> : <select value={member.role || 'member'} onChange={(e) => void changeRole(member.id, e.target.value)}><option value="member">Membro</option><option value="moderator">Moderador</option><option value="admin">Administrador</option></select>}</div>)}</div><button className="danger-button" onClick={() => void deleteServer()}>Excluir servidor permanentemente</button></Modal>}
    </div>
  )
}


// ======================================================
// MODAL
// ======================================================

function Modal({
  title,
  close,
  children
}: {
  title:
    string

  close:
    () => void

  children:
    ReactNode
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={
        (event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            close()
          }
        }
      }
    >
      <div className="modal">

        <div className="modal-head">
          <h2>
            {title}
          </h2>

          <button
            onClick={
              close
            }
          >
            ×
          </button>
        </div>

        {children}

      </div>
    </div>
  )
}

export default App