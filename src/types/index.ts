export type StatusObra = 'A Iniciar' | 'Execução' | 'Concluída' | 'Paralisada'
export type Prioridade = 'Alta' | 'Média' | 'Baixa'
export type Regiao = 'Norte' | 'Sul' | 'Metropolitana' | 'Centro-Oeste' | 'Leste'
export type StatusIDP = 'ATINGIDO' | 'NÃO ATINGIDO' | '—'

export interface Obra {
  id: string
  // Identificação
  engenharia: string            // ENGENHARIA (estado/UF)
  tipo: string                  // TIPO (Própria / Terceirizada)
  engenheiro: string            // ENG. RESP.
  orgao: string                 // ÓRGÃO
  municipio: string             // CIDADE
  regiao: Regiao
  localidade: string            // OBRA
  servico: string
  tipoServico: string
  dataOS: string
  ordemServico: string          // CÓD.
  numeroObra: string
  // Datas
  dataInicio: string            // INÍCIO
  conclusaoPrevista: string     // DATA PREV. CONCLUSÃO
  dataRealConclusao: string     // DATA REAL DE CONCLUSÃO
  // Financeiro
  executivo: number             // EXECUTIVO (R$)
  venda: number                 // VENDA (R$)
  avancoPct: number             // AVANÇO %
  avancoReais: number           // AVANÇO R$
  realizado: number             // REALIZADO
  comprometido: number          // COMPROMETIDO
  valorMedido: number           // VALOR MEDIDO
  saldo: number                 // SALDO
  proximaMedicao: number        // PROXIMA MED. (R$)
  dataMedicao: string           // DATA próxima medição
  // Prazo
  tempoPrevisto: number         // TEMPO DE OBRA PREVISTO (DIAS)
  tempoAtual: number            // TEMPO DE OBRA ATUAL (DIAS)
  velocidadePlanej: number      // VELOCIDADE EXEC. PLANEJ. (%/dia)
  velocidadeReal: number        // VELOCIDADE EXEC. REAL (%/dia)
  idp: number                   // ÍNDICE DE DESEMPENHO DE PRAZO (%)
  statusIdp: StatusIDP          // STATUS IDP: ATINGIDO / NÃO ATINGIDO
  // Status e prioridade
  status: StatusObra
  prioridade: Prioridade
  ano: number
  historicoAvanco?: { data: string; avancoPct: number }[]
  contratoItem?: string            // Vínculo ao contrato em faturamentoContratos
}

export interface Anexo {
  id: string
  obraId: string
  nome: string
  tipo: string        // MIME type
  tamanho: number     // bytes
  dados: string       // base64
  data: string        // ISO date
  descricao?: string
}

export interface Engenheiro {
  id: string
  nome: string
  cargo: string
  email: string
  telefone: string
  obrasAtivas: number
  obrasConcluidas: number
  taxaPontualidade: number
}
