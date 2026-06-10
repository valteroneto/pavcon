import { useState } from 'react'
import { Building2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Props { onGoToLogin: () => void }

export default function Register({ onGoToLogin }: Props) {
  const { register } = useAuth()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    setTimeout(() => {
      const result = register(name, email, password)
      if (!result.ok) setError(result.error ?? 'Erro ao cadastrar.')
      setLoading(false)
    }, 400)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-4">
            <Building2 size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">GESTÃO DE OBRAS — SESA</h1>
          <p className="text-blue-200 text-sm mt-1">Pavcon Construtora</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Criar conta</h2>
          <p className="text-gray-500 text-sm mb-5">
            Todos os usuários entram como <strong>Visualizador</strong>. O administrador pode promover seu acesso depois.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Seu nome" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
              <input type={showPass ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha" required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <button onClick={onGoToLogin} className="text-blue-700 font-semibold hover:underline">Entrar</button>
          </p>
        </div>
      </div>
    </div>
  )
}
