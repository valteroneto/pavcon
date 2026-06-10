import { useCallback } from 'react'

export interface NotificacaoItem {
  id: string
  tipo: 'aprovacao' | 'prazo' | 'paralisada'
  titulo: string
  descricao: string
  timestamp: string
  lida: boolean
}

const STORAGE_KEY = 'pavcon_notificacoes'

export function loadNotificacoes(): NotificacaoItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
export function saveNotificacoes(list: NotificacaoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function useNotificacoes() {
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const notify = useCallback((titulo: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, { body, icon: '/favicon.ico' })
    }
  }, [])

  return { requestPermission, notify }
}
