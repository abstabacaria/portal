-- ============================================================
-- CONECTAY — MIGRAÇÃO V3 (final, sob medida)
-- NÃO TOCA no módulo de segmentação existente:
--   portal_categoria_regras (codigo/dias_min/dias_max/...),
--   portal_mensagem_templates, portal_disparos,
--   portal_recalcular_categorias(), portal_montar_msg(), cron.
-- Adiciona apenas: colunas novas, portal_usuarios, RLS,
-- view da aba Mensagens e função do dashboard.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PORTAL_LOJAS — colunas do motor/painel v2
--    (modo nasce 'instagram' = comportamento atual preservado)
-- ------------------------------------------------------------
alter table portal_lojas add column if not exists modo text not null default 'instagram';
alter table portal_lojas add column if not exists destino text not null default 'instagram';
alter table portal_lojas add column if not exists google_review_url text;

-- ------------------------------------------------------------
-- 2. PORTAL_ACESSOS — user-agent p/ gráficos de dispositivo/SO
-- ------------------------------------------------------------
alter table portal_acessos add column if not exists ip text;
alter table portal_acessos add column if not exists user_agent text;
alter table portal_acessos add column if not exists so text;
create index if not exists idx_acessos_loja_data on portal_acessos (loja_id, criado_em);
create index if not exists idx_acessos_loja_mac  on portal_acessos (loja_id, mac);

-- ------------------------------------------------------------
-- 3. PORTAL_LEADS — colunas planas + LGPD, com backfill do JSONB
-- ------------------------------------------------------------
alter table portal_leads add column if not exists nome text;
alter table portal_leads add column if not exists telefone text;
alter table portal_leads add column if not exists user_agent text;
alter table portal_leads add column if not exists optin boolean not null default false;
alter table portal_leads add column if not exists optin_data timestamptz;
alter table portal_leads add column if not exists optin_texto text;

update portal_leads set
  telefone = nullif(regexp_replace(
    coalesce(dados->>'telefone', dados->>'whatsapp', dados->>'celular', dados->>'fone', ''),
    '\D', '', 'g'), ''),
  nome = coalesce(nome, dados->>'nome')
where telefone is null;

create index if not exists idx_leads_loja on portal_leads (loja_id, criado_em);
create index if not exists idx_leads_tel  on portal_leads (loja_id, telefone);

-- ------------------------------------------------------------
-- 4. PORTAL_PESSOAS — CRM ampliado
-- ------------------------------------------------------------
alter table portal_pessoas add column if not exists tags text[] not null default '{}';
alter table portal_pessoas add column if not exists observacoes text;
alter table portal_pessoas add column if not exists status text not null default 'ativo';

-- ------------------------------------------------------------
-- 5. TRIGGER lead -> pessoa
--    Só cria se portal_leads ainda NÃO tiver nenhum trigger de
--    insert (se sua consolidação atual já faz isso, não duplica).
-- ------------------------------------------------------------
create or replace function portal_lead_para_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tel text; v_aniv text;
begin
  v_tel := nullif(regexp_replace(coalesce(new.telefone,
             new.dados->>'telefone', new.dados->>'whatsapp', new.dados->>'celular', ''),
             '\D', '', 'g'), '');
  if v_tel is null then return new; end if;

  v_aniv := new.dados->>'aniversario';
  if v_aniv is null or v_aniv !~ '^\d{4}-\d{2}-\d{2}$' then v_aniv := null; end if;

  insert into portal_pessoas (loja_id, telefone, nome, aniversario,
                              primeira_visita, ultima_visita, total_visitas, categoria)
  values (new.loja_id, v_tel, coalesce(new.nome, new.dados->>'nome'), v_aniv,
          current_date, current_date, 1, 'novo')
  on conflict (loja_id, telefone) do update set
    nome          = coalesce(excluded.nome, portal_pessoas.nome),
    aniversario   = coalesce(excluded.aniversario, portal_pessoas.aniversario),
    ultima_visita = current_date,
    total_visitas = portal_pessoas.total_visitas
                    + case when portal_pessoas.ultima_visita = current_date then 0 else 1 end,
    atualizado_em = now();
  return new;
end $$;

do $$
begin
  -- garante o índice único que o ON CONFLICT precisa
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and tablename='portal_pessoas' and indexdef ilike '%unique%'
      and indexdef ilike '%loja_id%' and indexdef ilike '%telefone%'
  ) then
    create unique index uq_pessoas_loja_tel on portal_pessoas (loja_id, telefone);
  end if;

  -- só cria o trigger se não existir nenhum trigger de INSERT na tabela
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'portal_leads'::regclass
      and not t.tgisinternal
  ) then
    create trigger trg_lead_pessoa after insert on portal_leads
      for each row execute function portal_lead_para_pessoa();
    raise notice 'Trigger trg_lead_pessoa criado em portal_leads.';
  else
    raise notice 'portal_leads já tem trigger próprio — mantido como está.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. PORTAL_USUARIOS (auth -> loja) — base do RLS
-- ------------------------------------------------------------
create table if not exists portal_usuarios (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  loja_id  bigint references portal_lojas(id) on delete set null,
  papel    text not null default 'cliente' check (papel in ('admin','cliente')),
  criado_em timestamptz not null default now()
);

create or replace function conectay_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from portal_usuarios where user_id = auth.uid() and papel = 'admin');
$$;

create or replace function conectay_minha_loja() returns bigint
language sql stable security definer set search_path = public as $$
  select loja_id from portal_usuarios where user_id = auth.uid();
$$;

-- Auto-vínculo: liga usuários do Auth às lojas pelo email_acesso
-- (a portal_minha_loja() antiga do seu painel continua intacta)
insert into portal_usuarios (user_id, loja_id, papel)
select u.id, l.id, 'cliente'
from auth.users u
join portal_lojas l on lower(trim(l.email_acesso)) = lower(u.email)
where l.email_acesso is not null
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    ⚠️ Motor no Railway precisa estar na service_role key.
--    Painéis só voltam a ver dados após o insert do passo final.
-- ------------------------------------------------------------
alter table portal_lojas              enable row level security;
alter table portal_acessos            enable row level security;
alter table portal_leads              enable row level security;
alter table portal_pessoas            enable row level security;
alter table portal_categoria_regras   enable row level security;
alter table portal_mensagem_templates enable row level security;
alter table portal_disparos           enable row level security;
alter table portal_usuarios           enable row level security;

do $$
declare t text;
begin
  foreach t in array array['portal_lojas','portal_acessos','portal_leads','portal_pessoas',
                           'portal_categoria_regras','portal_mensagem_templates','portal_disparos'] loop
    execute format('drop policy if exists sel_%1$s on %1$s', t);
    execute format('drop policy if exists mod_%1$s on %1$s', t);
  end loop;
  drop policy if exists adm_ins_lojas on portal_lojas;
  drop policy if exists adm_del_lojas on portal_lojas;
  drop policy if exists sel_portal_usuarios on portal_usuarios;
  drop policy if exists adm_portal_usuarios on portal_usuarios;
end $$;

create policy sel_portal_lojas on portal_lojas for select to authenticated
  using (conectay_eh_admin() or id = conectay_minha_loja());
create policy mod_portal_lojas on portal_lojas for update to authenticated
  using (conectay_eh_admin() or id = conectay_minha_loja())
  with check (conectay_eh_admin() or id = conectay_minha_loja());
create policy adm_ins_lojas on portal_lojas for insert to authenticated with check (conectay_eh_admin());
create policy adm_del_lojas on portal_lojas for delete to authenticated using (conectay_eh_admin());

create policy sel_portal_acessos on portal_acessos for select to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja());
create policy sel_portal_leads on portal_leads for select to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja());

create policy sel_portal_pessoas on portal_pessoas for select to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja());
create policy mod_portal_pessoas on portal_pessoas for update to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja())
  with check (conectay_eh_admin() or loja_id = conectay_minha_loja());

create policy sel_portal_categoria_regras on portal_categoria_regras for select to authenticated
  using (conectay_eh_admin() or loja_id is null or loja_id = conectay_minha_loja());
create policy mod_portal_categoria_regras on portal_categoria_regras for all to authenticated
  using (conectay_eh_admin()) with check (conectay_eh_admin());

create policy sel_portal_mensagem_templates on portal_mensagem_templates for select to authenticated
  using (conectay_eh_admin() or loja_id is null or loja_id = conectay_minha_loja());
create policy mod_portal_mensagem_templates on portal_mensagem_templates for all to authenticated
  using (conectay_eh_admin()) with check (conectay_eh_admin());

create policy sel_portal_disparos on portal_disparos for select to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja());
create policy mod_portal_disparos on portal_disparos for update to authenticated
  using (conectay_eh_admin() or loja_id = conectay_minha_loja())
  with check (conectay_eh_admin() or loja_id = conectay_minha_loja());

create policy sel_portal_usuarios on portal_usuarios for select to authenticated
  using (user_id = auth.uid() or conectay_eh_admin());
create policy adm_portal_usuarios on portal_usuarios for all to authenticated
  using (conectay_eh_admin()) with check (conectay_eh_admin());

-- ------------------------------------------------------------
-- 8. VIEW DA ABA MENSAGENS (recria com as colunas do painel v2)
-- ------------------------------------------------------------
drop view if exists portal_disparos_prontos;
create view portal_disparos_prontos as
select d.id, d.loja_id, d.categoria, d.mensagem, d.status, d.criado_em,
       p.nome,
       coalesce(p.telefone, d.telefone) as telefone,
       p.total_visitas, p.ultima_visita
from portal_disparos d
left join portal_pessoas p on p.id = d.pessoa_id
where d.status = 'pendente'
  and coalesce(p.status, 'ativo') <> 'bloqueado';

-- ------------------------------------------------------------
-- 9. DASHBOARD — todos os KPIs em 1 chamada (p_loja bigint)
-- ------------------------------------------------------------
drop function if exists portal_dashboard(uuid);
drop function if exists portal_dashboard(bigint);
create function portal_dashboard(p_loja bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not (conectay_eh_admin() or p_loja = conectay_minha_loja()) then
    raise exception 'sem permissão';
  end if;

  select jsonb_build_object(
    'hoje',            (select count(*) from portal_acessos where loja_id=p_loja and criado_em::date=current_date),
    'total_visitas',   (select count(*) from portal_acessos where loja_id=p_loja),
    'unicos',          (select count(distinct mac) from portal_acessos where loja_id=p_loja and mac is not null),
    'recorrentes',     (select count(*) from portal_pessoas where loja_id=p_loja and categoria='recorrente'),
    'novos_30d',       (select count(*) from portal_leads where loja_id=p_loja and criado_em>now()-interval '30 days'),
    'total_leads',     (select count(*) from portal_pessoas where loja_id=p_loja),
    'mes_atual',       (select count(*) from portal_acessos where loja_id=p_loja and date_trunc('month',criado_em)=date_trunc('month',now())),
    'mes_anterior',    (select count(*) from portal_acessos where loja_id=p_loja and date_trunc('month',criado_em)=date_trunc('month',now()-interval '1 month')),
    'por_hora',        (select coalesce(jsonb_agg(jsonb_build_object('h',h,'n',n) order by h),'[]'::jsonb) from
                          (select extract(hour from criado_em at time zone 'America/Sao_Paulo')::int h, count(*) n
                           from portal_acessos where loja_id=p_loja and criado_em>now()-interval '30 days' group by 1) x),
    'por_dia_semana',  (select coalesce(jsonb_agg(jsonb_build_object('d',d,'n',n) order by d),'[]'::jsonb) from
                          (select extract(isodow from criado_em at time zone 'America/Sao_Paulo')::int d, count(*) n
                           from portal_acessos where loja_id=p_loja and criado_em>now()-interval '30 days' group by 1) x),
    'ultimos_14d',     (select coalesce(jsonb_agg(jsonb_build_object('dia',dia,'n',n) order by dia),'[]'::jsonb) from
                          (select criado_em::date dia, count(*) n
                           from portal_acessos where loja_id=p_loja and criado_em>now()-interval '14 days' group by 1) x),
    'dispositivos',    (select coalesce(jsonb_agg(jsonb_build_object('k',coalesce(dispositivo,'outro'),'n',n)),'[]'::jsonb) from
                          (select dispositivo, count(*) n from portal_acessos where loja_id=p_loja group by 1) x),
    'sistemas',        (select coalesce(jsonb_agg(jsonb_build_object('k',coalesce(so,'outro'),'n',n)),'[]'::jsonb) from
                          (select so, count(*) n from portal_acessos where loja_id=p_loja group by 1) x),
    'categorias',      (select coalesce(jsonb_agg(jsonb_build_object('k',categoria,'n',n)),'[]'::jsonb) from
                          (select categoria, count(*) n from portal_pessoas where loja_id=p_loja group by 1) x)
  ) into r;
  return r;
end $$;

grant execute on function portal_dashboard(bigint) to authenticated;

-- ============================================================
-- PASSO FINAL (obrigatório pro painel ver dados com RLS ligado):
--   1) Authentication > Users: copie o UUID do seu usuário.
--   2) insert into portal_usuarios (user_id, papel)
--      values ('<SEU-UUID>','admin')
--      on conflict (user_id) do update set papel='admin';
--   3) Para cada cliente:
--      insert into portal_usuarios (user_id, loja_id, papel)
--      values ('<UUID-CLIENTE>',
--              (select id from portal_lojas where slug='absolem'),
--              'cliente')
--      on conflict (user_id) do update set loja_id=excluded.loja_id;
-- ============================================================
