import { createClient } from '@supabase/supabase-js'

const url = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL
const key = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key && !url.includes('SEU_PROJETO') && !key.includes('SEU_ANON')
  ? createClient(url, key)
  : null

export interface CronogramaNuvem {
  id: string
  nome: string
  criado_em: string
  atualizado_em: string
  usuario_id: string
  dados: string // JSON serializado
}
