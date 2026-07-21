-- ============================================================
-- CONECTAY — MIGRAÇÃO V2 (sob medida pro banco em produção)
-- Estrutura real: ids BIGINT, leads com dados em JSONB,
-- portal_pessoas já existente com coluna aniversario (text).
-- 100% ADITIVA: não renomeia nem remove nada do que existe.
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- 1. PORTAL_LOJAS — colunas novas usadas pelo motor/painel v2
--    (modo nasce como 'instagram' pra NÃO mudar o comportamento
--    atual das lojas; você troca pra formulário pelo painel)
-- ------------------------------------------------------------
alter table portal_lojas add column if not exists modo text not null default 'instagram';
alter table portal_lojas add column if not exists destino text not null default 'instagram';
alter table portal_lojas add column if not exists google_review_url text;

-- ------------------------------------------------------------
-- 2. PORTAL_ACESSOS — user-agent p/ dashboard de dispositivos
-- ------------------------------------------------------------
alter table portal_acessos add column if not exists ip text;
alter table portal_acessos add column if not exists user_agent text;
alter table portal_acessos add column if not exists so text;
create index if not exists idx_acessos_loja_data on portal_acessos (loja_id, criado_em);
create index if not exists idx_acessos_loja_mac  on portal_acessos (loja_id, mac);

-- ------------------------------------------------------------
-- 3. PORTAL_LEADS — colunas planas + LGPD
--    (o JSONB `dados` continua existindo; backfill abaixo)
-- ------------------------------------------------------------
alter table portal_leads add column if not exists nome text;
alter table portal_leads add column if not exists telefone text;
alter table portal_leads add column if not exists user_agent text;
alter table portal_leads add column if not exists optin boolean not null default false;
alter table portal_leads add column if not exists optin_data timestamptz;
alter table portal_leads add column if not exists optin_texto text;

-- Backfill dos leads antigos a partir do JSONB (só onde estiver vazio)
update portal_leads set
  telefone = nullif(regexp_replace(
    coalesce(dados->>'telefone', dados->>'whatsapp', dados->>'celular', dados->>'fone', ''),
    '\D', '', 'g'), ''),
  nome = coalesce(nome, dados->>'nome')
where telefone is null;

create index if not exists idx_leads_loja on portal_leads (loja_id, criado_em);
create index if not exists idx_leads_tel  on portal_leads (loja_id, telefone);

-- ------------------------------------------------------------
-- 4. PORTAL_PESSOAS — CRM ampliado (tags, obs, status)
-- ------------------------------------------------------------
alter table portal_pessoas add column if not exists tags text[] not null default '{}';
alter table portal_pessoas add column if not exists observacoes text;
alter table portal_pessoas add column if not exists status text not null default 'ativo';

-- Índice único (necessário pro ON CONFLICT do trigger).
-- Se houver telefone duplicado na mesma loja, mantém o registro
-- mais recente e soma nada (avisa no final).
do $$
begin
  begin
    create unique index if not exists uq_pessoas_loja_tel on portal_pessoas (loja_id, telefone);
  exception when others then
    delete from portal_pessoas p using portal_pessoas p2
    where p.loja_id = p2.loja_id and p.telefone = p2.telefone
      and p.atualizado_em < p2.atualizado_em;
    create unique index if not exists uq_pessoas_loja_tel on portal_pessoas (loja_id, telefone);
    raise notice 'portal_pessoas tinha duplicados; mantive os registros mais recentes.';
  end;
end $$;

-- ------------------------------------------------------------
-- 5. REGRAS / TEMPLATES / DISPAROS (cria só se ainda não existem)
-- ------------------------------------------------------------
create table if not exists portal_categoria_regras (
  id            bigint generated always as identity primary key,
  loja_id       bigint references portal_lojas(id) on delete cascade,
  saudade_dias  int not null default 31,
  inativo_dias  int not null default 90,
  unique (loja_id)
);
insert into portal_categoria_regras (loja_id, saudade_dias, inativo_dias)
select null, 31, 90
where not exists (select 1 from portal_categoria_regras where loja_id is null);

create table if not exists portal_mensagem_templates (
  id        bigint generated always as identity primary key,
  loja_id   bigint references portal_lojas(id) on delete cascade,
  categoria text not null,
  texto     text not null,
  ativo     boolean not null default true
);
insert into portal_mensagem_templates (categoria, texto)
select v.categoria, v.texto from (values
  ('novo','Oi {nome}! Aqui é da {loja} 😊 Vimos que você passou por aqui pela primeira vez. Seja muito bem-vindo(a)!'),
  ('novo','Olá {nome}, tudo bem? Obrigado pela visita à {loja}! Esperamos te ver de novo em breve 🙌'),
  ('novo','{nome}, foi um prazer te receber na {loja}! Fica ligado(a) que sempre tem novidade por aqui.'),
  ('novo','Oi {nome}! Passando pra agradecer a visita à {loja}. Volte sempre! 😉'),
  ('recorrente','{nome}, você é de casa! 😄 Obrigado por sempre escolher a {loja}.'),
  ('recorrente','Oi {nome}! A {loja} agradece a preferência de sempre. Bora marcar a próxima?'),
  ('recorrente','Fala {nome}! Cliente fiel como você merece atenção especial da {loja} 🤝'),
  ('recorrente','{nome}, sempre bom te ver por aqui! A equipe da {loja} manda um abraço.'),
  ('saudade','Oi {nome}, sentimos sua falta na {loja}! 🥺 Aparece pra gente matar a saudade.'),
  ('saudade','{nome}, faz um tempinho que você não aparece na {loja}... Bora remediar isso? 😄'),
  ('saudade','Fala {nome}! A {loja} tá com saudade. Passa aqui essa semana!'),
  ('saudade','Oi {nome}! Sumiu, hein? 😅 A {loja} te espera de braços abertos.'),
  ('inativo','Oi {nome}! Há quanto tempo! A {loja} mudou umas coisas por aqui e queremos te mostrar. Aparece!'),
  ('inativo','{nome}, sentimos MUITO a sua falta na {loja}. Que tal voltar essa semana? 😊'),
  ('inativo','Fala {nome}! Faz tempo que você não vem na {loja}. Temos novidades que você vai gostar!'),
  ('inativo','Oi {nome}, a {loja} não esqueceu de você! Volta pra gente? 🙏'),
  ('aniversario','Parabéns, {nome}!! 🎉🎂 A {loja} te deseja um dia incrível. Passa aqui pra comemorar com a gente!'),
  ('aniversario','Feliz aniversário, {nome}! 🥳 A equipe da {loja} manda um abraço enorme!'),
  ('aniversario','{nome}, hoje o dia é seu! 🎈 Parabéns da equipe da {loja}. Vem comemorar com a gente!'),
  ('aniversario','Oi {nome}! 🎂 A {loja} veio te desejar um feliz aniversário. Muitas felicidades!')
) as v(categoria, texto)
where not exists (select 1 from portal_mensagem_templates t
                  where t.categoria = v.categoria and t.loja_id is null);

create table if not exists portal_disparos (
  id         bigint generated always as identity primary key,
  loja_id    bigint references portal_lojas(id) on delete cascade,
  pessoa_id  bigint references portal_pessoas(id) on delete cascade,
  categoria  text not null,
  mensagem   text not null,
  status     text not null default 'pendente',
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists idx_disparos_loja_status on portal_disparos (loja_id, status);

-- ------------------------------------------------------------
-- 6. USUÁRIOS DO PAINEL (auth -> loja) — base do RLS
-- ------------------------------------------------------------
create table if not exists portal_usuarios (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  loja_id  bigint references portal_lojas(id) on delete set null,
  papel    text not null default 'cliente' check (papel in ('admin','cliente')),
  criado_em timestamptz not null default now()
);

create or replace function portal_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from portal_usuarios where user_id = auth.uid() and papel = 'admin');
$$;

create or replace function portal_minha_loja() returns bigint
language sql stable security definer set search_path = public as $$
  select loja_id from portal_usuarios where user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    ⚠️ Antes de rodar: confirme que o MOTOR no Railway usa a
--    service_role key (ela ignora RLS). Painéis antigos só
--    voltam a ver dados depois do insert em portal_usuarios.
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
  using (portal_eh_admin() or id = portal_minha_loja());
create policy mod_portal_lojas on portal_lojas for update to authenticated
  using (portal_eh_admin() or id = portal_minha_loja())
  with check (portal_eh_admin() or id = portal_minha_loja());
create policy adm_ins_lojas on portal_lojas for insert to authenticated with check (portal_eh_admin());
create policy adm_del_lojas on portal_lojas for delete to authenticated using (portal_eh_admin());

create policy sel_portal_acessos on portal_acessos for select to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja());
create policy sel_portal_leads on portal_leads for select to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja());

create policy sel_portal_pessoas on portal_pessoas for select to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja());
create policy mod_portal_pessoas on portal_pessoas for update to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja())
  with check (portal_eh_admin() or loja_id = portal_minha_loja());

create policy sel_portal_categoria_regras on portal_categoria_regras for select to authenticated
  using (portal_eh_admin() or loja_id is null or loja_id = portal_minha_loja());
create policy mod_portal_categoria_regras on portal_categoria_regras for all to authenticated
  using (portal_eh_admin()) with check (portal_eh_admin());

create policy sel_portal_mensagem_templates on portal_mensagem_templates for select to authenticated
  using (portal_eh_admin() or loja_id is null or loja_id = portal_minha_loja());
create policy mod_portal_mensagem_templates on portal_mensagem_templates for all to authenticated
  using (portal_eh_admin()) with check (portal_eh_admin());

create policy sel_portal_disparos on portal_disparos for select to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja());
create policy mod_portal_disparos on portal_disparos for update to authenticated
  using (portal_eh_admin() or loja_id = portal_minha_loja())
  with check (portal_eh_admin() or loja_id = portal_minha_loja());

create policy sel_portal_usuarios on portal_usuarios for select to authenticated
  using (user_id = auth.uid() or portal_eh_admin());
create policy adm_portal_usuarios on portal_usuarios for all to authenticated
  using (portal_eh_admin()) with check (portal_eh_admin());

-- ------------------------------------------------------------
-- 8. TRIGGER: lead novo -> consolida em portal_pessoas
--    (aniversario vai pra COLUNA, formato AAAA-MM-DD)
-- ------------------------------------------------------------
create or replace function portal_lead_para_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tel text; v_aniv text;
begin
  v_tel := nullif(regexp_replace(coalesce(new.telefone,
             new.dados->>'telefone', new.dados->>'whatsapp', new.dados->>'celular', ''),
             '\D', '', 'g'), '');
  if v_tel is null then return new; end if;

  v_aniv := coalesce(new.dados->>'aniversario', null);
  if v_aniv !~ '^\d{4}-\d{2}-\d{2}$' then v_aniv := null; end if;

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

drop trigger if exists trg_lead_pessoa on portal_leads;
create trigger trg_lead_pessoa after insert on portal_leads
  for each row execute function portal_lead_para_pessoa();

-- ------------------------------------------------------------
-- 9. MENSAGEM COM ROTAÇÃO
-- ------------------------------------------------------------
create or replace function portal_montar_msg(p_pessoa_id bigint, p_categoria text) returns text
language plpgsql security definer set search_path = public as $$
declare v_texto text; v_nome text; v_loja text; v_loja_id bigint;
begin
  select coalesce(split_part(p.nome,' ',1),'cliente'), l.nome, p.loja_id
    into v_nome, v_loja, v_loja_id
  from portal_pessoas p join portal_lojas l on l.id = p.loja_id
  where p.id = p_pessoa_id;

  select texto into v_texto from portal_mensagem_templates
  where categoria = p_categoria and ativo
    and (loja_id = v_loja_id or loja_id is null)
  order by (loja_id is not null) desc, random() limit 1;

  return replace(replace(coalesce(v_texto,''), '{nome}', coalesce(v_nome,'cliente')), '{loja}', coalesce(v_loja,''));
end $$;

-- ------------------------------------------------------------
-- 10. RECÁLCULO DIÁRIO + ANIVERSÁRIO (usa a COLUNA aniversario)
-- ------------------------------------------------------------
create or replace function portal_recalcular_categorias() returns void
language plpgsql security definer set search_path = public as $$
begin
  update portal_pessoas p set categoria = sub.cat, atualizado_em = now()
  from (
    select p2.id,
      case
        when current_date - p2.ultima_visita >= coalesce(r.inativo_dias, g.inativo_dias, 90) then 'inativo'
        when current_date - p2.ultima_visita >= coalesce(r.saudade_dias, g.saudade_dias, 31) then 'saudade'
        when p2.total_visitas > 1 then 'recorrente'
        else 'novo'
      end as cat
    from portal_pessoas p2
    left join portal_categoria_regras r on r.loja_id = p2.loja_id
    left join portal_categoria_regras g on g.loja_id is null
  ) sub
  where sub.id = p.id and p.categoria is distinct from sub.cat;

  insert into portal_disparos (loja_id, pessoa_id, categoria, mensagem)
  select p.loja_id, p.id, 'aniversario', portal_montar_msg(p.id, 'aniversario')
  from portal_pessoas p
  where p.aniversario ~ '^\d{4}-\d{2}-\d{2}$'
    and substring(p.aniversario, 6, 5) = to_char(current_date, 'MM-DD')
    and coalesce(p.status,'ativo') <> 'bloqueado'
    and not exists (
      select 1 from portal_disparos d
      where d.pessoa_id = p.id and d.categoria = 'aniversario'
        and date_part('year', d.criado_em) = date_part('year', current_date)
    );
end $$;

-- ------------------------------------------------------------
-- 11. VIEW DA ABA MENSAGENS
-- ------------------------------------------------------------
create or replace view portal_disparos_prontos as
select d.id, d.loja_id, d.categoria, d.mensagem, d.status, d.criado_em,
       p.nome, p.telefone, p.total_visitas, p.ultima_visita
from portal_disparos d
join portal_pessoas p on p.id = d.pessoa_id
where d.status = 'pendente' and coalesce(p.status,'ativo') <> 'bloqueado';

-- ------------------------------------------------------------
-- 12. CRON DIÁRIO (07:00 BRT = 10:00 UTC)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'conectay_categorias') then
    perform cron.unschedule('conectay_categorias');
  end if;
  perform cron.schedule('conectay_categorias', '0 10 * * *', 'select portal_recalcular_categorias()');
end $$;

-- ------------------------------------------------------------
-- 13. DASHBOARD (p_loja BIGINT — todos os KPIs em 1 chamada)
-- ------------------------------------------------------------
drop function if exists portal_dashboard(uuid);
create or replace function portal_dashboard(p_loja bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not (portal_eh_admin() or p_loja = portal_minha_loja()) then
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
-- DEPOIS DE RODAR (obrigatório pro painel voltar a ver dados):
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
