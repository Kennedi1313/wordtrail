# Wordtrail — Plano de evolução

Este documento registra a visão do produto e a ordem sugerida de implementação.

## Visão do produto

O Wordtrail será um companheiro de leitura multilíngue. A pessoa poderá ler em português, inglês ou espanhol, consultar palavras durante a leitura, construir um vocabulário separado para cada idioma e praticar essas palavras com jogos. No futuro, também poderá participar de clubes de leitura.

## 1. Leitura multilíngue

Antes de iniciar uma sessão, a pessoa escolhe apenas o idioma do livro:

- Português
- Inglês
- Espanhol

A escolha do idioma define automaticamente o comportamento da leitura.

### Inglês

- Mostrar tradução para português.
- Mostrar definição do dicionário em inglês.
- Salvar a palavra no vocabulário inglês.

### Espanhol

- Mostrar tradução para português.
- Mostrar definição do dicionário em espanhol.
- Salvar a palavra no vocabulário espanhol.

### Português

- Mostrar somente definição do dicionário em português.
- Não mostrar tradução.
- Salvar a palavra no vocabulário português.

Não será necessário escolher separadamente entre “tradutor” e “dicionário”: o idioma do livro determina o fluxo.

## 2. Vocabulários separados

A pessoa terá três vocabulários independentes:

- Português (`pt`)
- Inglês (`en`)
- Espanhol (`es`)

Qualquer um deles pode estar vazio. Uma palavra deve guardar, no mínimo, o idioma de origem, a definição e o contexto em que foi encontrada.

```ts
type VocabularyLanguage = "pt" | "en" | "es";

type VocabularyWord = {
  id: string;
  word: string;
  language: VocabularyLanguage;
  definition: string;
  translation?: string;
  examples?: string[];
  sourceBook?: string;
};
```

`translation` é opcional e só deve ser preenchido para palavras em inglês ou espanhol.

## 3. Jogos de prática

Antes de iniciar um jogo, a pessoa escolhe:

1. O idioma do vocabulário.
2. O tipo de jogo.

Os jogos carregam somente palavras do idioma escolhido. A mecânica principal será sempre:

> Definição na língua escolhida → identificar ou digitar a palavra na mesma língua.

Não usar tradução como resposta dos jogos.

Exemplos:

- Inglês: definição em inglês → palavra em inglês.
- Espanhol: definição em espanhol → palavra em espanhol.
- Português: definição em português → palavra em português.

Tipos de jogo possíveis:

- Flashcards
- Múltipla escolha
- Digitação da palavra
- Completar frase
- Revisão de palavras difíceis

Se o vocabulário escolhido estiver vazio, mostrar uma mensagem amigável com opções para adicionar palavras, iniciar uma leitura naquele idioma ou escolher outro idioma.

As estatísticas de prática também devem ser separadas por idioma: acertos, erros, palavras aprendidas e sequência de prática.

## 4. Livros e progresso

Depois do fluxo básico de idioma, evoluir as sessões para suportar:

- Nome e autor do livro.
- Capa opcional.
- Progresso por livro.
- Histórico de sessões.
- Palavras salvas por livro.
- Estatísticas separadas por idioma.
- Metas de leitura.

## 5. Book Club

Criar uma área de clubes de leitura onde a pessoa possa:

- Criar um clube.
- Entrar por convite ou código.
- Ver seus clubes.
- Definir o livro atual.
- Acompanhar o progresso diário dos participantes.
- Ver ranking de leitura.
- Compartilhar o que está lendo.
- Recomendar livros.
- Participar de discussões e comentários.
- Consultar o histórico de leituras do clube.

### Entidades previstas

- `clubs`
- `club_members`
- `club_books`
- `club_reading_progress`
- `club_posts`
- `club_comments`
- `club_recommendations`

### Permissões

- Dono do clube
- Administrador
- Participante
- Convite pendente

## Ordem sugerida de implementação

1. Tela de escolha do idioma antes da leitura.
2. Fluxo automático de consulta para português, inglês e espanhol.
3. Separação dos vocabulários por idioma.
4. Persistência do idioma e do livro nas sessões.
5. Escolha de idioma antes dos jogos.
6. Jogos baseados em definição → palavra, sem tradução.
7. Estatísticas de prática por idioma.
8. Livros, progresso e histórico.
9. Book Club básico: criar, entrar e definir livro.
10. Progresso diário, ranking e feed do clube.
11. Fórum, recomendações, notificações e gamificação.

## Critérios importantes

- Nunca misturar palavras de idiomas diferentes no mesmo vocabulário ou jogo.
- Um vocabulário vazio é um estado válido, não um erro.
- Tradução é recurso da leitura em inglês/espanhol, não da mecânica dos jogos.
- Definições dos jogos devem permanecer no idioma da palavra.
- O idioma deve ser salvo junto com cada palavra, sessão e estatística.
