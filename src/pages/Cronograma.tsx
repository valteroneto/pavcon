import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Upload, FileSpreadsheet, Calendar, TrendingUp, Download,
  ChevronRight, ChevronLeft, AlertCircle, CheckCircle2, Clock, Layers, FileText, Pencil, Plus, Trash2, Lock, Unlock,
  Cloud, CloudDownload, Save, X, Loader2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, type CronogramaNuvem } from '../lib/supabase'

// Worker local via import.meta.url — CDN não tem v6.0.227
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Atividade {
  id: string
  eap: string
  nome: string
  etapa: string
  duracaoDias: number
  inicioDia: number   // semana 1-based
  fimDia: number
  predecessoras: string
  recursos: string
  peso: number           // % do custo total
  pesoCumulativo: number
  caminhoCritico: boolean
  marco: boolean
  agendamento: 'auto' | 'manual'
}

interface Resumo {
  prazoTotal: number
  totalAtividades: number
  etapas: string[]
  caminhoCritico: string[]
  premissas: string[]
  dataInicio: string
}

// ─── Mapa de etapas por palavras-chave ───────────────────────────────────────

const ETAPA_MAP: { etapa: string; keywords: string[]; ordem: number; cor: string }[] = [
  { etapa: 'Mobilização',              keywords: ['mobil', 'placa', 'canteiro', 'instalação provisória', 'acesso'], ordem: 1, cor: '#6b7280' },
  { etapa: 'Demolição/Limpeza',        keywords: ['demoli', 'limpeza', 'raspagem', 'remoção', 'entulho'], ordem: 2, cor: '#92400e' },
  { etapa: 'Terraplenagem',            keywords: ['terraplen', 'aterro', 'escavação', 'compactação', 'corte'], ordem: 3, cor: '#78350f' },
  { etapa: 'Fundação',                 keywords: ['fundação', 'estaca', 'sapata', 'bloco', 'radier', 'tubulão'], ordem: 4, cor: '#7c3aed' },
  { etapa: 'Estrutura',                keywords: ['estrutura', 'concreto', 'forma', 'ferragem', 'armação', 'viga', 'pilar', 'laje', 'fck'], ordem: 5, cor: '#2563eb' },
  { etapa: 'Alvenaria',                keywords: ['alvenaria', 'tijolo', 'bloco cerâmico', 'bloco de concreto', 'vedação'], ordem: 6, cor: '#d97706' },
  { etapa: 'Cobertura',                keywords: ['cobertura', 'telhado', 'telha', 'cumeeira', 'calha', 'rufo', 'estrutura metálica', 'madeiramento'], ordem: 7, cor: '#059669' },
  { etapa: 'Instalações Hidrosanitárias', keywords: ['hidro', 'sanitár', 'esgoto', 'água fria', 'água quente', 'tubulação', 'pvc', 'registro', 'torneira', 'louça', 'bacia', 'pia', 'tanque'], ordem: 8, cor: '#0891b2' },
  { etapa: 'Instalações Elétricas',    keywords: ['elétric', 'eletric', 'fiação', 'conduíte', 'quadro', 'disjuntor', 'tomada', 'interruptor', 'luminária', 'aterramento'], ordem: 9, cor: '#f59e0b' },
  { etapa: 'Revestimentos',            keywords: ['revestimento', 'reboco', 'chapisco', 'emboço', 'cerâmica', 'porcelanato', 'piso', 'azulejo', 'argamassa', 'rejunte', 'gesso'], ordem: 10, cor: '#ec4899' },
  { etapa: 'Esquadrias',               keywords: ['esquadria', 'porta', 'janela', 'vidro', 'veneziana', 'portão', 'fechadura', 'dobradiça'], ordem: 11, cor: '#8b5cf6' },
  { etapa: 'Pintura',                  keywords: ['pintura', 'tinta', 'selador', 'massa corrida', 'textura', 'verniz', 'impermeabilização'], ordem: 12, cor: '#f97316' },
  { etapa: 'Urbanização',              keywords: ['urban', 'calçada', 'passeio', 'meio-fio', 'jardim', 'paisagismo', 'estacionamento', 'drenagem'], ordem: 13, cor: '#10b981' },
  { etapa: 'Limpeza Final',            keywords: ['limpeza final', 'entrega', 'acabamento final'], ordem: 14, cor: '#6366f1' },
  { etapa: 'Desmobilização',           keywords: ['desmobil', 'retirada de equipamento', 'remoção de canteiro'], ordem: 15, cor: '#4b5563' },
]

function detectarEtapa(nome: string): string {
  const lower = nome.toLowerCase()
  for (const { etapa, keywords } of ETAPA_MAP) {
    if (keywords.some(k => lower.includes(k))) return etapa
  }
  return 'Outros Serviços'
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Parser do orçamento ──────────────────────────────────────────────────────

interface ServicoOrcamento {
  descricao: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  etapaExplicita?: string   // etapa lida diretamente do documento
}

function parseOrcamento(wb: XLSX.WorkBook): ServicoOrcamento[] {
  const servicos: ServicoOrcamento[] = []
  const ignorar = ['descrição', 'item', 'código', 'total', 'subtotal', 'bdi', 'valor', 'referência', 'composição']

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
    let currentEtapaExplicita = ''

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 2) continue

      const cells = row.map(c => String(c ?? '').trim())
      const descIdx = cells.findIndex(c => c.length > 5 && isNaN(Number(c.replace(',', '.'))))
      if (descIdx < 0) continue

      const desc = cells[descIdx]
      if (!desc || desc.length < 4) continue
      if (ignorar.some(ig => desc.toLowerCase().startsWith(ig))) continue

      const nums = cells
        .filter((_, idx) => idx !== descIdx)
        .map(c => parseFloat(c.replace(/\./g, '').replace(',', '.')))
        .filter(n => !isNaN(n) && n > 0)

      // Linha sem valores numéricos expressivos → candidata a cabeçalho de seção
      if (nums.filter(n => n > 100).length === 0) {
        const cabecalho = detectarCabecalhoSecao(desc)
        if (cabecalho) { currentEtapaExplicita = cabecalho }
        continue
      }

      const valorTotal = Math.max(...nums)
      if (valorTotal < 1) continue

      const unidade = cells.find(c => /^(m²|m³|m|un|vb|cj|kg|l|h|t|und|vlb|gl|m2|m3)/i.test(c)) ?? 'vb'

      servicos.push({
        descricao: desc,
        unidade,
        quantidade: nums.length >= 2 ? nums[0] : 1,
        valorUnitario: nums.length >= 3 ? nums[nums.length - 2] : valorTotal,
        valorTotal,
        etapaExplicita: currentEtapaExplicita || undefined,
      })
    }
  }

  return servicos.filter(s => s.descricao.length > 4).slice(0, 200)
}

// ─── Parser PDF ───────────────────────────────────────────────────────────────

function parseBRL(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

function extrairLinhasPDF(items: any[]): string[] {
  // Agrupa itens por posição Y (mesma linha visual)
  const rowMap = new Map<number, { x: number; text: string }[]>()
  for (const item of items) {
    const str = (item.str ?? '').trim()
    if (!str) continue
    const [, , , , x, y] = item.transform as number[]
    const yKey = Math.round(y / 2) * 2
    if (!rowMap.has(yKey)) rowMap.set(yKey, [])
    rowMap.get(yKey)!.push({ x, text: str })
  }
  const sortedYs = [...rowMap.keys()].sort((a, b) => b - a)
  return sortedYs.map(y =>
    rowMap.get(y)!.sort((a, b) => a.x - b.x).map(r => r.text).join(' ')
  ).filter(l => l.trim().length > 0)
}

function parseSienge(linhas: string[]): ServicoOrcamento[] {
  // Estratégia: capturar "Total etapa" por etapa (mais confiável que somar serviços)
  // Fallback: somar "Total serviço" quando não há "Total etapa"
  const porEtapa: Record<string, { descricao: string; valorTotal: number; etapaExplicita: string }> = {}
  const servicosSemEtapa: ServicoOrcamento[] = []

  let currentServico = ''
  let currentEtapaExplicita = ''
  let etapaAcum = 0  // acumula serviços enquanto espera o Total etapa

  for (const linha of linhas) {
    // Cabeçalho de etapa: "Etapa 01.001 - SERVIÇOS PRELIMINARES"
    const mEtapa = linha.match(/^Etapa\s+[\d.]+\s*[-–]\s*(.+)$/i)
    if (mEtapa) {
      currentEtapaExplicita = mEtapa[1].trim()
      currentServico = ''
      etapaAcum = 0
      continue
    }

    // Cabeçalho de subetapa — ignora
    if (/^Subetapa\s+[\d.]+\s*[-–]/i.test(linha)) continue

    // Cabeçalho de serviço
    const mServ = linha.match(/^Servi[çc]o\s+[\d.]+\s*[-–]\s*(.+)$/i)
    if (mServ) {
      currentServico = mServ[1].trim()
      continue
    }

    // Total do serviço → acumula no total da etapa
    const mTotalServ = linha.match(/Total\s+servi[çc]o\s+([\d.]+,\d{2})/i)
    if (mTotalServ && currentServico) {
      const valor = parseBRL(mTotalServ[1])
      if (valor > 0 && currentEtapaExplicita) {
        etapaAcum += valor
      } else if (valor > 0) {
        // Serviço sem etapa pai → guarda individualmente
        servicosSemEtapa.push({
          descricao: currentServico.slice(0, 100),
          unidade: 'vb', quantidade: 1,
          valorUnitario: valor, valorTotal: valor,
        })
      }
      currentServico = ''
      continue
    }

    // Total da etapa — linha mais confiável: usa este valor direto
    const mTotalEtapa = linha.match(/Total\s+etapa\s+([\d.]+,\d{2})/i)
    if (mTotalEtapa && currentEtapaExplicita) {
      const valor = parseBRL(mTotalEtapa[1])
      if (valor > 0) {
        // Se já existia acumulado, substitui pelo total oficial da etapa
        porEtapa[currentEtapaExplicita] = {
          descricao: currentEtapaExplicita,
          valorTotal: valor,
          etapaExplicita: currentEtapaExplicita,
        }
      }
      etapaAcum = 0
      currentServico = ''
      continue
    }
  }

  // Monta lista final: uma entrada por etapa com o valor correto do PDF
  const resultado: ServicoOrcamento[] = Object.values(porEtapa).map(e => ({
    descricao: e.descricao.slice(0, 100),
    unidade: 'vb',
    quantidade: 1,
    valorUnitario: e.valorTotal,
    valorTotal: e.valorTotal,
    etapaExplicita: e.etapaExplicita,
  }))

  return resultado.length > 0 ? resultado : servicosSemEtapa
}

// Detecta se uma linha é cabeçalho de seção do orçamento (sem valores, texto longo)
function detectarCabecalhoSecao(linha: string): string | null {
  const nums = [...linha.matchAll(/[\d.,]+/g)]
    .map(m => parseBRL(m[0]))
    .filter(n => !isNaN(n) && n > 100)
  if (nums.length > 0) return null   // tem valores → não é cabeçalho

  const texto = linha.replace(/^\d+[\s.)-]+/, '').trim()  // remove numeração inicial
  if (texto.length < 5 || texto.length > 120) return null

  // É cabeçalho se contém palavra-chave de etapa OU é tudo maiúsculas com mais de 8 chars
  const temKeyword = ETAPA_MAP.some(e => e.keywords.some(k => texto.toLowerCase().includes(k)))
  const eMaiusculas = texto === texto.toUpperCase() && texto.length > 8 && /[A-ZÀ-Ú]/.test(texto)

  return (temKeyword || eMaiusculas) ? texto : null
}

function parseGenericLinhas(linhas: string[]): ServicoOrcamento[] {
  const servicos: ServicoOrcamento[] = []
  const ignorar = ['descrição', 'item', 'código', 'total geral', 'subtotal', 'bdi', 'valor total', 'referência']
  let currentEtapaExplicita = ''

  for (const limpa of linhas) {
    if (limpa.length < 6) continue
    if (ignorar.some(ig => limpa.toLowerCase().startsWith(ig))) continue

    // Tenta capturar cabeçalho de seção
    const cabecalho = detectarCabecalhoSecao(limpa)
    if (cabecalho) {
      currentEtapaExplicita = cabecalho
      continue
    }

    const nums = [...limpa.matchAll(/[\d.,]+/g)]
      .map(m => parseBRL(m[0]))
      .filter(n => !isNaN(n) && n > 0 && n < 1e9)
    if (nums.length === 0) continue

    const desc = limpa.replace(/[\d.,/]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (desc.length < 5) continue

    const temPalavraChave = ETAPA_MAP.some(e =>
      e.keywords.some(k => desc.toLowerCase().includes(k))
    )
    if (!temPalavraChave && nums.length < 2) continue

    const valorTotal = Math.max(...nums)
    if (valorTotal < 10) continue

    const unidade = limpa.match(/\b(m²|m³|m2|m3|m\b|un|vb|cj|kg|l\b|h\b|t\b|und|gl)\b/i)?.[1] ?? 'vb'
    servicos.push({
      descricao: desc.slice(0, 100),
      unidade,
      quantidade: nums.length >= 2 ? nums[0] : 1,
      valorUnitario: nums.length >= 3 ? nums[nums.length - 2] : valorTotal,
      valorTotal,
      etapaExplicita: currentEtapaExplicita || undefined,
    })
  }

  return servicos.filter(s => s.descricao.length > 5).slice(0, 200)
}

async function parseOrcamentoPDF(buf: ArrayBuffer): Promise<ServicoOrcamento[]> {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const todasLinhas: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const linhasPagina = extrairLinhasPDF(content.items as any[])
    todasLinhas.push(...linhasPagina)
  }

  const textoCompleto = todasLinhas.join('\n')

  // Detecta formato SIENGE/STARIAN
  const isSienge =
    /Insumos\s+Or[çc]ados/i.test(textoCompleto) ||
    /Etapa\s+\d{2}\.\d{3}\s*[-–]/i.test(textoCompleto) ||
    /Servi[çc]o\s+\d{2}\.\d{3}/i.test(textoCompleto) ||
    /Total\s+servi[çc]o/i.test(textoCompleto)

  if (isSienge) {
    const result = parseSienge(todasLinhas)
    if (result.length > 0) return result
  }

  return parseGenericLinhas(todasLinhas)
}

// ─── Gerador de cronograma ────────────────────────────────────────────────────

function gerarCronograma(servicos: ServicoOrcamento[], dataInicio: string): { atividades: Atividade[]; resumo: Resumo } {
  const totalCusto = servicos.reduce((s, sv) => s + sv.valorTotal, 0) || 1

  // Agrupa por etapa — usa etapaExplicita do documento quando disponível,
  // cai em detecção por palavra-chave apenas como fallback
  const grupos: Record<string, ServicoOrcamento[]> = {}
  for (const s of servicos) {
    const eExplicita = s.etapaExplicita ? detectarEtapa(s.etapaExplicita) : null
    const e = eExplicita !== 'Outros Serviços' && eExplicita
      ? eExplicita
      : detectarEtapa(s.descricao)
    if (!grupos[e]) grupos[e] = []
    grupos[e].push(s)
  }

  // Ordena etapas pela ordem técnica
  const etapasOrdenadas = Object.keys(grupos).sort((a, b) => {
    const oa = ETAPA_MAP.find(e => e.etapa === a)?.ordem ?? 99
    const ob = ETAPA_MAP.find(e => e.etapa === b)?.ordem ?? 99
    return oa - ob
  })

  const atividades: Atividade[] = []
  let semanaAtual = 1
  let idCounter = 1
  const etapasIds: Record<string, string> = {}

  for (const etapa of etapasOrdenadas) {
    const svsEtapa = grupos[etapa]
    const custoEtapa = svsEtapa.reduce((s, sv) => s + sv.valorTotal, 0)
    const pesoEtapa = (custoEtapa / totalCusto) * 100

    // Duração da etapa proporcional ao peso (mín 1, máx 84 dias)
    const duracaoEtapa = Math.max(1, Math.min(84, Math.round(pesoEtapa / 5 * 7)))

    const idEtapa = `${idCounter++}`
    etapasIds[etapa] = idEtapa

    // Atividade-mãe da etapa
    const inicioEtapa = semanaAtual
    const fimEtapa = semanaAtual + duracaoEtapa - 1

    // Sub-atividades
    let subSemana = semanaAtual
    const subAtividades: Atividade[] = []

    for (let si = 0; si < Math.min(svsEtapa.length, 6); si++) {
      const sv = svsEtapa[si]
      const pesoSub = (sv.valorTotal / custoEtapa) * pesoEtapa
      const durSub = Math.max(1, Math.round((sv.valorTotal / custoEtapa) * duracaoEtapa))
      const fim = Math.min(subSemana + durSub - 1, fimEtapa)

      subAtividades.push({
        id: `${idCounter++}`,
        eap: `${idEtapa}.${si + 1}`,
        nome: sv.descricao.length > 60 ? sv.descricao.slice(0, 57) + '...' : sv.descricao,
        etapa,
        duracaoDias: durSub,
        inicioDia: subSemana,
        fimDia: fim,
        predecessoras: si === 0 ? '' : String(idCounter - 2),
        recursos: sv.unidade !== 'vb' ? `Equipe ${etapa.split(' ')[0]}` : 'Equipe Geral',
        peso: pesoSub,
        pesoCumulativo: 0,
        caminhoCritico: false,
        marco: false,
        agendamento: 'auto' as const,
      })

      subSemana = Math.min(subSemana + Math.ceil(durSub / 2), fimEtapa)
    }

    atividades.push({
      id: idEtapa,
      eap: idEtapa,
      nome: `▸ ${etapa}`,
      etapa,
      duracaoDias: duracaoEtapa,
      inicioDia: inicioEtapa,
      fimDia: fimEtapa,
      predecessoras: atividades.length > 0 ? String(atividades[atividades.length - 1].id) : '',
      recursos: '',
      peso: pesoEtapa,
      pesoCumulativo: 0,
      caminhoCritico: true,
      marco: false,
      agendamento: 'auto' as const,
    }, ...subAtividades)

    semanaAtual = fimEtapa + 1
  }

  // Marco final
  atividades.push({
    id: String(idCounter),
    eap: String(etapasOrdenadas.length + 1),
    nome: '🏁 Entrega da Obra',
    etapa: 'Marco',
    duracaoDias: 0,
    inicioDia: semanaAtual,
    fimDia: semanaAtual,
    predecessoras: String(idCounter - 1),
    recursos: '',
    peso: 0,
    pesoCumulativo: 100,
    caminhoCritico: true,
    marco: true,
    agendamento: 'auto' as const,
  })

  // Calcula peso cumulativo
  let acum = 0
  for (const a of atividades) {
    if (!a.nome.startsWith('▸')) {
      acum += a.peso
      a.pesoCumulativo = Math.min(100, acum)
    }
  }

  const prazoTotal = semanaAtual
  const premissas = [
    `Prazo calculado proporcionalmente ao peso financeiro de cada etapa`,
    `Jornada de trabalho: 5 dias/semana, 8h/dia`,
    `Paralelismo limitado entre etapas interdependentes`,
    `Valores de referência: SINAPI/SEINFRA vigente`,
    `Mobilização e desmobilização incluídas no prazo total`,
    `Caminho crítico definido pelas etapas de maior peso financeiro`,
  ]

  return {
    atividades,
    resumo: {
      prazoTotal,
      totalAtividades: atividades.filter(a => !a.nome.startsWith('▸')).length,
      etapas: etapasOrdenadas,
      caminhoCritico: etapasOrdenadas.filter(e =>
        (grupos[e].reduce((s, sv) => s + sv.valorTotal, 0) / totalCusto) > 0.1
      ),
      premissas,
      dataInicio,
    },
  }
}

// ─── Exportar Excel (multi-sheet) ─────────────────────────────────────────────

function exportarExcelExecutivo(atividades: Atividade[], dataInicio: string, valorVenda: number) {
  const inicio = new Date(dataInicio)
  const rows = atividades
    .filter(a => !a.marco)
    .map(a => {
      const isMae = a.nome.startsWith('▸')
      const di = new Date(inicio); di.setDate(di.getDate() + (a.inicioDia - 1))
      const df = new Date(inicio); df.setDate(df.getDate() + (a.fimDia - 1))
      const row: Record<string, unknown> = {
        'EAP': a.eap,
        'Atividade': isMae ? a.nome.replace('▸ ', '').toUpperCase() : a.nome,
        'Etapa': isMae ? '' : a.etapa,
        'Duração (dias)': a.duracaoDias,
        'Início': di.toLocaleDateString('pt-BR'),
        'Término': df.toLocaleDateString('pt-BR'),
        'Predecessoras': a.predecessoras,
      }
      if (valorVenda > 0 && isMae) {
        row['Valor Total (R$)'] = +(a.peso / 100 * valorVenda).toFixed(2)
      } else if (valorVenda > 0) {
        row['Valor Total (R$)'] = ''
      }
      return row
    })
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 8 }, { wch: 38 }, { wch: 26 }, { wch: 14 },
    { wch: 13 }, { wch: 13 }, { wch: 12 },
    ...(valorVenda > 0 ? [{ wch: 18 }] : []),
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cronograma Executivo')
  XLSX.writeFile(wb, 'cronograma-executivo.xlsx')
}

function exportarExcel(atividades: Atividade[], dataInicio: string, valorVenda: number) {
  const wb = XLSX.utils.book_new()
  const inicio = new Date(dataInicio)

  // Sheet 1 — Executivo
  const rowsExec = atividades.map(a => {
    const di = new Date(inicio); di.setDate(di.getDate() + (a.inicioDia - 1))
    const df = new Date(inicio); df.setDate(df.getDate() + (a.fimDia - 1))
    const row: Record<string, unknown> = {
      'ID': a.id, 'EAP': a.eap,
      'Atividade': a.nome.replace('▸ ', ''),
      'Etapa': a.etapa,
      'Duração (dias)': a.duracaoDias,
      'Início': di.toLocaleDateString('pt-BR'),
      'Término': df.toLocaleDateString('pt-BR'),
      'Predecessoras': a.predecessoras,
      'Recursos': a.recursos,
      'Peso (%)': +a.peso.toFixed(2),
      'Peso Acum. (%)': +a.pesoCumulativo.toFixed(2),
      'Caminho Crítico': a.caminhoCritico ? 'Sim' : 'Não',
    }
    if (valorVenda > 0) {
      row['Valor (R$)'] = +(a.peso / 100 * valorVenda).toFixed(2)
      row['Valor Acum. (R$)'] = +(a.pesoCumulativo / 100 * valorVenda).toFixed(2)
    }
    return row
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsExec), 'Executivo')

  // Sheet 2 — Gantt (dias como colunas, X = atividade ativa naquele dia)
  const totalDias = atividades.length ? Math.max(...atividades.map(a => a.fimDia)) : 0
  const ganttRows = atividades.map(a => {
    const row: Record<string, unknown> = { 'Atividade': a.nome.replace('▸ ', ''), 'Etapa': a.etapa }
    for (let d = 1; d <= Math.min(totalDias, 180); d++) {
      const date = new Date(inicio); date.setDate(date.getDate() + d - 1)
      const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      row[label] = d >= a.inicioDia && d <= a.fimDia ? 'X' : ''
    }
    return row
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ganttRows), 'Gantt')

  // Sheet 3 — Curva S
  const dias = Math.min(totalDias, 120)
  const curvaRows = Array.from({ length: dias + 1 }, (_, s) => {
    const acum = atividades
      .filter(a => !a.nome.startsWith('▸') && !a.marco && a.fimDia <= s)
      .reduce((sum, a) => sum + a.peso, 0)
    const date = new Date(inicio); date.setDate(date.getDate() + s)
    return {
      'Dia': s,
      'Data': date.toLocaleDateString('pt-BR'),
      'Avanço Físico Acum. (%)': +Math.min(100, acum).toFixed(2),
      ...(valorVenda > 0 ? { 'Avanço Financeiro Acum. (R$)': +(Math.min(100, acum) / 100 * valorVenda).toFixed(2) } : {}),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(curvaRows), 'Curva S')

  // Sheet 4 — Físico-Financeiro por período
  const tamPeriodo = totalDias <= 60 ? 7 : 30
  const labelPeriodo = tamPeriodo === 7 ? 'Sem.' : 'Mês'
  const nPeriodos = Math.ceil(totalDias / tamPeriodo)
  const pesosPorDia: number[] = Array(totalDias + 2).fill(0)
  for (const a of atividades) {
    if (a.nome.startsWith('▸') || a.marco || a.duracaoDias <= 0) continue
    const ppd = a.peso / a.duracaoDias
    for (let d = a.inicioDia; d <= a.fimDia; d++) { if (d < pesosPorDia.length) pesosPorDia[d] += ppd }
  }
  let fisicoAcum = 0, financeiroAcum = 0
  const ffRows = Array.from({ length: nPeriodos }, (_, p) => {
    const diaIni = p * tamPeriodo + 1
    const diaFim = Math.min((p + 1) * tamPeriodo, totalDias)
    let fisicoPeriodo = 0
    for (let d = diaIni; d <= diaFim; d++) fisicoPeriodo += pesosPorDia[d] ?? 0
    fisicoPeriodo = Math.min(fisicoPeriodo, 100)
    fisicoAcum = Math.min(fisicoAcum + fisicoPeriodo, 100)
    const financeiroPeriodo = valorVenda > 0 ? fisicoPeriodo / 100 * valorVenda : 0
    financeiroAcum = valorVenda > 0 ? fisicoAcum / 100 * valorVenda : 0
    const di = new Date(inicio); di.setDate(di.getDate() + diaIni - 1)
    const df = new Date(inicio); df.setDate(df.getDate() + diaFim - 1)
    return {
      'Período': `${labelPeriodo} ${p + 1}`,
      'Início': di.toLocaleDateString('pt-BR'),
      'Fim': df.toLocaleDateString('pt-BR'),
      'Físico Período (%)': +fisicoPeriodo.toFixed(2),
      'Físico Acum. (%)': +fisicoAcum.toFixed(2),
      ...(valorVenda > 0 ? {
        'Financeiro Período (R$)': +financeiroPeriodo.toFixed(2),
        'Financeiro Acum. (R$)': +financeiroAcum.toFixed(2),
      } : {}),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ffRows), 'Físico-Financeiro')

  XLSX.writeFile(wb, 'cronograma-obra.xlsx')
}

// ─── Exportar PDF ──────────────────────────────────────────────────────────────

async function exportarPDF(containerSelector: string) {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  const el = document.querySelector<HTMLElement>(containerSelector)
  if (!el) return

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgH = (canvas.height * pageW) / canvas.width

  let y = 0
  while (y < imgH) {
    if (y > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH)
    y += pageH
  }

  pdf.save('cronograma-obra.pdf')
}

// ─── Relatório Executivo PDF (jsPDF programático) ────────────────────────────

async function gerarRelatorioPDFExecutivo(
  atividades: Atividade[],
  dataInicio: string,
  valorVenda: number,
  resumo: { prazoTotal: number; totalAtividades: number; etapas: string[] }
) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, margin = 14
  const AZUL = [30, 58, 138] as const
  const LARANJA = [245, 146, 29] as const
  const CINZA = [100, 116, 139] as const

  function hex2rgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
  }

  let pageNum = 1
  function addHeader() {
    // Barra azul topo
    pdf.setFillColor(...AZUL)
    pdf.rect(0, 0, W, 22, 'F')
    // Texto PAVCON
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PAVCON', margin, 14)
    // Subtítulo direita
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text('CONSTRUTORA', W - margin, 9, { align: 'right' })
    pdf.text('GESTÃO DE OBRAS', W - margin, 14, { align: 'right' })
    // Linha laranja
    pdf.setFillColor(...LARANJA)
    pdf.rect(0, 22, W, 1.5, 'F')
  }

  function addFooter(page: number) {
    pdf.setFillColor(245, 247, 250)
    pdf.rect(0, 285, W, 12, 'F')
    pdf.setTextColor(...CINZA)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}  —  Pavcon Construtora`, margin, 292)
    pdf.text(`Página ${page}`, W - margin, 292, { align: 'right' })
  }

  // ── Página 1: Capa + Resumo + Tabela ──────────────────────────────────────
  addHeader()

  // Título do relatório
  pdf.setTextColor(...AZUL)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CRONOGRAMA EXECUTIVO DE OBRA', margin, 35)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(...CINZA)
  const dtInicio = new Date(dataInicio + 'T00:00:00')
  pdf.text(`Data de início: ${dtInicio.toLocaleDateString('pt-BR')}   |   Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, margin, 41)

  // Cards resumo
  const cards = [
    { label: 'Prazo Total', value: `${resumo.prazoTotal} dias` },
    { label: 'Atividades', value: `${resumo.totalAtividades}` },
    { label: 'Etapas', value: `${resumo.etapas.length}` },
    { label: 'Valor de Venda', value: valorVenda > 0 ? `R$ ${(valorVenda / 1e6).toFixed(2)}M` : '—' },
  ]
  const cardW = (W - margin * 2 - 9) / 4
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + 3)
    pdf.setFillColor(248, 250, 252)
    pdf.roundedRect(x, 46, cardW, 18, 2, 2, 'F')
    pdf.setDrawColor(...AZUL)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(x, 46, cardW, 18, 2, 2, 'S')
    pdf.setFontSize(7)
    pdf.setTextColor(...CINZA)
    pdf.setFont('helvetica', 'normal')
    pdf.text(c.label.toUpperCase(), x + cardW / 2, 52, { align: 'center' })
    pdf.setFontSize(11)
    pdf.setTextColor(...AZUL)
    pdf.setFont('helvetica', 'bold')
    pdf.text(c.value, x + cardW / 2, 60, { align: 'center' })
  })

  // Tabela de atividades
  const inicio = new Date(dataInicio + 'T00:00:00')
  const atvsExport = atividades.filter(a => !a.marco)
  const colsTab = [
    { label: 'EAP',       w: 18 },
    { label: 'Atividade', w: 70 },
    { label: 'Dur.(d)',   w: 16 },
    { label: 'Início',    w: 24 },
    { label: 'Término',   w: 24 },
    { label: 'Pred.',     w: 18 },
    ...(valorVenda > 0 ? [{ label: 'Valor (R$)', w: 26 }] : []),
  ]

  let y = 72
  const rowH = 6.5
  const tableW = colsTab.reduce((s, c) => s + c.w, 0)

  // Cabeçalho tabela
  pdf.setFillColor(...AZUL)
  pdf.rect(margin, y, tableW, 7, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  let cx = margin
  colsTab.forEach(col => {
    pdf.text(col.label, cx + col.w / 2, y + 5, { align: 'center' })
    cx += col.w
  })
  y += 7

  pdf.setFont('helvetica', 'normal')
  atvsExport.forEach((a, idx) => {
    if (y > 274) {
      addFooter(pageNum++)
      pdf.addPage()
      addHeader()
      y = 30
      // Cabeçalho repetido
      pdf.setFillColor(...AZUL)
      pdf.rect(margin, y, tableW, 7, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      cx = margin
      colsTab.forEach(col => { pdf.text(col.label, cx + col.w / 2, y + 5, { align: 'center' }); cx += col.w })
      y += 7
      pdf.setFont('helvetica', 'normal')
    }

    const isMae = a.nome.startsWith('▸')
    const di = new Date(inicio); di.setDate(di.getDate() + a.inicioDia - 1)
    const df = new Date(inicio); df.setDate(df.getDate() + a.fimDia - 1)
    const etapaCor = ETAPA_MAP.find(e => e.etapa === a.etapa)?.cor ?? '#6366f1'

    // Fundo alternado / mãe
    if (isMae) {
      pdf.setFillColor(230, 236, 255)
    } else if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.rect(margin, y, tableW, rowH, 'F')

    // Linha colorida lateral para atividades mãe
    if (isMae) {
      const [r, g, b] = hex2rgb(etapaCor)
      pdf.setFillColor(r, g, b)
      pdf.rect(margin, y, 1.5, rowH, 'F')
    }

    pdf.setFontSize(6.5)
    if (isMae) pdf.setTextColor(...AZUL)
    else pdf.setTextColor(50, 50, 50)
    if (isMae) pdf.setFont('helvetica', 'bold')
    else pdf.setFont('helvetica', 'normal')

    cx = margin
    const cells = [
      a.eap,
      isMae ? a.nome.replace('▸ ', '').toUpperCase() : `  ${a.nome}`,
      String(a.duracaoDias),
      di.toLocaleDateString('pt-BR'),
      df.toLocaleDateString('pt-BR'),
      a.predecessoras || '—',
      ...(valorVenda > 0 ? [isMae ? `R$ ${(a.peso / 100 * valorVenda / 1000).toFixed(0)}k` : ''] : []),
    ]
    colsTab.forEach((col, ci) => {
      const txt = cells[ci] ?? ''
      const maxW = col.w - 2
      const truncated = pdf.getStringUnitWidth(txt) * 6.5 / pdf.internal.scaleFactor > maxW
        ? txt.slice(0, Math.floor(maxW / (pdf.getStringUnitWidth('x') * 6.5 / pdf.internal.scaleFactor))) + '…'
        : txt
      pdf.text(truncated, ci === 1 ? cx + 2 : cx + col.w / 2, y + rowH - 1.8, ci === 1 ? {} : { align: 'center' })
      cx += col.w
    })

    // Separador linha
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.1)
    pdf.line(margin, y + rowH, margin + tableW, y + rowH)
    y += rowH
  })

  addFooter(pageNum)
  pdf.save('relatorio-executivo-pavcon.pdf')
}

// ─── Componente Gantt ─────────────────────────────────────────────────────────

function GanttChart({ atividades, totalDias }: { atividades: Atividade[]; totalDias: number }) {
  const cols = Math.min(totalDias, 120)

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: cols * 22 + 300 }}>
        {/* Cabeçalho semanas */}
        <div className="flex border-b border-gray-200 mb-1">
          <div className="w-72 flex-shrink-0 text-[10px] font-bold text-gray-500 px-2 py-1">ATIVIDADE</div>
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="flex-shrink-0 text-center text-[9px] text-gray-400 border-l border-gray-100"
              style={{ width: 22 }}>
              {i + 1}
            </div>
          ))}
        </div>

        {atividades.map(a => {
          const isMae = a.nome.startsWith('▸')
          const isMarca = a.marco
          const etapaCfg = ETAPA_MAP.find(e => e.etapa === a.etapa)
          const cor = etapaCfg?.cor ?? '#6366f1'

          return (
            <div key={a.id} className={`flex items-center mb-0.5 ${isMae ? 'bg-gray-50' : ''}`}
              style={{ height: isMae ? 22 : 18 }}>
              <div className={`w-72 flex-shrink-0 truncate px-2 text-[10px] ${isMae ? 'font-bold text-gray-700' : 'text-gray-600 pl-6'}`}>
                {isMarca ? '🏁 ' : ''}{a.nome.replace('▸ ', '')}
              </div>

              {/* Células do Gantt */}
              {Array.from({ length: cols }, (_, i) => {
                const sem = i + 1
                const ativo = !isMarca && sem >= a.inicioDia && sem <= Math.min(a.fimDia, cols)
                const isInicio = sem === a.inicioDia
                const isFim = sem === Math.min(a.fimDia, cols)
                return (
                  <div key={i} className="flex-shrink-0 border-l border-gray-100 h-full flex items-center justify-center"
                    style={{ width: 22 }}>
                    {isMarca && sem === a.inicioDia ? (
                      <div className="w-3 h-3 rotate-45" style={{ background: '#dc2626' }} />
                    ) : ativo ? (
                      <div className="w-full h-3/4 relative"
                        style={{
                          background: a.caminhoCritico ? cor : cor + '99',
                          borderRadius: isInicio ? '3px 0 0 3px' : isFim ? '0 3px 3px 0' : 0,
                        }} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Curva S ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

function CurvaS({ atividades, totalDias, valorVenda }: { atividades: Atividade[]; totalDias: number; valorVenda: number }) {
  const pontos = useMemo(() => {
    const dias = Math.min(totalDias, 120)
    return Array.from({ length: dias + 1 }, (_, s) => {
      const acum = atividades
        .filter(a => !a.nome.startsWith('▸') && !a.marco && a.fimDia <= s)
        .reduce((sum, a) => sum + a.peso, 0)
      return Math.min(100, acum)
    })
  }, [atividades, totalDias])

  const W = 600, H = 220
  const padL = 46, padB = 30, padR = valorVenda > 0 ? 72 : 20, padT = 10

  const toX = (i: number) => padL + (i / Math.max(1, pontos.length - 1)) * (W - padL - padR)
  const toY = (v: number) => padT + (1 - v / 100) * (H - padT - padB)

  const path = pontos.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ')
  const area = `${path} L${toX(pontos.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`

  const gridPcts = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {/* Grid + eixo esquerdo (%) */}
      {gridPcts.map(v => (
        <g key={v}>
          <line x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padL - 4} y={toY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}%</text>
        </g>
      ))}

      {/* Eixo direito (R$) */}
      {valorVenda > 0 && gridPcts.map(v => (
        <text key={v} x={W - padR + 4} y={toY(v) + 4} textAnchor="start" fontSize={8} fill="#059669">
          {fmtBRL(v / 100 * valorVenda)}
        </text>
      ))}

      {/* Área */}
      <path d={area} fill="#3b82f620" />
      {/* Linha física (%) */}
      <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
      {/* Linha financeira (R$) — mesma curva, cor verde, se valorVenda informado */}
      {valorVenda > 0 && (
        <path d={path} fill="none" stroke="#059669" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
      )}
      {/* Pontos */}
      {pontos.filter((_, i) => i % Math.ceil(Math.max(1, pontos.length) / 10) === 0).map((v, i) => {
        const origIdx = i * Math.ceil(Math.max(1, pontos.length) / 10)
        return (
          <g key={i}>
            <circle cx={toX(origIdx)} cy={toY(v)} r={3} fill="#2563eb" />
            {valorVenda > 0 && origIdx % Math.ceil(Math.max(1, pontos.length) / 5) === 0 && (
              <text x={toX(origIdx)} y={toY(v) - 6} textAnchor="middle" fontSize={8} fill="#059669">
                {fmtBRL(v / 100 * valorVenda)}
              </text>
            )}
          </g>
        )
      })}
      {/* Legenda */}
      <g>
        <circle cx={padL + 8} cy={H - 8} r={3} fill="#2563eb" />
        <text x={padL + 14} y={H - 5} fontSize={8} fill="#2563eb">Físico (%)</text>
        {valorVenda > 0 && (
          <>
            <line x1={padL + 70} y1={H - 8} x2={padL + 82} y2={H - 8} stroke="#059669" strokeWidth={1.5} strokeDasharray="4,2" />
            <text x={padL + 86} y={H - 5} fontSize={8} fill="#059669">Financeiro (R$)</text>
          </>
        )}
      </g>
      {/* Eixo X label */}
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={9} fill="#6b7280">Dias</text>
    </svg>
  )
}

// ─── Físico-Financeiro ───────────────────────────────────────────────────────

interface PeriodoFF {
  periodo: number
  label: string
  dataInicioPeriodo: string
  dataFimPeriodo: string
  fisicoPeriodo: number
  fisicoAcum: number
  financeiroPeriodo: number
  financeiroAcum: number
}

function calcularFisicoFinanceiro(
  atividades: Atividade[],
  totalDias: number,
  valorVenda: number,
  dataInicio: string
): PeriodoFF[] {
  // Distribui peso de cada atividade dia a dia
  const pesosPorDia: number[] = Array(totalDias + 2).fill(0)
  for (const a of atividades) {
    if (a.nome.startsWith('▸') || a.marco || a.duracaoDias <= 0) continue
    const ppd = a.peso / a.duracaoDias
    for (let d = a.inicioDia; d <= a.fimDia; d++) {
      if (d < pesosPorDia.length) pesosPorDia[d] += ppd
    }
  }

  // Agrupa por mês (30 dias) ou semana se prazo curto
  const tamPeriodo = totalDias <= 60 ? 7 : 30
  const labelPeriodo = tamPeriodo === 7 ? 'Sem.' : 'Mês'
  const nPeriodos = Math.ceil(totalDias / tamPeriodo)
  const inicio = new Date(dataInicio)

  const periodos: PeriodoFF[] = []
  let fisicoAcum = 0
  let financeiroAcum = 0

  for (let p = 0; p < nPeriodos; p++) {
    const diaIni = p * tamPeriodo + 1
    const diaFim = Math.min((p + 1) * tamPeriodo, totalDias)

    let fisicoPeriodo = 0
    for (let d = diaIni; d <= diaFim; d++) fisicoPeriodo += pesosPorDia[d] ?? 0
    fisicoPeriodo = Math.min(fisicoPeriodo, 100)
    fisicoAcum = Math.min(fisicoAcum + fisicoPeriodo, 100)

    const financeiroPeriodo = valorVenda > 0 ? fisicoPeriodo / 100 * valorVenda : 0
    financeiroAcum = valorVenda > 0 ? fisicoAcum / 100 * valorVenda : 0

    const di = new Date(inicio); di.setDate(di.getDate() + diaIni - 1)
    const df = new Date(inicio); df.setDate(df.getDate() + diaFim - 1)

    periodos.push({
      periodo: p + 1,
      label: `${labelPeriodo} ${p + 1}`,
      dataInicioPeriodo: di.toLocaleDateString('pt-BR'),
      dataFimPeriodo: df.toLocaleDateString('pt-BR'),
      fisicoPeriodo,
      fisicoAcum,
      financeiroPeriodo,
      financeiroAcum,
    })
  }
  return periodos
}

function FisicoFinanceiro({
  atividades, totalDias, valorVenda, dataInicio,
}: {
  atividades: Atividade[]; totalDias: number; valorVenda: number; dataInicio: string
}) {
  const periodos = useMemo(
    () => calcularFisicoFinanceiro(atividades, totalDias, valorVenda, dataInicio),
    [atividades, totalDias, valorVenda, dataInicio]
  )

  const maxPeriodo = Math.max(...periodos.map(p => p.fisicoPeriodo), 0.01)

  // Mini gráfico barras + linha acumulada
  const W = 700, H = 180
  const padL = 44, padB = 28, padR = valorVenda > 0 ? 80 : 20, padT = 12
  const n = periodos.length
  const barW = Math.max(4, Math.floor((W - padL - padR) / n) - 2)
  const toX = (i: number) => padL + i * (W - padL - padR) / n + (W - padL - padR) / n / 2
  const toYpct = (v: number) => padT + (1 - v / 100) * (H - padT - padB)

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 text-sm">Cronograma Físico-Financeiro — Distribuição por Período</h3>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
          {/* Grid */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={padL} y1={toYpct(v)} x2={W - padR} y2={toYpct(v)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={padL - 4} y={toYpct(v) + 4} textAnchor="end" fontSize={8} fill="#9ca3af">{v}%</text>
            </g>
          ))}
          {/* Barras (período) */}
          {periodos.map((p, i) => {
            const h = (p.fisicoPeriodo / 100) * (H - padT - padB)
            const x = toX(i) - barW / 2
            const y = toYpct(p.fisicoPeriodo)
            return (
              <rect key={i} x={x} y={y} width={barW} height={h}
                fill="#3b82f6" opacity={0.7} rx={2} />
            )
          })}
          {/* Linha acumulada física */}
          <polyline
            points={periodos.map((p, i) => `${toX(i)},${toYpct(p.fisicoAcum)}`).join(' ')}
            fill="none" stroke="#2563eb" strokeWidth={2} />
          {periodos.map((p, i) => (
            <circle key={i} cx={toX(i)} cy={toYpct(p.fisicoAcum)} r={3} fill="#2563eb" />
          ))}
          {/* Eixo direito R$ acumulado */}
          {valorVenda > 0 && [0, 25, 50, 75, 100].map(v => (
            <text key={v} x={W - padR + 4} y={toYpct(v) + 4} textAnchor="start" fontSize={7} fill="#059669">
              {fmtBRL(v / 100 * valorVenda)}
            </text>
          ))}
          {/* Legenda */}
          <rect x={padL} y={H - 10} width={10} height={7} fill="#3b82f6" opacity={0.7} rx={1} />
          <text x={padL + 13} y={H - 4} fontSize={8} fill="#3b82f6">Físico período</text>
          <circle cx={padL + 90} cy={H - 6} r={3} fill="#2563eb" />
          <text x={padL + 95} y={H - 4} fontSize={8} fill="#2563eb">Acumulado físico</text>
          <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={8} fill="#9ca3af">Período</text>
        </svg>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Período', 'Início', 'Fim',
                  'Físico (%)', 'Físico Acum. (%)',
                  ...(valorVenda > 0 ? ['Financeiro (R$)', 'Financeiro Acum. (R$)'] : []),
                  'Avanço Período', 'Acumulado',
                ].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodos.map((p, i) => (
                <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 font-semibold text-gray-700">{p.label}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{p.dataInicioPeriodo}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{p.dataFimPeriodo}</td>
                  <td className="px-3 py-2 font-medium text-blue-700">{p.fisicoPeriodo.toFixed(2)}%</td>
                  <td className="px-3 py-2 font-bold text-blue-900">{p.fisicoAcum.toFixed(2)}%</td>
                  {valorVenda > 0 && (
                    <>
                      <td className="px-3 py-2 font-medium text-green-700 whitespace-nowrap">
                        {p.financeiroPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 font-bold text-green-900 whitespace-nowrap">
                        {p.financeiroAcum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2" style={{ minWidth: 100 }}>
                    <div className="bg-gray-100 rounded-full h-2 w-full">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.min(100, (p.fisicoPeriodo / maxPeriodo) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: 100 }}>
                    <div className="bg-gray-100 rounded-full h-2 w-full">
                      <div className="bg-blue-700 h-full rounded-full" style={{ width: `${p.fisicoAcum}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {/* Totais */}
              <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                <td className="px-3 py-2 text-blue-800" colSpan={3}>Total</td>
                <td className="px-3 py-2 text-blue-800">
                  {periodos.reduce((s, p) => s + p.fisicoPeriodo, 0).toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-blue-900">
                  {periodos.length > 0 ? periodos[periodos.length - 1].fisicoAcum.toFixed(2) : '0.00'}%
                </td>
                {valorVenda > 0 && (
                  <>
                    <td className="px-3 py-2 text-green-800 whitespace-nowrap">
                      {periodos.reduce((s, p) => s + p.financeiroPeriodo, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 text-green-900 whitespace-nowrap">
                      {periodos.length > 0 ? periodos[periodos.length - 1].financeiroAcum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'}
                    </td>
                  </>
                )}
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Cronograma() {
  const { user } = useAuth()
  const STORAGE_KEY = 'pavcon_cronograma_v1'

  function loadStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
  }

  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analisando' | 'resultado'>(() => loadStorage()?.step ?? 'idle')
  const [erro, setErro] = useState('')
  const [fileName, setFileName] = useState(() => loadStorage()?.fileName ?? '')
  const [dataInicio, setDataInicio] = useState(() => loadStorage()?.dataInicio ?? new Date().toISOString().slice(0, 10))
  const [dataLimite, setDataLimite] = useState<string>(() => loadStorage()?.dataLimite ?? '')
  const [valorVenda, setValorVenda] = useState<number>(() => loadStorage()?.valorVenda ?? 0)
  const [atividades, setAtividades] = useState<Atividade[]>(() =>
    (loadStorage()?.atividades ?? []).map((a: Atividade) => ({ ...a, agendamento: a.agendamento ?? 'auto' as const }))
  )
  const [resumo, setResumo] = useState<Resumo | null>(() => loadStorage()?.resumo ?? null)
  const [abaAtiva, setAbaAtiva] = useState<'gantt' | 'tabela' | 'curvaS' | 'fisicoFinanceiro' | 'riscos'>(() => loadStorage()?.abaAtiva ?? 'gantt')
  const [fontePDF, setFontePDF] = useState<boolean>(() => {
    const s = loadStorage()
    return s?.fontePDF ?? s?.fileName?.toLowerCase().endsWith('.pdf') ?? false
  })

  // Persiste no localStorage sempre que o estado relevante muda
  useEffect(() => {
    if (step === 'analisando') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, fileName, dataInicio, dataLimite, valorVenda, atividades, resumo, abaAtiva, fontePDF }))
  }, [step, fileName, dataInicio, valorVenda, atividades, resumo, abaAtiva])

  useEffect(() => {
    if (step === 'idle' && supabase) carregarListaNuvem()
  }, [step])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingEtapaId, setEditingEtapaId] = useState<string | null>(null)
  const [editingEtapaNome, setEditingEtapaNome] = useState('')
  const [editingNomeId, setEditingNomeId] = useState<string | null>(null)
  const [editingNomeValor, setEditingNomeValor] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [exportandoPDF, setExportandoPDF] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [printAll, setPrintAll] = useState(false)
  const [sortData, setSortData] = useState<'asc' | 'desc' | null>(null)

  // ── Nuvem ──────────────────────────────────────────────────────────────────
  const [modalNuvem, setModalNuvem] = useState<'salvar' | 'carregar' | null>(null)
  const [nomeNuvem, setNomeNuvem] = useState('')
  const [listaNuvem, setListaNuvem] = useState<CronogramaNuvem[]>([])
  const [nuvemLoading, setNuvemLoading] = useState(false)
  const [nuvemErro, setNuvemErro] = useState('')
  const [nuvemSucesso, setNuvemSucesso] = useState('')

  async function salvarNaNuvem() {
    if (!supabase) return setNuvemErro('Supabase não configurado. Adicione as variáveis de ambiente.')
    if (!nomeNuvem.trim()) return setNuvemErro('Digite um nome para o cronograma.')
    if (!resumo) return setNuvemErro('Não há cronograma para salvar.')
    setNuvemLoading(true); setNuvemErro(''); setNuvemSucesso('')
    const dados = JSON.stringify({ step, fileName, dataInicio, dataLimite, valorVenda, atividades, resumo, abaAtiva, fontePDF })
    const { error } = await supabase.from('cronogramas').insert({
      nome: nomeNuvem.trim(),
      usuario_id: user?.id ?? 'anonimo',
      dados,
    })
    setNuvemLoading(false)
    if (error) setNuvemErro(error.message)
    else { setNuvemSucesso('Cronograma salvo!'); setNomeNuvem('') }
  }

  async function carregarListaNuvem() {
    if (!supabase) return setNuvemErro('Supabase não configurado.')
    setNuvemLoading(true); setNuvemErro('')
    const { data, error } = await supabase
      .from('cronogramas')
      .select('id, nome, criado_em, atualizado_em, usuario_id, dados')
      .eq('usuario_id', user?.id ?? 'anonimo')
      .order('atualizado_em', { ascending: false })
    setNuvemLoading(false)
    if (error) setNuvemErro(error.message)
    else setListaNuvem((data ?? []) as CronogramaNuvem[])
  }

  function carregarCronogramaNuvem(item: CronogramaNuvem) {
    try {
      const s = JSON.parse(item.dados)
      if (s.atividades) setAtividades(s.atividades.map((a: Atividade) => ({ ...a, agendamento: a.agendamento ?? 'auto' as const })))
      if (s.resumo) setResumo(s.resumo)
      if (s.dataInicio) setDataInicio(s.dataInicio)
      if (s.dataLimite !== undefined) setDataLimite(s.dataLimite)
      if (s.valorVenda) setValorVenda(s.valorVenda)
      if (s.fontePDF !== undefined) setFontePDF(s.fontePDF)
      setStep('resultado')
      setModalNuvem(null)
    } catch { setNuvemErro('Erro ao carregar cronograma.') }
  }

  async function apagarNuvem(id: string) {
    if (!supabase) return
    await supabase.from('cronogramas').delete().eq('id', id)
    setListaNuvem(prev => prev.filter(c => c.id !== id))
  }
  const [colAtividadeW, setColAtividadeW] = useState(260)
  const resizingRef = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  function renomearAtividade(id: string, novoNome: string) {
    const nome = novoNome.trim()
    if (nome) setAtividades(prev => prev.map(a => a.id === id ? { ...a, nome } : a))
    setEditingNomeId(null)
  }

  function nextId(prev: Atividade[]) {
    return String(Math.max(0, ...prev.map(a => parseInt(a.id) || 0)) + 1)
  }

  function adicionarAtividade() {
    setAtividades(prev => {
      const id = nextId(prev)
      const ultimaFim = prev.length ? Math.max(...prev.map(a => a.fimDia)) : 0
      const novaAtividade: Atividade = {
        id, eap: id,
        nome: '▸ Nova Atividade',
        etapa: 'Outros Serviços',
        duracaoDias: 5, inicioDia: ultimaFim + 1, fimDia: ultimaFim + 5,
        predecessoras: '', recursos: '', peso: 0, pesoCumulativo: 0,
        caminhoCritico: false, marco: false, agendamento: 'auto' as const,
      }
      return recalcularEAP([...prev, novaAtividade])
    })
  }

  function apagarAtividade(id: string) {
    setAtividades(prev => {
      const alvo = prev.find(a => a.id === id)
      if (!alvo) return prev
      if (alvo.nome.startsWith('▸')) {
        return recalcularEAP(prev.filter(a => !(a.id === id || a.etapa === alvo.etapa)))
      }
      return recalcularEAP(prev.filter(a => a.id !== id))
    })
    setSelecionados(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function apagarSelecionados() {
    setAtividades(prev => {
      let arr = [...prev]
      // Expande seleção: se uma ▸ estiver selecionada, inclui seus filhos
      const idsParaApagar = new Set<string>()
      for (const id of selecionados) {
        const alvo = arr.find(a => a.id === id)
        if (!alvo) continue
        idsParaApagar.add(id)
        if (alvo.nome.startsWith('▸')) {
          arr.filter(a => a.etapa === alvo.etapa && !a.nome.startsWith('▸')).forEach(a => idsParaApagar.add(a.id))
        }
      }
      return recalcularEAP(arr.filter(a => !idsParaApagar.has(a.id)))
    })
    setSelecionados(new Set())
  }

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleSelecionarTodos() {
    if (selecionados.size === atividades.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(atividades.map(a => a.id)))
    }
  }

  function adicionarServico(atividadeId: string) {
    setAtividades(prev => {
      const mae = prev.find(a => a.id === atividadeId)
      if (!mae) return prev
      const id = nextId(prev)
      const irmaos = prev.filter(a => a.etapa === mae.etapa && !a.nome.startsWith('▸') && !a.marco)
      const inicioServico = irmaos.length
        ? Math.max(...irmaos.map(a => a.fimDia)) + 1
        : mae.inicioDia
      const novoServico: Atividade = {
        id, eap: '',
        nome: 'Novo Serviço',
        etapa: mae.etapa,
        duracaoDias: 5, inicioDia: inicioServico, fimDia: inicioServico + 4,
        predecessoras: '', recursos: '', peso: 0, pesoCumulativo: 0,
        caminhoCritico: false, marco: false, agendamento: 'auto' as const,
      }
      // Insere logo após a última linha da atividade
      const maeIdx = prev.findIndex(a => a.id === atividadeId)
      const filhosIdxs = prev.map((a, i) => a.etapa === mae.etapa && !a.nome.startsWith('▸') ? i : -1).filter(i => i > maeIdx)
      const insertAt = filhosIdxs.length ? Math.max(...filhosIdxs) + 1 : maeIdx + 1
      const arr = [...prev]
      arr.splice(insertAt, 0, novoServico)
      return recalcularEAP(arr)
    })
  }

  function recalcularEAP(arr: Atividade[]): Atividade[] {
    let etapaIdx = 0
    const etapaNumero: Record<string, number> = {}
    const childCount: Record<string, number> = {}
    return arr.map(a => {
      if (a.nome.startsWith('▸')) {
        etapaIdx++
        etapaNumero[a.etapa] = etapaIdx
        childCount[a.etapa] = 0
        return { ...a, eap: String(etapaIdx) }
      } else {
        const pNum = etapaNumero[a.etapa] ?? etapaIdx
        childCount[a.etapa] = (childCount[a.etapa] ?? 0) + 1
        return { ...a, eap: `${pNum}.${childCount[a.etapa]}` }
      }
    })
  }

  function moverParaEtapa(servicoId: string, novaEtapa: string) {
    setAtividades(prev => recalcularEAP(
      prev.map(a => a.id === servicoId ? { ...a, etapa: novaEtapa } : a)
    ))
  }

  function reordenarAtividades(draggedId: string, targetId: string, novaEtapa?: string) {
    setAtividades(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(a => a.id === draggedId)
      const toIdx = arr.findIndex(a => a.id === targetId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const [item] = arr.splice(fromIdx, 1)
      if (novaEtapa) item.etapa = novaEtapa
      arr.splice(toIdx, 0, item)
      return recalcularEAP(arr)
    })
  }

  function renomearEtapa(id: string, novoNome: string) {
    const nome = novoNome.trim()
    if (!nome) return
    setAtividades(prev => {
      const mae = prev.find(a => a.id === id)
      if (!mae) return prev
      const antigaEtapa = mae.etapa
      return recalcularEAP(prev.map(a => {
        if (a.etapa === antigaEtapa) {
          return {
            ...a,
            etapa: nome,
            nome: a.nome.startsWith('▸') ? `▸ ${nome}` : a.nome,
          }
        }
        return a
      }))
    })
    setEditingEtapaId(null)
  }

  const totalDias = useMemo(() =>
    atividades.length ? Math.max(...atividades.map(a => a.fimDia)) : 0
  , [atividades])

  // Atividades ordenadas por data de início (agrupa ▸ com seus filhos)
  const atividadesOrdenadas = useMemo(() => {
    if (!sortData) return atividades
    // Separa marcos
    const marcos = atividades.filter(a => a.marco)
    const resto = atividades.filter(a => !a.marco)
    // Agrupa: cada grupo = [▸, ...filhos]
    const grupos: Atividade[][] = []
    let grupoAtual: Atividade[] = []
    for (const a of resto) {
      if (a.nome.startsWith('▸')) {
        if (grupoAtual.length) grupos.push(grupoAtual)
        grupoAtual = [a]
      } else {
        grupoAtual.push(a)
      }
    }
    if (grupoAtual.length) grupos.push(grupoAtual)
    // Ordena grupos pela data de início do ▸
    grupos.sort((a, b) => {
      const ini = (g: Atividade[]) => g[0]?.inicioDia ?? 0
      return sortData === 'asc' ? ini(a) - ini(b) : ini(b) - ini(a)
    })
    return [...grupos.flat(), ...marcos]
  }, [atividades, sortData])

  // Calcula o inicioDia de uma atividade com base em suas predecessoras
  // TI (padrão): "3"   → inicia após o fim da atividade 3
  // II          : "3II" → inicia junto com o início da atividade 3
  function calcularInicioPorPredecessoras(pred: string, arr: Atividade[]): number {
    const partes = pred.split(/[,;]/).map(p => p.trim()).filter(Boolean)
    let maxInicio = 1
    for (const parte of partes) {
      const mII = parte.match(/^(\d+)\s*II$/i)
      const mTI = parte.match(/^(\d+)$/)
      if (mII) {
        const dep = arr.find(a => a.id === mII[1])
        if (dep) maxInicio = Math.max(maxInicio, dep.inicioDia)
      } else if (mTI) {
        const dep = arr.find(a => a.id === mTI[1])
        if (dep) maxInicio = Math.max(maxInicio, dep.fimDia + 1)
      }
    }
    return maxInicio
  }

  // Propaga datas em cascata (até 8 passes para cobrir cadeias longas)
  function recalcularDatas(arr: Atividade[]): Atividade[] {
    let result = arr.map(a => ({ ...a }))
    for (let pass = 0; pass < 8; pass++) {
      let changed = false
      result = result.map(a => {
        if (a.agendamento === 'manual') return a   // data fixa — não recalcula
        if (!a.predecessoras.trim()) return a
        const novoInicio = calcularInicioPorPredecessoras(a.predecessoras, result)
        if (novoInicio === a.inicioDia) return a
        changed = true
        return { ...a, inicioDia: novoInicio, fimDia: novoInicio + a.duracaoDias - 1 }
      })
      if (!changed) break
    }
    // Atualiza datas das etapas-mãe com base nos filhos
    return result.map(a => {
      if (!a.nome.startsWith('▸')) return a
      const filhos = result.filter(f => f.etapa === a.etapa && !f.nome.startsWith('▸') && !f.marco)
      if (filhos.length === 0) return a
      const ini = Math.min(...filhos.map(f => f.inicioDia))
      const fim = Math.max(...filhos.map(f => f.fimDia))
      return { ...a, inicioDia: ini, fimDia: fim, duracaoDias: fim - ini + 1 }
    })
  }

  function updateAtividade(id: string, campo: 'duracaoDias' | 'predecessoras' | 'recursos', valor: string) {
    setAtividades(prev => {
      const base = prev.map(a => {
        if (a.id !== id) return a
        if (campo === 'duracaoDias') {
          const dur = Math.max(1, parseInt(valor) || 1)
          return { ...a, duracaoDias: dur, fimDia: a.inicioDia + dur - 1 }
        }
        return { ...a, [campo]: valor }
      })
      // Recalcula datas em cascata quando duração ou predecessoras mudam
      return campo === 'recursos' ? base : recalcularDatas(base)
    })
  }

  async function handleFile(file: File) {
    if (!file) return
    setErro('')
    setFileName(file.name)
    setStep('analisando')

    try {
      const buf = await file.arrayBuffer()
      const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

      let servicos: ServicoOrcamento[]
      if (isPDF) {
        servicos = await parseOrcamentoPDF(buf)
      } else {
        const wb = XLSX.read(buf, { type: 'array' })
        servicos = parseOrcamento(wb)
      }

      if (servicos.length < 3) {
        setErro('Não foi possível identificar serviços suficientes no arquivo. Verifique se o arquivo contém descrições de serviços com valores.')
        setStep('idle')
        return
      }

      const resultado = gerarCronograma(servicos, dataInicio)
      setAtividades(resultado.atividades)
      setResumo(resultado.resumo)
      setFontePDF(isPDF)
      setStep('resultado')
    } catch (e) {
      setErro('Erro ao processar o arquivo. Verifique se é um Excel (.xlsx) ou PDF válido com orçamento de obra.')
      setStep('idle')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const corEtapa = (etapa: string) =>
    ETAPA_MAP.find(e => e.etapa === etapa)?.cor ?? '#6366f1'

  const RISCOS = [
    { risco: 'Chuvas intensas durante Terraplenagem/Fundação', probabilidade: 'Alta', impacto: 'Alto', mitigacao: 'Prever folga de 10-15% no prazo das etapas iniciais' },
    { risco: 'Atraso na entrega de materiais (estrutura metálica, esquadrias)', probabilidade: 'Média', impacto: 'Alto', mitigacao: 'Compra antecipada com 4-6 semanas de lead time' },
    { risco: 'Interferência de subsolo (fundações especiais)', probabilidade: 'Média', impacto: 'Alto', mitigacao: 'Sondagem SPT prévia à execução' },
    { risco: 'Falta de mão de obra especializada', probabilidade: 'Média', impacto: 'Médio', mitigacao: 'Contratos antecipados com subempreiteiras' },
    { risco: 'Retrabalho por incompatibilidade de projetos', probabilidade: 'Alta', impacto: 'Alto', mitigacao: 'Revisão BIM/Clash detection antes do início' },
    { risco: 'Aditivos contratuais por serviços extras', probabilidade: 'Média', impacto: 'Médio', mitigacao: 'Orçamento com reserva de contingência de 10%' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === 'resultado' && (
          <button
            onClick={() => { setStep('idle'); setAtividades([]); setResumo(null); localStorage.removeItem(STORAGE_KEY) }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 transition-colors"
            title="Voltar à tela inicial"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={22} className="text-blue-600" />
            Planejador de Obra
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gere um cronograma executivo profissional a partir do orçamento da obra
          </p>
        </div>
      </div>

      {step === 'idle' && (
        <div className="max-w-2xl space-y-4">
          {/* Data de início + Data Limite + Valor de Venda */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Início da Obra</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                Data Limite de Entrega
                <span className="text-[10px] font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="date"
                value={dataLimite}
                onChange={e => setDataLimite(e.target.value)}
                className="border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">Prazo contratual de entrega</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Valor de Venda (R$)</label>
              <input
                type="number" min={0} step={1000}
                value={valorVenda || ''}
                onChange={e => setValorVenda(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 1500000"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 w-48"
              />
              <p className="text-[10px] text-gray-400 mt-1">Para o cronograma físico-financeiro</p>
            </div>
          </div>

          {/* Upload */}
          <div
            className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors p-12 text-center cursor-pointer"
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <FileSpreadsheet size={36} className="text-green-500" />
              <FileText size={36} className="text-red-500" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg mb-2">Anexe o Orçamento da Obra</h3>
            <p className="text-sm text-gray-500 mb-4">
              Arraste ou clique para selecionar o orçamento em Excel ou PDF
            </p>
            <div className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Upload size={16} />
              Selecionar arquivo
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <FileSpreadsheet size={12} className="text-green-500" /> Excel (.xlsx, .xls)
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <FileText size={12} className="text-red-500" /> PDF (.pdf)
              </span>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {erro && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {erro}
            </div>
          )}

          {/* O que o sistema faz */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
            <h4 className="font-bold text-blue-800 mb-3 text-sm">O sistema vai gerar automaticamente:</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                'EAP / WBS completa',
                'Cronograma físico (Gantt)',
                'Cronograma físico-financeiro',
                'Curva S acumulada',
                'Caminho crítico',
                'Principais riscos de prazo',
                'Exportação Excel (.xlsx)',
                'Premissas adotadas',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-blue-700">
                  <CheckCircle2 size={12} className="flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Cronogramas Salvos */}
          {supabase && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                  <Cloud size={14} className="text-blue-500" />
                  Cronogramas Salvos
                </h4>
                <button
                  onClick={() => carregarListaNuvem()}
                  className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                  title="Atualizar lista"
                >
                  {nuvemLoading ? <Loader2 size={13} className="animate-spin" /> : '↻ Atualizar'}
                </button>
              </div>
              {nuvemLoading && (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-blue-400" /></div>
              )}
              {!nuvemLoading && listaNuvem.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">Nenhum cronograma salvo ainda.</p>
              )}
              {!nuvemLoading && listaNuvem.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {listaNuvem.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-blue-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{item.nome}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(item.atualizado_em ?? item.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => carregarCronogramaNuvem(item)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex-shrink-0"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => apagarNuvem(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Apagar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'analisando' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="font-bold text-gray-700">Analisando orçamento...</h3>
          <p className="text-sm text-gray-400 mt-1">{fileName}</p>
        </div>
      )}

      {step === 'resultado' && resumo && (
        <div id="cronograma-resultado" className="space-y-4">
          {/* Resumo executivo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Prazo Total', value: `${resumo.prazoTotal} dias`, sub: `≈ ${Math.round(resumo.prazoTotal / 30)} meses`, icon: Clock, cor: '#2563eb' },
              { label: 'Atividades', value: resumo.totalAtividades, sub: `em ${resumo.etapas.length} etapas`, icon: Layers, cor: '#059669' },
              { label: 'Valor de Venda', value: valorVenda > 0 ? fmtBRL(valorVenda) : '—', sub: valorVenda > 0 ? 'orçamento de venda' : 'não informado', icon: TrendingUp, cor: '#059669' },
              { label: 'Caminho Crítico', value: `${resumo.caminhoCritico.length} etapas`, sub: resumo.caminhoCritico.slice(0, 2).join(' → '), icon: TrendingUp, cor: '#dc2626' },
            ].map(({ label, value, sub, icon: Icon, cor }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: cor }} />
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
                <p className="text-2xl font-black" style={{ color: cor }}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>
              </div>
            ))}
          </div>

          {/* Alerta data limite */}
          {dataLimite && (() => {
            const dtInicio = new Date(dataInicio + 'T00:00:00')
            const dtLimite = new Date(dataLimite + 'T00:00:00')
            const dtFim = new Date(dtInicio)
            dtFim.setDate(dtFim.getDate() + resumo.prazoTotal - 1)
            const diasRestantes = Math.round((dtLimite.getTime() - dtFim.getTime()) / 86400000)
            const excede = diasRestantes < 0
            const folga = Math.abs(diasRestantes)
            return (
              <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 border ${excede ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">
                    {excede
                      ? `⚠️ Cronograma excede o prazo contratual em ${folga} dia${folga !== 1 ? 's' : ''}`
                      : `✅ Cronograma dentro do prazo — folga de ${folga} dia${folga !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Entrega prevista: {dtFim.toLocaleDateString('pt-BR')} · Limite contratual: {dtLimite.toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { id: 'gantt', label: 'Gantt' },
                { id: 'tabela', label: 'Executivo' },
                { id: 'curvaS', label: 'Curva S' },
                { id: 'fisicoFinanceiro', label: 'Físico-Financeiro' },
                { id: 'riscos', label: 'Riscos' },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setAbaAtiva(tab.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    abaAtiva === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); adicionarAtividade() }}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors"
              >
                <Plus size={14} /> Atividade
              </button>
              {selecionados.size > 0 && (
                <button
                  onClick={apagarSelecionados}
                  className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 px-3 py-1.5 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
                >
                  <Trash2 size={14} /> Apagar ({selecionados.size})
                </button>
              )}
              <button
                onClick={() => { setStep('idle'); setAtividades([]); setResumo(null); localStorage.removeItem(STORAGE_KEY) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
              >
                Novo orçamento
              </button>
              <button
                onClick={() => { setModalNuvem('salvar'); setNuvemErro(''); setNuvemSucesso('') }}
                title="Salvar na nuvem"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors"
              >
                <Cloud size={14} /> Nuvem
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors"
                >
                  <Download size={14} /> Exportar ▾
                </button>
                {showExportMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[200px] overflow-hidden"
                    onMouseLeave={() => setShowExportMenu(false)}
                  >
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Para a Obra</p>
                    <button
                      onClick={() => { setShowExportMenu(false); exportarExcelExecutivo(atividades, dataInicio, valorVenda) }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700"
                    >
                      <FileSpreadsheet size={14} /> Executivo (.xlsx)
                    </button>
                    <button
                      disabled={exportandoPDF}
                      onClick={async () => {
                        setShowExportMenu(false)
                        setExportandoPDF(true)
                        await gerarRelatorioPDFExecutivo(atividades, dataInicio, valorVenda, resumo)
                        setExportandoPDF(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <FileText size={14} /> {exportandoPDF ? 'Gerando...' : 'Relatório Executivo (.pdf)'}
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <p className="px-4 pt-1.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestão Completa</p>
                    <button
                      onClick={() => { setShowExportMenu(false); exportarExcel(atividades, dataInicio, valorVenda) }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700"
                    >
                      <FileSpreadsheet size={14} /> Todas as abas (.xlsx)
                    </button>
                    <button
                      disabled={exportandoPDF}
                      onClick={async () => {
                        setShowExportMenu(false)
                        setExportandoPDF(true)
                        await gerarRelatorioPDFExecutivo(atividades, dataInicio, valorVenda, resumo)
                        setExportandoPDF(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <FileText size={14} /> {exportandoPDF ? 'Gerando...' : 'Físico-Financeiro (.pdf)'}
                    </button>
                    <button
                      disabled={exportandoPDF}
                      onClick={async () => {
                        setShowExportMenu(false)
                        setExportandoPDF(true)
                        setPrintAll(true)
                        await new Promise(r => setTimeout(r, 120))
                        await exportarPDF('#cronograma-resultado')
                        setPrintAll(false)
                        setExportandoPDF(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 pb-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <FileText size={14} /> {exportandoPDF ? 'Gerando...' : 'Todas as abas (.pdf)'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Aba Gantt */}
          {(printAll || abaAtiva === 'gantt') && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-bold text-gray-800">Cronograma Físico — Gráfico de Gantt</h3>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">■ Caminho crítico</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">◻ Não crítico</span>
              </div>
              <GanttChart atividades={atividades} totalDias={totalDias} />
            </div>
          )}

          {/* Aba Tabela */}
          {(printAll || abaAtiva === 'tabela') && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={selecionados.size === atividades.length && atividades.length > 0}
                          onChange={toggleSelecionarTodos}
                          className="accent-blue-600 cursor-pointer"
                        />
                      </th>
                      {['', 'ID', 'EAP', 'Atividade', 'Dur.', 'Início', 'Fim', 'Pred.', 'Recursos', 'Peso%', ...(valorVenda > 0 && !fontePDF ? ['Valor (R$)'] : []), 'Acum%', 'CC', ''].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap relative"
                          style={h === 'Atividade' ? { width: colAtividadeW, minWidth: colAtividadeW } : undefined}
                        >
                          {h === 'Pred.' ? (
                            <>Pred. <span className="text-[9px] font-normal text-gray-400">(3=TI · 3II=II)</span></>
                          ) : h === 'Início' ? (
                            <button
                              onClick={() => setSortData(s => s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc')}
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                              title="Ordenar por data de início"
                            >
                              Início
                              <span className="text-[10px]">
                                {sortData === 'asc' ? '▲' : sortData === 'desc' ? '▼' : '⇅'}
                              </span>
                            </button>
                          ) : h}
                          {h === 'Atividade' && (
                            <span
                              onMouseDown={e => {
                                resizingRef.current = true
                                resizeStartX.current = e.clientX
                                resizeStartW.current = colAtividadeW
                                const onMove = (ev: MouseEvent) => {
                                  if (!resizingRef.current) return
                                  const delta = ev.clientX - resizeStartX.current
                                  setColAtividadeW(Math.max(120, resizeStartW.current + delta))
                                }
                                const onUp = () => {
                                  resizingRef.current = false
                                  window.removeEventListener('mousemove', onMove)
                                  window.removeEventListener('mouseup', onUp)
                                }
                                window.addEventListener('mousemove', onMove)
                                window.addEventListener('mouseup', onUp)
                              }}
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group"
                              title="Arrastar para redimensionar"
                            >
                              <span className="w-0.5 h-4 bg-gray-300 group-hover:bg-blue-400 rounded transition-colors" />
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {atividadesOrdenadas.map(a => {
                      const inicio = new Date(dataInicio)
                      inicio.setDate(inicio.getDate() + (a.inicioDia - 1))
                      const fim = new Date(dataInicio)
                      fim.setDate(fim.getDate() + (a.fimDia - 1))
                      const isMae = a.nome.startsWith('▸')
                      const isDragging = dragId === a.id
                      const isDragOver = dragOverId === a.id
                      return (
                        <tr
                          key={a.id}
                          draggable={!isMae}
                          onDragStart={() => !isMae && setDragId(a.id)}
                          onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                          onDragOver={e => { e.preventDefault(); if (!isMae && dragId !== a.id) setDragOverId(a.id) }}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragId && dragId !== a.id) {
                              reordenarAtividades(dragId, a.id, a.etapa)
                            }
                            setDragId(null); setDragOverId(null)
                          }}
                          className={[
                            'group',
                            isMae ? 'bg-gray-50 font-bold' : 'hover:bg-blue-50/30',
                            isDragging ? 'opacity-40' : '',
                            isDragOver ? 'border-t-2 border-blue-400' : '',
                            !isMae ? 'cursor-grab' : '',
                          ].join(' ')}
                        >
                          <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selecionados.has(a.id)}
                              onChange={() => toggleSelecionado(a.id)}
                              className="accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-gray-300 select-none">
                            {isMae ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); adicionarServico(a.id) }}
                                title="Adicionar serviço nesta atividade"
                                className="text-gray-300 hover:text-blue-500 transition-colors"
                              >
                                <Plus size={13} />
                              </button>
                            ) : '⠿'}
                          </td>
                          <td className="px-3 py-1.5">{a.id}</td>
                          <td className="px-3 py-1.5 font-mono">{a.eap}</td>
                          <td className="px-3 py-1.5" style={{ paddingLeft: isMae ? 12 : 24, width: colAtividadeW, minWidth: colAtividadeW }}>
                            {isMae && editingEtapaId === a.id ? (
                              <input
                                autoFocus
                                value={editingEtapaNome}
                                onChange={e => setEditingEtapaNome(e.target.value)}
                                onBlur={() => renomearEtapa(a.id, editingEtapaNome)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renomearEtapa(a.id, editingEtapaNome)
                                  if (e.key === 'Escape') setEditingEtapaId(null)
                                }}
                                className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs font-bold focus:outline-none"
                                style={{ color: corEtapa(a.etapa) }}
                              />
                            ) : editingNomeId === a.id ? (
                              <input
                                autoFocus
                                value={editingNomeValor}
                                onChange={e => setEditingNomeValor(e.target.value)}
                                onBlur={() => renomearAtividade(a.id, editingNomeValor)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renomearAtividade(a.id, editingNomeValor)
                                  if (e.key === 'Escape') setEditingNomeId(null)
                                }}
                                className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
                              />
                            ) : (
                              <span className="flex items-center gap-1 group">
                                <span
                                  style={{ color: isMae ? corEtapa(a.etapa) : undefined }}
                                  title={a.nome.replace('▸ ', '')}
                                >
                                  {a.nome.replace('▸ ', '')}
                                </span>
                                <button
                                  title="Renomear"
                                  onClick={() => {
                                    if (isMae) {
                                      setEditingEtapaId(a.id)
                                      setEditingEtapaNome(a.etapa)
                                    } else {
                                      setEditingNomeId(a.id)
                                      setEditingNomeValor(a.nome)
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-blue-500 transition-opacity"
                                >
                                  <Pencil size={11} />
                                </button>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input
                              type="number" min={1} value={a.duracaoDias}
                              onChange={e => updateAtividade(a.id, 'duracaoDias', e.target.value)}
                              className="w-14 border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 bg-transparent"
                            />
                            <span className="ml-0.5 text-gray-400">d</span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                title={a.agendamento === 'manual' ? 'Manual — clique para automático' : 'Automático — clique para manual'}
                                onClick={() => setAtividades(prev => recalcularDatas(prev.map(x =>
                                  x.id !== a.id ? x : { ...x, agendamento: x.agendamento === 'manual' ? 'auto' : 'manual' }
                                )))}
                                className={`flex-shrink-0 transition-colors ${a.agendamento === 'manual' ? 'text-orange-500 hover:text-orange-700' : 'text-gray-300 hover:text-blue-500'}`}
                              >
                                {a.agendamento === 'manual' ? <Lock size={11} /> : <Unlock size={11} />}
                              </button>
                              {a.agendamento === 'manual' ? (
                                <input
                                  type="date"
                                  value={inicio.toISOString().slice(0, 10)}
                                  onChange={e => {
                                    if (!e.target.value) return
                                    const base = new Date(dataInicio)
                                    const picked = new Date(e.target.value + 'T00:00:00')
                                    const diffDias = Math.round((picked.getTime() - base.getTime()) / 86400000) + 1
                                    const novoDia = Math.max(1, diffDias)
                                    setAtividades(prev => recalcularDatas(prev.map(x =>
                                      x.id !== a.id ? x : { ...x, inicioDia: novoDia, fimDia: novoDia + x.duracaoDias - 1 }
                                    )))
                                  }}
                                  className="text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:border-orange-500 bg-orange-50"
                                />
                              ) : (
                                <span>{inicio.toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{fim.toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text" value={a.predecessoras}
                              onChange={e => updateAtividade(a.id, 'predecessoras', e.target.value)}
                              placeholder="Ex: 3 ou 3II"
                              title="TI: só o número (término→início) | II: número + II (início→início)"
                              className="w-20 border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 bg-transparent"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text" value={a.recursos}
                              onChange={e => updateAtividade(a.id, 'recursos', e.target.value)}
                              placeholder="—"
                              className="w-28 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 bg-transparent text-xs"
                            />
                          </td>
                          <td className="px-3 py-1.5">{a.peso.toFixed(1)}%</td>
                          {valorVenda > 0 && !fontePDF && (
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-green-700">
                              {isMae ? (a.peso / 100 * valorVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—'}
                            </td>
                          )}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5" style={{ minWidth: 40 }}>
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${a.pesoCumulativo}%` }} />
                              </div>
                              <span>{a.pesoCumulativo.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            {a.caminhoCritico ? <span className="text-red-600 font-bold">CC</span> : '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); apagarAtividade(a.id) }}
                              title={isMae ? 'Apagar atividade e serviços' : 'Apagar serviço'}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba Curva S */}
          {(printAll || abaAtiva === 'curvaS') && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">Curva S — Avanço Físico-Financeiro Acumulado</h3>
              <CurvaS atividades={atividades} totalDias={totalDias} valorVenda={valorVenda} />
              <p className="text-xs text-gray-400 mt-3 text-center">
                Avanço físico previsto (%) × Semanas de obra
              </p>

              {/* Tabela resumo por etapa */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribuição por Etapa</h4>
                <div className="space-y-2">
                  {resumo.etapas.map(etapa => {
                    const atsEtapa = atividades.filter(a => a.etapa === etapa && !a.nome.startsWith('▸'))
                    const pesoEtapa = atsEtapa.reduce((s, a) => s + a.peso, 0)
                    return (
                      <div key={etapa} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: corEtapa(etapa) }} />
                        <span className="text-xs text-gray-600 w-48 flex-shrink-0">{etapa}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-full rounded-full" style={{ width: `${pesoEtapa}%`, background: corEtapa(etapa) }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-12 text-right">{pesoEtapa.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Aba Físico-Financeiro */}
          {(printAll || abaAtiva === 'fisicoFinanceiro') && (
            <FisicoFinanceiro
              atividades={atividades}
              totalDias={totalDias}
              valorVenda={valorVenda}
              dataInicio={dataInicio}
            />
          )}

          {/* Aba Riscos */}
          {(printAll || abaAtiva === 'riscos') && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">Principais Riscos de Prazo</h3>
                <div className="space-y-3">
                  {RISCOS.map((r, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <AlertCircle size={16} className={`flex-shrink-0 mt-0.5 ${
                          r.probabilidade === 'Alta' ? 'text-red-500' : 'text-amber-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{r.risco}</p>
                          <div className="flex gap-3 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              r.probabilidade === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>Prob: {r.probabilidade}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              r.impacto === 'Alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>Impacto: {r.impacto}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1.5">
                            <span className="font-medium text-green-700">Mitigação:</span> {r.mitigacao}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Premissas */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h4 className="font-bold text-amber-800 mb-3 text-sm">Premissas Adotadas</h4>
                <ul className="space-y-1">
                  {resumo.premissas.map((p, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                      <span className="font-bold flex-shrink-0">{i + 1}.</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Nuvem ──────────────────────────────────────────────────── */}
      {modalNuvem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex gap-2">
                <button
                  onClick={() => { setModalNuvem('salvar'); setNuvemErro(''); setNuvemSucesso('') }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${modalNuvem === 'salvar' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Save size={13} className="inline mr-1" /> Salvar
                </button>
                <button
                  onClick={() => { setModalNuvem('carregar'); setNuvemErro(''); setNuvemSucesso(''); carregarListaNuvem() }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${modalNuvem === 'carregar' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <CloudDownload size={13} className="inline mr-1" /> Carregar
                </button>
              </div>
              <button onClick={() => setModalNuvem(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="px-6 py-5">
              {!supabase && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mb-4">
                  <strong>Supabase não configurado.</strong> Adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> e reinicie o servidor.
                </div>
              )}

              {/* Aba Salvar */}
              {modalNuvem === 'salvar' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cronograma</label>
                    <input
                      autoFocus
                      type="text"
                      value={nomeNuvem}
                      onChange={e => setNomeNuvem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && salvarNaNuvem()}
                      placeholder="Ex: Obra IPEM MT — Etapa 2"
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {nuvemErro && <p className="text-sm text-red-600">{nuvemErro}</p>}
                  {nuvemSucesso && <p className="text-sm text-green-600 font-semibold">{nuvemSucesso}</p>}
                  <button
                    onClick={salvarNaNuvem}
                    disabled={nuvemLoading || !supabase}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {nuvemLoading ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                    {nuvemLoading ? 'Salvando...' : 'Salvar na nuvem'}
                  </button>
                </div>
              )}

              {/* Aba Carregar */}
              {modalNuvem === 'carregar' && (
                <div>
                  {nuvemLoading && (
                    <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                  )}
                  {nuvemErro && <p className="text-sm text-red-600 mb-3">{nuvemErro}</p>}
                  {!nuvemLoading && listaNuvem.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">Nenhum cronograma salvo na nuvem.</p>
                  )}
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {listaNuvem.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-blue-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">{item.nome}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(item.atualizado_em ?? item.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => carregarCronogramaNuvem(item)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => apagarNuvem(item.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Apagar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
