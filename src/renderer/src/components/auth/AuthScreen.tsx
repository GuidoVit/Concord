import type { FormEvent } from 'react'

import type { AuthMode } from '../../types/concord'
import { Field } from '../common/Field'
import { Logo } from '../common/Logo'
import { Mascot } from '../common/Mascot'

interface AuthScreenProps {
  authMode: AuthMode
  username: string
  displayName: string
  password: string
  confirmPassword: string
  loading: boolean
  error: string
  setUsername: (value: string) => void
  setDisplayName: (value: string) => void
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  setAuthMode: (mode: AuthMode) => void
  clearError: () => void
  handleLogin: (event: FormEvent) => void
  handleRegister: (event: FormEvent) => void
}

export function AuthScreen({
  authMode,
  username,
  displayName,
  password,
  confirmPassword,
  loading,
  error,
  setUsername,
  setDisplayName,
  setPassword,
  setConfirmPassword,
  setAuthMode,
  clearError,
  handleLogin,
  handleRegister
}: AuthScreenProps) {
  return (
    <div className="app auth-screen">
      <div className="solar-glow" />

      <header className="auth-header">
        <Logo />
      </header>

      <main className="auth-main">
        <section className="auth-card">
          <div className="auth-mascot">
            <Mascot alt="Concord" />
          </div>

          <h1>
            {authMode === 'login'
              ? 'Bem-vindo de volta'
              : 'Crie seu Concord'}
          </h1>

          <p>
            {authMode === 'login'
              ? 'Sua galera tá te esperando.'
              : 'Escolha como você vai aparecer por aqui.'}
          </p>

          <form
            onSubmit={
              authMode === 'login'
                ? handleLogin
                : handleRegister
            }
          >
            {authMode === 'register' && (
              <Field
                label="NOME"
                value={displayName}
                setValue={setDisplayName}
                placeholder="Como seus amigos vão te ver"
              />
            )}

            <Field
              label="USUÁRIO"
              value={username}
              setValue={setUsername}
              placeholder="seuusuario"
              prefix="@"
            />

            <Field
              label="SENHA"
              value={password}
              setValue={setPassword}
              placeholder="••••••••"
              type="password"
            />

            {authMode === 'register' && (
              <Field
                label="CONFIRMAR SENHA"
                value={confirmPassword}
                setValue={setConfirmPassword}
                placeholder="••••••••"
                type="password"
              />
            )}

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}

            <button
              className="primary"
              disabled={loading}
            >
              {loading
                ? 'Aguarde...'
                : authMode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
          </form>

          <div className="divider">
            <span />
            OU
            <span />
          </div>

          <button
            className="secondary full"
            onClick={() => {
              clearError()
              setAuthMode(
                authMode === 'login'
                  ? 'register'
                  : 'login'
              )
            }}
          >
            {authMode === 'login'
              ? 'Criar uma conta'
              : 'Já tenho uma conta'}
          </button>
        </section>
      </main>
    </div>
  )
}
