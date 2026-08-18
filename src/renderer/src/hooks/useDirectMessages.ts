import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type {
  Conversation,
  DirectMessage,
  MessageAttachment,
  Screen,
  User
} from '../types/concord'
import { apiRequest } from '../services/apiClient'

export function useDirectMessages({
  user,
  screen,
  setScreen
}: {
  user: User | null
  screen: Screen
  setScreen: (screen: Screen) => void
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [unreadMessages, setUnreadMessages] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const currentScreenRef = useRef<Screen>(screen)
  const selectedFriendRef = useRef<User | null>(null)

  useEffect(() => {
    currentScreenRef.current = screen
  }, [screen])

  useEffect(() => {
    selectedFriendRef.current = selectedFriend
  }, [selectedFriend])

  const loadConversations = useCallback(async () => {
    if (!localStorage.getItem('concord_token')) return

    try {
      const data = await apiRequest('/messages')
      setConversations(data.conversations ?? [])
      setUnreadMessages(Number(data.unreadTotal || 0))
    } catch {
      // Polling auxiliar: falhas temporárias não desmontam a UI.
    }
  }, [])

  const loadMessages = useCallback(async (friendId: string) => {
    try {
      const data = await apiRequest(`/messages/${friendId}`)
      setMessages(data.messages ?? [])

      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 20)
    } catch {
      // nada
    }
  }, [])

  const openDirectMessage = useCallback(async (friend: User) => {
    setSelectedFriend(friend)
    setScreen('dm')
    await loadMessages(friend.id)
    await loadConversations()
  }, [loadConversations, loadMessages, setScreen])

  const sendMessage = useCallback(async (
    event?: FormEvent,
    attachment?: MessageAttachment | null
  ) => {
    event?.preventDefault()

    const friend = selectedFriendRef.current
    if (!friend || (!messageText.trim() && !attachment)) return false

    const text = messageText.trim()
    setMessageText('')

    try {
      await apiRequest(`/messages/${friend.id}`, {
        method: 'POST',
        body: JSON.stringify({
          content: text,
          attachment: attachment || null
        })
      })

      await loadMessages(friend.id)
      await loadConversations()
      return true
    } catch (error) {
      setMessageText(text)
      alert(error instanceof Error ? error.message : 'Erro ao enviar mensagem.')
      return false
    }
  }, [messageText, loadConversations, loadMessages])

  useEffect(() => {
    if (!user) return

    const interval = window.setInterval(async () => {
      await loadConversations()

      const friend = selectedFriendRef.current
      if (currentScreenRef.current === 'dm' && friend) {
        await loadMessages(friend.id)
        await loadConversations()
      }
    }, 1500)

    return () => window.clearInterval(interval)
  }, [user, loadConversations, loadMessages])

  const resetDirectMessages = useCallback(() => {
    setConversations([])
    setSelectedFriend(null)
    setMessages([])
    setMessageText('')
    setUnreadMessages(0)
  }, [])

  return {
    conversations,
    selectedFriend,
    setSelectedFriend,
    messages,
    messageText,
    setMessageText,
    unreadMessages,
    messagesEndRef: messagesEndRef as RefObject<HTMLDivElement | null>,
    loadConversations,
    loadMessages,
    openDirectMessage,
    sendMessage,
    resetDirectMessages
  }
}
