import { carregarTarefas } from './js/api.js';
import { renderizarEstado } from './js/estados.js';

async function iniciar() {
  renderizarEstado('carregando');

  try {
    const tarefas = await carregarTarefas();

    if (tarefas.length === 0) {
      renderizarEstado('vazio');
      return;
    }

    renderizarEstado('sucesso', tarefas);
  } catch (erro) {
    const tipo = erro.name === 'TypeError'
      ? 'rede'
      : erro.name === 'SyntaxError'
        ? 'formato'
        : 'protocolo';

    renderizarEstado('erro', { tipo });
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
