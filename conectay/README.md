# ConectaY 2.0 — Pacote completo de implantação

Estrutura do pacote:

```
conectay/
├── sql/schema_conectay.sql   → rodar no Supabase (SQL Editor)
├── motor/                    → subir no Railway (projeto zucchini-abundance, serviço "portal")
│   ├── server.js  views.js  lojas.js  db.js  package.json
├── painel/index.html         → GitHub Pages (painel.conectay.com.br)
└── site/                     → Cloudflare Pages (conectay.com.br)
    ├── index.html  privacidade.html
```

## O que há de novo nesta versão

1. **RLS de verdade** — cada cliente só enxerga a própria loja no banco (fecha o furo do filtro client-side). Nova tabela `portal_usuarios` liga o login ao papel (admin/cliente) e à loja.
2. **Dashboard turbinado** — função `portal_dashboard()` devolve todos os KPIs em 1 chamada: visitas hoje/mês, únicos, recorrentes, crescimento vs mês anterior, horários de pico, dias da semana, dispositivos e SO (o motor agora grava o user-agent).
3. **Destino configurável pós-login** — Instagram, **Avaliação no Google ⭐** ou site da loja (aba Aparência).
4. **CRM ampliado** — tags, observações e status (ativo/vip/bloqueado) por lead + **exportar CSV**.
5. **Painel único** — admin e cliente no mesmo index.html; admin tem seletor de loja + aba de criação de lojas (campo domínio com sufixo `.conectay.com.br` e detecção de domínio próprio).
6. Tudo que já existia mantido: modo Formulário com opt-in LGPD, consolidação por telefone, categorias novo/recorrente/saudade/inativo, aniversário 1x/ano, rotação de templates, disparo manual 1-a-1 via wa.me.

## Ordem de implantação

### 1) Supabase (5 min)
1. SQL Editor → cole `sql/schema_conectay.sql` inteiro → Run. É idempotente (pode rodar de novo sem quebrar nada que já existe).
2. Authentication → Users → confirme/crie: seu usuário (admin) e o de cada cliente.
3. Pegue o UUID de cada usuário e rode:
   ```sql
   insert into portal_usuarios (user_id, papel) values ('<SEU-UUID>', 'admin')
     on conflict (user_id) do update set papel='admin';
   insert into portal_usuarios (user_id, loja_id, papel)
     values ('<UUID-CLIENTE>', (select id from portal_lojas where slug='absolem'), 'cliente')
     on conflict (user_id) do update set loja_id=excluded.loja_id;
   ```
4. Se as lojas ainda não existem:
   ```sql
   insert into portal_lojas (slug, nome, dominio, instagram, modo)
   values ('absolem','Absolem Tabacaria','absolem.conectay.com.br','abstabacaria','formulario'),
          ('goldpipe','Gold Pipe','goldpipe.conectay.com.br',null,'formulario')
   on conflict (slug) do nothing;
   ```

### 2) Railway (motor)
1. Substitua os 5 arquivos da pasta `motor/` no repositório do serviço **portal**.
2. Variables — confira/adicione:
   - `SUPABASE_URL` = https://iekxuehdrxsimqtfejxm.supabase.co
   - `SUPABASE_SERVICE_KEY` = **service_role** key (Settings → API). ⚠️ Nunca a anon.
   - `AP_SECRET` = (já existe)
   - `AUTO_CODE` = ABSOLEM (já existe)
3. Deploy. Teste: `https://absolem.conectay.com.br/health` deve responder `{"ok":true,...}`.

### 3) Painel (GitHub Pages)
1. Abra `painel/index.html` e cole sua **anon key** na constante `SUPABASE_ANON_KEY` (linha ~380). A anon key é pública — o RLS é quem protege.
2. Suba no repositório do GitHub Pages.
3. DNS: crie o CNAME `painel.conectay.com.br` → `abstabacaria.github.io` no Cloudflare (proxy desligado/cinza para o GitHub emitir o certificado) e configure o custom domain no repositório.

### 4) Site (Cloudflare Pages)
Suba `site/index.html` e `site/privacidade.html`. A página fica em `conectay.com.br/privacidade` (Cloudflare Pages serve `/privacidade.html` nesse caminho automaticamente).

> No botão "Quero na minha loja" do index, complete o número do WhatsApp comercial no link `wa.me/5521...`.

### 5) Ativar o modo Formulário na Absolem
No painel → Aparência → Modo: **Formulário** → Salvar. A partir daí `portal_leads` começa a encher e a segmentação liga de verdade.

### 6) Teste ponta a ponta
1. Celular no Wi-Fi da loja → portal abre → preencher nome + WhatsApp + aniversário + aceitar → conectar.
2. Conferir: lead na aba Leads, visita no Dashboard, redirecionamento pro destino configurado.
3. No Supabase: `select * from portal_pessoas order by id desc limit 5;`
4. Simular aniversário: mude `dados->>'aniversario'` de um lead pra hoje e rode `select portal_recalcular_categorias();` → mensagem deve aparecer na aba Mensagens.

## Segurança — resumo
- Motor usa **service_role** (só no Railway, nunca no front).
- Painel usa **anon key + RLS**: cliente lê/edita apenas a própria loja; admin lê tudo.
- Consentimento LGPD gravado com data e texto no lead.
- `AP_SECRET` valida chamadas do AP em `/auth`.

## Próximos passos sugeridos (Fase 2)
- Pesquisa NPS pós-login (1 pergunta antes do sucesso).
- Cartão fidelidade digital ("na 10ª visita ganhe X") — as visitas já são contadas.
- 3 templates visuais de portal na aba Aparência.
