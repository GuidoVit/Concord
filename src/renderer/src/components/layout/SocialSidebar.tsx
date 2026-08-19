import type { Conversation, Screen, User } from '../../types/harmony'
import { Avatar } from '../common/Avatar'

interface SocialSidebarProps {
  screen: Screen
  user: User | null
  requestsCount: number
  conversations: Conversation[]
  selectedFriend: User | null
  goHome: () => void
  openFriends: () => void
  openDirectMessage: (friend: User) => void
  openProfileSettings: () => void
  logout: () => void
}

export function SocialSidebar({
  screen,
  user,
  requestsCount,
  conversations,
  selectedFriend,
  goHome,
  openFriends,
  openDirectMessage,
  openProfileSettings,
  logout
}: SocialSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <strong>Harmony</strong>
      </div>

      <nav>
        <button
          className={screen === 'home' ? 'nav active' : 'nav'}
          onClick={goHome}
        >
          ⌂ Início
        </button>

        <button
          className={screen === 'friends' ? 'nav active' : 'nav'}
          onClick={openFriends}
        >
          ◎ Amigos

          {requestsCount > 0 && (
            <span className="badge">
              {requestsCount}
            </span>
          )}
        </button>
      </nav>

      <div className="sidebar-label">
        MENSAGENS DIRETAS
      </div>

      <div className="dm-sidebar-list">
        {conversations.map((conversation) => (
          <button
            key={conversation.friend.id}
            className={
              selectedFriend?.id === conversation.friend.id && screen === 'dm'
                ? 'dm-sidebar-item active'
                : 'dm-sidebar-item'
            }
            onClick={() => openDirectMessage(conversation.friend)}
          >
            <Avatar name={conversation.friend.displayName} image={conversation.friend.avatarUrl} />

            <div className="dm-sidebar-info">
              <strong>{conversation.friend.displayName}</strong>
              <small>
                {conversation.lastMessage?.content || (conversation.lastMessage?.attachment ? (conversation.lastMessage.attachment.kind === 'video' ? '🎬 Vídeo' : conversation.lastMessage.attachment.kind === 'sticker' ? '✨ GIF / figurinha' : '🖼 Imagem') : `@${conversation.friend.username}`)}
              </small>
            </div>

            {conversation.unread > 0 && (
              <span className="dm-unread">
                {conversation.unread > 99 ? '99+' : conversation.unread}
              </span>
            )}
          </button>
        ))}

        {conversations.length === 0 && (
          <p className="empty-small">
            Seus amigos aparecerão aqui.
          </p>
        )}
      </div>

      <div className="profile">
        <button
          className="profile-avatar-button"
          onClick={openProfileSettings}
          title="Editar perfil"
        >
          <Avatar
            name={user?.displayName || '?'}
            image={user?.avatarUrl}
          />
        </button>

        <div>
          <strong>{user?.displayName}</strong>
          <small>@{user?.username}</small>
        </div>

        <button
          onClick={openProfileSettings}
          title="Configurações"
          aria-label="Abrir configurações do Harmony"
        >
          ⚙
        </button>

        <button
          onClick={logout}
          title="Sair"
          aria-label="Sair do Harmony"
        >
          ↪
        </button>
      </div>
    </aside>
  )
}
