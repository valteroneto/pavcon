import { useState } from 'react'
import { Eye, EyeOff, Briefcase, Mail, ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth, CARGOS, CARGO_ALCADA, type Cargo } from '../contexts/AuthContext'
import {
  DEV_MODE,
  generateOTP, saveOTP, verifyOTP,
  generateResetToken, sendOTP, sendResetLink,
} from '../lib/emailService'
import PavconLogo from '../components/PavconLogo'

type Tela =
  | 'login'
  | 'cadastro'
  | 'otp'           // confirmação de e-mail após cadastro
  | 'esqueciEmail'  // usuário informa e-mail para recuperação
  | 'resetEnviado'  // link enviado

// Dados do cadastro aguardando confirmação de OTP
interface PendingRegister {
  nome: string; cargo: Cargo; email: string; senha: string
}

export default function Login() {
  const { login, register, emailExists } = useAuth()

  const [tela, setTela] = useState<Tela>('login')

  // ── Login ──────────────────────────────────────────────
  const [loginEmail, setLoginEmail]     = useState('')
  const [loginSenha, setLoginSenha]     = useState('')
  const [loginErro, setLoginErro]       = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPass, setShowPass]         = useState(false)

  // ── Cadastro ───────────────────────────────────────────
  const [nome, setNome]             = useState('')
  const [cargo, setCargo]           = useState<Cargo>(CARGOS[2])
  const [cadEmail, setCadEmail]     = useState('')
  const [cadSenha, setCadSenha]     = useState('')
  const [cadConfirm, setCadConfirm] = useState('')
  const [cadErro, setCadErro]       = useState('')
  const [cadLoading, setCadLoading] = useState(false)
  const [pending, setPending]       = useState<PendingRegister | null>(null)

  // ── OTP ────────────────────────────────────────────────
  const [otpInput, setOtpInput]     = useState('')
  const [otpErro, setOtpErro]       = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [devCode, setDevCode]       = useState('')   // DEV_MODE

  // ── Esqueci senha ──────────────────────────────────────
  const [esqEmail, setEsqEmail]     = useState('')
  const [esqErro, setEsqErro]       = useState('')
  const [esqLoading, setEsqLoading] = useState(false)
  const [devLink, setDevLink]       = useState('')   // DEV_MODE

  // ──────────────────────────────────────────────────────
  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  // ── Handlers ───────────────────────────────────────────

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginErro('')
    setLoginLoading(true)
    setTimeout(() => {
      const r = login(loginEmail, loginSenha)
      if (!r.ok) setLoginErro(r.error ?? 'Erro ao entrar.')
      setLoginLoading(false)
    }, 400)
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setCadErro('')
    if (cadSenha.length < 6) return setCadErro('A senha deve ter pelo menos 6 caracteres.')
    if (cadSenha !== cadConfirm) return setCadErro('As senhas não coincidem.')
    if (emailExists(cadEmail)) return setCadErro('Este e-mail já está cadastrado.')
    setCadLoading(true)

    const code = generateOTP()
    saveOTP(cadEmail, code)
    const result = await sendOTP(cadEmail, nome, code)

    if (!result.ok) {
      setCadErro('Erro ao enviar e-mail. Tente novamente.')
      setCadLoading(false)
      return
    }

    setPending({ nome, cargo, email: cadEmail, senha: cadSenha })
    if (DEV_MODE && result.devCode) setDevCode(result.devCode)
    setOtpInput('')
    setOtpErro('')
    setCadLoading(false)
    setTela('otp')
  }

  const handleVerificarOTP = (e: React.FormEvent) => {
    e.preventDefault()
    setOtpErro('')
    if (!pending) return
    setOtpLoading(true)

    setTimeout(() => {
      const ok = verifyOTP(pending.email, otpInput.trim())
      if (!ok) {
        setOtpErro('Código inválido ou expirado. Verifique e tente novamente.')
        setOtpLoading(false)
        return
      }
      register(pending.nome, pending.email, pending.senha, pending.cargo)
      setOtpLoading(false)
    }, 400)
  }

  const handleReenviarOTP = async () => {
    if (!pending) return
    const code = generateOTP()
    saveOTP(pending.email, code)
    const result = await sendOTP(pending.email, pending.nome, code)
    if (DEV_MODE && result.devCode) setDevCode(result.devCode)
    setOtpErro('Novo código enviado!')
  }

  const handleEsqueciSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    setEsqErro('')
    if (!emailExists(esqEmail)) {
      setEsqErro('E-mail não encontrado no sistema.')
      return
    }
    setEsqLoading(true)

    const token = generateResetToken(esqEmail)
    const link  = `${window.location.origin}/redefinir-senha?token=${token}`

    // Sempre mostra o link na tela (app sem servidor de e-mail configurado)
    setDevLink(link)

    // Tenta enviar e-mail real se EmailJS estiver configurado (ignora erros)
    if (!DEV_MODE) {
      await sendResetLink(esqEmail, esqEmail, link)
    }

    setEsqLoading(false)
    setTela('resetEnviado')
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0a1a3e 0%, #1E3A8A 60%, #0f2557 100%)' }}>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: '#F5921D' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10" style={{ background: '#F5921D' }} />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-2 bg-white rounded-2xl p-4 shadow-xl">
            <PavconLogo size={150} />
          </div>
          <p className="text-blue-200 mt-2 text-center" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', opacity: 0.65 }}>
            GESTÃO DE OBRAS
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 w-full" style={{ background: '#F5921D' }} />

          <div className="p-8">

            {/* ══════════════ TELA: LOGIN ══════════════ */}
            {tela === 'login' && (
              <>
                <div className="grid grid-cols-2 border-b border-gray-100 -mx-8 px-0 mb-6">
                  <button
                    onClick={() => setTela('login')}
                    className="py-3 text-sm font-semibold border-b-2 bg-orange-50/50"
                    style={{ color: '#F5921D', borderColor: '#F5921D' }}>
                    Entrar
                  </button>
                  <button
                    onClick={() => setTela('cadastro')}
                    className="py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                    Criar conta
                  </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className={labelCls}>E-mail</label>
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="seu@email.com" required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Senha</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={loginSenha}
                        onChange={e => setLoginSenha(e.target.value)}
                        placeholder="••••••••" required className={`${inputCls} pr-10`} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="button"
                      onClick={() => { setEsqEmail(''); setEsqErro(''); setTela('esqueciEmail') }}
                      className="mt-1 text-xs hover:underline float-right" style={{ color: '#F5921D' }}>
                      Esqueci minha senha
                    </button>
                  </div>

                  {loginErro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                      {loginErro}
                    </div>
                  )}

                  <button type="submit" disabled={loginLoading}
                    className="w-full disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-sm hover:opacity-90 mt-2"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #F5921D)' }}>
                    {loginLoading ? 'Entrando...' : 'Entrar'}
                  </button>

                  <p className="text-center text-xs text-gray-400 pt-1">
                    Não tem conta?{' '}
                    <button type="button" onClick={() => setTela('cadastro')}
                      className="font-semibold hover:underline" style={{ color: '#F5921D' }}>
                      Cadastre-se aqui
                    </button>
                  </p>
                </form>
              </>
            )}

            {/* ══════════════ TELA: CADASTRO ══════════════ */}
            {tela === 'cadastro' && (
              <>
                <div className="grid grid-cols-2 border-b border-gray-100 -mx-8 px-0 mb-6">
                  <button
                    onClick={() => setTela('login')}
                    className="py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                    Entrar
                  </button>
                  <button
                    onClick={() => setTela('cadastro')}
                    className="py-3 text-sm font-semibold border-b-2 bg-orange-50/50"
                    style={{ color: '#F5921D', borderColor: '#F5921D' }}>
                    Criar conta
                  </button>
                </div>

                <form onSubmit={handleCadastro} className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className={labelCls}>Nome completo</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome" required className={inputCls} />
                  </div>

                  {/* Cargo */}
                  <div>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <Briefcase size={13} className="text-gray-500" /> Cargo na empresa
                      </span>
                    </label>
                    <select value={cargo} onChange={e => setCargo(e.target.value as Cargo)}
                      required className={inputCls}>
                      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {CARGO_ALCADA[cargo] ? (
                      <p className="mt-1 text-[11px] font-medium" style={{
                        color: CARGO_ALCADA[cargo] === 3 ? '#7c3aed' : CARGO_ALCADA[cargo] === 2 ? '#0891b2' : '#16a34a'
                      }}>
                        🔑 Possui {CARGO_ALCADA[cargo]}ª alçada de aprovação
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-gray-400">Este cargo não possui alçada de aprovação</p>
                    )}
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className={labelCls}>E-mail</label>
                    <input type="email" value={cadEmail} onChange={e => setCadEmail(e.target.value)}
                      placeholder="seu@email.com" required className={inputCls} />
                  </div>

                  {/* Senha */}
                  <div>
                    <label className={labelCls}>Senha</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={cadSenha}
                        onChange={e => setCadSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres" required className={`${inputCls} pr-10`} />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar */}
                  <div>
                    <label className={labelCls}>Confirmar senha</label>
                    <input type={showPass ? 'text' : 'password'} value={cadConfirm}
                      onChange={e => setCadConfirm(e.target.value)}
                      placeholder="Repita a senha" required className={inputCls} />
                  </div>

                  {cadErro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                      {cadErro}
                    </div>
                  )}

                  <button type="submit" disabled={cadLoading}
                    className="w-full disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-sm hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #F5921D)' }}>
                    {cadLoading ? 'Enviando código...' : 'Criar conta'}
                  </button>

                  <p className="text-center text-xs text-gray-400 pt-1">
                    Já tem conta?{' '}
                    <button type="button" onClick={() => setTela('login')}
                      className="font-semibold hover:underline" style={{ color: '#F5921D' }}>
                      Entrar
                    </button>
                  </p>
                </form>
              </>
            )}

            {/* ══════════════ TELA: OTP ══════════════ */}
            {tela === 'otp' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setTela('cadastro')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563eb)' }}>
                    <ShieldCheck size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Confirmação de e-mail</h2>
                    <p className="text-xs text-gray-500">{pending?.email}</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-blue-700">
                  <Mail size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Enviamos um código de 6 dígitos para o seu e-mail.
                    Verifique também a pasta de spam. O código expira em <strong>10 minutos</strong>.
                  </span>
                </div>

                {/* DEV MODE: mostra o código na tela */}
                {DEV_MODE && devCode && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-center">
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">Modo desenvolvimento</p>
                    <p className="text-xs text-amber-700 mb-1">E-mail real não configurado. Use o código abaixo:</p>
                    <p className="text-2xl font-mono font-black text-amber-800 tracking-[0.3em]">{devCode}</p>
                  </div>
                )}

                <form onSubmit={handleVerificarOTP} className="space-y-4">
                  <div>
                    <label className={labelCls}>Código de verificação</label>
                    <input
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      required
                      className={`${inputCls} text-center text-xl font-mono tracking-[0.4em]`}
                    />
                  </div>

                  {otpErro && (
                    <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                      otpErro.includes('enviado')
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {otpErro}
                    </div>
                  )}

                  <button type="submit" disabled={otpLoading || otpInput.length < 6}
                    className="w-full disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #F5921D)' }}>
                    {otpLoading ? 'Verificando...' : 'Confirmar e criar conta'}
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    Não recebeu?{' '}
                    <button type="button" onClick={handleReenviarOTP}
                      className="font-semibold hover:underline" style={{ color: '#F5921D' }}>
                      Reenviar código
                    </button>
                  </p>
                </form>
              </div>
            )}

            {/* ══════════════ TELA: ESQUECI SENHA ══════════════ */}
            {tela === 'esqueciEmail' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setTela('login')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Recuperar senha</h2>
                    <p className="text-xs text-gray-500">Enviaremos um link para o seu e-mail</p>
                  </div>
                </div>

                <form onSubmit={handleEsqueciSenha} className="space-y-4">
                  <div>
                    <label className={labelCls}>E-mail cadastrado</label>
                    <input type="email" value={esqEmail} onChange={e => setEsqEmail(e.target.value)}
                      placeholder="seu@email.com" required className={inputCls} />
                  </div>

                  {esqErro && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                      {esqErro}
                    </div>
                  )}

                  <button type="submit" disabled={esqLoading}
                    className="w-full disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                    style={{ background: 'linear-gradient(135deg, #1E3A8A, #F5921D)' }}>
                    {esqLoading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>
                </form>
              </div>
            )}

            {/* ══════════════ TELA: RESET ENVIADO ══════════════ */}
            {tela === 'resetEnviado' && (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail size={26} className="text-green-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Link de redefinição gerado!</h2>
                <p className="text-sm text-gray-500">
                  Clique no link abaixo para redefinir a senha de <strong>{esqEmail}</strong>.<br />
                  O link expira em <strong>30 minutos</strong>.
                </p>

                {devLink && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-left">
                    <p className="text-xs text-blue-700 font-semibold mb-2">🔗 Link de redefinição de senha:</p>
                    <a href={devLink}
                      className="text-xs text-blue-600 underline break-all hover:text-blue-800"
                      onClick={() => setTela('login')}>
                      {devLink}
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(devLink) }}
                      className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 rounded-lg transition-colors"
                    >
                      Copiar link
                    </button>
                  </div>
                )}

                <button onClick={() => setTela('login')}
                  className="text-sm font-semibold hover:underline" style={{ color: '#F5921D' }}>
                  Voltar ao login
                </button>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-blue-300 opacity-50 mt-6">
          © {new Date().getFullYear()} Pavcon Construtora — Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
