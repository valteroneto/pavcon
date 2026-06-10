import { useState, useRef } from 'react'
import {
  ShieldCheck, Eye, Search, Crown, Pencil, X, Camera,
  KeyRound, User, Check, AlertCircle, UserPlus,
} from 'lucide-react'
import { useAuth, SUPER_ADMIN_EMAIL, CARGOS, type Cargo } from '../contexts/AuthContext'
import type { User as UserType } from '../contexts/AuthContext'

// ── Modal de edição de usuário ──────────────────────────────────────────
function EditarUsuarioModal({
  u,
  onClose,
}: {
  u: UserType
  onClose: () => void
}) {
  const { updateUserProfile, updateUserRole, updateUserCargo, resetPassword } = useAuth()
  const isSuperUser = u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  const fileRef = useRef<HTMLInputElement>(null)

  // campos
  const [nome, setNome]     = useState(u.name)
  const [cargo, setCargo]   = useState<Cargo>(u.cargo)
  const [avatar, setAvatar] = useState<string | undefined>(u.avatar)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(u.avatar)

  // senha
  const [novaSenha, setNovaSenha]     = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  // feedback
  const [salvo, setSalvo]     = useState(false)
  const [erroSenha, setErroSenha] = useState('')

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande — máx 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAvatar(result)
      setAvatarPreview(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removerAvatar = () => { setAvatar(undefined); setAvatarPreview(undefined) }

  const salvar = () => {
    setErroSenha('')
    const updates: { name?: string; avatar?: string } = {}
    if (nome.trim() && nome.trim() !== u.name) updates.name = nome.trim()
    if (avatar !== u.avatar) updates.avatar = avatar
    if (Object.keys(updates).length) updateUserProfile(u.id, updates)
    if (!isSuperUser && cargo !== u.cargo) updateUserCargo(u.id, cargo)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const redefinirSenha = () => {
    if (!novaSenha) { setErroSenha('Digite a nova senha'); return }
    if (novaSenha.length < 6) { setErroSenha('Mínimo 6 caracteres'); return }
    if (novaSenha !== confirmar) { setErroSenha('Senhas não coincidem'); return }
    resetPassword(u.email, novaSenha)
    setNovaSenha(''); setConfirmar(''); setErroSenha('')
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Pencil size={16} className="text-blue-600" /> Editar usuário
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {avatarPreview ? (
                <img src={avatarPreview} alt={u.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {getInitials(nome || u.name)}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Alterar foto"
              >
                <Camera size={20} className="text-white" />
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />

            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Camera size={12} /> Alterar foto
              </button>
              {avatarPreview && (
                <button onClick={removerAvatar}
                  className="text-xs text-red-400 hover:underline flex items-center gap-1">
                  <X size={12} /> Remover
                </button>
              )}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
              <User size={12} /> Nome
            </label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Nome completo"
            />
          </div>

          {/* E-mail (somente leitura) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2">
              E-mail (não editável)
            </label>
            <input
              value={u.email}
              readOnly
              className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
            />
          </div>

          {/* Cargo */}
          {!isSuperUser && (
            <div>
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                <ShieldCheck size={12} /> Cargo
              </label>
              <select
                value={cargo}
                onChange={e => setCargo(e.target.value as Cargo)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Redefinição de senha */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <KeyRound size={14} className="text-amber-500" /> Redefinir senha
            </h3>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => { setNovaSenha(e.target.value); setErroSenha('') }}
                placeholder="Nova senha (mín. 6 caracteres)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 pr-20"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={confirmar}
              onChange={e => { setConfirmar(e.target.value); setErroSenha('') }}
              placeholder="Confirmar nova senha"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
            {erroSenha && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={11} /> {erroSenha}
              </p>
            )}
            <button
              onClick={redefinirSenha}
              disabled={!novaSenha}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-xl transition-colors"
            >
              Redefinir senha
            </button>
          </div>

          {/* Papel */}
          {!isSuperUser && (
            <div>
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                <Eye size={12} /> Papel de acesso
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateUserRole(u.id, 'Administrador')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    u.role === 'Administrador'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                  }`}
                >
                  <ShieldCheck size={13} className="inline mr-1" /> Administrador
                </button>
                <button
                  onClick={() => updateUserRole(u.id, 'Visualizador')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    u.role === 'Visualizador'
                      ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                      : 'border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600'
                  }`}
                >
                  <Eye size={13} className="inline mr-1" /> Visualizador
                </button>
              </div>
            </div>
          )}

          {/* Feedback */}
          {salvo && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <Check size={15} /> Alterações salvas com sucesso!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Fechar
          </button>
          <button onClick={salvar}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <Check size={14} /> Salvar alterações
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de novo usuário ───────────────────────────────────────────────
function NovoUsuarioModal({ onClose }: { onClose: () => void }) {
  const { createUser, emailExists } = useAuth()
  const [nome, setNome]         = useState('')
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargo, setCargo]       = useState<Cargo>('Assistente de engenharia')
  const [papel, setPapel]       = useState<'Administrador' | 'Visualizador'>('Visualizador')
  const [mostrar, setMostrar]   = useState(false)
  const [erro, setErro]         = useState('')
  const [criado, setCriado]     = useState(false)

  const criar = () => {
    setErro('')
    if (!nome.trim())  { setErro('Informe o nome'); return }
    if (!email.trim()) { setErro('Informe o e-mail'); return }
    if (!senha)        { setErro('Informe a senha'); return }
    if (senha.length < 6) { setErro('Senha mínima: 6 caracteres'); return }
    if (senha !== confirmar) { setErro('Senhas não coincidem'); return }
    if (emailExists(email.trim())) { setErro('E-mail já cadastrado'); return }

    const r = createUser(nome.trim(), email.trim(), senha, cargo, papel)
    if (!r.ok) { setErro(r.error ?? 'Erro ao criar usuário'); return }
    setCriado(true)
  }

  if (criado) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Usuário criado!</h3>
        <p className="text-sm text-gray-500 mb-6">
          <strong>{nome}</strong> foi adicionado como <strong>{papel}</strong>.
        </p>
        <button onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors">
          Fechar
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <UserPlus size={16} className="text-green-600" /> Novo usuário
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Nome completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Ana Silva"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          {/* E-mail */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>

          {/* Cargo */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Cargo</label>
            <select value={cargo} onChange={e => setCargo(e.target.value as Cargo)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Papel */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Papel de acesso</label>
            <div className="flex gap-2">
              {(['Visualizador', 'Administrador'] as const).map(p => (
                <button key={p} onClick={() => setPapel(p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    papel === p
                      ? p === 'Administrador'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-yellow-50 border-yellow-300 text-yellow-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {p === 'Administrador' ? <ShieldCheck size={13} className="inline mr-1" /> : <Eye size={13} className="inline mr-1" />}
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Senha */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <KeyRound size={12} className="text-amber-500" /> Senha de acesso
            </h3>
            <div className="relative">
              <input type={mostrar ? 'text' : 'password'} value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 pr-20" />
              <button type="button" onClick={() => setMostrar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {mostrar ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <input type={mostrar ? 'text' : 'password'} value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              placeholder="Confirmar senha"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={14} /> {erro}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={criar}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <UserPlus size={14} /> Criar usuário
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────
export default function PainelUsuarios() {
  const { allUsers, updateUserRole, isSuperAdmin } = useAuth()
  const [busca, setBusca]       = useState('')
  const [editando, setEditando] = useState<UserType | null>(null)
  const [novoModal, setNovoModal] = useState(false)

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Acesso restrito ao super-administrador.</p>
        </div>
      </div>
    )
  }

  const filtrados = allUsers.filter(u =>
    u.name.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  )

  const totalAdmins = allUsers.filter(u => u.role === 'Administrador').length
  const totalVisit  = allUsers.filter(u => u.role === 'Visualizador').length

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel de Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os usuários cadastrados no sistema.</p>
        </div>
        <button onClick={() => setNovoModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <UserPlus size={15} /> Novo usuário
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Total de usuários</p>
          <p className="text-3xl font-bold text-blue-700">{allUsers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Administradores</p>
          <p className="text-3xl font-bold text-green-600">{totalAdmins}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Visualizadores</p>
          <p className="text-3xl font-bold text-yellow-600">{totalVisit}</p>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Usuário', 'E-mail', 'Cargo', 'Cadastro', 'Papel', 'Ações'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {filtrados.map(u => {
              const isSuperUser = u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
              return (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  {/* Avatar + Nome */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(u.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 flex items-center gap-1.5 leading-tight">
                          {u.name}
                          {isSuperUser && <Crown size={11} className="text-yellow-500 flex-shrink-0" />}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.email}</td>

                  {/* Cargo */}
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{u.cargo}</td>

                  {/* Data de cadastro */}
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>

                  {/* Papel */}
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      u.role === 'Administrador'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {u.role === 'Administrador' ? <ShieldCheck size={11} /> : <Eye size={11} />}
                      {u.role}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setEditando(u)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal novo usuário */}
      {novoModal && <NovoUsuarioModal onClose={() => setNovoModal(false)} />}

      {/* Modal de edição */}
      {editando && (
        <EditarUsuarioModal
          u={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}
