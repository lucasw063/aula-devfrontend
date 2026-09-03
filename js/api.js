export async function carregarTarefas() {
  try {
    const resposta = await fetch('./dados.json');

    if (!resposta.ok) {
      const erro = new Error(`Falha ao carregar tarefas: ${resposta.status}`);
      erro.name = 'ErroProtocolo';
      erro.status = resposta.status;
      throw erro;
    }

    const dados = await resposta.json();

    if (!dados || !Array.isArray(dados.tarefas)) {
      const erro = new Error('Formato de dados inválido.');
      erro.name = 'SyntaxError';
      throw erro;
    }

    return dados.tarefas;
  } catch (erro) {
    if (erro instanceof TypeError) {
      const erroRede = new Error('Não foi possível acessar o servidor. Verifique sua conexão.');
      erroRede.name = 'TypeError';
      throw erroRede;
    }

    if (erro instanceof SyntaxError) {
      const erroFormato = new Error('O arquivo de dados está em um formato inválido.');
      erroFormato.name = 'SyntaxError';
      throw erroFormato;
    }

    throw erro;
  }
}
