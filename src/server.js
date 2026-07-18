require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { validateCode, logAccess, getMetrics } = require('./db');
const { lojaPorDominio, lojaPorSlug, validarCodigoDaLoja, registrarAcesso } = require('./lojas');
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
  AUTO_CODE = 'ABSOLEM',
  METRICS_KEY = '',
} = process.env;

// Extrai o @handle do Instagram e monta o link do APP (deep link) + fallback web.
const IG_HANDLE = (INSTAGRAM_URL || '')
  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  .replace(/[\/?#].*$/, '')
  .replace(/^@/, '') || 'abstabacaria';
const IG_APP_LINK = 'instagram://user?username=' + IG_HANDLE;
const IG_WEB_LINK = 'https://instagram.com/' + IG_HANDLE;

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
    loja: src.loja || '',
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

// Acha a loja: primeiro por ?loja=slug (teste sem domínio), senão pelo domínio.
// O slug, quando usado, precisa "grudar" nos próximos passos — por isso ele
// também entra no cookie e nos campos ocultos do form.
async function acharLoja(req) {
  const slug = (req.query && req.query.loja) || (req.body && req.body.loja) || '';
  if (slug) {
    const l = await lojaPorSlug(slug);
    if (l) return l;
  }
  return await lojaPorDominio(req.headers.host);
}

// Constrói a \"marca\" a partir da loja achada pelo domínio.
// Se não achar (ex: domínio novo ainda não cadastrado), usa o padrão da Absolem
// pra nunca deixar o cliente na mão.
function marcaDaLoja(loja, host) {
  if (loja) {
    const ig = String(loja.instagram || '').replace(/^@/, '');
    return {
      nome: loja.nome || 'Wi-Fi',
      instagram: ig ? 'https://instagram.com/' + ig : INSTAGRAM_URL,
      igHandle: ig || IG_HANDLE,
      cor: loja.cor || '#ff6a1a',
      logo: loja.logo_url || '/static/logo.png',
      mensagem: loja.mensagem || '',
      autoCode: loja.codigo_wifi || AUTO_CODE,   // liberação automática: nunca deixa vazio
      apSecret: loja.ap_secret || AP_SECRET,
      destinoTipo: loja.destino_tipo || 'instagram',
      whatsappLink: loja.whatsapp_link || '',
      ativo: loja.ativo !== false,
      achou: true,
    };
  }
  return {
    nome: 'Absolem Tabacaria', instagram: INSTAGRAM_URL, igHandle: IG_HANDLE,
    cor: '#ff6a1a', logo: '/static/logo.png', mensagem: '', autoCode: AUTO_CODE,
    apSecret: AP_SECRET, ativo: true, achou: false,
  };
}

// Página inicial — o AP redireciona o cliente para cá (GET).
app.get('/', async (req, res) => {
  const p = extractApParams(req.query);
  let loja = null;
  try { loja = await acharLoja(req); } catch (e) { console.error('[get] acharLoja:', e.message); }
  const marca = marcaDaLoja(loja, req.headers.host);
  if (req.query && req.query.loja) p.loja = req.query.loja;  // carrega o slug adiante

  // loja cadastrada mas DESLIGADA no painel: portal fora do ar
  if (marca.achou && !marca.ativo) {
    return res.send(renderResult({
      ok: false,
      title: marca.nome,
      msg: 'O Wi-Fi deste local está temporariamente indisponível. Tente novamente mais tarde.',
    }));
  }

  res.setHeader('Set-Cookie',
    `apx=${encodeURIComponent(JSON.stringify(p))}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  res.send(renderPortal({ ap: p, instagram: marca.instagram, autoCode: marca.autoCode, error: null, marca }));
});

// Envio do formulário (código digitado).
app.post('/auth', async (req, res) => {
  try {
    let ap;
    try { ap = JSON.parse(req.cookies.apx || '{}'); } catch { ap = {}; }
    ap = extractApParams({ ...ap, ...req.body }); // body pode reenviar campos ocultos

    let loja = null;
    try { loja = await lojaPorDominio(req.headers.host); } catch (e) { console.error('[auth] lojaPorDominio:', e.message); }
    const marca = marcaDaLoja(loja, req.headers.host);
    const code = String(req.body.code || '').trim().toUpperCase();
    const base = { code, client_mac: ap.mac, ap_mac: ap.ap_mac, ssid: ap.ssid, user_hash: ap.user_hash };

    if (!code) {
      await logAccess({ ...base, result: 'denied', reason: 'Código vazio' });
      return res.send(renderPortal({ ap, instagram: marca.instagram, autoCode: marca.autoCode, error: 'Digite o código para liberar o Wi-Fi.', marca }));
    }

    if (!ap.redirect_uri) {
      // Sem redirect_uri não há como liberar — provavelmente acesso fora do fluxo do AP.
      await logAccess({ ...base, result: 'denied', reason: 'Sem redirect_uri (fora do AP)' });
      return res.send(renderResult({
        ok: false,
        title: 'Abra pelo Wi-Fi da loja',
        msg: 'Esta página precisa ser aberta ao conectar na rede do Wi-Fi. Conecte-se e tente de novo.',
        link: { href: '/ig', label: '📸 Ir pro Instagram assim mesmo' },
      }));
    }

    // Validação do código (que vai ESCONDIDO no botão — liberação automática).
    // - loja cadastrada com código próprio: valida contra ela.
    // - senão: basta bater com o AUTO_CODE do ambiente. NÃO depende de banco,
    //   então o portal nunca cai por causa do Supabase.
    let outcome;
    if (marca.achou && String(loja.codigo_wifi || '').trim()) {
      outcome = validarCodigoDaLoja(loja, code);
    } else {
      const esperado = String(AUTO_CODE || '').trim().toUpperCase();
      outcome = (esperado && code === esperado)
        ? { granted: true, reason: 'ok' }
        : { granted: false, reason: 'Código inválido' };
    }

    if (!outcome.granted) {
      await logAccess({ ...base, result: 'denied', reason: outcome.reason });
      return res.send(renderPortal({ ap, instagram: marca.instagram, autoCode: marca.autoCode, error: `${outcome.reason}.`, marca }));
    }

    // registra o acesso (não espera, não derruba se falhar)
    try { registrarAcesso(loja, ap.mac, /mobile|android|iphone/i.test(req.headers['user-agent']||'') ? 'celular' : 'computador'); } catch (e) {}

    // Liberado! Registra e manda o navegador de volta ao AP para soltar a internet.
    await logAccess({ ...base, result: 'granted', reason: outcome.reason });
    // Se veio do botão do Instagram, após liberar a internet o AP manda o cliente
    // para o Instagram (que abre normalmente, já com internet).
    if (req.body.go === 'instagram') {
      // Manda pro /ig do próprio portal, que abre o APP do Instagram (evita o "restrito" do navegador).
      ap.continue = 'https://' + (req.headers.host || 'wifi.absolemtabacaria.com') + '/ig';
    }
    const releaseUrl = buildReleaseUrl(ap);
    // NÃO apagamos o cookie do AP aqui: se a pessoa voltar e tocar de novo,
    // sem ele o portal não sabe o redirect_uri e cai na tela de erro.
    return res.redirect(302, releaseUrl);
  } catch (err) {
    // Rede de segurança: NADA pode fazer o portal responder 'failed to respond'.
    console.error('[auth] erro inesperado:', err && err.message);
    try {
      let ap2 = {}; try { ap2 = JSON.parse(req.cookies.apx || '{}'); } catch {}
      ap2 = extractApParams({ ...ap2, ...req.body });
      if (ap2.redirect_uri) {
        if (req.body.go === 'instagram') ap2.continue = 'https://' + (req.headers.host || 'wifi.absolemtabacaria.com') + '/ig';
        return res.redirect(302, buildReleaseUrl(ap2));  // libera assim mesmo
      }
    } catch {}
    return res.redirect(302, '/ig');
  }
});

// Saúde do serviço (útil pra monitorar na VPS).
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Página que abre o APP do Instagram (deep link), com fallback pro navegador.
app.get('/ig', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abrindo o Instagram…</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d0f;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
.box{max-width:340px}h1{font-size:20px;margin:0 0 10px}p{color:#aaa;font-size:14px;line-height:1.5;margin:0}
a{display:inline-block;margin-top:20px;background:linear-gradient(135deg,#ff6a1a,#e1306c);color:#fff;text-decoration:none;padding:15px 26px;border-radius:999px;font-weight:800;font-size:15px}</style></head>
<body><div class="box">
<h1>📸 Abrindo o Instagram…</h1>
<p>Estamos te levando pro nosso Instagram. Se não abrir sozinho, toque no botão abaixo.</p>
<a href="${IG_APP_LINK}">Abrir Instagram</a>
</div>
<script>
(function(){
  var app=${JSON.stringify(IG_APP_LINK)}, web=${JSON.stringify(IG_WEB_LINK)};
  var t=setTimeout(function(){ window.location.href=web; }, 1400);
  function cancel(){ clearTimeout(t); }
  window.addEventListener('pagehide', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) cancel(); });
  window.location.href = app;
})();
</script></body></html>`);
});

// API de métricas — protegida por METRICS_KEY, com CORS liberado para o widget.
app.get('/api/metrics', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = req.query.key || req.headers['x-metrics-key'] || '';
  if (!METRICS_KEY || key !== METRICS_KEY) {
    return res.status(401).json({ error: 'Chave inválida' });
  }
  try {
    const data = await getMetrics();
    return res.json(data);
  } catch (err) {
    console.error('[metrics] Erro:', err.message);
    return res.status(500).json({ error: 'Falha ao obter métricas' });
  }
});

app.listen(PORT, () => {
  console.log(`[absolem] Autenticador ouvindo na porta ${PORT}`);
  if (!AP_SECRET) console.warn('[absolem] AVISO: AP_SECRET vazio — configure a mesma senha no AP para segurança.');
});
