import { ShieldOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export function AdminGuard({ children, fallback }: Props) {
  const { isAdmin } = useAuth()
  if (isAdmin) return <>{children}</>
  return fallback ? (
    <>{fallback}</>
  ) : (
    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2.5 rounded-lg">
      <ShieldOff size={15} className="shrink-0" />
      Apenas administradores podem realizar esta ação.
    </div>
  )
}
