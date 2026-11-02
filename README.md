# Wordtrail

Um companheiro de leitura para pesquisar palavras em inglês, guardar vocabulário e revisar com jogos curtos. O app pode usar Supabase Auth + PostgreSQL para sincronizar o progresso entre dispositivos, com hospedagem na Vercel.

## Rodar localmente

Requer Node.js 22.12+ (linha 22.x).

```sh
npm install
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). O Vite serve a interface e encaminha `/api` ao servidor Node leve na porta `4175`; não há serviços de tradução, dicionário ou modelos de IA locais. A porta `4173` fica livre caso exista um servidor antigo do Wordtrail rodando.

Sem configuração do Supabase, o app continua em modo local no navegador. Para testar Google Auth localmente, crie `.env.local` com base em [.env.example](./.env.example) e use as configurações de OAuth descritas abaixo.

## Preparar Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard). O plano Free é suficiente para começar; projetos Free podem pausar após uma semana sem atividade.
2. A migração inicial já foi aplicada ao projeto conectado. O SQL correspondente está em [supabase/schema.sql](./supabase/schema.sql) e versionado em [supabase/migrations](./supabase/migrations); isso cria uma tabela JSONB por conta com políticas RLS, para cada pessoa autenticada ler e alterar somente a própria linha.
3. Em **Project Settings → API**, copie a Project URL e a chave **publishable** (ou a chave legada `anon`). Nunca use `service_role` no app.
4. Em **Authentication → URL Configuration**, defina o Site URL como o domínio de produção da Vercel e adicione à Redirect URLs:
   - `http://localhost:5173`
   - `https://SEU-DOMINIO-VERCEL`
5. Em **Authentication → Providers → Google**, habilite Google e copie o callback URL indicado pelo Supabase.
6. No [Google Cloud Console](https://console.cloud.google.com/), configure a tela de consentimento OAuth e crie um OAuth Client ID do tipo Web. Adicione `http://localhost:5173` e o domínio Vercel em **Authorized JavaScript origins**; adicione o callback do Supabase em **Authorized redirect URIs**. Cole o Client ID e o Client Secret no provedor Google do Supabase — o secret fica somente no Supabase, nunca neste repositório.
7. Para desenvolvimento, copie `.env.example` para `.env.local` e substitua os valores:

```sh
cp .env.example .env.local
```

Reinicie `npm run dev` após alterar o arquivo. Com Supabase configurado, o app pede login Google; no primeiro login, os dados antigos do `localStorage` deste navegador são mesclados com a conta e enviados ao banco.

## Publicar na Vercel

1. Envie este projeto para um repositório Git e importe-o no [Vercel](https://vercel.com/new).
2. Use os padrões Vite: build `npm run build`, diretório de saída `dist`.
3. Em **Project → Settings → Environment Variables**, cadastre:
   - `VITE_SUPABASE_URL` — Project URL do Supabase.
   - `VITE_SUPABASE_ANON_KEY` — chave publishable (ou `anon`) do Supabase.
4. Faça deploy/redeploy. Essas variáveis `VITE_` entram no bundle público: são identificadores/chaves públicas, protegidos pelas políticas RLS. Não publique a `service_role` nem o Client Secret do Google.
5. Copie a URL final `https://...vercel.app` e adicione-a nas Redirect URLs do Supabase e nos Authorized JavaScript origins do OAuth Client Google. Use também como Site URL do Supabase. Faça um redeploy se tiver alterado as variáveis.

As rotas em `api/` são funções serverless da Vercel para consultar as APIs públicas. O app não precisa de um servidor permanente nem de Docker.

## Dados e migração

O Supabase guarda uma linha JSONB por usuário com vocabulário, sessões, revisões e meta diária. O cache local continua para a inicialização e uso temporário offline. No primeiro login, os dados anônimos antigos deste navegador são mesclados com o registro remoto; sessões e revisões são deduplicadas. Para migrar, faça esse primeiro login no navegador que ainda contém seu progresso.

## APIs externas usadas

- **Definições, IPA e áudio:** [Free Dictionary API](https://dictionaryapi.dev/).
- **Tradução inglês → português:** [MyMemory](https://mymemory.translated.net/).
- **Autocomplete:** [Datamuse](https://www.datamuse.com/api/).
- **Palavras aleatórias para os jogos:** [Random Word API](https://random-word-api.herokuapp.com/).

Essas APIs podem ter limites ou ficar indisponíveis. O serviço de áudio nem sempre oferece arquivo para cada palavra.
