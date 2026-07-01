'use client'

import { useState } from 'react'
import { useAuth } from './AuthProvider'

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const fn = mode === 'in' ? signIn : signUp
    const { error } = await fn(email, password)
    if (error) {
      setError(error)
    } else if (mode === 'up') {
      setInfo('Conta criada! Se a confirmação por e-mail estiver ativa, confirme antes de entrar.')
      setMode('in')
    }
    setBusy(false)
  }

  const inputCls =
    'mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-400/60 focus:bg-white/[0.07]'

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="animate-float-up glass w-full max-w-sm rounded-2xl p-8 shadow-[0_0_60px_-15px_rgba(16,185,129,0.35)]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 text-emerald-300 shadow-[0_0_30px_-6px_rgba(16,185,129,0.7)]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20Z" />
            </svg>
          </div>
          <div>
            <h1 className="accent-gradient text-xl font-bold tracking-tight">Leads · WhatsApp</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500">
              command center
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Senha
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="btn-neon mt-1 rounded-xl px-4 py-2.5 text-sm"
          >
            {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError(null)
            setInfo(null)
          }}
          className="mt-5 w-full text-center text-xs text-neutral-500 transition-colors hover:text-emerald-300"
        >
          {mode === 'in' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  )
}
