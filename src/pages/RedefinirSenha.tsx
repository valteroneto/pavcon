import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { verifyResetToken, clearResetToken } from '../lib/emailService'
import { useAuth } from '../contexts/AuthContext'
import PavconLogo from '../components/PavconLogo'

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const { resetPassword } = useAuth()

  const [email, setEmail] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    const e = verifyResetToken(token)
    setEmail(e)
  }, [token])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha deve ter pelo menos 6 caracteres.')
    if (senha !== confirma) return setErro('As senhas não coincidem.')
    if (!email) return

    resetPassword(email, senha)
    clearResetToken()
    setSucesso(true)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0a1a3e 0%, #1E3A8A 60%, #0f2557 100%)' }}>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: '#F5921D' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10" style={{ background: '#F5921D' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-2 bg-white rounded-2xl p-4 shadow-xl">
            <PavconLogo size={120} />
          </div>
          <p className="text-blue-200 mt-2 text-center" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', opacity: 0.65 }}>
            GESTÃO DE OBRAS
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 w-full" style={{ background: '#F5921D' }} />

          <div className="p-8">
            {/* Token inválido */}
            {!email ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <XCircle size={28} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Link inválido ou expirado</h2>
                <p className="text-sm text-gray-500">
                  Este link de redefinição não é válido ou já expirou (validade: 30 minutos).
                </p>
                <a href="/" className="inline-block text-sm font-semibold hover:underline" style={{ color: '#F5921D' }}>
                  Voltar ao login
                </a>
              </div>
            ) : sucesso ? (
              /* Sucesso */
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Senha redefinida!</h2>
                <p className="text-sm text-gray-500">Sua nova senha foi salva com sucesso.</p>
                <a href="/" className="inline-block text-sm font-semibold hover:underline" style={{ color: '#F5921D' }}>
                  Ir para o login
                </a>
              </div>
            ) : (
              /* Formulário */
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563eb)' }}>
                    <Lock size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Redefinir senha</h2>
                    <p className="text-xs text-gray-500">{email}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={labelCls}>Nova senha</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres" required
                        className={`${inputCls} pr-10`} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmar nova senha</label>
                    <input type={showPass ? 'text' : 'password'} value={confirma}
                      onChange={e => setConfirma(e.target.value)}
                      placeholder="Repita a senha" required className={inputCls} />
                  </div>

                  {erro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                      {erro}
                    </div>
                  )}

                  <button type="submit"
                    className="w-full text-white font-semibold py-2.5 rounded-lg transition-all text-sm hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #F5921D)' }}>
                    Salvar nova senha
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
