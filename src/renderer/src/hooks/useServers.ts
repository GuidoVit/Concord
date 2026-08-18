import { useCallback, useState } from 'react'
import type { ConcordServer } from '../types/concord'
import { apiRequest } from '../services/apiClient'

export function useServers() {
  const [servers, setServers] = useState<ConcordServer[]>([])
  const [selectedServer, setSelectedServer] = useState<ConcordServer | null>(null)
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [showJoinServer, setShowJoinServer] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const loadServers = useCallback(async () => {
    try {
      const data = await apiRequest('/servers')
      setServers(data.servers ?? [])
    } catch {
      // Sessão/restauração controla o erro global.
    }
  }, [])

  const createServer = useCallback(async () => {
    const name = newServerName.trim()
    if (!name) return null

    const data = await apiRequest('/servers', {
      method: 'POST',
      body: JSON.stringify({ name })
    })

    setNewServerName('')
    setShowCreateServer(false)
    await loadServers()
    setSelectedServer(data.server)
    return data.server as ConcordServer
  }, [newServerName, loadServers])

  const joinServer = useCallback(async () => {
    const code = inviteCode.trim()
    if (!code) return null

    const data = await apiRequest('/servers/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: code })
    })

    setInviteCode('')
    setShowJoinServer(false)
    await loadServers()
    setSelectedServer(data.server)
    return data.server as ConcordServer
  }, [inviteCode, loadServers])

  const copyInvite = useCallback(async () => {
    if (!selectedServer) return
    await navigator.clipboard.writeText(selectedServer.inviteCode)
  }, [selectedServer])

  const updateServer = useCallback((nextServer: ConcordServer) => {
    setSelectedServer(nextServer)
    setServers((current) =>
      current.map((item) => item.id === nextServer.id ? nextServer : item)
    )
  }, [])

  const resetServers = useCallback(() => {
    setServers([])
    setSelectedServer(null)
    setShowCreateServer(false)
    setShowJoinServer(false)
    setNewServerName('')
    setInviteCode('')
  }, [])

  return {
    servers,
    setServers,
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
    createServer,
    joinServer,
    copyInvite,
    updateServer,
    resetServers
  }
}
