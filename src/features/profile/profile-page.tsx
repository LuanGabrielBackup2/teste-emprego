
import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { MarketplaceHeader } from '@/components/marketplace-header'
import { sessionQueryKey, useSession } from '@/features/auth/use-session'
import {
  changePassword,
  fetchProfile,
  updateProfile,
} from './profile-api'
import type { MarketplaceUser } from '@/contracts/account'
import {
  readStoredSession,
  saveSession,
} from '@/lib/auth/session-storage'
import './profile.css'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.error?.message
    if (typeof message === 'string') return message

    if (error.response?.status === 409) {
      return 'Este e-mail já está sendo utilizado por outra conta.'
    }

    if (error.response?.status === 401) {
      return 'Sua sessão expirou. Entre novamente.'
    }
  }

  return fallback
}

export function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!session.isLoading && !session.data) {
      void navigate({
        to: '/login',
        search: { returnTo: '/profile' },
        replace: true,
      })
    }
  }, [session.data, session.isLoading, navigate])

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    enabled: Boolean(session.data),
    retry: false,
  })

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name)
      setEmail(profile.data.email)
    }
  }, [profile.data])

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (user: MarketplaceUser) => {
      queryClient.setQueryData(['profile'], user)

      const storedSession = readStoredSession()

      if (storedSession) {
        const updatedSession = { ...storedSession, user }
        saveSession(updatedSession)
        queryClient.setQueryData(sessionQueryKey, updatedSession)
      }

      setProfileMessage('Seus dados foram atualizados com sucesso.')
      setProfileError('')
    },
    onError: (error: unknown) => {
      setProfileError(
        getErrorMessage(error, 'Não foi possível atualizar seus dados.'),
      )
      setProfileMessage('')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      setPasswordMessage('Sua senha foi alterada com sucesso.')
    },
    onError: (error: unknown) => {
      setPasswordError(
        getErrorMessage(error, 'Não foi possível alterar sua senha.'),
      )
      setPasswordMessage('')
    },
  })

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileMessage('')
    setProfileError('')

    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setProfileError('O nome deve ter entre 2 e 100 caracteres.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setProfileError('Informe um endereço de e-mail válido.')
      return
    }

    updateMutation.mutate({
      name: normalizedName,
      email: normalizedEmail,
    })
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError('A nova senha deve ter entre 8 e 128 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não corresponde à nova senha.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('Escolha uma senha diferente da senha atual.')
      return
    }

    passwordMutation.mutate({ currentPassword, newPassword })
  }

  if (session.isLoading || (!session.data && !session.isError)) {
    return (
      <main className="profile-page">
        <p className="profile-loading" role="status">
          Verificando sua sessão...
        </p>
      </main>
    )
  }

  if (!session.data) return null

  return (
    <div className="profile-page">
      <MarketplaceHeader />

      <main className="profile-main">
        <header className="profile-heading">
          <span className="profile-eyebrow">SUA CONTA</span>
          <h1>Meu perfil</h1>
          <p>Gerencie seus dados pessoais e as informações de segurança.</p>
        </header>

        {profile.isLoading && (
          <p className="profile-loading" role="status">
            Carregando seus dados...
          </p>
        )}

        {profile.isError && (
          <section className="profile-panel" role="alert">
            <p>Não foi possível carregar seu perfil.</p>
            <button
              className="profile-button profile-button-secondary"
              type="button"
              onClick={() => void profile.refetch()}
            >
              Tentar novamente
            </button>
          </section>
        )}

        {profile.data && (
          <>
            <section className="profile-panel">
              <div className="profile-panel-heading">
                <div>
                  <span className="profile-eyebrow">INFORMAÇÕES PESSOAIS</span>
                  <h2>Seus dados</h2>
                </div>
                <span className="profile-avatar" aria-hidden="true">
                  {name.trim().charAt(0).toUpperCase() || 'J'}
                </span>
              </div>

              <form onSubmit={handleProfileSubmit} noValidate>
                <label className="profile-field">
                  Nome completo
                  <input
                    autoComplete="name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    maxLength={100}
                    required
                  />
                </label>

                <label className="profile-field">
                  E-mail
                  <input
                    autoComplete="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    required
                  />
                </label>

                {profileError && (
                  <p className="profile-message profile-message-error" role="alert">
                    {profileError}
                  </p>
                )}

                {profileMessage && (
                  <p className="profile-message profile-message-success" role="status">
                    {profileMessage}
                  </p>
                )}

                <button
                  className="profile-button"
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </form>
            </section>

            <section className="profile-panel">
              <div className="profile-panel-heading">
                <div>
                  <span className="profile-eyebrow">SEGURANÇA</span>
                  <h2>Alterar senha</h2>
                </div>
              </div>

              <p className="profile-description">
                Por segurança, informe sua senha atual antes de cadastrar uma nova.
              </p>

              <form onSubmit={handlePasswordSubmit} noValidate>
                <label className="profile-field">
                  Senha atual
                  <input
                    autoComplete="current-password"
                    name="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                    required
                  />
                </label>

                <label className="profile-field">
                  Nova senha
                  <input
                    autoComplete="new-password"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.currentTarget.value)}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <span className="profile-hint">Use entre 8 e 128 caracteres.</span>
                </label>

                <label className="profile-field">
                  Confirmar nova senha
                  <input
                    autoComplete="new-password"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                    required
                  />
                </label>

                {passwordError && (
                  <p className="profile-message profile-message-error" role="alert">
                    {passwordError}
                  </p>
                )}

                {passwordMessage && (
                  <p className="profile-message profile-message-success" role="status">
                    {passwordMessage}
                  </p>
                )}

                <button
                  className="profile-button"
                  type="submit"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? 'Atualizando...' : 'Alterar senha'}
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
