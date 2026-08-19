import { useCallback, useState } from 'react'
import type { FriendRequest, User } from '../types/harmony'
import { apiRequest } from '../services/apiClient'

export function useFriends() {
  const [friends, setFriends] = useState<User[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])

  const loadFriends = useCallback(async () => {
    try {
      const data = await apiRequest('/friends')
      setFriends(data.friends ?? [])
      setRequests(data.incoming ?? [])
    } catch {
      // A restauração de sessão decide quando mostrar erro global.
    }
  }, [])

  const sendFriendRequest = useCallback(async (username: string) => {
    const normalized = username.trim().replace(/^@+/, '')
    if (!normalized) return

    await apiRequest('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: normalized })
    })
  }, [])

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
  }, [])

  return {
    friends,
    requests,
    loadFriends,
    sendFriendRequest,
    acceptFriend,
    declineFriend,
    resetFriends
  }
}
