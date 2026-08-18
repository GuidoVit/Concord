import {
  useCallback,
  useEffect,
  useState
} from 'react'

import './App.css'

import type {
  ConcordServer,
  Screen
} from './types/concord'
import { Modal } from './components/common/Modal'
import { AuthScreen } from './components/auth/AuthScreen'
import { ServerRail } from './components/layout/ServerRail'
import { SocialSidebar } from './components/layout/SocialSidebar'
import { DirectMessageScreen } from './components/dm/DirectMessageScreen'
import { Friends } from './components/friends/Friends'
import { Home } from './components/home/Home'
import { ServerScreen } from './components/server/ServerScreen'
import { ScreenSharePicker } from './components/screen/ScreenSharePicker'
import { useVoice } from './hooks/useVoice'
import { useScreenShare } from './hooks/useScreenShare'
import { useFriends } from './hooks/useFriends'
import { useServers } from './hooks/useServers'
import { useDirectMessages } from './hooks/useDirectMessages'
import { useAuth } from './hooks/useAuth'
import { apiRequest } from './services/apiClient'
import { WindowChrome } from './components/window/WindowChrome'
import { UpdateBanner } from './components/update/UpdateBanner'
import { useUpdater } from './hooks/useUpdater'

function App() {
  const updater = useUpdater()

  const [
    screen,
    setScreen
  ] =
    useState<Screen>(
      'auth'
    )

  const {
    authMode,
    setAuthMode,
    user,
    setUser,
    username,
    setUsername,
    displayName,
    setDisplayName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    setError,
    sessionReady,
    handleLogin,
    handleRegister,
    logoutAuth
  } = useAuth({ setScreen })

  const {
    friends,
    requests,
    friendUsername,
    setFriendUsername,
    loadFriends,
    sendFriendRequest,
    acceptFriend,
    declineFriend,
    resetFriends
  } = useFriends()

  const {
    servers,
    selectedServer,
    setSelectedServer,
    showCreateServer,
    setShowCreateServer,
    showJoinServer,
    setShowJoinServer,
    newServerName,
    setNewServerName,
    inviteCode,
    setInviteCode,
    loadServers,
    createServer: createServerData,
    joinServer: joinServerData,
    copyInvite,
    updateServer,
    resetServers
  } = useServers()

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

  const {
    conversations,
    selectedFriend,
    messages,
    messageText,
    setMessageText,
    unreadMessages,
    messagesEndRef,
    loadConversations,
    openDirectMessage,
    sendMessage,
    resetDirectMessages
  } = useDirectMessages({
    user,
    screen,
    setScreen
  })

  // ====================================================
  // VOICE + SCREEN SHARE
  // ====================================================

  const voice = useVoice({
    user,
    apiRequest
  })

  const screenShare = useScreenShare({
    livekitRoom: voice.livekitRoom,
    voiceConnected: voice.voiceConnected,
    user
  })

  const {
    muted,
    deafened,
    voiceConnected,
    voiceConnecting,
    voiceParticipants,
    connectedServerId,
    connectedChannelId,
    participantVolumes,
    screenShareVolumes,
    setParticipantVolume,
    setScreenShareVolume,
    connectVoice,
    toggleMicrophone,
    toggleDeafen
  } = voice

  const {
    screenSources,
    showScreenPicker,
    setShowScreenPicker,
    screenSharing,
    screenShareStarting,
    screenTrack,
    screenSharerName,
    screenSharerIdentity,
    screenQuality,
    screenVideoRef,
    openScreenPicker,
    startScreenShare,
    stopScreenShare
  } = screenShare

  const disconnectVoice = useCallback(async () => {
    await screenShare.cleanupBeforeDisconnect()
    await voice.disconnectVoice()
  }, [screenShare.cleanupBeforeDisconnect, voice.disconnectVoice])

  // Carrega os dados sociais assim que uma sessão válida é restaurada/criada.
  useEffect(() => {
    if (!user || !sessionReady) return

    void Promise.all([
      loadFriends(),
      loadServers(),
      loadConversations()
    ])
  }, [user?.id, sessionReady, loadFriends, loadServers, loadConversations])

  function logout() {
    void disconnectVoice()
    resetFriends()
    resetServers()
    resetDirectMessages()
    logoutAuth()
  }

  // ====================================================
  // SERVERS
  // ====================================================

  async function createServer() {
    try {
      const created = await createServerData()
      if (created) setScreen('server')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro.')
    }
  }

  async function joinServer() {
    try {
      const joined = await joinServerData()
      if (joined) setScreen('server')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro.')
    }
  }

  async function openServer(server: ConcordServer) {
    // A call continua ativa em segundo plano ao navegar entre servidores.
    setSelectedServer(server)
    setScreen('server')
  }

  function goHome() {
    setScreen('home')
    void loadConversations()
  }

  // ====================================================
  // AUTH SCREEN
  // ====================================================

  if (screen === 'auth') {
    return (
      <>
        <WindowChrome />
        <UpdateBanner
          state={updater.state}
          visible={updater.visible}
          download={updater.download}
          install={updater.install}
          dismiss={updater.dismiss}
        />
        <AuthScreen
        authMode={authMode}
        username={username}
        displayName={displayName}
        password={password}
        confirmPassword={confirmPassword}
        loading={loading}
        error={error}
        setUsername={setUsername}
        setDisplayName={setDisplayName}
        setPassword={setPassword}
        setConfirmPassword={setConfirmPassword}
        setAuthMode={setAuthMode}
        clearError={() => setError('')}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        />
      </>
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
      <WindowChrome />
      <UpdateBanner
        state={updater.state}
        visible={updater.visible}
        download={updater.download}
        install={updater.install}
        dismiss={updater.dismiss}
      />

      <ServerRail
        servers={servers}
        selectedServer={selectedServer}
        screen={screen}
        unreadMessages={unreadMessages}
        goHome={goHome}
        openServer={(server) => void openServer(server)}
        openCreateServer={() => setShowCreateServer(true)}
        openJoinServer={() => setShowJoinServer(true)}
      />

      {!insideServer && (
        <SocialSidebar
          screen={screen}
          user={user}
          requestsCount={requests.length}
          conversations={conversations}
          selectedFriend={selectedFriend}
          goHome={goHome}
          openFriends={() => {
            void loadFriends()
            setScreen('friends')
          }}
          openDirectMessage={(friend) => void openDirectMessage(friend)}
          openProfileSettings={openProfileSettings}
          logout={logout}
        />
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
            connectedServerId={connectedServerId}
            connectedChannelId={connectedChannelId}
            participantVolumes={participantVolumes}
            screenShareVolumes={screenShareVolumes}
            setParticipantVolume={setParticipantVolume}
            setScreenShareVolume={setScreenShareVolume}
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
            screenSharerIdentity={screenSharerIdentity}
            screenQuality={screenQuality}
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
            onServerChange={updateServer}
            onServerDeleted={() => { setSelectedServer(null); setScreen('home'); void loadServers() }}
          />
        )}

      </main>

      {showScreenPicker && (
        <ScreenSharePicker
          sources={screenSources}
          starting={screenShareStarting}
          close={() => setShowScreenPicker(false)}
          start={startScreenShare}
        />
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


export default App
