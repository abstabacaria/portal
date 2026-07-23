// ============================================================
//  MULTI-MARCA — resolve a loja pelo domínio e valida o código.
//  Cada portal (wifi.lojaX.com.br) aponta pro MESMO servidor;
//  aqui a gente descobre QUAL loja é, pela tabela portal_lojas.
// ============================================================
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// cache curto: evita bater no banco a cada request (o portal é muito acessado)
const CACHE = new Map();
const TTL = 60 * 1000; // 60s

function norm(host) {
  return String(host || '')
    .toLowerCase()
    .replace(/:\d+$/, '')      // tira porta
    .replace(/^www\./, '')
    .trim();
}

// Busca a loja pelo domínio. Retorna null se não achar ou estiver inativa.
async function lojaPorDominio(host) {
  const dominio = norm(host);
  if (!dominio) return null;

  const cached = CACHE.get(dominio);
  if (cached && Date.now() - cached.t < TTL) return cached.v;

  let loja = null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/portal_lojas?dominio=eq.${encodeURIComponent(dominio)}&select=*&limit=1`;
    const r = await fetch(url, { headers: H });
    if (r.ok) {
      const rows = await r.json();
      loja = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
  } catch (e) {
    console.warn('[lojas] erro ao buscar', dominio, e.message);
  }

  CACHE.set(dominio, { t: Date.now(), v: loja });
  return loja;
}

// Busca a loja pelo SLUG (identificador) — usado pra testar via ?loja=xxx,
// sem precisar de domínio configurado.
async function lojaPorSlug(slug) {
  slug = String(slug || '').toLowerCase().trim();
  if (!slug) return null;
  const chave = '__slug__' + slug;
  const cached = CACHE.get(chave);
  if (cached && Date.now() - cached.t < TTL) return cached.v;
  let loja = null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/portal_lojas?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
    const r = await fetch(url, { headers: H });
    if (r.ok) {
      const rows = await r.json();
      loja = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
  } catch (e) {
    console.warn('[lojas] erro ao buscar slug', slug, e.message);
  }
  CACHE.set(chave, { t: Date.now(), v: loja });
  return loja;
}

// Valida o código digitado contra o código daquela loja.
// granted=false com motivo claro. Nunca deixa o código de uma loja liberar outra.
function validarCodigoDaLoja(loja, code) {
  if (!loja) return { granted: false, reason: 'Loja não encontrada' };
  if (loja.ativo === false) return { granted: false, reason: 'Portal desativado' };
  const esperado = String(loja.codigo_wifi || '').trim();
  if (!esperado) return { granted: false, reason: 'Loja sem código configurado' };
  const digitado = String(code || '').trim();
  if (!digitado) return { granted: false, reason: 'Digite o código' };
  if (digitado.toUpperCase() !== esperado.toUpperCase()) {
    return { granted: false, reason: 'Código inválido' };
  }
  return { granted: true, reason: 'ok' };
}

// ---- BLOQUEIO POR LOJA -------------------------------------------------
// Consulta portal_bloqueios: se o MAC, o cookie do aparelho (cyid) ou o
// telefone estiverem bloqueados (ativo=true) naquela loja, devolve o
// registro { id, motivo }. Senão, devolve null.
// FAIL-OPEN de propósito: se o banco falhar, ninguém fica sem Wi-Fi.
async function estaBloqueado(loja, { mac, telefone, cyid } = {}) {
  if (!loja || !loja.id) return null;

  const conds = [];
  const m = String(mac || '').toLowerCase().trim();
  const t = String(telefone || '').replace(/\D/g, '');
  const c = String(cyid || '').trim();
  if (m) conds.push(`mac.eq."${m}"`);
  if (t) conds.push(`telefone.eq."${t}"`);
  if (c) conds.push(`cyid.eq."${c}"`);
  if (!conds.length) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/portal_bloqueios`
      + `?loja_id=eq.${encodeURIComponent(loja.id)}`
      + `&ativo=eq.true`
      + `&or=${encodeURIComponent('(' + conds.join(',') + ')')}`
      + `&select=id,motivo&limit=1`;
    const r = await fetch(url, { headers: H });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.warn('[lojas] erro ao checar bloqueio:', e.message);
    return null;
  }
}

// ---- Detecção de dispositivo/SO pelo user-agent (alimenta o dashboard) ----
function lerUA(ua = '') {
  const s = String(ua).toLowerCase();
  let so = 'outro';
  if (s.includes('android')) so = 'Android';
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) so = 'iOS';
  else if (s.includes('windows')) so = 'Windows';
  else if (s.includes('mac os') || s.includes('macintosh')) so = 'macOS';
  else if (s.includes('linux')) so = 'Linux';
  let dispositivo = 'computador';
  if (s.includes('ipad') || s.includes('tablet')) dispositivo = 'tablet';
  else if (s.includes('mobile') || s.includes('android') || s.includes('iphone')) dispositivo = 'celular';
  return { so, dispositivo };
}

// Registra o acesso marcado por loja (não derruba o fluxo se falhar).
// Aceita a assinatura antiga (loja, mac, dispositivo) e a nova com user-agent.
async function registrarAcesso(loja, mac, dispositivo, userAgent, ip) {
  if (!loja) return;
  try {
    const ua = lerUA(userAgent);
    await fetch(`${SUPABASE_URL}/rest/v1/portal_acessos`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        loja_id: loja.id,
        slug: loja.slug,
        mac: mac || null,
        dispositivo: dispositivo || ua.dispositivo || null,
        so: userAgent ? ua.so : null,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        ip: ip || null,
      }),
    });
  } catch (e) {
    /* silencioso de propósito */
  }
}

// grava um lead coletado pelo formulário (isolado por loja)
// Além do JSONB `dados` (histórico), preenche as colunas planas usadas
// pelo CRM (portal_pessoas) — nome, telefone e o consentimento.
async function registrarLead(loja, dados, mac, userAgent) {
  if (!loja) return;
  try {
    const registro = Object.assign({}, dados || {});
    const optin = !!registro.optin;
    // Consentimento LGPD: se a pessoa marcou o aceite, guarda a PROVA
    // (que aceitou, quando aceitou e o texto exato que foi mostrado).
    if (optin) {
      registro.optin = true;
      registro.optin_data = new Date().toISOString();
      registro.optin_texto = 'Aceito receber novidades e ofertas no WhatsApp e concordo com a Política de Privacidade.';
    }
    const telefone = String(
      registro.telefone || registro.whatsapp || registro.celular || ''
    ).replace(/\D/g, '') || null;

    await fetch(`${SUPABASE_URL}/rest/v1/portal_leads`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        loja_id: loja.id,
        slug: loja.slug,
        dados: registro,
        mac: mac || null,
        nome: registro.nome || null,
        telefone,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        optin,
        optin_data: optin ? new Date().toISOString() : null,
        optin_texto: optin ? registro.optin_texto : null,
      }),
    });
    return telefone;
  } catch (e) { /* silencioso */ }
}

// ---- PORTAL INTELIGENTE ----------------------------------------------
// Reconhece o aparelho pelo MAC e diz qual tela mostrar.
// Se a função ainda não existir no banco, devolve null e o motor
// segue com o comportamento normal da loja (nada quebra).
async function visitaDispositivo(loja, mac, cookie) {
  if (!loja || (!mac && !cookie)) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/conectay_dispositivo_visita`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ p_loja: loja.id, p_mac: mac || '', p_cookie: cookie || '' }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

// Marca o aparelho como já cadastrado (depois do formulário enviado).
async function marcarCadastrado(loja, mac, telefone, cookie) {
  if (!loja || (!mac && !cookie)) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/conectay_dispositivo_cadastrado`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ p_loja: loja.id, p_mac: mac || '', p_telefone: telefone || '', p_cookie: cookie || '' }),
    });
  } catch (e) { /* silencioso */ }
}

// limpa o cache de um domínio (útil quando você edita a loja no painel)
function limparCache(host) {
  if (host) CACHE.delete(norm(host));
  else CACHE.clear();
}

module.exports = {
  lojaPorDominio, lojaPorSlug, validarCodigoDaLoja,
  registrarAcesso, registrarLead, limparCache,
  visitaDispositivo, marcarCadastrado, lerUA,
  estaBloqueado,
};
