import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Phone, Search, ChevronLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '../contexts/AuthContext'

interface Mensagem {
  id: string
  de: string
  para: string
  texto: string
  hora: string
  viaWhatsapp: boolean
}

const STORAGE_KEY = 'pavcon_chat'

function loadMensagens(): Mensagem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveMensagens(msgs: Mensagem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
}
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function limparNumero(n: string) {
  return n.replace(/\D/g, '')
}

export default function Chat() {
  const { user, allUsers } = useAuth()
  const [mensagens, setMensagens] = useState<Mensagem[]>(loadMensagens)
  const [selecionado, setSelecionado] = useState<User | null>(null)
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [whatsappInput, setWhatsappInput] = useState('')
  const [editandoWpp, setEditandoWpp] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const outros = allUsers.filter(u => u.id !== user?.id)
  const filtrados = outros.filter(u =>
    u.name.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  )

  const conversa = selecionado
    ? mensagens.filter(m =>
        (m.de === user?.name && m.para === selecionado.name) ||
        (m.de === selecionado.name && m.para === user?.name)
      )
    : []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa.length])

  const enviar = (viaWhatsapp: boolean) => {
    if (!texto.trim() || !selecionado || !user) return
    const nova: Mensagem = {
      id: crypto.randomUUID(),
      de: user.name,
      para: selecionado.name,
      texto: texto.trim(),
      hora: new Date().toISOString(),
      viaWhatsapp,
    }
    const novas = [...mensagens, nova]
    setMensagens(novas)
    saveMensagens(novas)

    if (viaWhatsapp) {
      const numero = limparNumero(selecionado.whatsapp || '')
      if (!numero) {
        alert(`${selecionado.name} não tem número de WhatsApp cadastrado.`)
        return
      }
      const msg = encodeURIComponent(
        `📋 *PAVCON — Mensagem do sistema*\n\nDe: *${user.name}*\nPara: *${selecionado.name}*\n\n${texto.trim()}`
      )
      window.open(`https://wa.me/${numero}?text=${msg}`, '_blank')
    }
    setTexto('')
  }

  const salvarWhatsapp = () => {
    if (!selecionado) return
    try {
      const key = 'pavcon_users'
      const users = JSON.parse(localStorage.getItem(key) || '[]')
      const updated = users.map((u: User) =>
        u.id === selecionado.id ? { ...u, whatsapp: limparNumero(whatsappInput) } : u
      )
      localStorage.setItem(key, JSON.stringify(updated))
      setSelecionado({ ...selecionado, whatsapp: limparNumero(whatsappInput) })
      setEditandoWpp(false)
    } catch { /* ignore */ }
  }

  const corAvatar = (name: string) => {
    const cores = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']
    return cores[name.charCodeAt(0) % cores.length]
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

      {/* Painel esquerdo */}
      <div className={`flex flex-col border-r border-gray-100 ${selecionado ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0`}>
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" /> Conversas
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar usuário..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8 px-4">Nenhum usuário encontrado</p>
          ) : filtrados.map(u => {
            const msgs = mensagens.filter(m =>
              (m.de === user?.name && m.para === u.name) ||
              (m.de === u.name && m.para === user?.name)
            )
            const ultima = msgs[msgs.length - 1]
            const ativo = selecionado?.id === u.id
            return (
              <button key={u.id}
                onClick={() => { setSelecionado(u); setWhatsappInput(u.whatsapp || ''); setEditandoWpp(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50"
                style={{ background: ativo ? '#eff6ff' : 'transparent' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: corAvatar(u.name) }}>
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                    {ultima && <span className="text-[10px] text-gray-400">{fmtHora(ultima.hora)}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{ultima ? ultima.texto : u.cargo}</p>
                  {!u.whatsapp && (
                    <span className="text-[9px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                      <AlertCircle size={9} /> Sem WhatsApp
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Painel direito */}
      {!selecionado ? (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400 gap-3">
          <MessageSquare size={48} className="opacity-20" />
          <p className="text-sm">Selecione um usuário para iniciar uma conversa</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <button className="md:hidden p-1 rounded-lg hover:bg-gray-200" onClick={() => setSelecionado(null)}>
              <ChevronLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: corAvatar(selecionado.name) }}>
              {getInitials(selecionado.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{selecionado.name}</p>
              <p className="text-xs text-gray-500">{selecionado.cargo} · {selecionado.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {editandoWpp ? (
                <>
                  <input value={whatsappInput} onChange={e => setWhatsappInput(e.target.value)}
                    placeholder="55279999-99999"
                    className="text-xs border border-gray-300 rounded px-2 py-1 w-36 focus:outline-none focus:border-green-400" />
                  <button onClick={salvarWhatsapp}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Salvar</button>
                  <button onClick={() => setEditandoWpp(false)} className="text-xs text-gray-500">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setEditandoWpp(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={selecionado.whatsapp
                    ? { borderColor: '#22c55e', color: '#16a34a', background: '#f0fdf4' }
                    : { borderColor: '#fcd34d', color: '#92400e', background: '#fffbeb' }}>
                  <Phone size={12} />
                  {selecionado.whatsapp ? `+${selecionado.whatsapp}` : 'Definir WhatsApp'}
                </button>
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#f8fafc' }}>
            {conversa.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <MessageSquare size={36} className="opacity-20" />
                <p className="text-sm">Nenhuma mensagem ainda. Inicie a conversa!</p>
              </div>
            ) : conversa.map(m => {
              const minha = m.de === user?.name
              return (
                <div key={m.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[70%]">
                    <div className="rounded-2xl px-4 py-2.5 text-sm shadow-sm"
                      style={minha
                        ? { background: '#1e3a8a', color: 'white', borderBottomRightRadius: 4 }
                        : { background: 'white', color: '#1e293b', borderBottomLeftRadius: 4, border: '1px solid #e2e8f0' }}>
                      {m.texto}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${minha ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] text-gray-400">{fmtHora(m.hora)}</span>
                      {m.viaWhatsapp && (
                        <span className="text-[9px] text-green-600 font-medium flex items-center gap-0.5">
                          <Phone size={8} /> WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            {!selecionado.whatsapp && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertCircle size={13} />
                <span>Cadastre o WhatsApp de <strong>{selecionado.name}</strong> para enviar via WhatsApp.</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(false) } }}
                placeholder={`Mensagem para ${selecionado.name}...`}
                rows={2}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400" />
              <div className="flex flex-col gap-1.5">
                <button onClick={() => enviar(false)} disabled={!texto.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
                  style={{ background: '#1e3a8a' }}>
                  <Send size={15} /> Enviar
                </button>
                <button onClick={() => enviar(true)} disabled={!texto.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
                  style={{ background: '#16a34a' }}>
                  <Phone size={15} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
