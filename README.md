# Autenticador — Captive Portal Absolem Tabacaria

Servidor de **Captive Portal Externo** para o **Intelbras AP 360 (Zeus OS)**,
usando **Supabase (PostgreSQL)** como banco.

Fluxo: pessoa conecta no Wi-Fi → esta página abre → ela segue o Instagram e
digita um **código** → o código é validado no **Supabase** → a internet libera.

Sem serviço pago, sem RADIUS.

---

## Como funciona (protocolo Zeus OS)

1. O AP redireciona o cliente para este servidor com `mac`, `user_hash`,
   `redirect_uri` (endereço que "libera"), `continue` (URL original), etc.
2. Mostramos a página da Absolem (seguir Instagram + digitar código).
3. O código é validado pela função `validate_code()` no Supabase.
4. Se aprovado, redirecionamos o navegador de volta ao AP (`redirect_uri`)
   com um **token HMAC-SHA256** → o AP libera o acesso.

---

## 1. Preparar o Supabase

1. No painel do Supabase, abra **SQL Editor** e rode o `database.sql`
   (cria `access_codes`, `access_log` e a função `validate_code`, com 2
   códigos de exemplo: `ABSOLEM` e `STORIES50`).
2. Pegue a connection string: **Project Settings › Database › Connection string › URI**.
   Use a porta **6543** (Transaction Pooler) — melhor para hospedagens free.

## 2. Instalar o app

```bash
npm install
cp .env.example .env
# edite o .env: DATABASE_URL (Supabase), AP_SECRET, INSTAGRAM_URL, REDIRECT_AFTER
npm start        # local; em produção use PM2 ou o painel do serviço
```

Teste: `http://SEU_HOST:8080/health` deve responder `{"ok":true}`.

---

## 3. Onde hospedar de graça (com Supabase, dá pra hospedar em qualquer lugar)

Como o banco é o Supabase (acessível pela internet), o app pode rodar em:

- **Render.com (free)** — roda Node, conecta no Supabase fácil.
  *Porém:* no plano free o serviço "dorme" após 15 min e leva ~30s pra acordar.
  Ruim para captive portal (o cliente quer conectar na hora). Contornável com
  um "ping" periódico (cron externo) para mantê-lo acordado.
- **Railway / Fly.io (free/crédito)** — funcionam bem, sem o "dormir" tão agressivo.
- **Sua VPS** — se você tiver uma, é o mais estável (sem dormir, sem limite).

> Recomendação honesta: para captive portal, **evite serviços que "dormem"**.
> Se tiver VPS, use-a. Se não, Fly.io ou Railway tendem a ir melhor que o
> Render free; ou mantenha o Render acordado com um cron de ping a cada 10 min.

### Passos gerais para subir (ex.: Render)
1. Suba este projeto num repositório Git (GitHub).
2. No Render: **New › Web Service** → conecte o repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Em **Environment**, cole as variáveis do `.env` (DATABASE_URL, AP_SECRET, etc.).
5. Deploy. Anote a URL pública (ex.: `https://absolem-portal.onrender.com`).

---

## 4. Configurar o AP 360 (Zeus OS)

> O captive portal exige o AP em **modo Roteador + NAT**, e **direto na ONU**
> (não empilhado atrás de outro roteador), senão trava.

1. **Serviços › Captive portal** → **Habilitar** no seu SSID
2. **Endereço do captive portal externo (Autenticador):** a URL pública do app
   (ex.: `https://absolem-portal.onrender.com/`)
3. **Tipo de autenticação:** `Externo`
4. **Senha:** a MESMA string do `AP_SECRET` no `.env`
5. **Walled Garden:** libere antes do login:
   - o domínio do app
   - `instagram.com` `*.cdninstagram.com` `*.fbcdn.net` (para o botão do Instagram)
   - o domínio do seu linktree no Netlify
6. **Salvar › Aplicar alterações**

---

## 5. Gerenciar códigos (SQL Editor do Supabase)

```sql
-- Código novo ilimitado:
INSERT INTO access_codes (code, note) VALUES ('VERAO', 'Campanha verão');

-- Código com validade e limite de usos:
INSERT INTO access_codes (code, max_uses, expires_at, note)
VALUES ('PROMO100', 100, now() + interval '15 days', 'Stories 15 dias');

-- Desativar:
UPDATE access_codes SET active = false WHERE code = 'VERAO';

-- Ver acessos:
SELECT * FROM access_log ORDER BY created_at DESC LIMIT 100;
```

---

## Notas honestas

- **HTTPS:** hospedagens como Render/Railway já dão HTTPS. Ótimo, pois muitos
  celulares reclamam de captive portal em HTTP puro.
- **Instagram:** não dá para *verificar de verdade* se a pessoa seguiu (a Meta
  fechou a API). O controle real vem do **código** que você distribui.
- **AP 360:** se voltar a travar (LED vermelho), é defeito do aparelho, não do
  app. Um Mikrotik roda o mesmo conceito com mais estabilidade (adaptando a URL
  de liberação — o resto do código serve).
- **Segurança:** mantenha `AP_SECRET` forte e igual nos dois lados; e nunca
  exponha a `DATABASE_URL` no front-end.
