import { carregarTarefas } from './js/api.js';
import { renderizarTarefas } from './js/renderizacao.js';

const estado = {
  tarefas: [],
  busca: '',
  status: '',
  prioridade: '',
  ordenacao: 'prazo-asc',
  carregamento: 'carregando',
  erro: null,
};

function selecionarTarefas(estadoAtual) {
  const termo = estadoAtual.busca.trim().toLowerCase();
  const visiveis = estadoAtual.tarefas
    .filter((tarefa) => tarefa.titulo.toLowerCase().includes(termo))
    .filter((tarefa) => !estadoAtual.status || tarefa.status === estadoAtual.status)
    .filter((tarefa) => !estadoAtual.prioridade || tarefa.prioridade === estadoAtual.prioridade);

  return visiveis.sort((a, b) => {
    const comparacao = a.prazo.localeCompare(b.prazo);
    return estadoAtual.ordenacao === 'prazo-desc' ? -comparacao : comparacao;
  });
}

function mostrarMensagem(estadoAtual, visiveis) {
  const statusElemento = document.querySelector('#status');
  const quadro = document.querySelector('#quadro-tarefas');

  if (estadoAtual.carregamento === 'carregando') {
    statusElemento.textContent = 'Carregando tarefas...';
    quadro.innerHTML = '<div class="estado estado--carregando">Carregando tarefas...</div>';
    return;
  }

  if (estadoAtual.carregamento === 'erro') {
    statusElemento.textContent = estadoAtual.erro;
    quadro.innerHTML = `<div class="estado estado--erro"><h3>Não foi possível carregar as tarefas</h3><p>${estadoAtual.erro}</p></div>`;
    return;
  }

  if (estadoAtual.tarefas.length === 0) {
    statusElemento.textContent = 'Nenhuma tarefa cadastrada no momento.';
    quadro.innerHTML = '<div class="estado estado--vazio">Nenhuma tarefa cadastrada no momento.</div>';
    return;
  }

  if (visiveis.length === 0) {
    statusElemento.textContent = `0 de ${estadoAtual.tarefas.length} tarefas. Altere ou limpe os critérios.`;
    return;
  }

  statusElemento.textContent = `${visiveis.length} de ${estadoAtual.tarefas.length} tarefas.`;
}

function renderizarAplicacao() {
  const visiveis = selecionarTarefas(estado);
  mostrarMensagem(estado, visiveis);

  if (estado.carregamento === 'sucesso' && visiveis.length > 0) {
    renderizarTarefas(visiveis);
  } else if (estado.carregamento === 'sucesso') {
    document.querySelector('#quadro-tarefas').innerHTML = '<div class="estado estado--vazio">Nenhuma tarefa corresponde aos critérios. Altere ou limpe os filtros.</div>';
  }
}

function sincronizarControles() {
  document.querySelector('#busca-titulo').value = estado.busca;
  document.querySelector('#ordenacao').value = estado.ordenacao;
  document.querySelector(`input[name="status"][value="${estado.status}"]`).checked = true;
  document.querySelector(`input[name="prioridade-filtro"][value="${estado.prioridade}"]`).checked = true;
}

function registrarEventos() {
  document.querySelector('#busca-titulo').addEventListener('input', (evento) => {
    estado.busca = evento.currentTarget.value;
    renderizarAplicacao();
  });

  document.querySelectorAll('input[name="status"]').forEach((controle) => {
    controle.addEventListener('change', (evento) => {
      estado.status = evento.currentTarget.value;
      renderizarAplicacao();
    });
  });

  document.querySelectorAll('input[name="prioridade-filtro"]').forEach((controle) => {
    controle.addEventListener('change', (evento) => {
      estado.prioridade = evento.currentTarget.value;
      renderizarAplicacao();
    });
  });

  document.querySelector('#ordenacao').addEventListener('change', (evento) => {
    estado.ordenacao = evento.currentTarget.value;
    renderizarAplicacao();
  });

  document.querySelector('#limpar-filtros').addEventListener('click', () => {
    estado.busca = '';
    estado.status = '';
    estado.prioridade = '';
    estado.ordenacao = 'prazo-asc';
    sincronizarControles();
    renderizarAplicacao();
  });
}

async function iniciar() {
  renderizarAplicacao();

  try {
    const tarefas = await carregarTarefas();
    estado.tarefas = tarefas;
    estado.carregamento = 'sucesso';
  } catch (erro) {
    estado.carregamento = 'erro';
    estado.erro = erro.message;
  }

  renderizarAplicacao();
}

document.addEventListener('DOMContentLoaded', () => {
  registrarEventos();
  iniciar();
});
