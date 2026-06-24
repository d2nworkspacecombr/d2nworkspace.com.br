# D2N Workspace (versão HTML + JavaScript)

Mesma plataforma, reconstruída no formato mais simples — igual ao Fontys Auto:
páginas HTML comuns + funções JavaScript na pasta `api/` rodando no servidor
(Vercel Functions), conversando com o mesmo banco de dados Supabase que já
criamos.

## Estrutura

```
index.html       → tela de login
app.html         → o sistema inteiro (sidebar + Clientes + Assessoria)
api/
  _supabase.js   → arquivo auxiliar (não é uma rota)
  login.js       → POST   verifica e-mail/senha
  me.js          → GET    retorna o perfil do usuário logado
  clientes.js    → GET/POST   lista e cria clientes
  vinculos.js    → GET/POST/DELETE   vincula colaboradores a clientes
  colaboradores.js → GET  lista colaboradores (pra vincular)
  sessoes.js     → GET/POST   sessões de atendimento (Assessoria)
  planejamento.js→ GET/POST   planejamento dos 5 pilares (Assessoria)
  okrs.js        → GET/POST/PATCH   plano tático OKRs (Assessoria)
schema.sql       → o mesmo banco de dados de antes (já está pronto no Supabase)
logo-icon.png / logo-completo.png → identidade visual D2N
```

## Por que essa versão é mais simples de operar

- Não tem cookies, não tem sessão do lado do servidor, não tem middleware.
- O login devolve um token simples; o navegador guarda esse token e manda ele
  em toda chamada à API (`Authorization: Bearer ...`) — é só isso.
- Cada arquivo em `api/` é independente, como no Fontys: dá pra entender,
  editar ou trocar um de cada vez sem afetar o resto.

## Como publicar

### 1. O banco de dados já está pronto
Você já rodou o `schema.sql` no Supabase numa etapa anterior — não precisa
fazer nada de novo aqui.

### 2. Variáveis de ambiente no Vercel
Diferente da versão anterior, agora as variáveis **não** começam com
`NEXT_PUBLIC_` (porque elas nunca vão pro navegador — só são usadas dentro
das funções em `api/`, no servidor):

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://kwjtmgswxoziblfowllv.supabase.co` |
| `SUPABASE_ANON_KEY` | a chave anon (legacy, formato `eyJ...`) |

No Vercel: **Settings > Environment Variables** → apague as variáveis antigas
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e crie essas duas
novas.

### 3. Subir os arquivos
Mesmo processo de antes: suba todos os arquivos dessa pasta pro repositório
do GitHub (substituindo os arquivos antigos do projeto Next.js — pode apagar
as pastas `src`, a `tsconfig.json`, `next.config.js`, `tailwind.config.js`,
`postcss.config.js` e `middleware.ts`, já que não existem mais nessa versão).

O Vercel vai detectar automaticamente os arquivos `.html` na raiz como
páginas estáticas e os arquivos em `api/` como funções — sem precisar de
nenhuma configuração extra.

### 4. Testar
Acesse `seusite.vercel.app/index.html` (ou só `seusite.vercel.app`, que deve
abrir o `index.html` automaticamente), entre com o e-mail e senha do Admin
que você já criou no Supabase, e confirme que o painel abre.

## Próximos passos sugeridos
1. Validar o login funcionando nessa versão mais simples.
2. Ajustar os campos do Plano de Assessoria com os prints que você for enviando.
3. Criar uma tela de cadastro de novos usuários (hoje ainda é feito direto no Supabase).
