import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../services/apiClient'

export interface VoicePresenceParticipant {
  identity: string
  name: string
  username?: string
  avatarUrl?: string
  isMuted?: boolean
  isDeafened?: boolean
}

export interface VoiceChannelPresence {
  participants: VoicePresenceParticipant[]
  startedAt: string | null
}

export type VoicePresenceMap = Record<string, VoiceChannelPresence>

export function useVoicePresence(serverId: string) {
  const [presence, setPresence] = useState<VoicePresenceMap>({})

  const refresh = useCallback(async () => {
    if (!serverId) {
      setPresence({})
      return
    }

    try {
      const data = await apiRequest(`/servers/${serverId}/voice-presence`)
      setPresence(data.presence ?? {})
    } catch (error) {
      console.warn('Harmony: falha ao atualizar presença de voz:', error)
    }
  }, [serverId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { presence, refresh }
}
