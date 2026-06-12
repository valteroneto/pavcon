import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Upload, FileSpreadsheet, Calendar, TrendingUp, Download,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Layers, FileText
} from 'lucide-react'

// Configura worker do PDF.js via CDN (evita bundling)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Atividade {
  id: string
  eap: string
  nome: string
  etapa: string
  duracaoSemanas: number
  inicioSemana: number   // semana 1-based
  fimSemana: number
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
}

function parseOrcamento(wb: XLSX.WorkBook): ServicoOrcamento[] {
  const servicos: ServicoOrcamento[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 3) continue

      // Detecta linhas com descrição + valor numérico
      const cells = row.map(c => String(c ?? '').trim())
      const descIdx = cells.findIndex(c => c.length > 5 && isNaN(Number(c.replace(',', '.'))))
      if (descIdx < 0) continue

      const desc = cells[descIdx]
      if (!desc || desc.length < 4) continue

      // Ignora cabeçalhos comuns
      const ignorar = ['descrição', 'item', 'código', 'total', 'subtotal', 'bdi', 'valor', 'referência', 'composição']
      if (ignorar.some(ig => desc.toLowerCase().startsWith(ig))) continue

      // Procura valores numéricos na linha
      const nums = cells
        .filter((_, idx) => idx !== descIdx)
        .map(c => parseFloat(c.replace(/\./g, '').replace(',', '.')))
        .filter(n => !isNaN(n) && n > 0)

      if (nums.length === 0) continue

      const valorTotal = Math.max(...nums)
      if (valorTotal < 1) continue

      const unidade = cells.find(c => /^(m²|m³|m|un|vb|cj|kg|l|h|t|und|vlb|gl|m2|m3)/i.test(c)) ?? 'vb'

      servicos.push({
        descricao: desc,
        unidade,
        quantidade: nums.length >= 2 ? nums[0] : 1,
        valorUnitario: nums.length >= 3 ? nums[nums.length - 2] : valorTotal,
        valorTotal,
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

  for (const linha of linhas) {
    // Cabeçalho de etapa — apenas rastreia contexto
    if (/^Etapa\s+[\d.]+\s*[-–]/i.test(linha)) {
      currentServico = ''
      continue
    }

    // Cabeçalho de subetapa — ignora
    if (/^Subetapa\s+[\d.]+\s*[-–]/i.test(linha)) {
      continue
    }

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
        })
      }
      currentServico = ''
      continue
    }

    // Linha de insumo: "CÓDIGO DESCRIÇÃO UN QTD PREÇO_UN PREÇO_TOTAL DATA"
    // ex: "13549 PLACA DE OBRA und 1,0000 1.500,0000 1.500,00 08/07/2025"
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
        })
      }
    }
  }

  return servicos
}

function parseGenericLinhas(linhas: string[]): ServicoOrcamento[] {
  const servicos: ServicoOrcamento[] = []
  const ignorar = ['descrição', 'item', 'código', 'total geral', 'subtotal', 'bdi', 'valor total', 'referência']

  for (const limpa of linhas) {
    if (limpa.length < 6) continue
    if (ignorar.some(ig => limpa.toLowerCase().startsWith(ig))) continue

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

  console.log('[PDF] Total linhas extraídas:', todasLinhas.length)
  console.log('[PDF] Primeiras 30 linhas:', todasLinhas.slice(0, 30))
  console.log('[PDF] Amostra do texto (chars 0-500):', textoCompleto.slice(0, 500))

  // Detecta formato SIENGE/STARIAN
  const isSienge =
    /Insumos\s+Or[çc]ados/i.test(textoCompleto) ||
    /Etapa\s+\d{2}\.\d{3}\s*[-–]/i.test(textoCompleto) ||
    /Servi[çc]o\s+\d{2}\.\d{3}/i.test(textoCompleto) ||
    /Total\s+servi[çc]o/i.test(textoCompleto)

  console.log('[PDF] isSienge detectado:', isSienge)

  if (isSienge) {
    const result = parseSienge(todasLinhas)
    console.log('[PDF] parseSienge retornou:', result.length, 'serviços')
    if (result.length > 0) return result
  }

  const generic = parseGenericLinhas(todasLinhas)
  console.log('[PDF] parseGeneric retornou:', generic.length, 'serviços')
  return generic
}

// ─── Gerador de cronograma ────────────────────────────────────────────────────

function gerarCronograma(servicos: ServicoOrcamento[], dataInicio: string): { atividades: Atividade[]; resumo: Resumo } {
  const totalCusto = servicos.reduce((s, sv) => s + sv.valorTotal, 0) || 1

  // Agrupa por etapa
  const grupos: Record<string, ServicoOrcamento[]> = {}
  for (const s of servicos) {
    const e = detectarEtapa(s.descricao)
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

    // Duração da etapa proporcional ao peso (mín 1, máx 12 semanas)
    const duracaoEtapa = Math.max(1, Math.min(12, Math.round(pesoEtapa / 5)))

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
        duracaoSemanas: durSub,
        inicioSemana: subSemana,
        fimSemana: fim,
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
      duracaoSemanas: duracaoEtapa,
      inicioSemana: inicioEtapa,
      fimSemana: fimEtapa,
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
    duracaoSemanas: 0,
    inicioSemana: semanaAtual,
    fimSemana: semanaAtual,
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

function exportarExcel(atividades: Atividade[], dataInicio: string) {
  const inicio = new Date(dataInicio)
  const rows = atividades.map(a => {
    const di = new Date(inicio)
    di.setDate(di.getDate() + (a.inicioSemana - 1) * 7)
    const df = new Date(inicio)
    df.setDate(df.getDate() + (a.fimSemana - 1) * 7 + 6)
    return {
      'ID': a.id,
      'EAP': a.eap,
      'Atividade': a.nome.replace('▸ ', ''),
      'Etapa': a.etapa,
      'Duração (sem.)': a.duracaoSemanas,
      'Início': di.toLocaleDateString('pt-BR'),
      'Término': df.toLocaleDateString('pt-BR'),
      'Predecessoras': a.predecessoras,
      'Recursos': a.recursos,
      'Peso (%)': a.peso.toFixed(2),
      'Peso Acum. (%)': a.pesoCumulativo.toFixed(2),
      'Caminho Crítico': a.caminhoCritico ? 'Sim' : 'Não',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cronograma')
  XLSX.writeFile(wb, 'cronograma-obra.xlsx')
}

// ─── Componente Gantt ─────────────────────────────────────────────────────────

function GanttChart({ atividades, totalSemanas }: { atividades: Atividade[]; totalSemanas: number }) {
  const cols = Math.min(totalSemanas, 52)

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
                const ativo = !isMarca && sem >= a.inicioSemana && sem <= Math.min(a.fimSemana, cols)
                const isInicio = sem === a.inicioSemana
                const isFim = sem === Math.min(a.fimSemana, cols)
                return (
                  <div key={i} className="flex-shrink-0 border-l border-gray-100 h-full flex items-center justify-center"
                    style={{ width: 22 }}>
                    {isMarca && sem === a.inicioSemana ? (
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

function CurvaS({ atividades, totalSemanas }: { atividades: Atividade[]; totalSemanas: number }) {
  const pontos = useMemo(() => {
    const semanas = Math.min(totalSemanas, 52)
    return Array.from({ length: semanas + 1 }, (_, s) => {
      const acum = atividades
        .filter(a => !a.nome.startsWith('▸') && !a.marco && a.fimSemana <= s)
        .reduce((sum, a) => sum + a.peso, 0)
      return Math.min(100, acum)
    })
  }, [atividades, totalSemanas])

  const W = 600, H = 200
  const padL = 40, padB = 30, padR = 20, padT = 10

  const toX = (i: number) => padL + (i / (pontos.length - 1)) * (W - padL - padR)
  const toY = (v: number) => padT + (1 - v / 100) * (H - padT - padB)

  const path = pontos.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ')
  const area = `${path} L${toX(pontos.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
      {/* Grid */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padL - 4} y={toY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}%</text>
        </g>
      ))}
      {/* Área */}
      <path d={area} fill="#3b82f620" />
      {/* Linha */}
      <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} />
      {/* Pontos */}
      {pontos.filter((_, i) => i % Math.ceil(pontos.length / 10) === 0).map((v, i, arr) => {
        const origIdx = i * Math.ceil(pontos.length / 10)
        return <circle key={i} cx={toX(origIdx)} cy={toY(v)} r={3} fill="#2563eb" />
      })}
      {/* Eixo X label */}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#6b7280">Semanas</text>
    </svg>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Cronograma() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'analisando' | 'resultado'>('idle')
  const [erro, setErro] = useState('')
  const [fileName, setFileName] = useState('')
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'gantt' | 'tabela' | 'curvaS' | 'riscos'>('gantt')

  const totalSemanas = useMemo(() =>
    atividades.length ? Math.max(...atividades.map(a => a.fimSemana)) : 0
  , [atividades])

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
          {/* Data de início */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Início da Obra</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
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
              { label: 'Prazo Total', value: `${resumo.prazoTotal} semanas`, sub: `≈ ${Math.round(resumo.prazoTotal / 4.3)} meses`, icon: Clock, cor: '#2563eb' },
              { label: 'Atividades', value: resumo.totalAtividades, sub: `em ${resumo.etapas.length} etapas`, icon: Layers, cor: '#059669' },
              { label: 'Etapas', value: resumo.etapas.length, sub: 'identificadas', icon: ChevronRight, cor: '#d97706' },
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
                { id: 'tabela', label: 'Tabela' },
                { id: 'curvaS', label: 'Curva S' },
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
                onClick={() => { setStep('idle'); setAtividades([]); setResumo(null) }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
              >
                Novo orçamento
              </button>
              <button
                onClick={() => exportarExcel(atividades, dataInicio)}
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
              <GanttChart atividades={atividades} totalSemanas={totalSemanas} />
            </div>
          )}

          {/* Aba Tabela */}
          {abaAtiva === 'tabela' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['ID', 'EAP', 'Atividade', 'Etapa', 'Dur.', 'Início', 'Fim', 'Pred.', 'Recursos', 'Peso%', 'Acum%', 'CC'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {atividades.map(a => {
                      const inicio = new Date(dataInicio)
                      inicio.setDate(inicio.getDate() + (a.inicioSemana - 1) * 7)
                      const fim = new Date(dataInicio)
                      fim.setDate(fim.getDate() + (a.fimSemana - 1) * 7 + 6)
                      const isMae = a.nome.startsWith('▸')
                      return (
                        <tr key={a.id} className={isMae ? 'bg-gray-50 font-bold' : 'hover:bg-blue-50/30'}>
                          <td className="px-3 py-1.5">{a.id}</td>
                          <td className="px-3 py-1.5 font-mono">{a.eap}</td>
                          <td className="px-3 py-1.5 max-w-[180px] truncate" style={{ paddingLeft: isMae ? 12 : 24 }}>
                            <span style={{ color: isMae ? corEtapa(a.etapa) : undefined }}>{a.nome.replace('▸ ', '')}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ background: corEtapa(a.etapa) }}>{a.etapa}</span>
                          </td>
                          <td className="px-3 py-1.5">{a.duracaoSemanas}sem</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{inicio.toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{fim.toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-1.5">{a.predecessoras}</td>
                          <td className="px-3 py-1.5 max-w-[100px] truncate">{a.recursos}</td>
                          <td className="px-3 py-1.5">{a.peso.toFixed(1)}%</td>
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
              <CurvaS atividades={atividades} totalSemanas={totalSemanas} />
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
