// Regras do quadro, independentes do DOM e do cenário visual.
export const STAGES = ['a-fazer', 'em-andamento', 'em-revisao', 'concluida'];
export const STAGE_LABELS = {
  'a-fazer': 'A fazer', 'em-andamento': 'Em andamento',
  'em-revisao': 'Em revisão', concluida: 'Concluídas',
};
export const PRIORITIES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const ACTIONS = {
  'a-fazer': 'Iniciar tarefa', 'em-andamento': 'Enviar à revisão',
  'em-revisao': 'Concluir tarefa', concluida: 'Reabrir tarefa',
};
export const NOTES = {
  'a-fazer': 'Um começo à sua espera.', 'em-andamento': 'Trabalho em andamento.',
  'em-revisao': 'Pronta para a última revisão.', concluida: 'Tarefa concluída.',
};

export function normalizarTarefas(registros) {
  if (!Array.isArray(registros)) throw new Error('O arquivo deve conter uma lista de tarefas.');
  const ids = new Set();
  return registros.map((tarefa, indice) => {
    const id = tarefa?.id;
    const idValido = (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0)
      || (typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id));
    const data = typeof tarefa?.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tarefa.prazo)
      ? new Date(tarefa.prazo + 'T12:00:00Z') : new Date(NaN);
    const dataValida = !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === tarefa.prazo;
    if (!idValido || ids.has(String(id)) || typeof tarefa?.titulo !== 'string'
        || !tarefa.titulo.trim() || !STAGES.includes(tarefa.status)
        || !Object.hasOwn(PRIORITIES, tarefa.prioridade) || !dataValida) {
      throw new Error('A tarefa ' + (indice + 1) + ' possui campos inválidos ou um identificador repetido.');
    }
    ids.add(String(id));
    const checklist = Array.isArray(tarefa.checklist)
      ? tarefa.checklist.filter(item => typeof item === 'string' && item.trim()) : [];
    return {
      id, title: tarefa.titulo.trim(), status: tarefa.status,
      priority: tarefa.prioridade, date: tarefa.prazo,
      course: typeof tarefa.disciplina === 'string' ? tarefa.disciplina : 'Atividade acadêmica',
      description: typeof tarefa.descricao === 'string' ? tarefa.descricao : 'Sem observações adicionais.',
      checklist, checks: checklist.map(() => tarefa.status === 'concluida'),
    };
  });
}

export function cloneTasks(tasks) {
  return tasks.map(task => ({ ...task, checklist: [...task.checklist], checks: [...task.checks] }));
}

export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function selectTasks(tasks, filters) {
  const term = normalize(filters.search);
  const result = tasks.filter(task => (!term || normalize(task.title + ' ' + task.course).includes(term))
    && (!filters.priority || task.priority === filters.priority)
    && (!filters.status || task.status === filters.status));
  return result.sort((a, b) => {
    if (filters.sort === 'titulo') return a.title.localeCompare(b.title, 'pt-BR');
    const delta = a.date.localeCompare(b.date);
    return filters.sort === 'prazo-desc' ? -delta : delta;
  });
}

export function deadline(task, reference = new Date()) {
  if (task.status === 'concluida') return { label: 'Concluída', late: false };
  const [year, month, day] = task.date.split('-').map(Number);
  // Compara dias de calendário, sem a variação de horas de um fuso horário.
  const today = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const days = Math.round((Date.UTC(year, month - 1, day) - today) / 86400000);
  if (days < 0) return { label: Math.abs(days) + (days === -1 ? ' dia em atraso' : ' dias em atraso'), late: true };
  return { label: days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : 'Em ' + days + ' dias', late: false };
}

export function nextDeadline(tasks) {
  const weight = { alta: 0, media: 1, baixa: 2 };
  return tasks.filter(task => task.status !== 'concluida').sort((a, b) =>
    a.date.localeCompare(b.date) || weight[a.priority] - weight[b.priority]
      || String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true })
  )[0] || null;
}
