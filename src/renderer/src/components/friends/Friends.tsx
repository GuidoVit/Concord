import { useState } from 'react'
import type { FriendRequest, User } from '../../types/concord'
import { Avatar } from '../common/Avatar'
import { FriendCard } from './FriendCard'

export function Friends({
  friends,
  requests,
  sendFriendRequest,
  acceptFriend,
  declineFriend,
  openDirectMessage
}: {
  friends: User[]
  requests: FriendRequest[]
  sendFriendRequest: (username: string) => Promise<void> | void
  acceptFriend: (id: string) => Promise<void> | void
  declineFriend: (id: string) => Promise<void> | void
  openDirectMessage: (friend: User) => void
}) {
  const [processingId, setProcessingId] = useState('')
  const [sending, setSending] = useState(false)
  const [friendUsername, setFriendUsername] = useState('')
  const [status, setStatus] = useState('')

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
    const username = friendUsername.trim().replace(/^@+/, '')
    if (!username || sending) return

    try {
      setSending(true)
      setStatus('')
      await sendFriendRequest(username)
      setFriendUsername('')
      setStatus('Pedido enviado!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro ao enviar pedido.')
    } finally {
      setSending(false)
      window.setTimeout(() => setStatus(''), 2500)
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
          {status && <span>{status}</span>}
        </div>

        <div className="friend-input">
          <b>@</b>
          <input
            value={friendUsername}
            onChange={(event) => setFriendUsername(event.target.value)}
            placeholder="username"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submitFriendRequest()
              }
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
