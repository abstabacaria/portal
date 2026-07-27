require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { validateCode, logAccess, getMetrics } = require('./db');
const {
  lojaPorDominio, lojaPorSlug, validarCodigoDaLoja,
  registrarAcesso, registrarLead, visitaDispositivo, marcarCadastrado,
  estaBloqueado, fidelidadeInfo, pessoaIdPorTelefone,
} = require('./lojas');
const { renderPortal, renderResult, renderPronto, renderPrivacidade, montarVcard, renderCupomHtml, renderBalcao } = require('./views');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
    modo: src.modo || '',
  };
}

// Resolve a sessão por fidelidade: VIP > recorrente > novo, conforme o
// histórico do aparelho/pessoa. Retorna segundos ou null (usa o padrão).
function sessaoPorFidelidade(loja, info) {
  if (!loja || !loja.fidelidade_ativa || !info) return null;
  // VIP tem prioridade máxima
  if (info.status === 'vip' && loja.sess_vip > 0) return loja.sess_vip;
  // recorrente: categoria recorrente OU 3+ visitas
  const recorrente = info.categoria === 'recorrente' || (info.total_visitas || info.visitas || 0) >= 3;
  if (recorrente && loja.sess_recorrente > 0) return loja.sess_recorrente;
  // demais (novos/desconhecidos) usam sess_novo se configurado
  if (loja.sess_novo > 0) return loja.sess_novo;
  return null;
}

// Monta a URL de liberação de volta para o AP, com token de segurança.
// Sessão e limites de banda vêm da LOJA quando configurados no painel;
// senão usam os padrões globais do ambiente.
// sessOverride (segundos) tem prioridade — usado pela sessão por fidelidade.
function buildReleaseUrl(p, loja, sessOverride) {
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
  const ov = parseInt(sessOverride, 10);
  const st = parseInt(loja && loja.session_timeout, 10);
  params.set('session_timeout',
    (ov && ov > 0) ? String(ov) : ((st && st > 0) ? String(st) : SESSION_TIMEOUT));
  params.set('idle_timeout', IDLE_TIMEOUT);
  const dl = parseInt(loja && loja.download_kbps, 10);
  const ul = parseInt(loja && loja.upload_kbps, 10);
  params.set('download_kbps', (!isNaN(dl) && dl >= 0) ? String(dl) : DOWNLOAD_KBPS);
  params.set('upload_kbps', (!isNaN(ul) && ul >= 0) ? String(ul) : UPLOAD_KBPS);

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
      bannerAtivo: !!loja.banner_ativo,
      popupAtivo: !!loja.popup_ativo,
      popupTipo: loja.popup_tipo || 'imagem',
      popupUrl: loja.popup_url || '',
      popupLink: loja.popup_link || '',
      popupSegundos: parseInt(loja.popup_segundos, 10) || 0,
      autoCode: loja.codigo_wifi || AUTO_CODE,   // liberação automática: nunca deixa vazio
      apSecret: loja.ap_secret || AP_SECRET,
      destinoTipo: loja.destino_tipo || 'instagram',
      whatsappLink: loja.whatsapp_link || '',
      googleReviewUrl: loja.google_review_url || '',
      siteUrl: loja.site_url || '',
      formCampos: loja.form_campos || null,
      formTitulo: loja.form_titulo || '',
      modoAp: loja.modo_ap || '',
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
      // MODO SIMPLES — APs sem o protocolo Intelbras (ex.: D-Link em Web
      // Redirection). Não há internet a liberar: só captura o lead e segue
      // pro destino. Ativado com &modo=simples na URL configurada no AP.
      if (ap.modo === 'simples' || marca.modoAp === 'simples') {
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
            const cyid = req.cookies.cyid || req.body.cyid || null;
            try { marcarCadastrado(loja, ap.mac, telefoneLead, cyid); } catch (e) {}
          }
        }
        try { registrarAcesso(loja, ap.mac, null, req.headers['user-agent'] || '', ap.ip); } catch (e) {}
        await logAccess({ ...base, result: 'granted', reason: 'modo simples (sem release)' });

        const goS = String(req.body.go || '');
        const destinoS = (goS === 'form')
          ? (marca.destinoTipo === 'formulario' ? 'instagram' : marca.destinoTipo)
          : (goS || marca.destinoTipo);
        if (marca.vcardAtivo) {
          return res.redirect(302, 'https://' + host + '/pronto?d=' + encodeURIComponent(destinoS));
        }
        const urlS = urlDoDestino(loja, marca, host, destinoS);
        return res.redirect(302, urlS || ('https://' + host + '/pronto?d=' + encodeURIComponent(destinoS)));
      }

      // Sem redirect_uri não há como liberar — provavelmente acesso fora do fluxo do AP.
      await logAccess({ ...base, result: 'denied', reason: 'Sem redirect_uri (fora do AP)' });
      return res.send(renderResult({
        ok: false, marca,
        title: 'Abra pelo Wi-Fi da loja',
        msg: 'Esta página precisa ser aberta ao conectar na rede do Wi-Fi. Conecte-se e tente de novo.',
        link: marca.instagram ? { href: '/ig', label: '📸 Ir pro Instagram assim mesmo' } : null,
      }));
    }

    // BLOQUEIO: se o MAC, o cookie do aparelho ou o telefone informado
    // estiverem na lista de bloqueio da loja, nega educadamente.
    // (Sessões já ativas no AP não são derrubadas — o efeito pega na
    // próxima autenticação, no máximo em <session_timeout>.)
    const cyidBloq = req.cookies.cyid || req.body.cyid || '';
    const telBloq = String(req.body.lead_telefone || req.body.lead_whatsapp || req.body.lead_celular || '').replace(/\D/g, '');
    const bloq = await estaBloqueado(loja, { mac: ap.mac, cyid: cyidBloq, telefone: telBloq });
    if (bloq) {
      await logAccess({ ...base, result: 'denied', reason: 'Bloqueado' + (bloq.motivo ? ': ' + bloq.motivo : '') });
      return res.send(renderResult({
        ok: false, marca,
        title: 'Acesso indisponível',
        msg: 'O acesso ao Wi-Fi não está disponível para este dispositivo. Em caso de dúvida, fale com o estabelecimento.',
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
        // CUPOM: se a loja emite cupom de boas-vindas, gera e guarda o código
        // num cookie curto pro /pronto exibir o cartão.
        if (loja && loja.cupom_ativo && telefoneLead) {
          try {
            const cuponsMod = require('./cupons');
            const pid = await pessoaIdPorTelefone(loja.id, telefoneLead);
            if (pid) {
              const cup = await cuponsMod.emitirCupom(loja.id, pid, null);
              if (cup && cup.code) {
                res.setHeader('Set-Cookie', `cyc=${encodeURIComponent(cup.code)}; Max-Age=300; Path=/`);
              }
            }
          } catch (e) { console.error('[cupom emit]', e.message); }
        }
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

    // Sessão por fidelidade (só Intelbras): busca o histórico do aparelho/pessoa
    // e escala o tempo. Falha silenciosa -> cai no timeout padrão da loja.
    let sessOverride = null;
    if (loja && loja.fidelidade_ativa) {
      try {
        const info = await fidelidadeInfo(loja, ap.mac, telefoneLead || req.cookies.cyid);
        sessOverride = sessaoPorFidelidade(loja, info);
      } catch (e) {}
    }

    const releaseUrl = buildReleaseUrl(ap, loja, sessOverride);
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
  // cupom emitido no /auth vem por cookie curto
  let cupomHtml = '';
  const code = req.cookies && req.cookies.cyc;
  if (code && loja && loja.cupom_ativo) {
    try {
      const cuponsMod = require('./cupons');
      const info = await cuponsMod.consultarCupom(loja.id, code);
      if (info && info.resultado === 'active') {
        cupomHtml = renderCupomHtml({
          code: info.code, offer_kind: info.offer_kind, offer_value: info.offer_value,
          min_purchase: info.min_purchase, expires_at: info.expires_at,
        }, marca, destino);
      }
    } catch (e) {}
    res.setHeader('Set-Cookie', 'cyc=; Max-Age=0; Path=/');
  }
  res.send(renderPronto({ marca, destinoUrl: url, rotulo: rotuloDoDestino(destino, marca), cupomHtml }));
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
app.get('/health', (req, res) => res.json({ ok: true, servico: 'conectay-portal', versao: '2.9.0', ts: Date.now() }));

// Página que abre o APP do Instagram, com estratégia POR PLATAFORMA:
//   ANDROID → intent:// (único esquema que o navegador do captive aceita;
//             instagram:// é bloqueado no Android, por isso não abria).
//   iOS     → instagram:// (funciona) com fallback pro site.
//   Outros  → site direto.
// Resolve a loja pelo domínio pra abrir o Instagram DELA (não o global).
app.get('/ig', async (req, res) => {
  let handle = IG_HANDLE;
  try {
    const loja = await lojaPorDominio(req.headers.host);
    if (loja && loja.instagram) {
      const h = String(loja.instagram)
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/[\/?#].*$/, '')
        .replace(/^@/, '');
      if (h) handle = h;
    }
  } catch (e) { /* se falhar, usa o global */ }

  const webLink    = 'https://instagram.com/' + handle;
  const appLink    = 'instagram://user?username=' + handle;
  const intentLink = 'intent://instagram.com/_u/' + handle
    + '#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url='
    + encodeURIComponent(webLink) + ';end';

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
<a href="${appLink}" id="btnIg">Abrir Instagram</a>
</div>
<script>
(function(){
  var app=${JSON.stringify(appLink)}, web=${JSON.stringify(webLink)}, intent=${JSON.stringify(intentLink)};
  var isAndroid=/Android/i.test(navigator.userAgent||'');
  var btn=document.getElementById('btnIg');

  var isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');

  if(isAndroid){
    // Android: intent:// é o único que abre o APP a partir daqui.
    btn.setAttribute('href', intent);
    var t=setTimeout(function(){ window.location.href=web; }, 3000);
    function cancel(){ clearTimeout(t); }
    window.addEventListener('pagehide', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) cancel(); });
    // tentativa automática
    window.location.href = intent;
  } else if(isIOS){
    // iOS: o Universal Link (https://instagram.com/perfil) abre o APP de
    // verdade — e diferente do instagram://, NÃO é bloqueado no redirect.
    // Dispara automático E deixa o botão como garantia (toque = mesmo efeito).
    btn.setAttribute('href', web);
    // tenta primeiro o app via esquema (Safari normal), e logo em seguida
    // navega pro universal link, que abre o app sozinho na maioria dos casos.
    try { window.location.href = app; } catch(e){}
    setTimeout(function(){ window.location.href = web; }, 900);
  } else {
    // Desktop e demais: vai pro site depois de tentar o app.
    var t2=setTimeout(function(){ window.location.href=web; }, 1400);
    function cancel2(){ clearTimeout(t2); }
    window.addEventListener('pagehide', cancel2);
    window.addEventListener('blur', cancel2);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) cancel2(); });
    window.location.href = app;
  }
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

// ============================================================
// CUPONS — tela de balcão (/v/:slug) + API de validação/baixa
// ============================================================
const cupons = require('./cupons');
const ipDe = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// Tela do balcão: o atendente valida e dá baixa. Protegida por PIN.
app.get('/v/:slug', async (req, res) => {
  try {
    const loja = await cupons.lojaPorSlugCupom(req.params.slug);
    if (!loja) return res.status(404).send(renderResult({ ok: false, marca: {}, title: 'Loja não encontrada', msg: 'Confira o link do balcão.' }));
    res.send(renderBalcao(loja));
  } catch (e) {
    console.error('[balcao]', e.message);
    res.status(500).send('Erro ao abrir o balcão: ' + e.message);
  }
});

// valida o PIN do atendente
app.post('/api/balcao/:slug/pin', async (req, res) => {
  const loja = await cupons.lojaPorSlugCupom(req.params.slug);
  if (!loja) return res.status(404).json({ ok: false });
  const pin = String((req.body && req.body.pin) || '');
  if (!loja.balcao_pin || pin !== loja.balcao_pin) return res.status(401).json({ ok: false, erro: 'PIN incorreto' });
  return res.json({ ok: true, loja: { nome: loja.nome, pedir_valor: loja.balcao_pedir_valor } });
});

// consulta um código
app.get('/api/balcao/:slug/consultar', async (req, res) => {
  try {
    const loja = await cupons.lojaPorSlugCupom(req.params.slug);
    if (!loja) return res.status(404).json({ resultado: 'nao_encontrado' });
    const out = await cupons.consultarCupom(loja.id, String(req.query.code || ''));
    res.json(out);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// dá baixa (transacional no banco)
app.post('/api/balcao/:slug/baixa', async (req, res) => {
  try {
    const loja = await cupons.lojaPorSlugCupom(req.params.slug);
    if (!loja) return res.status(404).json({ ok: false });
    const b = req.body || {};
    const out = await cupons.darBaixa(loja.id, String(b.code || ''), {
      amount: b.amount, actor: b.actor, force: b.force, renew: b.renew,
      ip: ipDe(req), ua: req.headers['user-agent'] || '',
    });
    res.status(out && out.ok ? 200 : 409).json(out);
  } catch (e) { res.status(500).json({ ok: false, erro: e.message }); }
});

app.listen(PORT, () => {
  console.log(`[conectay] Portal ouvindo na porta ${PORT}`);
  if (!AP_SECRET) console.warn('[conectay] AVISO: AP_SECRET vazio — configure a mesma senha no AP para segurança.');
});
