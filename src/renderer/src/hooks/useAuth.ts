import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthMode, Screen, User } from '../types/concord'
import { apiRequest } from '../services/apiClient'

export function useAuth({
  setScreen
}: {
  setScreen: (screen: Screen) => void
}) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('concord_token')

    if (!token) {
      setSessionReady(true)
      return
    }

    try {
      const data = await apiRequest('/auth/me')
      setUser(data.user)
      setScreen('home')
    } catch {
      localStorage.removeItem('concord_token')
    } finally {
      setSessionReady(true)
    }
  }, [setScreen])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })

      localStorage.setItem('concord_token', data.token)
      setUser(data.user)
      setScreen('home')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não são iguais.')
      return
    }

    setLoading(true)

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, displayName, password })
      })

      localStorage.setItem('concord_token', data.token)
      setUser(data.user)
      setScreen('home')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  const logoutAuth = useCallback(() => {
    localStorage.removeItem('concord_token')
    setUser(null)
    setPassword('')
    setConfirmPassword('')
    setError('')
    setScreen('auth')
  }, [setScreen])

  return {
    authMode,
    setAuthMode,
    user,
    setUser,
    username,
    setUsername,
    displayName,
    setDisplayName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    setError,
    sessionReady,
    handleLogin,
    handleRegister,
    logoutAuth
  }
}
