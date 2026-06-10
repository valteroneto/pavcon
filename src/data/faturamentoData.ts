export type MesesProjecao = {
  janeiro: number; fevereiro: number; marco: number; abril: number
  maio: number; junho: number; julho: number; agosto: number
  setembro: number; outubro: number; novembro: number; dezembro: number
}

export type Mes = keyof MesesProjecao

export interface FaturamentoContrato {
  item: string
  tipo_obra: string
  tipo_contrato: string
  contrato: string
  contratante: string
  objeto: string
  cidade: string
  estado: string
  data_inicio: string
  data_fim: string
  valor_contrato: number
  faturamento_anterior: number
  faturamento_2025: number
  aditivo: number
  saldo: number
  observacao: string
  projecao: MesesProjecao
  real?: MesesProjecao
}

export const MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'] as const
export const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
export const MESES_REAL = ['janeiro','fevereiro','marco','abril','maio'] // meses com dados reais disponíveis

export const METAS = { META01: 130_000_000, META02: 170_000_000, META03: 200_000_000 }

// Total acumulado do exercício (linha TOTAIS da planilha)
export const TOTAIS_MENSAIS: { projecao: MesesProjecao; real: MesesProjecao } = {
  projecao: { janeiro:3711892.56,fevereiro:5635609.44,marco:11117440.62,abril:24410548.44,maio:35112236.46,junho:39200284.87,julho:44506884.21,agosto:34563959.5,setembro:33870390.56,outubro:14528115.48,novembro:10319027.94,dezembro:8833681.21 },
  real:     { janeiro:3011211.15, fevereiro:5843699.44,marco:11053440.55,abril:9331569.19, maio:11551609.03,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
}

export const faturamentoContratos: FaturamentoContrato[] = [
  { item:'1.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'CT 003/2024 - GERENCIAMENTO PEDRO II', contratante:'PREFEITURA MUNICIPAL DE PEDRO II', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'PEDRO II', estado:'PIAUÍ', data_inicio:'2025-01-17', data_fim:'2030-01-17', valor_contrato:15794230.41, faturamento_anterior:0, faturamento_2025:7400899.71, aditivo:0, saldo:15794230.41, observacao:'15794230.41',
    projecao:{ janeiro:365322.28,fevereiro:364458.44,marco:1341122.36,abril:868217.07,maio:848128.52,junho:878762.18,julho:1075454.12,agosto:1122371.37,setembro:1258883.23,outubro:1241520.25,novembro:1023939.82,dezembro:848260.39 },
    real:{ janeiro:365322.28,fevereiro:364458.28,marco:1341122.36,abril:526996.49,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'2.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'CT 059/2025 - SESAPI', contratante:'SECRETARIA DE ESTADO DA SAÚDE', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'TERESINA', estado:'PIAUÍ', data_inicio:'2025-03-31', data_fim:'2026-03-31', valor_contrato:40853038.18, faturamento_anterior:0, faturamento_2025:14323995.74, aditivo:5106629.77, saldo:31635672.21, observacao:'31635672.21',
    projecao:{ janeiro:0,fevereiro:0,marco:1500000,abril:2634601.73,maio:2577017.94,junho:3406341.69,julho:3413489.03,agosto:4382009.74,setembro:4542560.16,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:1500000,abril:3216474,maio:1139868.09,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'3.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'CT 08/2025 - SEGOV - MA (PAVCON)', contratante:'SECRETARIA DE ESTADO DE GOVERNO DO MARANHÃO', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'SÃO LUÍS', estado:'MARANHÃO', data_inicio:'2025-04-02', data_fim:'2026-04-02', valor_contrato:60929593.96, faturamento_anterior:0, faturamento_2025:27953907.75, aditivo:15104446.34, saldo:48080132.55, observacao:'48080132.55',
    projecao:{ janeiro:1365881.7,fevereiro:1188360.54,marco:5147216.83,abril:4568529.39,maio:5512306.35,junho:4886167.12,julho:8200451.94,agosto:5196531.07,setembro:5911287.54,outubro:6018522.7,novembro:0,dezembro:0 },
    real:{ janeiro:1365881.7,fevereiro:1188360.54,marco:5147216.83,abril:712282.92,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'4.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'ATA CT 026/2025 - SEDUC PIAUÍ', contratante:'SECRETARIA DE ESTADO DA EDUCAÇÃO - SEDUC - PI', objeto:'REFORMA E MANUTENÇÃO', cidade:'TERESINA', estado:'PIAUÍ', data_inicio:'2025-05-02', data_fim:'2025-12-31', valor_contrato:14980520.46, faturamento_anterior:0, faturamento_2025:6928195.89, aditivo:3745130.12, saldo:11797454.69, observacao:'11797454.69',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:1179745.47,maio:1769618.2,junho:1769618.2,julho:1769618.2,agosto:1769618.2,setembro:1769618.2,outubro:1769618.2,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'5.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 01.0605/2025 - ILHA GRANDE - PI', contratante:'MUNICIPIO DE ILHA GRANDE', objeto:'PAVIMENTAÇÃO', cidade:'ILHA GRANDE', estado:'PIAUÍ', data_inicio:'2025-05-06', data_fim:'2026-09-06', valor_contrato:905998.43, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:905998.43, observacao:'905998.43',
    projecao:{ janeiro:0,fevereiro:200734.42,marco:0,abril:705264.01,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:200734.42,marco:0,abril:0,maio:200734.42,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'6.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT - 005/2025 - IPEM MT', contratante:'IPEM/MT - INSTITUTO DE PESOS E MEDIDAS DE MATO GROSSO', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'CUIABÁ', estado:'MATO GROSSO', data_inicio:'2025-05-19', data_fim:'2026-05-19', valor_contrato:5034328.12, faturamento_anterior:0, faturamento_2025:3578931.07, aditivo:2517014.84, saldo:3972411.89, observacao:'3972411.89',
    projecao:{ janeiro:740589.12,fevereiro:357403.97,marco:599304.03,abril:629253.71,maio:755104.45,junho:566328.34,julho:566328.34,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:740589.12,fevereiro:357403.97,marco:599303.96,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'7.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'CT - 055264/2025 - FJZB - BRASÍLIA', contratante:'FUNDAÇÃO JARDIM ZOOLÓGICO DE BRASÍLIA', objeto:'REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'BRASÍLIA', estado:'DISTRITO FEDERAL', data_inicio:'2025-09-03', data_fim:'2030-09-03', valor_contrato:30697755.43, faturamento_anterior:0, faturamento_2025:2205995.24, aditivo:0, saldo:28491760.19, observacao:'28491760.19',
    projecao:{ janeiro:0,fevereiro:0,marco:379552.75,abril:1580116.55,maio:2144394.5,junho:1780316.18,julho:2074260.93,agosto:2595599.35,setembro:2042919.99,outubro:2766610.7,novembro:2757287.43,dezembro:1535888.22 },
    real:{ janeiro:0,fevereiro:0,marco:379552.75,abril:0,maio:1286868.06,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'8.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 157/2025 - PEDRO II - PI', contratante:'PEDRO II', objeto:'ESCOLA EM TEMPO INTEGRAL', cidade:'PEDRO II', estado:'PIAUÍ', data_inicio:'2025-09-16', data_fim:'2026-09-15', valor_contrato:9168861.65, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:9168861.65, observacao:'9168861.65',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:315408.84,maio:966206.91,junho:871827.04,julho:989320.17,agosto:1200203.99,setembro:1464155.12,outubro:1212123.51,novembro:1419774.67,dezembro:729841.39 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'9.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'CT 021/2025 - IGEPPS - PARÁ - PA', contratante:'IGEPPS', objeto:'REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'BELÉM', estado:'PARÁ', data_inicio:'2025-09-22', data_fim:'2026-09-22', valor_contrato:20014932.24, faturamento_anterior:0, faturamento_2025:268101.07, aditivo:0, saldo:19746831.17, observacao:'19746831.17',
    projecao:{ janeiro:0,fevereiro:1655598.37,marco:0,abril:1542233.56,maio:1458649.36,junho:1515002.27,julho:1952044.02,agosto:1648111.31,setembro:1932143.66,outubro:2391660.98,novembro:3211193.82,dezembro:1000124.26 },
    real:{ janeiro:0,fevereiro:1655598.37,marco:0,abril:2364622.2,maio:585407.43,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'10.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 089/2025 - ELESBÃO VELOSO - PI', contratante:'ELESBÃO VELOSO', objeto:'AMPLIAÇÃO DA CRECHE VOVÓ EMÍLIA', cidade:'ELESBÃO VELOSO', estado:'PIAUÍ', data_inicio:'2025-09-23', data_fim:'2026-09-23', valor_contrato:828225.81, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:828225.81, observacao:'828225.81',
    projecao:{ janeiro:0,fevereiro:0,marco:198939.79,abril:527286.02,maio:102000,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:198939.79,abril:118545.01,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'11.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 060/2025 - UESPI OEIRAS - PI', contratante:'FUESPI', objeto:'UESPI - CAMPUS PROFESSOR POSSIDÔNIO QUEIROZ', cidade:'OEIRAS', estado:'PIAUÍ', data_inicio:'2025-11-03', data_fim:'2026-11-03', valor_contrato:742892.42, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:606166.35, observacao:'606166.35',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:606166.35,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:483363.49,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'12.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'CT 2025.004260.44101.01 - SESA - VITÓRIA - ES', contratante:'SESA ES', objeto:'REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'VITÓRIA', estado:'ESPÍRITO SANTO', data_inicio:'2025-10-29', data_fim:'2027-10-29', valor_contrato:29173786.75, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:29173786.75, observacao:'29173786.75',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:1996003.7,maio:2042484.19,junho:2010734.79,julho:3147851.59,agosto:2657731.97,setembro:3115760.42,outubro:3856774.61,novembro:5178347.15,dezembro:4644466.85 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:309084.94,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'13.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 001/2025 - COOPANESTI - TERESINA - PI', contratante:'COOPANESTI', objeto:'CONSTRUÇÃO E REFORMA', cidade:'TERESINA', estado:'PIAUÍ', data_inicio:'2025-11-03', data_fim:'2027-02-03', valor_contrato:1720427.82, faturamento_anterior:0, faturamento_2025:443410.25, aditivo:0, saldo:1277017.57, observacao:'1277017.57',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:287328.95,maio:171896.09,junho:171493.94,julho:137790.2,agosto:203301.19,setembro:136385.48,outubro:168821.72,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'14.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 065/2025 - LAGOA DE SÃO FRANCISCO - PI', contratante:'LAGOA DE SÃO FRANCISCO', objeto:'ESCOLA MUNICIPAL ZILDA GONÇALVES', cidade:'LAGOA DE SÃO FRANCISCO', estado:'PIAUÍ', data_inicio:'2025-11-05', data_fim:'2026-11-05', valor_contrato:4852972.67, faturamento_anterior:0, faturamento_2025:1000205.79, aditivo:0, saldo:3852766.88, observacao:'3852766.88',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:232535.18,maio:479284.2,junho:235232.12,julho:415713.55,agosto:471963.94,setembro:411475.5,outubro:509335.78,novembro:583866.12,dezembro:513360.49 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:500221.84,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'15.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 289/2025 - SEDEC - FRANCINÓPOLIS - PI', contratante:'SEDEC', objeto:'PAVIMENTAÇÃO EM PARALELEPÍPEDO', cidade:'FRANCINÓPOLIS', estado:'PIAUÍ', data_inicio:'2025-11-17', data_fim:'2026-11-17', valor_contrato:1421678.04, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:1421678.04, observacao:'1421678.04',
    projecao:{ janeiro:0,fevereiro:710839.02,marco:0,abril:710839.02,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:710839.02,marco:0,abril:284335.63,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'16.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'CT 01100256/2025 - SEMSA - RIO BRANCO - AC', contratante:'SEMSA', objeto:'REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'RIO BRANCO', estado:'ACRE', data_inicio:'2025-11-28', data_fim:'2026-11-28', valor_contrato:14000000, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:14000000, observacao:'14000000',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:1088200,junho:1141400,julho:1510600,agosto:1518400,setembro:2176800,outubro:1850800,novembro:2485000,dezembro:2228800 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'17.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 100/2025 - CDTER - TERESINA - PI', contratante:'CDTER', objeto:'PAVIMENTAÇÃO EM PARALELEPÍPEDO', cidade:'TERESINA', estado:'PIAUÍ', data_inicio:'2025-12-03', data_fim:'2026-12-03', valor_contrato:3916896.7, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:3916896.7, observacao:'3916896.7',
    projecao:{ janeiro:0,fevereiro:0,marco:1248312.27,abril:1334292.22,maio:1334292.22,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:1248312.27,abril:0,maio:633839.85,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'18.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'CT 944/2025 - SMEC - BOA VISTA - RR', contratante:'SMEC', objeto:'REFORMA, AMPLIAÇÃO E MANUTENÇÃO DE ESCOLAS E PRÉDIOS ADM', cidade:'BOA VISTA', estado:'RORAIMA', data_inicio:'2025-12-18', data_fim:'2026-01-18', valor_contrato:14356764.08, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:14356764.08, observacao:'14356764.08',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:2347441.68,maio:2393285.82,junho:1417008.12,julho:1549094.84,agosto:1607901.21,setembro:1533302.4,outubro:1750462,novembro:1758268,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:812399.45,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'19.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'ATA CT 595/2022 - GERENCIAMENTO PIRIPIRI I', contratante:'PREFEITURA MUNICIPAL DE PIRIPIRI', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'PIRIPIRI', estado:'PIAUÍ', data_inicio:'2022-08-10', data_fim:'2026-07-18', valor_contrato:8940297.11, faturamento_anterior:0, faturamento_2025:183900, aditivo:0, saldo:8756397.11, observacao:'8756397.11',
    projecao:{ janeiro:443418.05,fevereiro:249876.99,marco:373876.99,abril:677370.71,maio:771392.92,junho:988844.15,julho:1214397.7,agosto:1078937.58,setembro:861139.3,outubro:1065942.09,novembro:1031200.62,dezembro:0 },
    real:{ janeiro:443418.05,fevereiro:249876.99,marco:373876.99,abril:437646.34,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'20.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'ATA CT 82/2024 - GERENCIAMENTO PIRIPIRI II', contratante:'PREFEITURA MUNICIPAL DE PIRIPIRI', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'PIRIPIRI', estado:'PIAUÍ', data_inicio:'2024-04-16', data_fim:'2026-04-16', valor_contrato:6500000, faturamento_anterior:0, faturamento_2025:1161490.4, aditivo:0, saldo:6500000, observacao:'6500000',
    projecao:{ janeiro:0,fevereiro:728337.69,marco:0,abril:682563,maio:615826.99,junho:793520.64,julho:671036.68,agosto:694200,setembro:796250,outubro:859300,novembro:658965,dezembro:0 },
    real:{ janeiro:0,fevereiro:728337.69,marco:0,abril:161503.12,maio:945519.76,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'21.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT - PADRE DELFINO TIMON - MA', contratante:'SINFRA', objeto:'REFORMA E AMPLIAÇÃO', cidade:'TIMON', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:4504656.68, faturamento_anterior:3814815.46, faturamento_2025:639168.06, aditivo:0, saldo:50673.16, observacao:'50673.16',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:50673.16,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'22.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT - SÃO Fº DO MARANHÃO - MA', contratante:'SINFRA', objeto:'REFORMA E AMPLIAÇÃO', cidade:'SÃO Fº DO MA', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:4166465.7, faturamento_anterior:0, faturamento_2025:2765102.88, aditivo:0, saldo:1401362.82, observacao:'1401362.82',
    projecao:{ janeiro:700681.41,fevereiro:0,marco:0,abril:700681.41,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'23.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'CT 056/2024 - JOAQUIM PIRES - PI', contratante:'PREFEITURA MUNICIPAL DE JOAQUIM PIRES', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'JOAQUIM PIRES', estado:'PIAUÍ', data_inicio:'2024-09-17', data_fim:'2026-09-17', valor_contrato:6600336.57, faturamento_anterior:633972.84, faturamento_2025:936352.54, aditivo:0, saldo:5030011.19, observacao:'5030011.19',
    projecao:{ janeiro:0,fevereiro:84000,marco:169115.6,abril:170142.78,maio:278460.43,junho:173604.99,julho:283674.61,agosto:350581.62,setembro:328234,outubro:353862.68,novembro:357916.99,dezembro:387404.98 },
    real:{ janeiro:0,fevereiro:84000,marco:169115.6,abril:56493.21,maio:511156.65,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'24.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT 012/2022 - ESTADO DE GOIÁS - IMPERATRIZ - MA', contratante:'SINFRA', objeto:'REFORMA E AMPLIAÇÃO', cidade:'IMPERATRIZ', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:1155487.7, faturamento_anterior:0, faturamento_2025:1205341.12, aditivo:0, saldo:-49853.42, observacao:'-49853.42',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'25.0', tipo_obra:'PRÓPRIA E TERC.', tipo_contrato:'POR DEMANDA', contrato:'SINFRA - MANUTENÇÃO PREDIAL', contratante:'SINFRA', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'SÃO LUÍS', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:30675037.9, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:30675037.9, observacao:'30675037.9',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:2800000,junho:3500000,julho:3500000,agosto:3500000,setembro:3500000,outubro:4500000,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:5435815.32,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'26.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'AGEMSUL - MANUTENÇÃO PREDIAL', contratante:'AGEMSUL', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'SÃO LUÍS', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:23518637.48, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:23518637.48, observacao:'23518637.48',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:1800000,junho:2500000,julho:2500000,agosto:3000000,setembro:3000000,outubro:3000000,novembro:4000000,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'27.0', tipo_obra:'PRÓPRIA', tipo_contrato:'POR DEMANDA', contrato:'AGEMLESTE - MANUTENÇÃO PREDIAL', contratante:'AGEMLESTE', objeto:'ATA - REFORMA, AMPLIAÇÃO E MANUTENÇÃO', cidade:'CAXIAS', estado:'MARANHÃO', data_inicio:'', data_fim:'', valor_contrato:9350219.98, faturamento_anterior:0, faturamento_2025:0, aditivo:0, saldo:9350219.98, observacao:'9350219.98',
    projecao:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:1500000,junho:1500000,julho:1500000,agosto:1500000,setembro:1500000,outubro:1850219.98,novembro:0,dezembro:0 },
    real:{ janeiro:0,fevereiro:0,marco:0,abril:0,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
  { item:'28.0', tipo_obra:'PRÓPRIA', tipo_contrato:'CONTRATO DE EXECUÇÃO', contrato:'CT - 223/2024 - ILUMINAÇÃO DE PEDRO II', contratante:'PEDRO II', objeto:'ILUMINAÇÃO PÚBLICA', cidade:'PEDRO II', estado:'PIAUÍ', data_inicio:'2024-12-10', data_fim:'2049-12-04', valor_contrato:47711700, faturamento_anterior:0, faturamento_2025:1089000, aditivo:0, saldo:46622700, observacao:'46622700',
    projecao:{ janeiro:96000,fevereiro:96000,marco:321000,abril:160000,maio:160000,junho:160000,julho:160000,agosto:160000,setembro:160000,outubro:160000,novembro:160000,dezembro:160000 },
    real:{ janeiro:96000,fevereiro:96000,marco:96000,abril:160000,maio:0,junho:0,julho:0,agosto:0,setembro:0,outubro:0,novembro:0,dezembro:0 } },
]

export const ESTADOS_FAT = [...new Set(faturamentoContratos.map(c => c.estado).filter(Boolean))].sort()
