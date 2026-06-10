// ============================================================
//  PAVCON – Gestão de Obras  |  app.js
// ============================================================

// ---------- DADOS MOCKADOS ----------

const obras = [
  {
    id: 1, nome: 'Pavimentação Av. Brasil', local: 'Zona Norte – SP',
    responsavel: 'Eng. Carlos Silva', inicio: '10/01/2025', previsao: '30/06/2025',
    orcamento: 'R$ 850.000', gasto: 'R$ 520.000', progresso: 62,
    status: 'andamento', equipe: 8
  },
  {
    id: 2, nome: 'Recapeamento Rua das Flores', local: 'Centro – SP',
    responsavel: 'Eng. Ana Costa', inicio: '05/02/2025', previsao: '20/04/2025',
    orcamento: 'R$ 320.000', gasto: 'R$ 320.000', progresso: 100,
    status: 'concluida', equipe: 5
  },
  {
    id: 3, nome: 'Calçada Acessível Pça. da Paz', local: 'Vila Madalena – SP',
    responsavel: 'Eng. Roberto Nunes', inicio: '15/03/2025', previsao: '15/05/2025',
    orcamento: 'R$ 180.000', gasto: 'R$ 195.000', progresso: 75,
    status: 'atrasada', equipe: 4
  },
  {
    id: 4, nome: 'Drenagem Pluvial – Bairro Novo', local: 'Zona Sul – SP',
    responsavel: 'Eng. Paula Mendes', inicio: '01/04/2025', previsao: '31/08/2025',
    orcamento: 'R$ 1.200.000', gasto: 'R$ 380.000', progresso: 30,
    status: 'andamento', equipe: 12
  },
  {
    id: 5, nome: 'Bloquetes – Mercado Municipal', local: 'Lapa – SP',
    responsavel: 'Eng. Carlos Silva', inicio: '20/02/2025', previsao: '20/05/2025',
    orcamento: 'R$ 560.000', gasto: 'R$ 280.000', progresso: 50,
    status: 'andamento', equipe: 7
  },
  {
    id: 6, nome: 'Sinalização Horizontal – Via Expressa', local: 'Marginal Tietê – SP',
    responsavel: 'Eng. Ana Costa', inicio: '10/11/2024', previsao: '10/01/2025',
    orcamento: 'R$ 95.000', gasto: 'R$ 95.000', progresso: 100,
    status: 'concluida', equipe: 3
  },
  {
    id: 7, nome: 'Terraplanagem – Loteamento Sol', local: 'Cajamar – SP',
    responsavel: 'Eng. João Alves', inicio: '01/05/2025', previsao: '30/09/2025',
    orcamento: 'R$ 720.000', gasto: 'R$ 90.000', progresso: 12,
    status: 'pausada', equipe: 6
  },
  {
    id: 8, nome: 'Micro-revestimento – Rua Palmeiras', local: 'Santana – SP',
    responsavel: 'Eng. Roberto Nunes', inicio: '05/03/2025', previsao: '30/04/2025',
    orcamento: 'R$ 240.000', gasto: 'R$ 261.000', progresso: 88,
    status: 'atrasada', equipe: 5
  },
];

const equipe = [
  { nome: 'Carlos Silva',   cargo: 'Engenheiro Civil',      obra: 'Av. Brasil',          salario: 'R$ 12.500', cor: '#2563eb' },
  { nome: 'Ana Costa',      cargo: 'Engenheira Civil',      obra: 'Recapeamento Flores',  salario: 'R$ 11.800', cor: '#7c3aed' },
  { nome: 'Roberto Nunes',  cargo: 'Mestre de Obras',       obra: 'Pça. da Paz',          salario: 'R$ 7.200',  cor: '#16a34a' },
  { nome: 'Paula Mendes',   cargo: 'Engenheira Hidráulica', obra: 'Drenagem Bairro Novo', salario: 'R$ 13.000', cor: '#ea580c' },
  { nome: 'João Alves',     cargo: 'Topógrafo',             obra: 'Loteamento Sol',       salario: 'R$ 6.500',  cor: '#0891b2' },
  { nome: 'Marcos Lima',    cargo: 'Operador de Máquinas',  obra: 'Av. Brasil',           salario: 'R$ 4.800',  cor: '#d97706' },
  { nome: 'Fernanda Reis',  cargo: 'Técnica em Edificações',obra: 'Micro-revestimento',   salario: 'R$ 5.200',  cor: '#db2777' },
  { nome: 'Diego Oliveira', cargo: 'Pedreiro',              obra: 'Bloquetes Mercado',    salario: 'R$ 3.800',  cor: '#059669' },
];

const materiais = [
  { nome: 'Asfalto CBUQ',      categoria: 'Betuminoso', estoque: 850,  unidade: 'ton',  valorUnit: 'R$ 420,00',  valorTotal: 'R$ 357.000', status: 'ok' },
  { nome: 'Brita Graduada',    categoria: 'Agregados',  estoque: 1200, unidade: 'm³',   valorUnit: 'R$ 85,00',   valorTotal: 'R$ 102.000', status: 'ok' },
  { nome: 'Areia Lavada',      categoria: 'Agregados',  estoque: 180,  unidade: 'm³',   valorUnit: 'R$ 62,00',   valorTotal: 'R$ 11.160',  status: 'baixo' },
  { nome: 'Cimento CP-II',     categoria: 'Ligante',    estoque: 2400, unidade: 'sc',   valorUnit: 'R$ 38,50',   valorTotal: 'R$ 92.400',  status: 'ok' },
  { nome: 'Bloquete Sextavado',categoria: 'Concreto',   estoque: 12500,unidade: 'un',   valorUnit: 'R$ 4,20',    valorTotal: 'R$ 52.500',  status: 'ok' },
  { nome: 'Cal Hidratada',     categoria: 'Ligante',    estoque: 40,   unidade: 'sc',   valorUnit: 'R$ 22,00',   valorTotal: 'R$ 880',     status: 'critico' },
  { nome: 'Tubo PEAD Ø600',    categoria: 'Tubulação',  estoque: 320,  unidade: 'ml',   valorUnit: 'R$ 185,00',  valorTotal: 'R$ 59.200',  status: 'ok' },
  { nome: 'Tinta Termoplástica',categoria:'Sinalização', estoque: 280,  unidade: 'kg',   valorUnit: 'R$ 48,00',   valorTotal: 'R$ 13.440',  status: 'ok' },
];

const lancamentos = [
  { data: '28/05/2025', desc: 'Fornecimento Asfalto CBUQ', obra: 'Av. Brasil',        tipo: 'despesa',  valor: 'R$ 84.000', status: 'pago' },
  { data: '27/05/2025', desc: 'Medição #3 – Cliente',      obra: 'Av. Brasil',        tipo: 'receita',  valor: 'R$ 210.000',status: 'recebido' },
  { data: '26/05/2025', desc: 'Folha de Pagamento',        obra: 'Geral',             tipo: 'despesa',  valor: 'R$ 128.500',status: 'pago' },
  { data: '25/05/2025', desc: 'Aluguel Rolo Compactador',  obra: 'Bloquetes Mercado', tipo: 'despesa',  valor: 'R$ 9.800',  status: 'pago' },
  { data: '24/05/2025', desc: 'Medição #2 – Drenagem',     obra: 'Drenagem Bairro Novo',tipo: 'receita',valor: 'R$ 180.000',status: 'recebido' },
  { data: '22/05/2025', desc: 'Compra Bloquetes',          obra: 'Bloquetes Mercado', tipo: 'despesa',  valor: 'R$ 52.500', status: 'pendente' },
  { data: '20/05/2025', desc: 'Fornecimento Tubos PEAD',   obra: 'Drenagem Bairro Novo',tipo: 'despesa',valor: 'R$ 59.200', status: 'pago' },
];

// ---------- NAVEGAÇÃO ----------

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });
  const titles = {
    dashboard: 'Dashboard',
    obras: 'Obras',
    equipes: 'Equipes',
    materiais: 'Materiais',
    financeiro: 'Financeiro',
    relatorios: 'Relatórios',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ---------- SIDEBAR TOGGLE ----------

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('expanded');
}

// ---------- MODAL ----------

function openModal(id) {
  document.getElementById(`modal-${id}`).classList.add('open');
}
function closeModal(id) {
  document.getElementById(`modal-${id}`).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ---------- TOAST ----------

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function salvarObra() {
  closeModal('nova-obra');
  showToast('✅ Obra salva com sucesso!');
}

// ---------- RENDER: OBRAS RECENTES (Dashboard) ----------

function renderObrasRecentes() {
  const tbody = document.getElementById('obras-recentes-tbody');
  tbody.innerHTML = obras.slice(0, 5).map(o => `
    <tr>
      <td><strong>${o.nome}</strong></td>
      <td>${o.responsavel.replace('Eng. ', '')}</td>
      <td>${o.inicio}</td>
      <td>${o.previsao}</td>
      <td>${o.orcamento}</td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${o.progresso}%;background:${progressColor(o.status)}"></div>
          </div>
          <span class="progress-label">${o.progresso}%</span>
        </div>
      </td>
      <td><span class="badge-status ${o.status}">${statusLabel(o.status)}</span></td>
    </tr>
  `).join('');
}

// ---------- RENDER: OBRAS GRID ----------

function renderObrasGrid(lista) {
  const grid = document.getElementById('obras-grid');
  grid.innerHTML = (lista || obras).map(o => `
    <div class="obra-card ${o.status}">
      <div class="obra-card-top"></div>
      <div class="obra-card-body">
        <div class="obra-card-header">
          <div>
            <div class="obra-card-title">${o.nome}</div>
            <div class="obra-card-loc"><i class="fas fa-location-dot"></i>${o.local}</div>
          </div>
          <span class="badge-status ${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="obra-meta">
          <div class="obra-meta-item">
            <div class="obra-meta-label">Orçamento</div>
            <div class="obra-meta-value">${o.orcamento}</div>
          </div>
          <div class="obra-meta-item">
            <div class="obra-meta-label">Gasto</div>
            <div class="obra-meta-value">${o.gasto}</div>
          </div>
          <div class="obra-meta-item">
            <div class="obra-meta-label">Início</div>
            <div class="obra-meta-value">${o.inicio}</div>
          </div>
          <div class="obra-meta-item">
            <div class="obra-meta-label">Previsão</div>
            <div class="obra-meta-value">${o.previsao}</div>
          </div>
        </div>
        <div class="obra-progress-label">
          <span>Progresso</span><span>${o.progresso}%</span>
        </div>
        <div class="obra-progress-bar">
          <div class="obra-progress-fill" style="width:${o.progresso}%;background:${progressColor(o.status)}"></div>
        </div>
      </div>
      <div class="obra-card-footer">
        <div class="obra-resp">
          <div class="resp-avatar">${o.responsavel.split(' ').pop()[0]}</div>
          ${o.responsavel}
        </div>
        <span style="font-size:11px;color:#64748b"><i class="fas fa-users"></i> ${o.equipe} pessoas</span>
      </div>
    </div>
  `).join('');
}

function filtrarObras() {
  const q      = document.getElementById('search-obras').value.toLowerCase();
  const status = document.getElementById('filtro-status').value;
  const filtradas = obras.filter(o => {
    const matchQ = o.nome.toLowerCase().includes(q) || o.local.toLowerCase().includes(q);
    const matchS = !status || o.status === status;
    return matchQ && matchS;
  });
  renderObrasGrid(filtradas);
}

// ---------- RENDER: EQUIPES ----------

function renderEquipes() {
  const grid = document.getElementById('equipes-grid');
  grid.innerHTML = equipe.map(c => `
    <div class="colaborador-card">
      <div class="colab-avatar" style="background:${c.cor}">${c.nome.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
      <div class="colab-name">${c.nome}</div>
      <div class="colab-role">${c.cargo}</div>
      <div class="colab-obra"><i class="fas fa-hard-hat"></i> ${c.obra}</div>
      <div class="colab-salary">${c.salario}<span style="font-size:10px;color:#64748b;font-weight:400">/mês</span></div>
    </div>
  `).join('');
}

// ---------- RENDER: MATERIAIS ----------

function renderMateriais() {
  const tbody = document.getElementById('materiais-tbody');
  tbody.innerHTML = materiais.map(m => `
    <tr>
      <td><strong>${m.nome}</strong></td>
      <td>${m.categoria}</td>
      <td>${m.estoque.toLocaleString('pt-BR')}</td>
      <td>${m.unidade}</td>
      <td>${m.valorUnit}</td>
      <td>${m.valorTotal}</td>
      <td>${badgeMaterial(m.status)}</td>
    </tr>
  `).join('');
}

function badgeMaterial(s) {
  const map = {
    ok:      ['#dcfce7','#16a34a','Estoque OK'],
    baixo:   ['#ffedd5','#ea580c','Estoque Baixo'],
    critico: ['#fee2e2','#dc2626','Crítico'],
  };
  const [bg, color, label] = map[s] || map.ok;
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${label}</span>`;
}

// ---------- RENDER: FINANCEIRO ----------

function renderFinanceiro() {
  const tbody = document.getElementById('financeiro-tbody');
  tbody.innerHTML = lancamentos.map(l => `
    <tr>
      <td>${l.data}</td>
      <td>${l.desc}</td>
      <td>${l.obra}</td>
      <td>
        <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;
          background:${l.tipo==='receita'?'#dcfce7':'#fee2e2'};
          color:${l.tipo==='receita'?'#16a34a':'#dc2626'}">
          ${l.tipo === 'receita' ? '▲ Receita' : '▼ Despesa'}
        </span>
      </td>
      <td style="font-weight:600;color:${l.tipo==='receita'?'#16a34a':'#dc2626'}">${l.valor}</td>
      <td>${badgePagamento(l.status)}</td>
    </tr>
  `).join('');
}

function badgePagamento(s) {
  const map = {
    pago:      ['#dcfce7','#16a34a','Pago'],
    recebido:  ['#dbeafe','#2563eb','Recebido'],
    pendente:  ['#ffedd5','#ea580c','Pendente'],
  };
  const [bg, color, label] = map[s] || map.pendente;
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${label}</span>`;
}

// ---------- HELPERS ----------

function statusLabel(s) {
  return { andamento: 'Em Andamento', concluida: 'Concluída', atrasada: 'Atrasada', pausada: 'Pausada' }[s] || s;
}
function progressColor(s) {
  return { andamento: '#2563eb', concluida: '#16a34a', atrasada: '#ea580c', pausada: '#94a3b8' }[s] || '#2563eb';
}

// ---------- CHARTS ----------

function initCharts() {
  // Financeiro (Line)
  const ctxF = document.getElementById('chartFinanceiro').getContext('2d');
  new Chart(ctxF, {
    type: 'bar',
    data: {
      labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
      datasets: [
        {
          label: 'Receita',
          data: [320,410,390,520,480,610,0,0,0,0,0,0],
          backgroundColor: 'rgba(37,99,235,.15)',
          borderColor: '#2563eb',
          borderWidth: 2,
          borderRadius: 6,
          type: 'bar',
        },
        {
          label: 'Custo',
          data: [280,350,340,460,420,520,0,0,0,0,0,0],
          backgroundColor: 'rgba(234,88,12,.1)',
          borderColor: '#ea580c',
          borderWidth: 2,
          borderRadius: 6,
          type: 'bar',
        },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => 'R$'+v+'k' } } }
    }
  });

  // Status (Doughnut)
  const ctxS = document.getElementById('chartStatus').getContext('2d');
  const counts = [0,0,0,0];
  obras.forEach(o => {
    if (o.status === 'andamento') counts[0]++;
    else if (o.status === 'concluida') counts[1]++;
    else if (o.status === 'atrasada') counts[2]++;
    else counts[3]++;
  });
  new Chart(ctxS, {
    type: 'doughnut',
    data: {
      labels: ['Em Andamento','Concluída','Atrasada','Pausada'],
      datasets: [{
        data: counts,
        backgroundColor: ['#2563eb','#16a34a','#ea580c','#94a3b8'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: { legend: { display: false } }
    }
  });
}

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', () => {
  renderObrasRecentes();
  renderObrasGrid();
  renderEquipes();
  renderMateriais();
  renderFinanceiro();
  initCharts();
});
