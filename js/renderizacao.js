const statusLegenda = {
  'a-fazer': 'A fazer',
  'em-andamento': 'Em andamento',
  'em-revisao': 'Em revisão',
  'concluida': 'Concluída',
};

const prioridadeLegenda = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

function formatarPrazo(prazo) {
  const data = new Date(`${prazo}T00:00:00`);

  if (Number.isNaN(data.getTime())) {
    return prazo;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);
}

function criarCartao(tarefa) {
  return `
    <li>
      <article class="cartao cartao--${tarefa.status}">
        <h4>${tarefa.titulo}</h4>
        <p><strong>Prioridade:</strong> ${prioridadeLegenda[tarefa.prioridade] || tarefa.prioridade}</p>
        <p><strong>Prazo:</strong> <time datetime="${tarefa.prazo}">${formatarPrazo(tarefa.prazo)}</time></p>
        <p class="cartao__status">${statusLegenda[tarefa.status] || tarefa.status}</p>
      </article>
    </li>
  `;
}

export function renderizarTarefas(tarefas) {
  const quadro = document.querySelector('#quadro-tarefas');

  if (!quadro) {
    return;
  }

  const grupos = {
    'a-fazer': [],
    'em-andamento': [],
    'em-revisao': [],
    concluida: [],
  };

  tarefas.forEach((tarefa) => {
    if (grupos[tarefa.status]) {
      grupos[tarefa.status].push(tarefa);
    }
  });

  quadro.innerHTML = Object.entries(statusLegenda)
    .map(([status, titulo]) => {
      const tarefasDoStatus = grupos[status] ?? [];
      const itens = tarefasDoStatus.map(criarCartao).join('');

      return `
        <section class="coluna coluna--${status}" aria-labelledby="coluna-${status}">
          <h3 id="coluna-${status}">${titulo}</h3>
          <ul>${itens || '<li class="vazio">Nenhuma tarefa neste status.</li>'}</ul>
        </section>
      `;
    })
    .join('');
}
