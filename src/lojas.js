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

// Registra o acesso marcado por loja (não derruba o fluxo se falhar).
async function registrarAcesso(loja, mac, dispositivo) {
  if (!loja) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/portal_acessos`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        loja_id: loja.id,
        slug: loja.slug,
        mac: mac || null,
        dispositivo: dispositivo || null,
      }),
    });
  } catch (e) {
    /* silencioso de propósito */
  }
}

// grava um lead coletado pelo formulário (isolado por loja)
async function registrarLead(loja, dados, mac) {
  if (!loja) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/portal_leads`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ loja_id: loja.id, slug: loja.slug, dados: dados || {}, mac: mac || null }),
    });
  } catch (e) { /* silencioso */ }
}

// limpa o cache de um domínio (útil quando você edita a loja no painel)
function limparCache(host) {
  if (host) CACHE.delete(norm(host));
  else CACHE.clear();
}

module.exports = { lojaPorDominio, lojaPorSlug, validarCodigoDaLoja, registrarAcesso, registrarLead, limparCache };
