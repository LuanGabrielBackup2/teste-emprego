import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Link, Navigate, useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthErrorResponse, MarketplaceSession } from '@/contracts/account'
import { validateLogin, validateRegistration } from '@/domain/auth'
import { login, register } from './auth-api'
import { clearSession } from '@/lib/auth/session-storage'
import { sessionQueryKey } from './use-session'
import { MarketplaceHeader } from '@/components/marketplace-header'
import './auth.css'

function apiMessage(error: unknown) {
  if (axios.isAxiosError<AuthErrorResponse>(error)) return error.response?.data.error.message ?? 'Não foi possível conectar. Tente novamente.'
  return error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.'
}

function AuthLayout({ children, label, title }: { children: React.ReactNode; label: string; title: string }) {
  return <div className="marketplace-shell"><MarketplaceHeader /><main className="auth-main"><section className="auth-art" aria-label="Jungle Market"><span className="auth-orbit" /><p className="eyebrow">JUNGLE MARKET · CONTA</p><h1>Suas peças.<br /><em>Sua história.</em></h1><p>Entre para manter sua seleção e continuar explorando arte digital.</p><span className="auth-art-foot">ARTE QUE FLORESCE · 2025</span></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">{label}</p><h2>{title}</h2>{children}</div></section></main></div>
}

function AuthField({ id, label, type = 'text', value, onChange, error, autoComplete }: { id: string; label: string; type?: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string }) {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><input id={id} name={id} type={type} value={value} onChange={(event) => onChange(event.currentTarget.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{error && <p className="auth-field-error" id={`${id}-error`} role="alert">{error}</p>}</div>
}

export function LoginPage() {
  const search = useSearch({ from: '/login' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [feedback, setFeedback] = useState('')
  const [session, setSession] = useState<MarketplaceSession | null>(null)
  const [pending, setPending] = useState(false)
  if (session) return <Navigate to={search.returnTo ?? '/'} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback('')
    const validation = validateLogin(email, password); setErrors(validation)
    if (Object.keys(validation).length) return
    setPending(true)
    try {
      const result = await login({ email, password }); setSession(result.session)
      queryClient.setQueryData(sessionQueryKey, result.session)
      queryClient.removeQueries({ queryKey: ['cart'], predicate: (query) => query.queryKey[1] !== result.session.user.id })
      queryClient.setQueryData(['cart', result.session.user.id], result.cart)
      void navigate({ to: search.returnTo ?? '/', replace: true })
    } catch (error) { clearSession(); setFeedback(apiMessage(error)) }
    finally { setPending(false) }
  }
  return <AuthLayout label="BEM-VINDO DE VOLTA" title="Entre na sua conta."><form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
    {feedback && <p className="auth-feedback" role="alert">{feedback}</p>}
    <AuthField id="email" label="E-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
    <AuthField id="password" label="Senha" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
    <button className="button-primary auth-submit" type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    <p className="auth-switch">Ainda não tem conta? <Link to="/register" search={{ returnTo: search.returnTo }}>Criar cadastro</Link></p>
    <details className="demo-credentials"><summary>Credenciais fictícias para teste</summary><p>maya@jungle.test · Jungle#2025<br />noah@jungle.test · Canopy#2025</p></details>
    <p className="auth-simulation-note">Autenticação simulada localmente. Não use senhas reais.</p>
  </form></AuthLayout>
}

export function RegisterPage() {
  const search = useSearch({ from: '/register' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [feedback, setFeedback] = useState(''); const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback('')
    const validation = validateRegistration(name, email, password); setErrors(validation)
    if (Object.keys(validation).length) return
    setPending(true)
    try { const result = await register({ name, email, password }); queryClient.setQueryData(sessionQueryKey, result.session); queryClient.removeQueries({ queryKey: ['cart'], predicate: (query) => query.queryKey[1] !== result.session.user.id }); queryClient.setQueryData(['cart', result.session.user.id], result.cart); void navigate({ to: search.returnTo ?? '/' }) }
    catch (error) { setFeedback(apiMessage(error)) }
    finally { setPending(false) }
  }
  return <AuthLayout label="NOVA NA FLORESTA" title="Crie sua conta."><form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
    {feedback && <p className="auth-feedback" role="alert">{feedback}</p>}
    <AuthField id="name" label="Nome completo" value={name} onChange={setName} error={errors.name} autoComplete="name" />
    <AuthField id="email" label="E-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
    <AuthField id="password" label="Senha (mínimo 8 caracteres)" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" />
    <button className="button-primary auth-submit" type="submit" disabled={pending}>{pending ? 'Criando conta…' : 'Criar conta'}</button>
    <p className="auth-switch">Já tem uma conta? <Link to="/login" search={{ returnTo: search.returnTo }}>Entrar</Link></p>
    <p className="auth-simulation-note">Cadastro e autenticação simulados localmente. Não use senhas reais.</p>
  </form></AuthLayout>
}
