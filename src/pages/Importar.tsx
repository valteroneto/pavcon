import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, FileSpreadsheet, CheckCircle, ShieldOff,
  AlertTriangle, X, ChevronRight, Loader2, Table2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useObras } from '../contexts/ObrasContext'
import type { Obra, StatusObra, Regiao } from '../types'

// ── Utilitários de conversão ──────────────────────────────────────────────────

/** Serial Excel ou "dd/mm/yyyy" ou "-" → "YYYY-MM-DD" ou "" */
function parseExcelDate(v: unknown): string {
  if (!v || v === '-' || v === '') return ''
  if (typeof v === 'number') {
    // Serial Excel (dias desde 1900-01-01, com bug do ano bissexto 1900)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d  = new Date(ms)
    return d.toISOString().split('T')[0]
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed || trimmed === '-') return ''
    // Formato dd/mm/yyyy
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
    // Formato yyyy-mm-dd passado direto
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  }
  return ''
}

/** Nome da aba → UF (MARANHÃO→MA, PIAUÍ→PI, etc.) */
function sheetToUF(name: string): string {
  const map: Record<string, string> = {
    'MARANHÃO': 'MA', 'MARANHAO': 'MA',
    'PIAUÍ': 'PI',   'PIAUI': 'PI',
    'PARÁ': 'PA',    'PARA': 'PA',
    'AMAZONAS': 'AM', 'RORAIMA': 'RR',
    'AMAPÁ': 'AP',   'AMAPA': 'AP',
    'TOCANTINS': 'TO', 'RONDÔNIA': 'RO', 'RONDONIA': 'RO',
    'ACRE': 'AC',
    'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
    'GOIÁS': 'GO',   'GOIAS': 'GO',
    'DISTRITO FEDERAL': 'DF',
    'MINAS GERAIS': 'MG', 'SÃO PAULO': 'SP', 'SAO PAULO': 'SP',
    'RIO DE JANEIRO': 'RJ', 'ESPÍRITO SANTO': 'ES', 'ESPIRITO SANTO': 'ES',
    'BAHIA': 'BA', 'SERGIPE': 'SE', 'ALAGOAS': 'AL',
    'PERNAMBUCO': 'PE', 'PARAÍBA': 'PB', 'PARAIBA': 'PB',
    'RIO GRANDE DO NORTE': 'RN', 'CEARÁ': 'CE', 'CEARA': 'CE',
    'PARANÁ': 'PR', 'PARANA': 'PR',
    'SANTA CATARINA': 'SC', 'RIO GRANDE DO SUL': 'RS',
  }
  const upper = name.toUpperCase().trim()
  return map[upper] ?? upper.substring(0, 2)
}

/** STATUS da planilha → StatusObra do app */
function normalizeStatus(s: unknown): StatusObra {
  const v = String(s ?? '').toUpperCase().trim()
  if (v === 'CONCLUÍDA' || v === 'CONCLUIDA') return 'Concluída'
  if (v === 'EXECUÇÃO'  || v === 'EXECUCAO')  return 'Execução'
  if (v === 'PARADA' || v === 'PARALISADA')    return 'Paralisada'
  return 'A Iniciar' // A INICIAR, ORÇAMENTO, ORCAMENTO, etc.
}

/** TIPO da planilha → tipo do app */
function normalizeTipo(s: unknown): string {
  const v = String(s ?? '').toUpperCase().trim()
  if (v === 'TERCEIRIZADA') return 'Terceirizada'
  return 'Própria'
}

/** Parseia um número ou retorna 0 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

// ── Detecção de aba válida ────────────────────────────────────────────────────
function isObraSheet(headerRow: unknown[]): boolean {
  const cells = headerRow.map(c => String(c ?? '').toUpperCase())
  return cells.includes('TIPO') && cells.includes('OBRA') && (cells.includes('CÓD.') || cells.includes('COD.') || cells.includes('CÓD') || cells.includes('COD'))
}

// ── Parser principal ──────────────────────────────────────────────────────────
function parseSheet(ws: XLSX.WorkSheet, sheetName: string): Omit<Obra, 'id'>[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (data.length < 2) return []

  const headerRow = data[0] as unknown[]
  if (!isObraSheet(headerRow)) return []

  const uf = sheetToUF(sheetName)

  return data.slice(1)
    .filter((row: unknown) => {
      const r = row as unknown[]
      // Linha deve ter ao menos CÓD (col 5) preenchido
      return r[5] !== '' && r[5] != null
    })
    .map((row: unknown): Omit<Obra, 'id'> => {
      const r = row as unknown[]
      const dataInicio        = parseExcelDate(r[7])
      const conclusaoPrevista = parseExcelDate(r[8])
      const dataRealConclusao = parseExcelDate(r[9])
      const avancoBruto       = toNum(r[12])
      // Planilha armazena 0–1 (ex: 0.62 = 62%). Se > 1.0 assume que já é percentual.
      const avancoPct         = avancoBruto <= 1 ? avancoBruto * 100 : avancoBruto
      const anoInicio         = dataInicio ? parseInt(dataInicio.split('-')[0]) : new Date().getFullYear()

      return {
        engenharia:        uf,
        tipo:              normalizeTipo(r[0]),
        engenheiro:        String(r[1] ?? '').trim(),
        orgao:             String(r[2] ?? '').trim(),
        municipio:         String(r[3] ?? '').trim(),
        localidade:        String(r[4] ?? '').trim(),
        servico:           '',
        tipoServico:       'Reforma',
        ordemServico:      String(r[5] ?? '').trim(),
        numeroObra:        String(r[5] ?? '').trim(),
        dataOS:            '',
        regiao:            'Metropolitana' as Regiao,
        status:            normalizeStatus(r[6]),
        dataInicio,
        conclusaoPrevista,
        dataRealConclusao,
        executivo:         toNum(r[10]),
        venda:             toNum(r[11]),
        avancoPct:         Math.round(avancoPct * 100) / 100,
        avancoReais:       toNum(r[13]),
        realizado:         toNum(r[14]),
        comprometido:      toNum(r[15]),
        valorMedido:       toNum(r[16]),
        saldo:             toNum(r[17]),
        proximaMedicao:    toNum(r[18]),
        dataMedicao:       parseExcelDate(r[19]),
        prioridade:        'Média',
        ano:               anoInicio,
        tempoPrevisto:     0,
        tempoAtual:        0,
        velocidadePlanej:  0,
        velocidadeReal:    0,
        idp:               0,
        statusIdp:         '—',
      }
    })
}

// ── Formatação para preview ──────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—'

const STATUS_BADGE: Record<string, string> = {
  'A Iniciar':  'bg-amber-50 text-amber-700 border-amber-200',
  'Execução':   'bg-blue-50 text-blue-700 border-blue-200',
  'Concluída':  'bg-green-50 text-green-700 border-green-200',
  'Paralisada': 'bg-gray-100 text-gray-600 border-gray-200',
}

type ImportStep = 'idle' | 'preview' | 'importing' | 'done'

// ── Componente principal ──────────────────────────────────────────────────────
export default function Importar() {
  const { isAdmin }  = useAuth()
  const { obras, addObra, updateObra, createSnapshot }  = useObras()

  const [dragging,      setDragging]      = useState(false)
  const [step,          setStep]          = useState<ImportStep>('idle')
  const [obrasPreview,  setObrasPreview]  = useState<Omit<Obra,'id'>[]>([])
  const [avisos,        setAvisos]        = useState<string[]>([])
  const [fileName,      setFileName]      = useState('')
  const [sheetNames,    setSheetNames]    = useState<string[]>([])
  const [modoSync,      setModoSync]      = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!isAdmin) return
    setFileName(file.name)
    setAvisos([])

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data   = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb     = XLSX.read(data, { type: 'array' })
        const found: Omit<Obra,'id'>[]  = []
        const sheets: string[] = []
        const warns:  string[] = []

        for (const name of wb.SheetNames) {
          const ws     = wb.Sheets[name]
          const parsed = parseSheet(ws, name)
          if (parsed.length > 0) {
            found.push(...parsed)
            sheets.push(`${name} (${parsed.length} obras)`)
          }
        }

        if (found.length === 0) {
          warns.push('Nenhuma aba com dados de obras foi encontrada. Verifique se o arquivo contém as colunas TIPO, OBRA e CÓD.')
        }

        // Avisos de dados
        const semLocalidade = found.filter(o => !o.localidade).length
        if (semLocalidade > 0) warns.push(`${semLocalidade} obra(s) sem nome de OBRA preenchido.`)

        setObrasPreview(found)
        setSheetNames(sheets)
        setAvisos(warns)
        setStep('preview')
      } catch (err) {
        setAvisos([`Erro ao ler o arquivo: ${err instanceof Error ? err.message : 'formato inválido'}`])
        setStep('preview')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [isAdmin])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!isAdmin) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = () => {
    setStep('importing')
    setTimeout(() => {
      createSnapshot('Antes da importação')
      if (modoSync) {
        // Sincronizar: atualizar existentes pelo ordemServico, adicionar novas
        obrasPreview.forEach(o => {
          const existente = obras.find(x => x.ordemServico === o.ordemServico && o.ordemServico)
          if (existente) updateObra(existente.id, o)
          else addObra(o)
        })
      } else {
        obrasPreview.forEach(o => addObra(o))
      }
      setStep('done')
    }, 50)
  }

  const resetar = () => {
    setStep('idle')
    setObrasPreview([])
    setAvisos([])
    setFileName('')
    setSheetNames([])
  }

  // ── Tela: Concluído ──────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="space-y-6 max-w-2xl">
        <Header />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            {obrasPreview.length} obra(s) importadas com sucesso!
          </h2>
          <p className="text-sm text-gray-500">As obras já aparecem na Tabela Detalhada.</p>
          <button onClick={resetar}
            className="mt-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors">
            Importar outro arquivo
          </button>
        </div>
      </div>
    )
  }

  // ── Tela: Preview ────────────────────────────────────────────────────────
  if (step === 'preview' || step === 'importing') {
    const previewed = obrasPreview.slice(0, 10)
    return (
      <div className="space-y-5 max-w-6xl">
        <div className="flex items-start justify-between">
          <Header />
          <button onClick={resetar} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <X size={14} /> Cancelar
          </button>
        </div>

        {/* Avisos */}
        {avisos.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
            {avisos.map((a, i) => (
              <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {a}
              </p>
            ))}
          </div>
        )}

        {obrasPreview.length > 0 && (
          <>
            {/* Resumo */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Arquivo</p>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FileSpreadsheet size={15} className="text-green-600" /> {fileName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sheetNames.map(s => (
                      <span key={s} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-blue-700">{obrasPreview.length}</p>
                  <p className="text-xs text-gray-500">obra(s) encontrada(s)</p>
                </div>
              </div>
            </div>

            {/* Preview da tabela */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                <Table2 size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">
                  Prévia — {previewed.length} de {obrasPreview.length} obra(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['UF','CÓD.','Tipo','Engenheiro','Órgão','Cidade','Obra','Status','Início','Conclusão Prev.','Executivo','Venda','Avanço %'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewed.map((o, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 font-mono font-bold text-blue-800">{o.engenharia}</td>
                        <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{o.ordemServico}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.tipo === 'Própria' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {o.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{o.engenheiro || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{o.orgao || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{o.municipio || '—'}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <div className="truncate font-medium text-gray-900" title={o.localidade}>{o.localidade || '—'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[o.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                          {o.dataInicio ? new Date(o.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                          {o.conclusaoPrevista ? new Date(o.conclusaoPrevista + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-700">{fmtBRL(o.executivo)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-900">{fmtBRL(o.venda)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-bold"
                          style={{ color: o.avancoPct >= 90 ? '#16a34a' : o.avancoPct >= 70 ? '#d97706' : '#2563eb' }}>
                          {o.avancoPct.toFixed(1).replace('.', ',')}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {obrasPreview.length > 10 && (
                <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                  + {obrasPreview.length - 10} obra(s) não exibidas no preview
                </div>
              )}
            </div>

            {/* Botão confirmar */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <div
                  onClick={() => setModoSync(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${modoSync ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${modoSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className={modoSync ? 'text-blue-700 font-semibold' : 'text-gray-500'}>
                  {modoSync ? 'Sincronizar (atualiza existentes)' : 'Adicionar (cria novas obras)'}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button onClick={resetar}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} disabled={step === 'importing'}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-xl transition-colors shadow-sm">
                  {step === 'importing'
                    ? <><Loader2 size={15} className="animate-spin" /> Importando...</>
                    : <><ChevronRight size={15} /> {modoSync ? 'Sincronizar' : 'Importar'} {obrasPreview.length} obra(s)</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Tela: Idle (upload) ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <Header />
        {!isAdmin && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded-lg">
            <ShieldOff size={14} />
            Somente administradores podem importar dados.
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); if (isAdmin) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`bg-white rounded-2xl border-2 border-dashed p-16 flex flex-col items-center gap-4 transition-colors ${
          !isAdmin
            ? 'border-gray-200 opacity-50 cursor-not-allowed'
            : dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 cursor-pointer'
        }`}
      >
        <div className={`rounded-full p-4 ${isAdmin ? 'bg-blue-50' : 'bg-gray-100'}`}>
          <Upload size={32} className={isAdmin ? 'text-blue-600' : 'text-gray-400'} />
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-medium">Arraste e solte o arquivo aqui</p>
          <p className="text-gray-400 text-sm mt-1">ou clique para selecionar</p>
        </div>
        {isAdmin ? (
          <label className="cursor-pointer bg-blue-700 hover:bg-blue-800 text-white text-sm px-5 py-2 rounded-lg transition-colors">
            Selecionar arquivo .xlsx
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInputChange} />
          </label>
        ) : (
          <span className="text-sm text-gray-400 italic">Acesso restrito</span>
        )}
        <p className="text-xs text-gray-400">Suporta .xlsx e .xls — formato SIENGE / Acompanhamento de Obras</p>
      </div>

      {/* Colunas esperadas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-green-600" />
          Colunas esperadas na planilha
        </h3>
        <p className="text-xs text-gray-500 mb-3">A primeira linha da aba deve conter os seguintes cabeçalhos:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            'TIPO', 'ENG. RESP.', 'ÓRGÃO', 'CIDADE',
            'OBRA', 'CÓD.', 'STATUS', 'INÍCIO',
            'DATA PREV. CONCLUSÃO', 'DATA REAL DE CONCLUSÃO',
            'EXECUTIVO', 'VENDA', 'AVANÇO %', 'AVANÇO R$',
            'REALIZADO', 'COMPROMETIDO', 'VALOR MEDIDO',
            'SALDO', 'PROXIMA MED.', 'DATA',
          ].map(col => (
            <span key={col} className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded truncate" title={col}>
              {col}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          O nome da aba é usado como <strong>UF da engenharia</strong> (ex: aba "MARANHÃO" → MA).
        </p>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Importar Dados</h1>
      <p className="text-gray-500 text-sm mt-1">Importe planilhas de obras (.xlsx) — formato Acompanhamento de Obras</p>
    </div>
  )
}
