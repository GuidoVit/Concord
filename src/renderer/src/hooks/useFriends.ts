import { useCallback, useState } from 'react'
import type { FriendRequest, User } from '../types/concord'
import { apiRequest } from '../services/apiClient'

export function useFriends() {
  const [friends, setFriends] = useState<User[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [friendUsername, setFriendUsername] = useState('')

  const loadFriends = useCallback(async () => {
    try {
      const data = await apiRequest('/friends')
      setFriends(data.friends ?? [])
      setRequests(data.incoming ?? [])
    } catch {
      // A restauração de sessão decide quando mostrar erro global.
    }
  }, [])

  const sendFriendRequest = useCallback(async () => {
    const username = friendUsername.trim()
    if (!username) return

    try {
      await apiRequest('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username })
      })

      setFriendUsername('')
      alert('Pedido enviado!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao enviar pedido.')
      throw error
    }
  }, [friendUsername])

  const acceptFriend = useCallback(async (id: string) => {
    await apiRequest(`/friends/${id}/accept`, { method: 'POST' })
    await loadFriends()
  }, [loadFriends])

  const declineFriend = useCallback(async (id: string) => {
    await apiRequest(`/friends/${id}`, { method: 'DELETE' })
    await loadFriends()
  }, [loadFriends])

  const resetFriends = useCallback(() => {
    setFriends([])
    setRequests([])
    setFriendUsername('')
  }, [])

  return {
    friends,
    requests,
    friendUsername,
    setFriendUsername,
    loadFriends,
    sendFriendRequest,
    acceptFriend,
    declineFriend,
    resetFriends
  }
}
