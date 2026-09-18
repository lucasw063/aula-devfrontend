// Os estados de carregamento usam elementos existentes, sem inserir HTML dos dados.
export function renderizarEstado(estado, tarefas) {
  const $ = selector => document.querySelector(selector);
  const pronto = estado.tipo === 'sucesso' && tarefas.length > 0;
  const vazio = estado.tipo === 'sucesso' && tarefas.length === 0;
  const carregando = estado.tipo === 'carregando';

  $('#board').hidden = !pronto;
  $('#board').setAttribute('aria-busy', String(carregando));
  $('#load-state').hidden = pronto;
  $('#no-results').hidden = true;
  $('#reset-board').disabled = !pronto;
  document.querySelectorAll('#filters input, #filters select, #filters button, [data-status-filter]')
    .forEach(controle => { controle.disabled = !pronto; });

  if (pronto) return true;

  const titulo = carregando ? 'Carregando tarefas…'
    : vazio ? 'O arquivo está vazio.' : 'Não foi possível carregar as tarefas.';
  const mensagem = carregando ? 'Buscando os pergaminhos do arquivo.'
    : vazio ? 'Nenhuma tarefa cadastrada no momento.' : estado.mensagem;

  $('#load-title').textContent = titulo;
  $('#load-message').textContent = mensagem;
  $('#results').textContent = titulo;
  $('#load-retry').hidden = carregando;
  $('#load-retry').textContent = vazio ? 'Recarregar tarefas' : 'Tentar novamente';
  return false;
}
