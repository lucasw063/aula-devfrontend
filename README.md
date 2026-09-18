# Sala de Estudos — Biblioteca de Hogwarts

Gerenciador de tarefas acadêmicas de Lucas Wagner Araujo, desenvolvido para a disciplina Desenvolvimento Frontend — 2026.2. A interface usa a biblioteca de Hogwarts como cenário para um quadro de quatro etapas: a fazer, em andamento, em revisão e concluídas.

HTML, CSS e JavaScript nativos, sem frameworks, pacotes, fontes remotas ou imagens externas. As ilustrações de Madame Nora e da coruja são SVGs desenhados no próprio HTML; a paisagem e a chuva são desenhadas com Canvas 2D.

[Abrir a aplicação publicada na branch principal](https://lucasw063.github.io/aula-devfrontend/)

## Como usar

- Busque pelo título ou pela disciplina, combine os filtros de prioridade e etapa e ordene por prazo ou título.
- Abra os detalhes de uma ficha para ler a descrição e marcar os itens do checklist.
- Use o botão da ficha para avançar de etapa. Ao concluir, o pergaminho recebe um selo. O aviso oferece **Desfazer**.
- Abra a carta da coruja para consultar a entrega mais urgente. Prazos vencidos vêm primeiro; em datas iguais, a maior prioridade desempata. **Localizar no quadro** limpa os filtros e abre a ficha correspondente.
- Use **Lumos / Nox** para alternar a iluminação da sala e clique em **Madame Nora** para cumprimentá-la.
- Os controles de animação e relâmpagos ajustam o ambiente. A preferência de movimento reduzido do sistema também é respeitada.

As alterações de etapa e checklist duram apenas a sessão da página. **Restaurar quadro** recupera os dados carregados inicialmente. Os títulos, prazos, prioridades e etapas originais de `dados.json` foram preservados; a coruja calcula os lembretes a partir dessas datas.

## Executar localmente

A aplicação usa módulos JavaScript e `fetch` para ler `dados.json`. Sirva esta pasta por HTTP com um servidor estático. Se tiver Python 3 instalado:

```sh
python3 -m http.server 8000
```

Depois, abra [a aplicação local](http://localhost:8000). Não há etapa de build nem instalação de pacotes. Com os arquivos no computador e o servidor local ativo, a aplicação funciona sem conexão com a internet.

O duplo clique em `index.html` usa o protocolo `file://`, que pode bloquear módulos e `fetch` no navegador. A amostra em HTML único apresentada durante o desenvolvimento é uma demonstração separada.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura semântica, controles, template das fichas e ilustrações SVG |
| `styles.css` | Layout responsivo, paletas Lumos/Nox e animações CSS |
| `script.js` | Eventos, fichas, ações, coruja e cenário animado |
| `js/api.js` | Leitura de `dados.json` e tratamento dos erros de rede, HTTP e JSON |
| `js/estados.js` | Validação dos dados, filtros, ordenação e cálculo dos prazos |
| `js/renderizacao.js` | Estados de carregamento, erro, lista vazia e sucesso |
| `dados.json` | Tarefas e seus detalhes |
| `tests/` | Testes com ferramentas nativas do Node.js |

Os campos originais de cada tarefa são `id`, `titulo`, `status`, `prioridade` e `prazo` no formato `AAAA-MM-DD`. Os campos `disciplina`, `descricao` e `checklist` são opcionais. IDs repetidos, datas impossíveis e valores inválidos exibem uma mensagem de erro com opção de tentar novamente.

## Verificação

Os testes são opcionais e usam o executor nativo do Node.js 24, sem pacotes adicionais:

```sh
node --test tests/*.test.mjs
```

Cobrem preservação dos dados, busca e filtros combinados, ordenação, atualização do lembrete da coruja, prazos relativos, restauração do checklist, dados inválidos e estados de carregamento.

A renderização completa no navegador ainda precisa de conferência manual. Pontos para conferir: navegação com Tab e Escape; filtros em tela pequena; troca Lumos/Nox; conclusão e desfazer; localização pela coruja; movimento reduzido.

Estudo acadêmico inspirado no universo de Harry Potter, sem vínculo oficial com a franquia.
