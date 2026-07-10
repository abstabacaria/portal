require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { validateCode, logAccess } = require('./db');
const { renderPortal, renderResult } = require('./views');

const app = express();
app.use(express.urlencoded({ extended: false }));

// Parser de cookie leve (evita dependência extra).
app.use((req, _res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
});
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

const {
  PORT = 8080,
  AP_SECRET = '',
  SESSION_TIMEOUT = '10800',
  IDLE_TIMEOUT = '900',
  DOWNLOAD_KBPS = '0',
  UPLOAD_KBPS = '0',
  INSTAGRAM_URL = 'https://instagram.com/absolem',
  REDIRECT_AFTER = '',
} = process.env;

/* -------------------------------------------------------------------------
   PROTOCOLO INTELBRAS ZEUS OS — Captive Portal Externo (modo "Externo")
   1) O AP redireciona o cliente para cá (GET) com os parâmetros do device.
   2) Mostramos a página (seguir Instagram + digitar código).
   3) Ao aprovar, montamos a URL de liberação (redirect_uri do AP) com o
      token HMAC-SHA256 e mandamos o navegador do cliente para lá.
   Referência: "Especificações do Captive Portal Externo v2.0".
   ------------------------------------------------------------------------- */

// Parâmetros que o AP envia e que precisamos carregar adiante.
function extractApParams(src) {
  return {
    continue: src.continue || REDIRECT_AFTER || '',
    ip: src.ip || '',
    ap_mac: src.ap_mac || '',
    mac: src.mac || '',
    radio: src.radio || '',
    ssid: src.ssid || '',
    ts: src.ts || '',
    redirect_uri: src.redirect_uri || '',
    user_hash: src.user_hash || '',
  };
}

// Monta a URL de liberação de volta para o AP, com token de segurança.
function buildReleaseUrl(p) {
  const ts = p.ts || String(Math.floor(Date.now() / 1000));
  const userContext = `${p.user_hash}|${ts}`;
  const token = AP_SECRET
    ? crypto.createHmac('sha256', AP_SECRET).update(userContext).digest('hex')
    : '';

  const params = new URLSearchParams();
  if (p.continue) params.set('continue', p.continue);
  params.set('ts', ts);
  if (token) params.set('token', token);
  params.set('user_hash', p.user_hash);
  params.set('session_timeout', SESSION_TIMEOUT);
  params.set('idle_timeout', IDLE_TIMEOUT);
  params.set('download_kbps', DOWNLOAD_KBPS);
  params.set('upload_kbps', UPLOAD_KBPS);

  return `${p.redirect_uri}?${params.toString()}`;
}

// Página inicial — o AP redireciona o cliente para cá (GET).
app.get('/', (req, res) => {
  const p = extractApParams(req.query);
  // Guardamos os parâmetros do AP em cookie curto para reusar no POST.
  res.setHeader('Set-Cookie',
    `apx=${encodeURIComponent(JSON.stringify(p))}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  res.send(renderPortal({ ap: p, instagram: INSTAGRAM_URL, error: null }));
});

// Envio do formulário (código digitado).
app.post('/auth', async (req, res) => {
  let ap;
  try { ap = JSON.parse(req.cookies.apx || '{}'); } catch { ap = {}; }
  ap = extractApParams({ ...ap, ...req.body }); // body pode reenviar campos ocultos

  const code = String(req.body.code || '').trim().toUpperCase();
  const base = { code, client_mac: ap.mac, ap_mac: ap.ap_mac, ssid: ap.ssid, user_hash: ap.user_hash };

  if (!code) {
    await logAccess({ ...base, result: 'denied', reason: 'Código vazio' });
    return res.send(renderPortal({ ap, instagram: INSTAGRAM_URL, error: 'Digite o código para liberar o Wi-Fi.' }));
  }

  if (!ap.redirect_uri) {
    // Sem redirect_uri não há como liberar — provavelmente acesso fora do fluxo do AP.
    await logAccess({ ...base, result: 'denied', reason: 'Sem redirect_uri (fora do AP)' });
    return res.send(renderResult({
      ok: false,
      title: 'Abra pelo Wi-Fi da loja',
      msg: 'Esta página precisa ser aberta ao conectar na rede da Absolem. Conecte-se ao Wi-Fi e tente de novo.',
    }));
  }

  let outcome;
  try {
    outcome = await validateCode(code);
  } catch (err) {
    console.error('[auth] Erro no SQL:', err.message);
    await logAccess({ ...base, result: 'denied', reason: 'Erro no banco' });
    return res.send(renderPortal({ ap, instagram: INSTAGRAM_URL, error: 'Sistema indisponível no momento. Tente novamente em instantes.' }));
  }

  if (!outcome.granted) {
    await logAccess({ ...base, result: 'denied', reason: outcome.reason });
    return res.send(renderPortal({ ap, instagram: INSTAGRAM_URL, error: `Código inválido: ${outcome.reason.toLowerCase()}.` }));
  }

  // Liberado! Registra e manda o navegador de volta ao AP para soltar a internet.
  await logAccess({ ...base, result: 'granted', reason: outcome.reason });
  const releaseUrl = buildReleaseUrl(ap);
  res.setHeader('Set-Cookie', 'apx=; HttpOnly; Path=/; Max-Age=0');
  return res.redirect(302, releaseUrl);
});

// Saúde do serviço (útil pra monitorar na VPS).
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, () => {
  console.log(`[absolem] Autenticador ouvindo na porta ${PORT}`);
  if (!AP_SECRET) console.warn('[absolem] AVISO: AP_SECRET vazio — configure a mesma senha no AP para segurança.');
});
