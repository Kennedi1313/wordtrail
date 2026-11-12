# Wordtrail

Um companheiro de leitura para pesquisar palavras em inglês, guardar vocabulário e revisar com jogos curtos. Next.js serve a interface e as APIs; Supabase Auth e PostgreSQL são obrigatórios para os dados da conta.

## Rodar localmente

Requer Node.js 22.12+ (linha 22.x).

```sh
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O app usa Next.js com App Router e TypeScript.

Validação local:

```sh
npm run typecheck
npm run build
npm run start
```

O Supabase é obrigatório: sem ele, o app permanece bloqueado e não executa operações de dados no navegador. Para testar Google Auth localmente, crie `.env.local` com base em [.env.example](./.env.example) e use as configurações de OAuth descritas abaixo.

## Preparar Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard). O plano Free é suficiente para começar; projetos Free podem pausar após uma semana sem atividade.
2. Aplique, em ordem, todas as migrations de [supabase/migrations](./supabase/migrations). Elas criam os registros da conta, clubes, RLS e as funções transacionais usadas pela aplicação.
3. Em **Project Settings → API**, copie a Project URL e a chave **publishable** (ou a chave legada `anon`). Nunca use `service_role` no app.
4. Em **Authentication → URL Configuration**, defina o Site URL como `https://wordtrail-beryl.vercel.app` e adicione à Redirect URLs:
   - `http://localhost:3000`
   - `https://wordtrail-beryl.vercel.app`
5. Em **Authentication → Providers → Google**, habilite Google e copie o callback URL indicado pelo Supabase.
6. No [Google Cloud Console](https://console.cloud.google.com/), configure a tela de consentimento OAuth e crie um OAuth Client ID do tipo Web. Adicione `http://localhost:3000` e o domínio de produção em **Authorized JavaScript origins**; adicione o callback do Supabase em **Authorized redirect URIs**. Cole o Client ID e o Client Secret no provedor Google do Supabase — o secret fica somente no Supabase, nunca neste repositório.
7. Para desenvolvimento, copie `.env.example` para `.env.local` e substitua os valores:

```sh
cp .env.example .env.local
```

Reinicie `npm run dev` após alterar o arquivo. Com Supabase configurado, o app pede login Google. Os dados da conta são carregados exclusivamente do servidor; sem conexão ou sessão válida, o app permanece bloqueado e nenhuma alteração é aplicada. Se não houver registros no formato atual, dados no armazenamento legado do Supabase são convertidos para registros independentes. Quando já existem registros atuais, o legado não é mesclado automaticamente; diferenças precisam ser verificadas para evitar recuperar dados apagados.

## Publicar na Vercel

1. Envie este projeto para um repositório Git e importe-o no [Vercel](https://vercel.com/new).
2. Use o preset Next.js e o comando `npm run build`.
3. Em **Project → Settings → Environment Variables**, cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL do Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave publishable (ou `anon`) do Supabase.
4. Faça deploy/redeploy. A chave publishable/anon é pública e protegida pelas políticas RLS. Não publique a `service_role` nem o Client Secret do Google.
5. Copie a URL final `https://...vercel.app` e adicione-a nas Redirect URLs do Supabase e nos Authorized JavaScript origins do OAuth Client Google. Use também como Site URL do Supabase. Faça um redeploy se tiver alterado as variáveis.

As rotas em `app/api/dictionary/` fazem chamadas server-side ao dicionário, autocomplete e serviço de palavras aleatórias. Chamadas externas têm timeout e a rota de prática limita a concorrência.

## Dados e migração

O Supabase guarda os dados por usuário, e o app só considera uma operação concluída depois da confirmação do servidor. Não existe cache local de estado, inicialização offline ou mesclagem automática de dados do navegador. As gravações de estado usam versão por conta; uma gravação concorrente é recusada para impedir sobrescrita silenciosa e exige recarregar os dados atuais.

## APIs externas usadas

- **Definições, IPA e áudio:** Merriam-Webster Collegiate API (requer `MERRIAM_WEBSTER_API_KEY`).
- **Autocomplete:** [Datamuse](https://www.datamuse.com/api/).
- **Palavras aleatórias para os jogos:** [Random Word API](https://random-word-api.herokuapp.com/).

Essas APIs podem ter limites ou ficar indisponíveis. O serviço de áudio nem sempre oferece arquivo para cada palavra.

## Arquitetura

As páginas e rotas ficam em `app/`; componentes em `components/`; estado e autenticação em `hooks/`; regras de domínio em `services/`; Supabase em `lib/supabase/`; e contratos de dados em `types/`. Não há persistência de estado da conta no navegador: registros e sessão de leitura ativa são carregados e gravados no Supabase.

As funcionalidades principais estão separadas entre `components/vocabulary`, `components/reading` e `components/practice`. A autenticação está em `hooks/use-auth.ts`; a integração de sincronização está em `services/sync-service.ts`; e as regras de revisão estão em `services/practice-service.ts`.
