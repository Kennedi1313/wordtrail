# Wordtrail — próximos passos

Este arquivo acompanha o produto atual. Ideias antigas de tradução e suporte multilíngue foram removidas porque não fazem parte do fluxo vigente.

## Produto atual

- Livros, sessões de leitura, vocabulário com definições em inglês e jogos de revisão.
- Clubes de leitura com convite, progresso e fórum.
- Supabase Auth e PostgreSQL como fonte única dos dados da conta.
- Operações de gravação confirmadas pelo servidor antes de atualizar a interface.

## Prioridades

1. Aplicar e validar as migrations de segurança e sincronização no Supabase de desenvolvimento.
2. Exercitar políticas RLS com contas distintas: membro, administrador e usuário fora do clube.
3. Validar conflito de gravação em duas sessões e apresentar um fluxo de recarga claro.
4. Investigar diferenças entre os registros antigos e os registros atuais de vocabulário antes de qualquer importação; não restaurar automaticamente itens que possam ter sido apagados.
5. Ampliar testes automatizados de sincronização, autorização, falhas de rede e fluxos de clube.
6. Remover módulos, estilos e documentação obsoletos conforme forem identificados por referências e validação de uso.

## Critério para alterações de dados

O banco é a fonte de verdade. Uma falha de rede ou conflito deve ser apresentado como erro e não pode ser confirmado como sucesso. A migração de dados antigos precisa preservar exclusões feitas pela pessoa; diferenças ambíguas exigem inspeção antes de importar.
