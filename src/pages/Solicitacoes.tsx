import { useState } from 'react'
import { Bell, Send, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Solicitacao {
  id: string
  titulo: string
  descricao: string
  tipo: 'Acesso' | 'Alteração' | 'Suporte' | 'Outro'
  status: 'Pendente' | 'Em Análise' | 'Aprovada' | 'Rejeitada'
  autor: string
  data: string
}

const STORAGE_KEY = 'pavcon_solicitacoes'

function load(): Solicitacao[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function save(s: Solicitacao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const statusConfig = {
  'Pendente':   { icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200' },
  'Em Análise': { icon: AlertCircle, color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-200'  },
  'Aprovada':   { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
  'Rejeitada':  { icon: XCircle,     color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200'   },
}

const tipoColors: Record<string, string> = {
  'Acesso':    'bg-purple-100 text-purple-700',
  'Alteração': 'bg-blue-100 text-blue-700',
  'Suporte':   'bg-orange-100 text-orange-700',
  'Outro':     'bg-gray-100 text-gray-700',
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Solicitacoes() {
  const { user, isAdmin } = useAuth()
  const [lista, setLista] = useState<Solicitacao[]>(load)
  const [abrirForm, setAbrirForm] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<Solicitacao['tipo']>('Suporte')

  const visiveis = isAdmin ? lista : lista.filter(s => s.autor === user?.name)

  const enviar = () => {
    if (!titulo.trim() || !descricao.trim() || !user) return
    const nova: Solicitacao = {
      id: crypto.randomUUID(),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipo,
      status: 'Pendente',
      autor: user.name,
      data: new Date().toISOString(),
    }
    const next = [nova, ...lista]
    setLista(next)
    save(next)
    setTitulo(''); setDescricao(''); setTipo('Suporte'); setAbrirForm(false)
  }

  const alterarStatus = (id: string, status: Solicitacao['status']) => {
    const next = lista.map(s => s.id === id ? { ...s, status } : s)
    setLista(next); save(next)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
            <Bell size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Solicitações</h1>
            <p className="text-xs text-gray-500">
              {isAdmin ? `${lista.length} solicitação(ões) no total` : `${visiveis.length} solicitação(ões) suas`}
            </p>
          </div>
        </div>
        <button onClick={() => setAbrirForm(!abrirForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
          style={{ background: '#1e3a8a' }}>
          <Plus size={16} /> Nova Solicitação
        </button>
      </div>

      {abrirForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Nova Solicitação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Resumo da solicitação..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as Solicitacao['tipo'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                <option>Acesso</option><option>Alteração</option><option>Suporte</option><option>Outro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva com detalhes..." rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAbrirForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            <button onClick={enviar} disabled={!titulo.trim() || !descricao.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ background: '#1e3a8a' }}>
              <Send size={14} /> Enviar
            </button>
          </div>
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <Bell size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map(s => {
            const cfg = statusConfig[s.status]
            const StatusIcon = cfg.icon
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoColors[s.tipo]}`}>{s.tipo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      <StatusIcon size={9} /> {s.status}
                    </span>
                    {isAdmin && <span className="text-[10px] text-gray-400">por <strong>{s.autor}</strong></span>}
                    <span className="text-[10px] text-gray-400 ml-auto">{fmtData(s.data)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{s.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.descricao}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1.5 flex-wrap">
                    {(['Pendente', 'Em Análise', 'Aprovada', 'Rejeitada'] as Solicitacao['status'][]).map(st => (
                      <button key={st} onClick={() => alterarStatus(s.id, st)} disabled={s.status === st}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-30"
                        style={s.status === st ? { background: '#1e3a8a', color: 'white', borderColor: '#1e3a8a' } : {}}>
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
