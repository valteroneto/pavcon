import { useState, useEffect, useCallback } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { useAprovacoes } from '../contexts/AprovacoesContext'
import { useObras } from '../contexts/ObrasContext'
import { faturamentoContratos } from '../data/faturamentoData'
import { type NotificacaoItem, loadNotificacoes, saveNotificacoes } from '../hooks/useNotificacoes'

const TODAY = new Date('2026-06-08')

function diasRestantes(dataFim: string): number {
  return Math.ceil((new Date(dataFim + 'T00:00:00').getTime() - TODAY.getTime()) / 86400000)
}

export default function NotificacoesBadge() {
  const { aprovacoes } = useAprovacoes()
  const { obras } = useObras()
  const [notifs, setNotifs] = useState<NotificacaoItem[]>(loadNotificacoes)
  const [open, setOpen] = useState(false)

  const persist = useCallback((list: NotificacaoItem[]) => {
    setNotifs(list)
    saveNotificacoes(list)
  }, [])

  // Build notifications from live data
  useEffect(() => {
    const existing = loadNotificacoes()
    const existingIds = new Set(existing.map(n => n.id))
    const newNotifs: NotificacaoItem[] = []

    // Aprovações pendentes
    const pendentes = aprovacoes.filter(a => a.status === 'pendente')
    for (const ap of pendentes) {
      const id = `aprov-${ap.id}`
      if (!existingIds.has(id)) {
        newNotifs.push({
          id, tipo: 'aprovacao', lida: false,
          titulo: 'Aprovação pendente',
          descricao: `${ap.obraLabel} — ${ap.campo}`,
          timestamp: ap.dataSolicitacao,
        })
      }
    }

    // Contratos vencendo em ≤7 dias
    for (const c of faturamentoContratos) {
      const dias = diasRestantes(c.data_fim)
      if (dias <= 7 && dias >= 0) {
        const id = `prazo-${c.item}`
        if (!existingIds.has(id)) {
          newNotifs.push({
            id, tipo: 'prazo', lida: false,
            titulo: `Contrato vence em ${dias} dia(s)`,
            descricao: c.contrato,
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    // Obras paralisadas
    const trintaDiasAtras = new Date(TODAY)
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
    for (const o of obras.filter(o => o.status === 'Paralisada')) {
      if (o.dataInicio && new Date(o.dataInicio) < trintaDiasAtras) {
        const id = `paralisada-${o.id}`
        if (!existingIds.has(id)) {
          newNotifs.push({
            id, tipo: 'paralisada', lida: false,
            titulo: 'Obra paralisada há mais de 30 dias',
            descricao: o.localidade,
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    if (newNotifs.length > 0) {
      persist([...existing, ...newNotifs])
    } else {
      setNotifs(existing)
    }
  }, [aprovacoes, obras, persist])

  const unread = notifs.filter(n => !n.lida).length

  const marcarLida = (id: string) => {
    persist(notifs.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  const marcarTodas = () => {
    persist(notifs.map(n => ({ ...n, lida: true })))
  }

  const iconeColor = (tipo: NotificacaoItem['tipo']) => {
    if (tipo === 'aprovacao') return 'text-amber-600 bg-amber-50'
    if (tipo === 'prazo') return 'text-red-600 bg-red-50'
    return 'text-gray-600 bg-gray-100'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        title="Notificações"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">Notificações</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={marcarTodas} className="text-xs text-blue-600 hover:text-blue-800">
                    Marcar todas como lidas
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {notifs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Nenhuma notificação</p>
              ) : [...notifs].reverse().map(n => (
                <div key={n.id} className={`px-4 py-3 flex gap-3 ${n.lida ? 'opacity-50' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${iconeColor(n.tipo)}`}>
                    <Bell size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{n.titulo}</p>
                    <p className="text-xs text-gray-500 truncate">{n.descricao}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(n.timestamp).toLocaleDateString('pt-BR')}</p>
                  </div>
                  {!n.lida && (
                    <button onClick={() => marcarLida(n.id)} className="shrink-0 text-gray-300 hover:text-green-600 transition-colors" title="Marcar como lida">
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
