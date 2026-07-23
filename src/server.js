require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { validateCode, logAccess, getMetrics } = require('./db');
const {
  lojaPorDominio, lojaPorSlug, validarCodigoDaLoja,
  registrarAcesso, registrarLead, visitaDispositivo, marcarCadastrado,
} = require('./lojas');
const { renderPortal, renderResult, renderPronto, renderPrivacidade, montarVcard } = require('./views');

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
   2) Mostramos a página (seguir Instagram / grupo / formulário).
   3) Ao aprovar, montamos a URL de liberação (redirect_uri do AP) com o
      token HMAC-SHA256 e mandamos o navegador do cliente para lá.
   Referência: "Especificações do Captive Portal Externo v2.0".
   NÃO ALTERAR sem testar num AP real — é isso que solta a internet.
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
async function acharLoja(req) {
  const slug = (req.query && req.query.loja) || (req.body && req.body.loja) || '';
  if (slug) {
    const l = await lojaPorSlug(slug);
    if (l) return l;
  }
  return await lojaPorDominio(req.headers.host);
}

// Constrói a "marca" a partir da loja achada pelo domínio.
// Se não achar, devolve uma marca NEUTRA do ConectaY — nunca mais a de outro
// cliente (antes caía na Absolem e mostrava a marca errada no portal alheio).
function marcaDaLoja(loja) {
  if (loja) {
    const ig = String(loja.instagram || '').replace(/^@/, '');
    return {
      nome: loja.nome || 'Wi-Fi',
      instagram: ig ? 'https://instagram.com/' + ig : '',
      igHandle: ig || '',
      cor: loja.cor || '#ff6a1a',
      cor2: loja.cor2 || loja.cor || '#ff6a1a',
      corFundo: loja.cor_fundo || '#1a1512',
      corFundo2: loja.cor_fundo2 || loja.cor_fundo || '',
      corCard: loja.cor_card || '#1b1917',
      logo: loja.logo_url || '/static/logo.png',
      mensagem: loja.mensagem || '',
      autoCode: loja.codigo_wifi || AUTO_CODE,   // liberação automática: nunca deixa vazio
      apSecret: loja.ap_secret || AP_SECRET,
      destinoTipo: loja.destino_tipo || 'instagram',
      whatsappLink: loja.whatsapp_link || '',
      googleReviewUrl: loja.google_review_url || '',
      siteUrl: loja.site_url || '',
      formCampos: loja.form_campos || null,
      formTitulo: loja.form_titulo || '',
      vcardAtivo: !!loja.vcard_ativo,
      ativo: loja.ativo !== false,
      achou: true,
    };
  }
  return {
    nome: 'ConectaY', instagram: '', igHandle: '',
    cor: '#0ea5e9', cor2: '#22d3ee', corFundo: '#0a0f1e', corCard: '#101827',
    logo: 'https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png', mensagem: '', autoCode: AUTO_CODE,
    apSecret: AP_SECRET, destinoTipo: 'instagram', ativo: true, achou: false,
  };
}

// Para onde o cliente vai DEPOIS que a internet libera.
function urlDoDestino(loja, marca, host, destino) {
  const d = destino || marca.destinoTipo || 'instagram';
  if (d === 'whatsapp' && marca.whatsappLink) return marca.whatsappLink;
  if (d === 'google_review' && marca.googleReviewUrl) return marca.googleReviewUrl;
  if (d === 'site' && marca.siteUrl) return marca.siteUrl;
  if (marca.instagram) return 'https://' + host + '/ig';   // deep link do app
  return '';
}
function rotuloDoDestino(destino, marca) {
  if (destino === 'whatsapp') return '💬 Entrar no grupo';
  if (destino === 'google_review') return '⭐ Avaliar no Google';
  if (destino === 'site') return '🌐 Visitar o site';
  return '📸 Abrir o Instagram';
}

// ---------- Política de privacidade ----------
app.get('/privacidade', (_req, res) => res.send(renderPrivacidade()));

// ---------- Página inicial — o AP redireciona o cliente para cá (GET) ----------
app.get('/', async (req, res) => {
  // privacidade.conectay.com.br mostra a política, não um portal
  if (/^privacidade\./i.test(String(req.headers.host || ''))) {
    return res.send(renderPrivacidade());
  }

  const p = extractApParams(req.query);
  let loja = null;
  try { loja = await acharLoja(req); } catch (e) { console.error('[get] acharLoja:', e.message); }
  const marca = marcaDaLoja(loja);
  if (req.query && req.query.loja) p.loja = req.query.loja;  // carrega o slug adiante

  // domínio não cadastrado: avisa em vez de mostrar a marca de outra loja
  if (!marca.achou) {
    return res.status(404).send(renderResult({
      ok: false, marca,
      title: 'Portal não encontrado',
      msg: 'Este endereço ainda não está configurado. Se você é o lojista, cadastre o domínio no painel ConectaY.',
    }));
  }

  // loja cadastrada mas DESLIGADA no painel: portal fora do ar
  if (!marca.ativo) {
    return res.send(renderResult({
      ok: false, marca,
      title: marca.nome,
      msg: 'O Wi-Fi deste local está temporariamente indisponível. Tente novamente mais tarde.',
    }));
  }

  // ID de dispositivo próprio (cookie de 1 ano) — sobrevive ao MAC aleatório.
  // Se o cliente já tem, reusamos; senão, geramos um novo agora.
  let cyid = req.cookies.cyid;
  if (!cyid) cyid = crypto.randomBytes(16).toString('hex');

  // PORTAL INTELIGENTE: reconhece o aparelho por COOKIE ou MAC.
  // Se a loja não usa rotação (ou a função não existe no banco), nada muda.
  if (loja.rotacao_ativa) {
    const info = await visitaDispositivo(loja, p.mac, cyid);
    if (info && info.destino) {
      marca.destinoTipo = info.destino;
      marca.voltou = !!info.conhecido && info.destino !== 'formulario';
    }
  }

  // guarda o cyid na tela pra reenviar no POST /auth (a mini-janela do captive
  // portal nem sempre devolve cookie no POST, então mandamos também num campo)
  marca.cyid = cyid;

  const umAno = 60 * 60 * 24 * 365;
  res.setHeader('Set-Cookie', [
    `apx=${encodeURIComponent(JSON.stringify(p))}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
    `cyid=${cyid}; HttpOnly; Path=/; Max-Age=${umAno}; SameSite=Lax`,
  ]);
  res.send(renderPortal({ ap: p, instagram: marca.instagram, autoCode: marca.autoCode, error: null, marca }));
});

// ---------- Envio do formulário (código escondido no botão) ----------
app.post('/auth', async (req, res) => {
  try {
    let ap;
    try { ap = JSON.parse(req.cookies.apx || '{}'); } catch { ap = {}; }
    ap = extractApParams({ ...ap, ...req.body }); // body pode reenviar campos ocultos

    let loja = null;
    try { loja = await acharLoja(req); } catch (e) { console.error('[auth] acharLoja:', e.message); }
    const marca = marcaDaLoja(loja);
    const host = req.headers.host || '';
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
        ok: false, marca,
        title: 'Abra pelo Wi-Fi da loja',
        msg: 'Esta página precisa ser aberta ao conectar na rede do Wi-Fi. Conecte-se e tente de novo.',
        link: marca.instagram ? { href: '/ig', label: '📸 Ir pro Instagram assim mesmo' } : null,
      }));
    }

    // Validação do código (que vai ESCONDIDO no botão — liberação automática).
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
    try {
      registrarAcesso(loja, ap.mac, null, req.headers['user-agent'] || '', ap.ip);
    } catch (e) {}

    // modo formulário: coleta os campos lead_* e salva como lead da loja
    let telefoneLead = null;
    if (req.body.go === 'form') {
      const dados = {};
      for (const k in req.body) {
        if (k.startsWith('lead_') && req.body[k]) dados[k.slice(5)] = String(req.body[k]).slice(0, 200);
      }
      if (Object.keys(dados).length) {
        try {
          telefoneLead = await registrarLead(loja, dados, ap.mac, req.headers['user-agent'] || '');
        } catch (e) {}
        // marca o aparelho como cadastrado (portal inteligente) — cookie OU mac
        const cyid = req.cookies.cyid || req.body.cyid || null;
        try { marcarCadastrado(loja, ap.mac, telefoneLead, cyid); } catch (e) {}
      }
    }

    // Liberado! Registra e manda o navegador de volta ao AP para soltar a internet.
    await logAccess({ ...base, result: 'granted', reason: outcome.reason });

    // Para onde mandar depois da liberação.
    const go = String(req.body.go || '');
    const destino = (go === 'form')
      ? (marca.destinoTipo === 'formulario' ? 'instagram' : marca.destinoTipo)
      : (go || marca.destinoTipo);
    const urlFinal = urlDoDestino(loja, marca, host, destino);

    if (marca.vcardAtivo) {
      // passa antes pela tela que oferece salvar o contato
      ap.continue = 'https://' + host + '/pronto?d=' + encodeURIComponent(destino);
    } else if (urlFinal) {
      ap.continue = urlFinal;
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
        if (req.body.go === 'instagram' || req.body.go === 'form') {
          ap2.continue = 'https://' + (req.headers.host || '') + '/ig';
        }
        return res.redirect(302, buildReleaseUrl(ap2));  // libera assim mesmo
      }
    } catch {}
    return res.redirect(302, '/ig');
  }
});

// ---------- Tela pós-liberação (só quando o cartão de contato está ligado) ----------
app.get('/pronto', async (req, res) => {
  let loja = null;
  try { loja = await lojaPorDominio(req.headers.host); } catch (e) {}
  const marca = marcaDaLoja(loja);
  const destino = String(req.query.d || marca.destinoTipo || 'instagram');
  const url = urlDoDestino(loja, marca, req.headers.host || '', destino) || 'https://conectay.com.br';
  res.send(renderPronto({ marca, destinoUrl: url, rotulo: rotuloDoDestino(destino, marca) }));
});

// ---------- Cartão de contato (.vcf) ----------
app.get('/contato.vcf', async (req, res) => {
  try {
    const loja = await lojaPorDominio(req.headers.host);
    if (!loja || !loja.vcard_ativo || !loja.vcard_telefone) {
      return res.status(404).send('Contato não disponível.');
    }
    const nome = String(loja.vcard_nome || loja.nome || 'contato').replace(/[^\w\s-]/g, '').trim();
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.vcf"`);
    res.send(montarVcard(loja));
  } catch (e) {
    res.status(500).send('Erro ao gerar contato.');
  }
});

// Saúde do serviço (útil pra monitorar na VPS).
app.get('/health', (req, res) => res.json({ ok: true, servico: 'conectay-portal', versao: '2.1.0', ts: Date.now() }));

// Página que abre o APP do Instagram (deep link), com fallback pro navegador.
// Resolve a loja pelo domínio pra abrir o Instagram DELA (não o global).
app.get('/ig', async (req, res) => {
  let appLink = IG_APP_LINK, webLink = IG_WEB_LINK;
  try {
    const loja = await lojaPorDominio(req.headers.host);
    if (loja && loja.instagram) {
      const h = String(loja.instagram)
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/[\/?#].*$/, '')
        .replace(/^@/, '');
      if (h) { appLink = 'instagram://user?username=' + h; webLink = 'https://instagram.com/' + h; }
    }
  } catch (e) { /* se falhar, usa o global */ }
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
<a href="${appLink}">Abrir Instagram</a>
</div>
<script>
(function(){
  var app=${JSON.stringify(appLink)}, web=${JSON.stringify(webLink)};
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
  console.log(`[conectay] Portal ouvindo na porta ${PORT}`);
  if (!AP_SECRET) console.warn('[conectay] AVISO: AP_SECRET vazio — configure a mesma senha no AP para segurança.');
});
