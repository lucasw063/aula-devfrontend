import { renderizarTarefas } from './renderizacao.js';

const MENSAGENS = {
  carregando: 'Carregando tarefas...',
  vazio: 'Nenhuma tarefa cadastrada no momento.',
  rede: 'Não foi possível carregar as tarefas. Verifique sua conexão com a internet e tente novamente.',
  protocolo: 'Não foi possível carregar as tarefas. O servidor respondeu com erro.',
  formato: 'Os dados recebidos estão em um formato inválido.',
};

export function renderizarEstado(estado, dados = []) {
  const statusElemento = document.querySelector('[role="status"]');
  const quadro = document.querySelector('#quadro-tarefas');

  if (!statusElemento || !quadro) {
    return;
  }

  switch (estado) {
    case 'carregando':
      statusElemento.textContent = MENSAGENS.carregando;
      quadro.innerHTML = '<div class="estado estado--carregando">Carregando tarefas...</div>';
      break;

    case 'vazio':
      statusElemento.textContent = MENSAGENS.vazio;
      quadro.innerHTML = '<div class="estado estado--vazio">Nenhuma tarefa cadastrada no momento.</div>';
      break;

    case 'erro': {
      const tipo = dados?.tipo || 'protocolo';
      const mensagem = MENSAGENS[tipo] || MENSAGENS.protocolo;

      statusElemento.textContent = mensagem;
      quadro.innerHTML = `
        <div class="estado estado--erro">
          <h3>Não foi possível carregar as tarefas</h3>
          <p>${mensagem}</p>
        </div>
      `;
      break;
    }

    case 'sucesso':
    default:
      statusElemento.textContent = `${dados.length} tarefa${dados.length === 1 ? '' : 's'} carregada${dados.length === 1 ? '' : 's'} com sucesso.`;
      renderizarTarefas(dados);
      break;
  }
}
