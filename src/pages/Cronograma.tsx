import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Upload, FileSpreadsheet, Calendar, TrendingUp, Download,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Layers, FileText, Pencil
} from 'lucide-react'

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
  const servicos: ServicoOrcamento[] = []
  let currentServico = ''
  let currentEtapaExplicita = ''

  for (const linha of linhas) {
    // Cabeçalho de etapa: "Etapa 01.001 - SERVIÇOS PRELIMINARES"
    const mEtapa = linha.match(/^Etapa\s+[\d.]+\s*[-–]\s*(.+)$/i)
    if (mEtapa) {
      currentEtapaExplicita = mEtapa[1].trim()
      currentServico = ''
      continue
    }

    // Cabeçalho de subetapa — ignora (herda etapa pai)
    if (/^Subetapa\s+[\d.]+\s*[-–]/i.test(linha)) continue

    // Cabeçalho de serviço: "Serviço 00.001.001.001 - NOME DO SERVIÇO"
    const mServ = linha.match(/^Servi[çc]o\s+[\d.]+\s*[-–]\s*(.+)$/i)
    if (mServ) {
      currentServico = mServ[1].trim()
      continue
    }

    // Total do serviço: "Total serviço 1.500,00"
    const mTotalServ = linha.match(/Total\s+servi[çc]o\s+([\d.]+,\d{2})/i)
    if (mTotalServ && currentServico) {
      const valor = parseBRL(mTotalServ[1])
      if (valor > 0) {
        servicos.push({
          descricao: currentServico.slice(0, 100),
          unidade: 'vb',
          quantidade: 1,
          valorUnitario: valor,
          valorTotal: valor,
          etapaExplicita: currentEtapaExplicita || undefined,
        })
      }
      currentServico = ''
      continue
    }

    // Linha de insumo avulso (sem serviço pai)
    const mInsumo = linha.match(
      /^\d{3,}\s+(.+?)\s+(und?|m[²³23]?|kg|vb|gl|cj|l|h|t|pç|pc|rl|cx|sc|sv|hr|d)\s+([\d.,]+)\s+[\d.]+,\d{4}\s+([\d.]+,\d{2})\s+\d{2}\/\d{2}\/\d{4}$/i
    )
    if (mInsumo && !currentServico) {
      const desc = mInsumo[1].trim()
      const un = mInsumo[2]
      const qtd = parseBRL(mInsumo[3])
      const total = parseBRL(mInsumo[4])
      if (total > 0 && desc.length > 3) {
        servicos.push({
          descricao: desc.slice(0, 100),
          unidade: un,
          quantidade: qtd,
          valorUnitario: total / (qtd || 1),
          valorTotal: total,
          etapaExplicita: currentEtapaExplicita || undefined,
        })
      }
    }
  }

  return servicos
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

// ─── Exportar Excel ───────────────────────────────────────────────────────────

function exportarExcel(atividades: Atividade[], dataInicio: string, valorVenda: number) {
  const inicio = new Date(dataInicio)
  const rows = atividades.map(a => {
    const di = new Date(inicio)
    di.setDate(di.getDate() + (a.inicioDia - 1))
    const df = new Date(inicio)
    df.setDate(df.getDate() + (a.fimDia - 1))
    const row: Record<string, unknown> = {
      'ID': a.id,
      'EAP': a.eap,
      'Atividade': a.nome.replace('▸ ', ''),
      'Etapa': a.etapa,
      'Duração (dias)': a.duracaoDias,
      'Início': di.toLocaleDateString('pt-BR'),
      'Término': df.toLocaleDateString('pt-BR'),
      'Predecessoras': a.predecessoras,
      'Recursos': a.recursos,
      'Peso (%)': a.peso.toFixed(2),
      'Peso Acum. (%)': a.pesoCumulativo.toFixed(2),
      'Caminho Crítico': a.caminhoCritico ? 'Sim' : 'Não',
    }
    if (valorVenda > 0) {
      row['Valor Venda (R$)'] = (a.peso / 100 * valorVenda).toFixed(2)
      row['Valor Acum. (R$)'] = (a.pesoCumulativo / 100 * valorVenda).toFixed(2)
    }
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cronograma')
  XLSX.writeFile(wb, 'cronograma-obra.xlsx')
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
  const STORAGE_KEY = 'pavcon_cronograma_v1'

  function loadStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
  }

  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analisando' | 'resultado'>(() => loadStorage()?.step ?? 'idle')
  const [erro, setErro] = useState('')
  const [fileName, setFileName] = useState(() => loadStorage()?.fileName ?? '')
  const [dataInicio, setDataInicio] = useState(() => loadStorage()?.dataInicio ?? new Date().toISOString().slice(0, 10))
  const [valorVenda, setValorVenda] = useState<number>(() => loadStorage()?.valorVenda ?? 0)
  const [atividades, setAtividades] = useState<Atividade[]>(() => loadStorage()?.atividades ?? [])
  const [resumo, setResumo] = useState<Resumo | null>(() => loadStorage()?.resumo ?? null)
  const [abaAtiva, setAbaAtiva] = useState<'gantt' | 'tabela' | 'curvaS' | 'fisicoFinanceiro' | 'riscos'>(() => loadStorage()?.abaAtiva ?? 'gantt')

  // Persiste no localStorage sempre que o estado relevante muda
  useEffect(() => {
    if (step === 'analisando') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, fileName, dataInicio, valorVenda, atividades, resumo, abaAtiva }))
  }, [step, fileName, dataInicio, valorVenda, atividades, resumo, abaAtiva])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingEtapaId, setEditingEtapaId] = useState<string | null>(null)
  const [editingEtapaNome, setEditingEtapaNome] = useState('')
  const [editingNomeId, setEditingNomeId] = useState<string | null>(null)
  const [editingNomeValor, setEditingNomeValor] = useState('')
  const [colAtividadeW, setColAtividadeW] = useState(200)
  const resizingRef = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  function renomearAtividade(id: string, novoNome: string) {
    const nome = novoNome.trim()
    if (nome) setAtividades(prev => prev.map(a => a.id === id ? { ...a, nome } : a))
    setEditingNomeId(null)
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={22} className="text-blue-600" />
          Planejador de Obra
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Gere um cronograma executivo profissional a partir do orçamento da obra
        </p>
      </div>

      {step === 'idle' && (
        <div className="max-w-2xl space-y-4">
          {/* Data de início + Valor de Venda */}
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
        <div className="space-y-4">
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
                onClick={() => { setStep('idle'); setAtividades([]); setResumo(null); localStorage.removeItem(STORAGE_KEY) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
              >
                Novo orçamento
              </button>
              <button
                onClick={() => exportarExcel(atividades, dataInicio, valorVenda)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors"
              >
                <Download size={14} /> Excel
              </button>
            </div>
          </div>

          {/* Aba Gantt */}
          {abaAtiva === 'gantt' && (
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
          {abaAtiva === 'tabela' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['', 'ID', 'EAP', 'Atividade', 'Etapa', 'Dur.', 'Início', 'Fim', 'Pred.', 'Recursos', 'Peso%', ...(valorVenda > 0 ? ['Valor (R$)'] : []), 'Acum%', 'CC'].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap relative"
                          style={h === 'Atividade' ? { width: colAtividadeW, minWidth: colAtividadeW } : undefined}
                        >
                          {h === 'Pred.' ? (
                            <>Pred. <span className="text-[9px] font-normal text-gray-400">(3=TI · 3II=II)</span></>
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
                    {atividades.map(a => {
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
                            isMae ? 'bg-gray-50 font-bold' : 'hover:bg-blue-50/30',
                            isDragging ? 'opacity-40' : '',
                            isDragOver ? 'border-t-2 border-blue-400' : '',
                            !isMae ? 'cursor-grab' : '',
                          ].join(' ')}
                        >
                          <td className="px-3 py-1.5 text-gray-300 select-none">{!isMae ? '⠿' : ''}</td>
                          <td className="px-3 py-1.5">{a.id}</td>
                          <td className="px-3 py-1.5 font-mono">{a.eap}</td>
                          <td className="px-3 py-1.5 overflow-hidden" style={{ paddingLeft: isMae ? 12 : 24, width: colAtividadeW, maxWidth: colAtividadeW }}>
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
                              <span className="flex items-center gap-1 group min-w-0">
                                <span
                                  style={{ color: isMae ? corEtapa(a.etapa) : undefined }}
                                  className="truncate"
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
                          <td className="px-3 py-1.5">
                            {isMae ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                style={{ background: corEtapa(a.etapa) }}>{a.etapa}</span>
                            ) : (
                              <select
                                value={a.etapa}
                                onChange={e => moverParaEtapa(a.id, e.target.value)}
                                className="text-[10px] font-medium text-white rounded px-1 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                style={{ background: corEtapa(a.etapa) }}
                              >
                                {ETAPA_MAP.map(em => (
                                  <option key={em.etapa} value={em.etapa} style={{ background: '#fff', color: '#374151' }}>{em.etapa}</option>
                                ))}
                                <option value="Outros Serviços" style={{ background: '#fff', color: '#374151' }}>Outros Serviços</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number" min={1} value={a.duracaoDias}
                              onChange={e => updateAtividade(a.id, 'duracaoDias', e.target.value)}
                              className="w-14 border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 bg-transparent"
                            />
                            <span className="ml-0.5 text-gray-400">d</span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{inicio.toLocaleDateString('pt-BR')}</td>
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
                          {valorVenda > 0 && (
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-green-700">
                              {(a.peso / 100 * valorVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
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
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba Curva S */}
          {abaAtiva === 'curvaS' && (
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
          {abaAtiva === 'fisicoFinanceiro' && (
            <FisicoFinanceiro
              atividades={atividades}
              totalDias={totalDias}
              valorVenda={valorVenda}
              dataInicio={dataInicio}
            />
          )}

          {/* Aba Riscos */}
          {abaAtiva === 'riscos' && (
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
    </div>
  )
}
