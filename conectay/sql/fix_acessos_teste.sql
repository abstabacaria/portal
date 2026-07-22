-- ============================================================
-- CONECTAY — CORREÇÃO DOS ACESSOS DA LOJA TESTE
-- Regera só os acessos (leads, CRM e disparos ficam intactos).
-- Corrige: SO/dispositivo/hora variados de verdade + pico
-- em sexta e sábado à noite + ~250 MACs únicos.
-- ============================================================

do $$
declare v_loja bigint; v_qtd int;
begin
  select id into v_loja from portal_lojas
   where slug='teste' or dominio='teste.conectay.com.br' order by id limit 1;
  if v_loja is null then raise exception 'Loja de teste não encontrada'; end if;

  delete from portal_acessos where loja_id = v_loja;

  -- ---- Base: 700 acessos em 90 dias ----
  insert into portal_acessos (loja_id, slug, mac, ip, user_agent, dispositivo, so, criado_em)
  select v_loja, 'teste',
    'AA:BB:CC:00:' || lpad(to_hex(t.dev/256),2,'0') || ':' || lpad(to_hex(t.dev%256),2,'0'),
    '10.0.' || (t.dev % 250) || '.' || (t.n % 250),
    case t.so
      when 'Android' then 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Mobile Safari/537.36'
      when 'iOS'     then 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      when 'Windows' then 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0'
      else                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.5'
    end,
    case t.so when 'Android' then 'mobile' when 'iOS' then 'mobile'
              when 'Windows' then 'desktop' else 'desktop' end,
    t.so,
    t.dia + (t.hora || ' hours')::interval + (t.minuto || ' minutes')::interval
  from (
    select g as n,
      (random()*249)::int as dev,
      (array['Android','Android','Android','Android','Android',
             'iOS','iOS','iOS','Windows','macOS'])[1+floor(random()*10)] as so,
      (array[11,12,13,14,15,16,17,17,18,18,19,19,19,
             20,20,20,20,21,21,22])[1+floor(random()*20)] as hora,
      (random()*59)::int as minuto,
      (current_date - (random()*89)::int)::timestamp as dia
    from generate_series(1,700) g
  ) t;

  -- ---- Pico: 10 acessos extras por sexta e sábado à noite ----
  insert into portal_acessos (loja_id, slug, mac, ip, user_agent, dispositivo, so, criado_em)
  select v_loja, 'teste',
    'AA:BB:CC:00:' || lpad(to_hex(t.dev/256),2,'0') || ':' || lpad(to_hex(t.dev%256),2,'0'),
    '10.0.' || (t.dev % 250) || '.99',
    case t.so
      when 'Android' then 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Mobile Safari/537.36'
      when 'iOS'     then 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      else                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0'
    end,
    case t.so when 'Windows' then 'desktop' else 'mobile' end,
    t.so,
    t.dia + (t.hora || ' hours')::interval + (t.minuto || ' minutes')::interval
  from (
    select d.dia,
      (random()*249)::int as dev,
      (array['Android','Android','Android','iOS','iOS','Windows'])[1+floor(random()*6)] as so,
      (array[19,20,20,21,21,22,23])[1+floor(random()*7)] as hora,
      (random()*59)::int as minuto
    from (
      select (current_date - s)::timestamp as dia
      from generate_series(0,89) s
      where extract(isodow from current_date - s) in (5,6)
    ) d
    cross join generate_series(1,10) k
  ) t;

  select count(*) into v_qtd from portal_acessos where loja_id = v_loja;
  raise notice 'Acessos regerados: % linhas na loja %', v_qtd, v_loja;
end $$;

-- ---- Conferência ----
with l as (
  select id from portal_lojas
  where slug='teste' or dominio='teste.conectay.com.br' order by id limit 1
)
select 'Total acessos' as item, count(*)::text as valor from portal_acessos where loja_id=(select id from l)
union all
select 'MACs unicos', count(distinct mac)::text from portal_acessos where loja_id=(select id from l)
union all
select 'SO: '||coalesce(so,'?'), count(*)::text from portal_acessos where loja_id=(select id from l) group by so
union all
select 'Dispositivo: '||coalesce(dispositivo,'?'), count(*)::text from portal_acessos where loja_id=(select id from l) group by dispositivo
union all
select 'Dia semana '||extract(isodow from criado_em)::text, count(*)::text from portal_acessos where loja_id=(select id from l) group by 1;
