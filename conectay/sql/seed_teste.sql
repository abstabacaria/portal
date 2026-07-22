-- ============================================================
-- CONECTAY — SEED DE TESTES (loja demo)
-- Cria a loja "Loja Teste (demo)" com:
--   ~950 acessos em 90 dias (com pico noturno e em sex/sáb)
--   48 pessoas no CRM nas 4 categorias
--   leads correspondentes (com opt-in LGPD)
--   disparos pendentes p/ testar a aba Mensagens
-- NÃO afeta Absolem, Gold Pipe nem nenhuma loja real.
-- Para apagar tudo depois: veja o bloco final do arquivo.
-- ============================================================

do $$
declare v_loja bigint;
begin

-- ------------------------------------------------------------
-- 1. LOJA DEMO
-- ------------------------------------------------------------
select id into v_loja from portal_lojas
 where slug = 'teste' or dominio = 'teste.conectay.com.br'
 order by id limit 1;
if v_loja is null then
  insert into portal_lojas (slug, nome, dominio, instagram, cor, ativo, modo, destino, criado_em)
  values ('teste', 'Loja Teste (demo)', 'teste.conectay.com.br', 'conectaywifi',
          '#0ea5e9', true, 'formulario', 'instagram', now())
  returning id into v_loja;
  raise notice 'Loja demo criada (id=%)', v_loja;
else
  -- limpa dados antigos do seed p/ não duplicar
  delete from portal_disparos where loja_id = v_loja;
  delete from portal_acessos where loja_id = v_loja;
  delete from portal_leads   where loja_id = v_loja;
  delete from portal_pessoas where loja_id = v_loja;
  raise notice 'Loja demo já existia (id=%) — dados antigos limpos', v_loja;
end if;

-- ------------------------------------------------------------
-- 2. ACESSOS — 700 base, distribuídos em 90 dias
--    horas com peso maior no fim da tarde/noite
-- ------------------------------------------------------------
insert into portal_acessos (loja_id, slug, mac, ip, user_agent, dispositivo, so, criado_em)
select v_loja, 'teste',
       'AA:BB:CC:' || lpad(to_hex((random()*255)::int),2,'0') || ':'
                   || lpad(to_hex((random()*255)::int),2,'0') || ':'
                   || lpad(to_hex((random()*255)::int),2,'0'),
       '10.0.' || (random()*250)::int || '.' || (random()*250)::int,
       case s.so
         when 'Android' then 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Mobile Safari/537.36'
         when 'iOS'     then 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
         when 'Windows' then 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0'
         else                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.5'
       end,
       case s.so when 'Android' then 'mobile' when 'iOS' then 'mobile'
                 when 'Windows' then 'desktop' else 'desktop' end,
       s.so,
       (current_date - (random()*89)::int)
         + (h.hora || ' hours')::interval
         + ((random()*59)::int || ' minutes')::interval
from generate_series(1,700) g
cross join lateral (select (array['Android','Android','Android','Android','iOS','iOS','iOS','Windows','macOS'])
                          [1+floor(random()*9)] as so) s
cross join lateral (select (array[11,12,13,14,15,16,17,17,18,18,19,19,19,20,20,20,20,21,21,22])
                          [1+floor(random()*20)] as hora) h;

-- ------------------------------------------------------------
-- 3. ACESSOS EXTRAS — só sex/sáb à noite (cria o pico visível)
-- ------------------------------------------------------------
insert into portal_acessos (loja_id, slug, mac, ip, user_agent, dispositivo, so, criado_em)
select v_loja, 'teste',
       'AA:BB:CC:' || lpad(to_hex((random()*255)::int),2,'0') || ':'
                   || lpad(to_hex((random()*255)::int),2,'0') || ':'
                   || lpad(to_hex((random()*255)::int),2,'0'),
       '10.0.' || (random()*250)::int || '.' || (random()*250)::int,
       'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
       'mobile', 'Android',
       d.dia + (array[19,20,20,21,21,22,23])[1+floor(random()*7)] * interval '1 hour'
             + ((random()*59)::int || ' minutes')::interval
from generate_series(1,250) g
cross join lateral (
  select (current_date - (random()*89)::int)::timestamp as dia
) d
where extract(isodow from d.dia) in (5,6);

-- ------------------------------------------------------------
-- 4. LEADS + CRM (48 pessoas nas 4 categorias)
--    i % 4 = 0 novo | 1 recorrente | 2 saudade | 3 inativo
--    As 3 primeiras têm aniversário HOJE (testa a aba Mensagens)
-- ------------------------------------------------------------
create temp table _seed_pessoas on commit drop as
with base(nome, telefone) as (values
  ('Ana Paula Ribeiro','21987650001'),('Bruno Carvalho','21987650002'),
  ('Camila Nogueira','21987650003'),('Diego Fontes','21987650004'),
  ('Eduarda Lima','21987650005'),('Felipe Andrade','21987650006'),
  ('Gabriela Rocha','21987650007'),('Henrique Barros','21987650008'),
  ('Isabela Martins','21987650009'),('João Pedro Alves','21987650010'),
  ('Karina Duarte','21987650011'),('Lucas Meireles','21987650012'),
  ('Mariana Cardoso','21987650013'),('Nathan Oliveira','21987650014'),
  ('Olívia Santana','21987650015'),('Pedro Henrique Sá','21987650016'),
  ('Quésia Ramos','21987650017'),('Rafael Tavares','21987650018'),
  ('Sabrina Pires','21987650019'),('Thiago Moreira','21987650020'),
  ('Ursula Campos','21987650021'),('Vinícius Prado','21987650022'),
  ('Wanessa Coelho','21987650023'),('Xavier Nunes','21987650024'),
  ('Yasmin Teixeira','21987650025'),('Zeca Monteiro','21987650026'),
  ('Amanda Vasconcelos','21987650027'),('Bernardo Cunha','21987650028'),
  ('Carla Mendonça','21987650029'),('Danilo Freitas','21987650030'),
  ('Elaine Bastos','21987650031'),('Fábio Guimarães','21987650032'),
  ('Giovana Peixoto','21987650033'),('Hugo Salgado','21987650034'),
  ('Ingrid Bezerra','21987650035'),('Jonas Correia','21987650036'),
  ('Kelly Amaral','21987650037'),('Leandro Pacheco','21987650038'),
  ('Michele Aragão','21987650039'),('Norberto Vieira','21987650040'),
  ('Patrícia Lemos','21987650041'),('Rodrigo Sampaio','21987650042'),
  ('Simone Drummond','21987650043'),('Tatiana Bicalho','21987650044'),
  ('Ulisses Rangel','21987650045'),('Viviane Portela','21987650046'),
  ('William Estrela','21987650047'),('Zilda Marcondes','21987650048')
)
select nome, telefone, i,
  case i % 4 when 0 then 'novo' when 1 then 'recorrente'
              when 2 then 'saudade' else 'inativo' end as categoria,
  case i % 4
    when 0 then current_date - (random()*9)::int
    when 1 then current_date - (random()*14)::int
    when 2 then current_date - (35 + (random()*40)::int)
    else        current_date - (95 + (random()*105)::int)
  end as ultima,
  case i % 4
    when 0 then 1
    when 1 then 4 + (random()*8)::int
    when 2 then 2 + (random()*3)::int
    else        1 + (random()*2)::int
  end as visitas,
  case when i <= 3
       then to_char(current_date, 'YYYY-MM-DD')   -- aniversário HOJE
       else to_char(date '1975-01-01' + (random()*16000)::int, 'YYYY-MM-DD')
  end as aniversario
from (select nome, telefone, row_number() over () as i from base) x;

-- 4a. Leads (o trigger, se existir, cria pessoas — corrigimos no 4b)
insert into portal_leads (loja_id, slug, nome, telefone, dados, mac, user_agent,
                          optin, optin_data, optin_texto, criado_em)
select v_loja, 'teste', p.nome, p.telefone,
       jsonb_build_object('nome', p.nome, 'telefone', p.telefone, 'aniversario', p.aniversario),
       'AA:BB:CC:00:00:' || lpad(to_hex(p.i),2,'0'),
       'Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36',
       true, p.ultima::timestamptz,
       'Aceito receber novidades da Loja Teste no WhatsApp + Política de Privacidade',
       p.ultima::timestamptz
from _seed_pessoas p;

-- 4b. CRM com os valores exatos (sobrepõe o que o trigger fez)
insert into portal_pessoas (loja_id, telefone, nome, aniversario, primeira_visita,
                            ultima_visita, total_visitas, categoria, categoria_desde,
                            atualizado_em, tags, observacoes, status)
select v_loja, p.telefone, p.nome, p.aniversario,
       p.ultima - (p.visitas * 12), p.ultima, p.visitas, p.categoria,
       p.ultima::timestamptz, now(),
       case when p.i % 7 = 0 then array['vip-teste'] when p.i % 5 = 0 then array['indicação'] else '{}'::text[] end,
       case when p.i % 9 = 0 then 'Cliente de teste com observação de exemplo.' end,
       case when p.i % 11 = 0 then 'vip' else 'ativo' end
from _seed_pessoas p
on conflict (loja_id, telefone) do update set
  nome            = excluded.nome,
  aniversario     = excluded.aniversario,
  primeira_visita = excluded.primeira_visita,
  ultima_visita   = excluded.ultima_visita,
  total_visitas   = excluded.total_visitas,
  categoria       = excluded.categoria,
  categoria_desde = excluded.categoria_desde,
  tags            = excluded.tags,
  observacoes     = excluded.observacoes,
  status          = excluded.status,
  atualizado_em   = now();

-- ------------------------------------------------------------
-- 5. DISPAROS PENDENTES (aba Mensagens)
--    Usa os templates reais quando possível; se a função tiver
--    outra assinatura, cai no texto padrão sem quebrar o script.
-- ------------------------------------------------------------
begin
  insert into portal_disparos (loja_id, pessoa_id, telefone, categoria, mensagem, status, criado_em)
  select v_loja, p.id, p.telefone,
         case when p.aniversario = to_char(current_date,'YYYY-MM-DD') then 'aniversario' else p.categoria end,
         coalesce(nullif(portal_montar_msg(v_loja,
             case when p.aniversario = to_char(current_date,'YYYY-MM-DD') then 'aniversario' else p.categoria end,
             split_part(p.nome,' ',1), 'Loja Teste (demo)'), ''),
           'Oi ' || split_part(p.nome,' ',1) || '! Mensagem de teste da Loja Teste (demo).'),
         'pendente', now()
  from portal_pessoas p
  where p.loja_id = v_loja
    and (p.categoria in ('saudade','inativo') or p.aniversario = to_char(current_date,'YYYY-MM-DD'));
exception when others then
  insert into portal_disparos (loja_id, pessoa_id, telefone, categoria, mensagem, status, criado_em)
  select v_loja, p.id, p.telefone,
         case when p.aniversario = to_char(current_date,'YYYY-MM-DD') then 'aniversario' else p.categoria end,
         case
           when p.aniversario = to_char(current_date,'YYYY-MM-DD')
             then 'Parabéns, ' || split_part(p.nome,' ',1) || '!! 🎉🎂 A Loja Teste te deseja um dia incrível!'
           when p.categoria = 'saudade'
             then 'Oi ' || split_part(p.nome,' ',1) || ', sentimos sua falta na Loja Teste! 🥺 Aparece pra gente.'
           else 'Oi ' || split_part(p.nome,' ',1) || '! Há quanto tempo! A Loja Teste tem novidades pra você.'
         end,
         'pendente', now()
  from portal_pessoas p
  where p.loja_id = v_loja
    and (p.categoria in ('saudade','inativo') or p.aniversario = to_char(current_date,'YYYY-MM-DD'));
  raise notice 'portal_montar_msg com assinatura diferente — usei mensagens padrão.';
end;

raise notice 'Seed concluído na loja demo (id=%)', v_loja;
end $$;

-- ------------------------------------------------------------
-- 6. RELATÓRIO DO QUE FOI CRIADO
-- ------------------------------------------------------------
with l as (
  select id, nome from portal_lojas
  where slug='teste' or dominio='teste.conectay.com.br'
  order by id limit 1
)
select 'Loja' as item, (select nome from l) as detalhe, (select id from l)::text as valor
union all
select 'Acessos', 'total (90 dias)', count(*)::text
  from portal_acessos where loja_id = (select id from l)
union all
select 'Acessos', 'hoje', count(*)::text
  from portal_acessos where loja_id = (select id from l) and criado_em::date = current_date
union all
select 'Acessos', 'MACs unicos', count(distinct mac)::text
  from portal_acessos where loja_id = (select id from l)
union all
select 'Leads', 'total', count(*)::text
  from portal_leads where loja_id = (select id from l)
union all
select 'CRM', 'pessoas: ' || categoria, count(*)::text
  from portal_pessoas where loja_id = (select id from l) group by categoria
union all
select 'Mensagens', 'disparos pendentes', count(*)::text
  from portal_disparos where loja_id = (select id from l) and status = 'pendente';

-- ============================================================
-- PARA APAGAR TODO O TESTE DEPOIS (rode este bloco separado):
--
-- do $$ declare v bigint; begin
--   select id into v from portal_lojas where slug='teste' or dominio='teste.conectay.com.br' order by id limit 1;
--   delete from portal_disparos where loja_id=v;
--   delete from portal_acessos  where loja_id=v;
--   delete from portal_leads    where loja_id=v;
--   delete from portal_pessoas  where loja_id=v;
--   delete from portal_lojas    where id=v;
-- end $$;
-- ============================================================
