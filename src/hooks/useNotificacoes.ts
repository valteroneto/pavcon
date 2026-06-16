import { useCallback, useEffect, useRef } from 'react'
import type { Alerta } from './useAlertas'

export interface NotificacaoItem {
  id: string
  tipo: 'aprovacao' | 'prazo' | 'paralisada'
  titulo: string
  descricao: string
  timestamp: string
  lida: boolean
}

const STORAGE_KEY = 'pavcon_notificacoes'
const ENVIADAS_KEY = 'pavcon_notif_enviadas'

export function loadNotificacoes(): NotificacaoItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
export function saveNotificacoes(list: NotificacaoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function getEnviadas(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ENVIADAS_KEY) ?? '[]')) }
  catch { return new Set() }
}
function salvarEnviadas(ids: Set<string>) {
  localStorage.setItem(ENVIADAS_KEY, JSON.stringify([...ids]))
}

export function useNotificacoes() {
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const notify = useCallback((titulo: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, { body, icon: '/icons/icon-192.png' })
    }
  }, [])

  return { requestPermission, notify }
}

// Hook separado para disparar notificações automáticas de alertas críticos
export function useNotificacoesAlertas(alertas: Alerta[]) {
  const permissaoSolicitada = useRef(false)

  useEffect(() => {
    if (permissaoSolicitada.current) return
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      permissaoSolicitada.current = true
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const criticos = alertas.filter(a => a.severidade === 'critico')
    if (!criticos.length) return

    const enviadas = getEnviadas()
    const novos = criticos.filter(a => !enviadas.has(a.id))
    if (!novos.length) return

    if (novos.length === 1) {
      const a = novos[0]
      new Notification(`⚠️ ${a.titulo}`, {
        body: a.descricao,
        icon: '/icons/icon-192.png',
        tag: a.id,
      })
    } else {
      new Notification(`⚠️ ${novos.length} alertas críticos — Pavcon`, {
        body: novos.slice(0, 3).map(a => `• ${a.obraLocalidade}`).join('\n'),
        icon: '/icons/icon-192.png',
        tag: 'pavcon-criticos',
      })
    }

    novos.forEach(a => enviadas.add(a.id))
    salvarEnviadas(enviadas)
  }, [alertas])
}
