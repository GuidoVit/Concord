import type { ConcordServer, Screen } from '../../types/concord'
import { Mascot } from '../common/Mascot'

interface ServerRailProps {
  servers: ConcordServer[]
  selectedServer: ConcordServer | null
  screen: Screen
  unreadMessages: number
  goHome: () => void
  openServer: (server: ConcordServer) => void
  openCreateServer: () => void
  openJoinServer: () => void
}

export function ServerRail({
  servers,
  selectedServer,
  screen,
  unreadMessages,
  goHome,
  openServer,
  openCreateServer,
  openJoinServer
}: ServerRailProps) {
  return (
    <aside className="server-rail">
      <button
        className="rail-logo mascot-rail concord-home-button"
        onClick={goHome}
        title="Mensagens diretas"
      >
        <Mascot
          alt="Concord"
          className="rail-mascot-image"
        />

        {unreadMessages > 0 && (
          <span className="concord-unread-badge">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </button>

      <div className="rail-line" />

      {servers.map((server) => (
        <button
          key={server.id}
          className={
            selectedServer?.id === server.id && screen === 'server'
              ? 'server-circle active'
              : 'server-circle'
          }
          title={server.name}
          onClick={() => openServer(server)}
        >
          {server.iconUrl ? (
            <img
              src={server.iconUrl}
              alt={server.name}
              className="server-circle-image"
            />
          ) : (
            server.name.charAt(0).toUpperCase()
          )}
        </button>
      ))}

      <button
        className="server-circle add"
        onClick={openCreateServer}
        title="Criar servidor"
      >
        +
      </button>

      <button
        className="server-circle join"
        onClick={openJoinServer}
        title="Entrar em servidor"
      >
        ↳
      </button>
    </aside>
  )
}
