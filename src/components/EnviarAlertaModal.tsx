import { useState, useMemo } from 'react'
import { X, Send, MessageSquare, Phone, Search, AlertTriangle, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Alerta } from '../hooks/useAlertas'

interface Props {
  alerta: Alerta
  onClose: () => void
}

interface Mensagem {
  id: string; de: string; para: string
  texto: string; hora: string; viaWhatsapp: boolean
}

const CHAT_KEY = 'pavcon_chat'

function loadMsgs(): Mensagem[] {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]') } catch { return [] }
}
function saveMsgs(m: Mensagem[]) { localStorage.setItem(CHAT_KEY, JSON.stringify(m)) }
function limpar(n: string) { return n.replace(/\D/g, '') }
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
function corAvatar(name: string) {
  const cores = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']
  return cores[name.charCodeAt(0) % cores.length]
}

const SEV_LABEL: Record<string, string> = {
  critico: '🔴 Crítico', atencao: '🟡 Atenção', info: '🔵 Informativo',
}

export default function EnviarAlertaModal({ alerta, onClose }: Props) {
  const { user, allUsers } = useAuth()

  const destinatarios = allUsers.filter(u => u.id !== user?.id)
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<typeof destinatarios[0] | null>(null)
  const [texto, setTexto] = useState(
    `⚠️ Alerta: ${alerta.titulo}\n\n${alerta.descricao}\n\nObra: ${alerta.obraLocalidade}` +
    (alerta.obraEngenheiro ? `\nEngenheiro: ${alerta.obraEngenheiro}` : '') +
    `\nStatus: ${alerta.obraStatus}`
  )
  const [enviado, setEnviado] = useState<'app' | 'whatsapp' | null>(null)

  const filtrados = useMemo(() =>
    destinatarios.filter(u =>
      u.name.toLowerCase().includes(busca.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(busca.toLowerCase())
    ), [destinatarios, busca])

  const enviarApp = () => {
    if (!texto.trim() || !selecionado || !user) return
    const nova: Mensagem = {
      id: crypto.randomUUID(),
      de: user.name,
      para: selecionado.name,
      texto: texto.trim(),
      hora: new Date().toISOString(),
      viaWhatsapp: false,
    }
    saveMsgs([...loadMsgs(), nova])
    setEnviado('app')
  }

  const enviarWhatsapp = () => {
    if (!texto.trim() || !selecionado || !user) return
    const numero = limpar(selecionado.whatsapp || '')
    if (!numero) {
      alert(`${selecionado.name} não tem número de WhatsApp cadastrado.`)
      return
    }
    // Salva no chat também
    const nova: Mensagem = {
      id: crypto.randomUUID(),
      de: user.name,
      para: selecionado.name,
      texto: texto.trim(),
      hora: new Date().toISOString(),
      viaWhatsapp: true,
    }
    saveMsgs([...loadMsgs(), nova])

    const msg = encodeURIComponent(
      `📋 *PAVCON — Alerta do sistema*\n\n*${alerta.titulo}* (${SEV_LABEL[alerta.severidade]})\n\n${alerta.descricao}\n\n👷 ${alerta.obraLocalidade} · ${alerta.obraStatus}\n\n_Enviado por: ${user.name}_`
    )
    window.open(`https://wa.me/${numero}?text=${msg}`, '_blank')
    setEnviado('whatsapp')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-amber-500" />
              Notificar sobre alerta
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[340px]">
              {SEV_LABEL[alerta.severidade]} · {alerta.titulo}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Resumo do alerta */}
          <div className={`rounded-xl px-4 py-3 text-sm border ${
            alerta.severidade === 'critico' ? 'bg-red-50 border-red-200 text-red-800' :
            alerta.severidade === 'atencao' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <p className="font-semibold">{alerta.titulo}</p>
            <p className="text-xs mt-0.5 opacity-80">{alerta.descricao}</p>
          </div>

          {/* Seleção de destinatário */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2 flex items-center gap-1.5">
              <User size={12} /> Destinatário
            </label>

            {selecionado ? (
              <div className="flex items-center gap-3 border border-blue-300 bg-blue-50 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: corAvatar(selecionado.name) }}>
                  {getInitials(selecionado.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{selecionado.name}</p>
                  <p className="text-xs text-gray-500 truncate">{selecionado.cargo}</p>
                </div>
                {selecionado.whatsapp && (
                  <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                    📱 WhatsApp
                  </span>
                )}
                <button onClick={() => { setSelecionado(null); setBusca(''); setEnviado(null) }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar usuário..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {filtrados.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário encontrado</p>
                  ) : filtrados.map(u => (
                    <button key={u.id} onClick={() => { setSelecionado(u); setEnviado(null) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: corAvatar(u.name) }}>
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.cargo}</p>
                      </div>
                      {u.whatsapp && (
                        <Phone size={12} className="text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2 flex items-center gap-1.5">
              <MessageSquare size={12} /> Mensagem
            </label>
            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); setEnviado(null) }}
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          {/* Feedback de envio */}
          {enviado && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
              enviado === 'app' ? 'bg-green-50 text-green-700' : 'bg-green-50 text-green-700'
            }`}>
              {enviado === 'app'
                ? <><MessageSquare size={14} /> Mensagem enviada no chat do app!</>
                : <><Phone size={14} /> WhatsApp aberto — mensagem registrada no chat.</>
              }
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={enviarApp}
            disabled={!selecionado || !texto.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <MessageSquare size={15} />
            Enviar no App
          </button>
          <button
            onClick={enviarWhatsapp}
            disabled={!selecionado || !texto.trim() || !selecionado?.whatsapp}
            title={selecionado && !selecionado.whatsapp ? 'Usuário sem WhatsApp cadastrado' : ''}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Phone size={15} />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
