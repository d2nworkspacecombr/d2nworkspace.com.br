-- ============================================================================
-- D2N WORKSPACE — SCHEMA INICIAL (Fase 1 + Módulo de Assessoria)
-- ============================================================================
-- Como aplicar: Supabase > seu projeto > SQL Editor > cole este arquivo > Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERFIS DE USUÁRIO
-- ----------------------------------------------------------------------------
-- Toda pessoa que faz login no sistema (auth.users do Supabase) tem um
-- registro espelho aqui, com o perfil (papel) que ela exerce.
-- ----------------------------------------------------------------------------

create type user_role as enum ('admin', 'colaborador', 'cliente');

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  role user_role not null default 'colaborador',
  cargo text,                 -- ex: "Assessor", "Consultor de Marketing"
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. CLIENTES
-- ----------------------------------------------------------------------------
-- Cadastro central. Todo módulo se conecta a um cliente.
-- ----------------------------------------------------------------------------

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  porte text,                 -- ex: "10-49 funcionários"
  interlocutor text,          -- pessoa de contato no cliente
  telefone text,
  email text,
  servicos text[] default '{}', -- ex: {'assessoria','marketing'}
  status text not null default 'ativo', -- ativo | pausado | encerrado
  criado_por uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. VÍNCULO COLABORADOR ↔ CLIENTE
-- ----------------------------------------------------------------------------
-- Um cliente pode ter vários colaboradores vinculados (ex: Diogo e Taique
-- no mesmo cliente). Quem cria o vínculo é sempre o Admin.
-- ----------------------------------------------------------------------------

create table vinculo_colaborador_cliente (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  modulo text not null default 'assessoria', -- assessoria | marketing | comercial...
  vinculado_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  unique (usuario_id, cliente_id, modulo)
);

-- ----------------------------------------------------------------------------
-- 4. MÓDULO ASSESSORIA — Plano de Assessoria
-- ----------------------------------------------------------------------------

-- 4.1 Sessões de atendimento (histórico, como abas no relatório antigo)
create table assessoria_sessoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  titulo text not null,           -- ex: "Sessão 1 - Diagnóstico inicial"
  data_sessao date not null default current_date,
  resumo text,
  pauta text,
  encaminhamentos text,
  registrado_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4.2 Planejamento Estratégico (5 pilares)
create table assessoria_planejamento (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  pilar text not null,            -- ex: Comercial, Marketing, Processos, Pessoas, Finanças
  objetivo text,
  diagnostico text,
  estrategia text,
  ordem int default 0,
  atualizado_por uuid references usuarios(id),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, pilar)
);

-- 4.3 Plano Tático (OKRs)
create table assessoria_okrs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  objetivo text not null,
  resultado_chave text not null,
  progresso int not null default 0 check (progresso between 0 and 100),
  prazo date,
  responsavel_id uuid references usuarios(id),
  atualizado_em timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. MÓDULO DIAGNÓSTICO (adaptado da ferramenta HTML existente)
-- ----------------------------------------------------------------------------

create table diagnosticos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  status text not null default 'rascunho', -- rascunho | concluido
  interlocutor text,
  consultor_id uuid references usuarios(id),
  respostas jsonb not null default '{}',   -- { areaId: { perguntaId: nota } }
  resultado jsonb,                          -- snapshot calculado no fechamento
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

-- ============================================================================
-- 6. FUNÇÕES AUXILIARES PARA AS REGRAS DE PERMISSÃO (RLS)
-- ============================================================================

create or replace function auth_role()
returns user_role
language sql stable
as $$
  select role from usuarios where id = auth.uid();
$$;

create or replace function tem_acesso_ao_cliente(p_cliente_id uuid)
returns boolean
language sql stable
as $$
  select
    auth_role() = 'admin'
    or exists (
      select 1 from vinculo_colaborador_cliente
      where usuario_id = auth.uid() and cliente_id = p_cliente_id
    );
$$;

-- ============================================================================
-- 7. RLS — LIGAR E DEFINIR POLÍTICAS
-- ============================================================================

alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table vinculo_colaborador_cliente enable row level security;
alter table assessoria_sessoes enable row level security;
alter table assessoria_planejamento enable row level security;
alter table assessoria_okrs enable row level security;
alter table diagnosticos enable row level security;

-- USUARIOS: todo mundo autenticado pode ler nomes/cargos (pra mostrar em listas);
-- só admin edita.
create policy "usuarios_select" on usuarios for select using (auth.uid() is not null);
create policy "usuarios_update_admin" on usuarios for update using (auth_role() = 'admin');
create policy "usuarios_insert_admin" on usuarios for insert with check (auth_role() = 'admin');

-- CLIENTES: admin vê tudo; colaborador só vê clientes vinculados a ele.
create policy "clientes_select" on clientes for select using (
  auth_role() = 'admin' or tem_acesso_ao_cliente(id)
);
create policy "clientes_insert_admin" on clientes for insert with check (auth_role() = 'admin');
create policy "clientes_update" on clientes for update using (
  auth_role() = 'admin' or tem_acesso_ao_cliente(id)
);
create policy "clientes_delete_admin" on clientes for delete using (auth_role() = 'admin');

-- VÍNCULOS: só admin cria/edita/remove. Colaborador pode ver os próprios vínculos.
create policy "vinculo_select" on vinculo_colaborador_cliente for select using (
  auth_role() = 'admin' or usuario_id = auth.uid()
);
create policy "vinculo_admin_all" on vinculo_colaborador_cliente for all using (
  auth_role() = 'admin'
);

-- ASSESSORIA (sessões, planejamento, OKRs): regra igual em todas —
-- só quem tem acesso ao cliente (admin ou vinculado) lê/escreve.
create policy "sessoes_acesso" on assessoria_sessoes for all using (
  tem_acesso_ao_cliente(cliente_id)
) with check (tem_acesso_ao_cliente(cliente_id));

create policy "planejamento_acesso" on assessoria_planejamento for all using (
  tem_acesso_ao_cliente(cliente_id)
) with check (tem_acesso_ao_cliente(cliente_id));

create policy "okrs_acesso" on assessoria_okrs for all using (
  tem_acesso_ao_cliente(cliente_id)
) with check (tem_acesso_ao_cliente(cliente_id));

-- DIAGNÓSTICOS: mesma regra.
create policy "diagnosticos_acesso" on diagnosticos for all using (
  tem_acesso_ao_cliente(cliente_id)
) with check (tem_acesso_ao_cliente(cliente_id));

-- ============================================================================
-- 8. TRIGGER: criar automaticamente o registro em "usuarios" quando alguém
--    se cadastra no Supabase Auth (o Admin cria os logins pelo painel)
-- ============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'colaborador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
