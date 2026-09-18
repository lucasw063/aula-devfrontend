import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizarTarefas, cloneTasks, selectTasks, deadline, nextDeadline } from '../js/estados.js';

const dados = JSON.parse(await readFile(new URL('../dados.json', import.meta.url), 'utf8')).tarefas;
const filtros = { search: '', status: '', priority: '', sort: 'prazo-asc' };

test('a adaptação mantém os identificadores, títulos, prazos e etapas do arquivo', () => {
  const original = JSON.stringify(dados);
  const tarefas = normalizarTarefas(dados);
  assert.equal(tarefas.length, dados.length);
  tarefas.forEach((tarefa, i) => {
    assert.equal(tarefa.id, dados[i].id);
    assert.equal(tarefa.title, dados[i].titulo);
    assert.equal(tarefa.date, dados[i].prazo);
    assert.equal(tarefa.status, dados[i].status);
    assert.equal(tarefa.priority, dados[i].prioridade);
  });
  assert.equal(JSON.stringify(dados), original);
});

test('dados legados funcionam sem disciplina, descrição ou checklist', () => {
  const [tarefa] = normalizarTarefas([{ id: 1, titulo: 'Relatório', prazo: '2026-09-20', status: 'a-fazer', prioridade: 'alta' }]);
  assert.equal(tarefa.course, 'Atividade acadêmica');
  assert.deepEqual(tarefa.checklist, []);
  assert.deepEqual(normalizarTarefas([]), []);
});

test('busca sem acentos combina disciplina, etapa e prioridade sem modificar a lista', () => {
  const tarefas = normalizarTarefas(dados);
  const ordem = tarefas.map(t => t.id);
  assert.equal(selectTasks(tarefas, { ...filtros, search: 'REFERENCIAS' })[0].id, 2);
  assert.equal(selectTasks(tarefas, { ...filtros, search: 'frontend', status: 'em-revisao', priority: 'alta' })[0].id, 6);
  assert.deepEqual(selectTasks(tarefas, { ...filtros, search: 'inexistente' }), []);
  const crescente = selectTasks(tarefas, filtros).map(t => t.date);
  const decrescente = selectTasks(tarefas, { ...filtros, sort: 'prazo-desc' }).map(t => t.date);
  assert.deepEqual(crescente, [...decrescente].reverse());
  assert.deepEqual(tarefas.map(t => t.id), ordem);
});

test('a coruja ignora concluídas e atualiza o lembrete ao concluir ou reabrir', () => {
  const tarefas = normalizarTarefas(dados);
  assert.equal(nextDeadline(tarefas).id, 6);
  tarefas.find(t => t.id === 6).status = 'concluida';
  assert.equal(nextDeadline(tarefas).id, 5);
  tarefas.forEach(t => { t.status = 'concluida'; });
  assert.equal(nextDeadline(tarefas), null);
  tarefas.find(t => t.id === 3).status = 'em-andamento';
  assert.equal(nextDeadline(tarefas).id, 3);
  assert.equal(nextDeadline([]), null);
});

test('a coruja desempata prazos pela prioridade e mantém uma ordem estável', () => {
  const tarefas = [
    { id: 3, date: '2026-09-20', status: 'a-fazer', priority: 'baixa' },
    { id: 2, date: '2026-09-20', status: 'a-fazer', priority: 'alta' },
    { id: 1, date: '2026-09-20', status: 'em-revisao', priority: 'alta' },
  ];
  assert.equal(nextDeadline(tarefas).id, 1);
  assert.deepEqual(tarefas.map(t => t.id), [3, 2, 1]);
});

test('prazos relativos consideram o dia local, inclusive virada de mês', () => {
  const agora = new Date(2026, 8, 30, 23, 59);
  assert.deepEqual(deadline({ date: '2026-09-30', status: 'a-fazer' }, agora), { label: 'Hoje', late: false });
  assert.equal(deadline({ date: '2026-10-01', status: 'a-fazer' }, agora).label, 'Amanhã');
  assert.equal(deadline({ date: '2026-09-29', status: 'a-fazer' }, agora).label, '1 dia em atraso');
  assert.deepEqual(deadline({ date: '2026-09-01', status: 'concluida' }, agora), { label: 'Concluída', late: false });
});

test('restaurar o quadro recupera também os itens do checklist', () => {
  const inicial = normalizarTarefas(dados);
  const copia = cloneTasks(inicial);
  copia[0].status = 'concluida';
  copia[0].checks[0] = true;
  copia[0].checklist[0] = 'Alterado';
  assert.equal(inicial[0].status, 'a-fazer');
  assert.equal(inicial[0].checks[0], false);
  assert.notEqual(inicial[0].checklist[0], 'Alterado');
  assert.deepEqual(cloneTasks(inicial), normalizarTarefas(dados));
});

test('um arquivo inválido mostra erro em vez de quebrar a renderização', () => {
  for (const patch of [{ prazo: '2026-02-30' }, { status: 'desconhecido' }, { prioridade: 'urgente' }, { titulo: '' }, { id: 'id com espaço' }]) {
    assert.throws(() => normalizarTarefas([{ ...dados[0], ...patch }]), /campos inválidos/);
  }
  assert.throws(() => normalizarTarefas([dados[0], { ...dados[1], id: String(dados[0].id) }]), /identificador repetido/);
  assert.throws(() => normalizarTarefas([null]), /campos inválidos/);
  assert.throws(() => normalizarTarefas({ tarefas: [] }), /lista de tarefas/);
});
