import type { User } from '../../types/concord'
import { FriendCard } from '../friends/FriendCard'

export function Home({
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

