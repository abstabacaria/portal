-- ============================================================
-- CONECTAY — UNIFICAÇÃO DO DESTINO
-- Remove as colunas duplicadas que a migração v3 criou (modo,
-- destino) e passa a usar APENAS destino_tipo, que já é o padrão
-- do painel antigo e do motor em produção.
-- Valores: instagram | whatsapp | formulario | google_review
-- Também normaliza form_campos para um formato único.
-- ============================================================

-- 1. Garante que ninguém fique sem destino
update portal_lojas
   set destino_tipo = coalesce(destino_tipo, 'instagram')
 where destino_tipo is null;

-- 2. A loja de teste passa a usar formulário (o seed pedia isso)
update portal_lojas set destino_tipo = 'formulario'
 where slug = 'teste' and destino_tipo = 'instagram';

-- 3. Remove as colunas duplicadas criadas por engano na v3
alter table portal_lojas drop column if exists modo;
alter table portal_lojas drop column if exists destino;

-- 4. Campo para o link de avaliação do Google (destino_tipo='google_review')
alter table portal_lojas add column if not exists google_review_url text;

-- 5. Normaliza form_campos para o formato de ARRAY:
--    [{"campo":"nome","label":"Nome","obrigatorio":true}, ...]
--    (a Rb Embalagens está no formato objeto {"nome":{"obrig":true}})
update portal_lojas l
   set form_campos = (
     select jsonb_agg(jsonb_build_object(
              'campo', k,
              'label', initcap(replace(k,'_',' ')),
              'obrigatorio', coalesce((v->>'obrig')::boolean, (v->>'obrigatorio')::boolean, false)
            ))
     from jsonb_each(l.form_campos) as e(k,v)
   )
 where jsonb_typeof(form_campos) = 'object';

-- 6. Lojas em modo formulário sem campos definidos ganham o padrão
update portal_lojas
   set form_campos = '[{"campo":"nome","label":"Seu nome","obrigatorio":false},
                       {"campo":"telefone","label":"WhatsApp","obrigatorio":true},
                       {"campo":"aniversario","label":"Data de aniversário","obrigatorio":false}]'::jsonb
 where destino_tipo = 'formulario'
   and (form_campos is null or jsonb_array_length(coalesce(form_campos,'[]'::jsonb)) = 0);

-- 7. Conferência
select slug, nome, destino_tipo, form_titulo,
       jsonb_array_length(coalesce(form_campos,'[]'::jsonb)) as qtd_campos,
       cor, cor2, (logo_url is not null) as tem_logo
from portal_lojas order by id;
