'use client'

import { useAuth } from './AuthProvider'
import LoginScreen from './LoginScreen'
import BoardContainer from './BoardContainer'

export default function AppGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="spin-ring absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 border-r-cyan-400" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400/70">
          inicializando
        </p>
      </div>
    )
  }

  return user ? <BoardContainer /> : <LoginScreen />
}
