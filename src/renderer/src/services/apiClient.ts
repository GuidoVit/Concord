import { API } from '../config/api'

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers)

  // Fastify rejeita DELETE/POST sem body quando enviamos
  // Content-Type: application/json com corpo vazio.
  if (options.body !== undefined && options.body !== null) {
    headers.set('Content-Type', 'application/json')
  } else {
    headers.delete('Content-Type')
  }

  const savedToken = localStorage.getItem('harmony_token') ?? localStorage.getItem('concord_token')

  if (savedToken) {
    headers.set('Authorization', `Bearer ${savedToken}`)
  }

  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers
  })

  const raw = await response.text()
  let data: any = {}

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(
        response.ok
          ? 'O servidor retornou uma resposta inválida.'
          : `Erro ${response.status}: resposta inválida do servidor.`
      )
    }
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Algo deu errado.')
  }

  return data
}
