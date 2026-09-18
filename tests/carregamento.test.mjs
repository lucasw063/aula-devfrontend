import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarTarefas } from '../js/api.js';
import { renderizarEstado } from '../js/renderizacao.js';

test('fetch preserva a lista, incluindo um arquivo vazio', async t => {
  const tarefas = [{ id: 1, titulo: 'Tarefa' }];
  t.mock.method(globalThis, 'fetch', async caminho => {
    assert.equal(caminho, './dados.json');
    return { ok: true, json: async () => ({ tarefas }) };
  });
  assert.deepEqual(await carregarTarefas(), tarefas);
  tarefas.splice(0);
  assert.deepEqual(await carregarTarefas(), []);
});

test('fetch distingue erro HTTP, falha de rede e JSON inválido', async t => {
  const respostas = [
    async () => ({ ok: false, status: 503 }),
    async () => { throw new TypeError('offline'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('JSON'); } }),
    async () => ({ ok: true, json: async () => ({ outroCampo: [] }) }),
  ];
  t.mock.method(globalThis, 'fetch', async () => respostas.shift()());
  await assert.rejects(carregarTarefas(), /503/);
  await assert.rejects(carregarTarefas(), /conexão/);
  await assert.rejects(carregarTarefas(), /formato inválido/);
  await assert.rejects(carregarTarefas(), /Formato de dados inválido/);
});

test('carregamento, erro, vazio e sucesso exibem os controles correspondentes', t => {
  const elementos = new Map();
  const controles = [{ disabled: false }, { disabled: false }];
  const $ = selector => {
    if (!elementos.has(selector)) elementos.set(selector, {
      hidden: false, disabled: false, textContent: '', attributes: {},
      setAttribute(nome, valor) { this.attributes[nome] = valor; },
    });
    return elementos.get(selector);
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    querySelector: $, querySelectorAll: () => controles,
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);

  assert.equal(renderizarEstado({ tipo: 'carregando' }, []), false);
  assert.equal($('#board').hidden, true);
  assert.equal($('#load-retry').hidden, true);
  assert.equal($('#board').attributes['aria-busy'], 'true');
  assert.ok(controles.every(c => c.disabled));

  renderizarEstado({ tipo: 'erro', mensagem: 'Falha de rede' }, []);
  assert.equal($('#load-message').textContent, 'Falha de rede');
  assert.equal($('#load-retry').hidden, false);
  assert.equal($('#board').attributes['aria-busy'], 'false');

  renderizarEstado({ tipo: 'sucesso' }, []);
  assert.match($('#load-message').textContent, /Nenhuma tarefa cadastrada/);
  assert.equal($('#no-results').hidden, true);

  assert.equal(renderizarEstado({ tipo: 'sucesso' }, [{ id: 1 }]), true);
  assert.equal($('#load-state').hidden, true);
  assert.equal($('#board').hidden, false);
  assert.ok(controles.every(c => !c.disabled));
});
