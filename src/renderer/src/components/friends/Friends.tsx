import { useState } from 'react'
import type { FriendRequest, User } from '../../types/concord'
import { Avatar } from '../common/Avatar'
import { FriendCard } from './FriendCard'

export function Friends({
  friends,
  requests,
  friendUsername,
  setFriendUsername,
  sendFriendRequest,
  acceptFriend,
  declineFriend,
  openDirectMessage
}: {
  friends: User[]
  requests: FriendRequest[]
  friendUsername: string
  setFriendUsername: (value: string) => void
  sendFriendRequest: () => Promise<void> | void
  acceptFriend: (id: string) => Promise<void> | void
  declineFriend: (id: string) => Promise<void> | void
  openDirectMessage: (friend: User) => void
}) {
  const [processingId, setProcessingId] = useState('')
  const [sending, setSending] = useState(false)

  async function runRequestAction(id: string, action: (id: string) => Promise<void> | void) {
    try {
      setProcessingId(id)
      await action(id)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.')
    } finally {
      setProcessingId('')
    }
  }

  async function submitFriendRequest() {
    try {
      setSending(true)
      await sendFriendRequest()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header compact">
        <p className="overline">SUA GALERA</p>
        <h1>Amigos</h1>
      </header>

      <div className="add-friend">
        <div>
          <strong>Adicionar amigo</strong>
          <span>Use o @username exato.</span>
        </div>

        <div className="friend-input">
          <b>@</b>
          <input
            value={friendUsername}
            onChange={(event) => setFriendUsername(event.target.value)}
            placeholder="username"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitFriendRequest()
            }}
          />
          <button
            disabled={sending || !friendUsername.trim()}
            onClick={() => void submitFriendRequest()}
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>

      {requests.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Pedidos</h2>
          </div>

          <div className="request-list">
            {requests.map((request) => {
              const processing = processingId === request.id

              return (
                <div className="request" key={request.id}>
                  <Avatar
                    name={request.user.displayName}
                    image={request.user.avatarUrl}
                  />

                  <div>
                    <strong>{request.user.displayName}</strong>
                    <span>@{request.user.username}</span>
                  </div>

                  <div className="request-actions">
                    <button
                      className="accept"
                      disabled={processing}
                      onClick={() => void runRequestAction(request.id, acceptFriend)}
                      title="Aceitar pedido"
                    >
                      ✓
                    </button>

                    <button
                      className="decline"
                      disabled={processing}
                      onClick={() => void runRequestAction(request.id, declineFriend)}
                      title="Recusar pedido"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Todos</h2>
        </div>

        {(friends ?? []).length === 0 ? (
          <div className="empty-state mini">
            <h3>Nenhum amigo ainda.</h3>
          </div>
        ) : (
          <div className="friend-grid">
            {(friends ?? []).map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onClick={() => openDirectMessage(friend)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
