import { useMemo } from 'react'
import type { Obra } from '../types'

export type TipoAlerta = 'paralisada' | 'prazo_vencido' | 'prazo_risco' | 'idp_critico' | 'idp_atencao' | 'sem_registro'

export interface Alerta {
  id: string
  tipo: TipoAlerta
  severidade: 'critico' | 'atencao' | 'info'
  titulo: string
  descricao: string
  obraId: string
  obraLocalidade: string
  obraEngenheiro: string
  obraStatus: string
  data: string
}

const TODAY = new Date().toISOString().split('T')[0]

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000
  )
}

function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}

export function useAlertas(obras: Obra[]): Alerta[] {
  return useMemo(() => {
    const alertas: Alerta[] = []

    for (const o of obras) {
      if (o.status === 'Concluída') continue

      // 1. Obra paralisada
      if (o.status === 'Paralisada') {
        alertas.push({
          id: `${o.id}-paralisada`,
          tipo: 'paralisada',
          severidade: 'critico',
          titulo: 'Obra paralisada',
          descricao: `${o.localidade} está com status Paralisada`,
          obraId: o.id,
          obraLocalidade: o.localidade,
          obraEngenheiro: o.engenheiro,
          obraStatus: o.status,
          data: TODAY,
        })
      }

      // 2. Prazo vencido (só para Execução e A Iniciar)
      if (o.conclusaoPrevista && o.conclusaoPrevista < TODAY) {
        const dias = diffDays(o.conclusaoPrevista, TODAY)
        alertas.push({
          id: `${o.id}-prazo-vencido`,
          tipo: 'prazo_vencido',
          severidade: 'critico',
          titulo: 'Prazo vencido',
          descricao: `${o.localidade} — prazo venceu há ${dias} dia${dias !== 1 ? 's' : ''} (prev. ${new Date(o.conclusaoPrevista + 'T00:00:00').toLocaleDateString('pt-BR')})`,
          obraId: o.id,
          obraLocalidade: o.localidade,
          obraEngenheiro: o.engenheiro,
          obraStatus: o.status,
          data: TODAY,
        })
        continue // já tem alerta crítico, não duplicar com "em risco"
      }

      // 3. Prazo em risco (vence nos próximos 30 dias)
      if (o.conclusaoPrevista && o.conclusaoPrevista >= TODAY && o.conclusaoPrevista <= addDays(TODAY, 30)) {
        const dias = diffDays(TODAY, o.conclusaoPrevista)
        alertas.push({
          id: `${o.id}-prazo-risco`,
          tipo: 'prazo_risco',
          severidade: 'atencao',
          titulo: 'Prazo em risco',
          descricao: `${o.localidade} — conclusão em ${dias} dia${dias !== 1 ? 's' : ''} (${new Date(o.conclusaoPrevista + 'T00:00:00').toLocaleDateString('pt-BR')})`,
          obraId: o.id,
          obraLocalidade: o.localidade,
          obraEngenheiro: o.engenheiro,
          obraStatus: o.status,
          data: TODAY,
        })
      }

      // 4. IDP crítico (< 70%)
      if (o.status === 'Execução' && o.idp > 0 && o.idp < 70) {
        alertas.push({
          id: `${o.id}-idp-critico`,
          tipo: 'idp_critico',
          severidade: 'critico',
          titulo: 'IDP crítico',
          descricao: `${o.localidade} — IDP em ${o.idp.toFixed(1)}% (abaixo de 70%)`,
          obraId: o.id,
          obraLocalidade: o.localidade,
          obraEngenheiro: o.engenheiro,
          obraStatus: o.status,
          data: TODAY,
        })
      }

      // 5. IDP em atenção (70–89%)
      if (o.status === 'Execução' && o.idp >= 70 && o.idp < 90) {
        alertas.push({
          id: `${o.id}-idp-atencao`,
          tipo: 'idp_atencao',
          severidade: 'atencao',
          titulo: 'IDP em atenção',
          descricao: `${o.localidade} — IDP em ${o.idp.toFixed(1)}% (entre 70% e 90%)`,
          obraId: o.id,
          obraLocalidade: o.localidade,
          obraEngenheiro: o.engenheiro,
          obraStatus: o.status,
          data: TODAY,
        })
      }

      // 6. Sem registro de avanço nos últimos 14 dias (obras em execução)
      if (o.status === 'Execução') {
        const historico = o.historicoAvanco ?? []
        const limite = addDays(TODAY, -14)
        const temRecente = historico.some(h => h.data >= limite)
        if (!temRecente) {
          alertas.push({
            id: `${o.id}-sem-registro`,
            tipo: 'sem_registro',
            severidade: 'info',
            titulo: 'Sem registro recente',
            descricao: `${o.localidade} — nenhum registro de avanço nos últimos 14 dias`,
            obraId: o.id,
            obraLocalidade: o.localidade,
            obraEngenheiro: o.engenheiro,
            obraStatus: o.status,
            data: TODAY,
          })
        }
      }
    }

    // Ordenar: crítico → atenção → info
    const ordem = { critico: 0, atencao: 1, info: 2 }
    return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
  }, [obras])
}
