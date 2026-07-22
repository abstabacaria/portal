// ============================================================
// CONECTAY — lojas.js
// Resolve a loja pelo domínio/slug e grava acessos e leads
// no Supabase via PostgREST (service_role — ignora RLS).
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iekxuehdrxsimqtfejxm.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service_role nas Variables do Railway

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const cache = new Map(); // dominio -> { loja, ts }
const CACHE_MS = 60_000;

async function rest(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS, ...opts });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`PostgREST ${r.status}: ${body}`);
  }
  return r.status === 204 ? null : r.json();
}

// ---- Resolve loja pelo Host (absolem.conectay.com.br) ou ?loja=slug ----
async function resolverLoja(host, slug) {
  const chave = (slug || host || '').toLowerCase().replace(/:\d+$/, '');
  if (!chave) return null;

  const hit = cache.get(chave);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.loja;

  let rows = [];
  if (slug) {
    rows = await rest(`portal_lojas?slug=eq.${encodeURIComponent(slug)}&ativo=eq.true&limit=1`);
  } else {
    rows = await rest(`portal_lojas?dominio=eq.${encodeURIComponent(chave)}&ativo=eq.true&limit=1`);
    // fallback: subdomínio *.conectay.com.br -> slug
    if (!rows.length && chave.endsWith('.conectay.com.br')) {
      const sub = chave.replace('.conectay.com.br', '');
      rows = await rest(`portal_lojas?slug=eq.${encodeURIComponent(sub)}&ativo=eq.true&limit=1`);
    }
  }
  const loja = rows[0] || null;
  if (loja) cache.set(chave, { loja, ts: Date.now() });
  return loja;
}

// ---- Detecção simples de dispositivo/SO pelo user-agent ----
function parseUA(ua = '') {
  const s = ua.toLowerCase();
  let so = 'outro';
  if (s.includes('android')) so = 'Android';
  else if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) so = 'iOS';
  else if (s.includes('windows')) so = 'Windows';
  else if (s.includes('mac os') || s.includes('macintosh')) so = 'macOS';
  else if (s.includes('linux')) so = 'Linux';

  let dispositivo = 'desktop';
  if (s.includes('ipad') || s.includes('tablet')) dispositivo = 'tablet';
  else if (s.includes('mobile') || s.includes('android') || s.includes('iphone')) dispositivo = 'mobile';

  return { so, dispositivo };
}

// ---- Grava visita ----
async function registrarAcesso(lojaId, { mac, ip, userAgent }) {
  const { so, dispositivo } = parseUA(userAgent);
  try {
    await rest('portal_acessos', {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        loja_id: lojaId,
        mac: mac || null,
        ip: ip || null,
        user_agent: (userAgent || '').slice(0, 500),
        so, dispositivo
      })
    });
  } catch (e) {
    console.error('registrarAcesso:', e.message);
  }
}

// ---- Grava lead (o trigger no banco consolida em portal_pessoas) ----
async function registrarLead(lojaId, { nome, telefone, aniversario, extras, mac, userAgent, optin, optinTexto }) {
  const dados = Object.assign({}, extras || {});
  if (nome) dados.nome = nome;
  if (telefone) dados.telefone = telefone;
  if (aniversario) dados.aniversario = aniversario; // AAAA-MM-DD
  await rest('portal_leads', {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      loja_id: lojaId,
      nome: nome || null,
      telefone,
      mac: mac || null,
      user_agent: (userAgent || '').slice(0, 500),
      dados,
      optin: !!optin,
      optin_data: optin ? new Date().toISOString() : null,
      optin_texto: optin ? (optinTexto || '') : null
    })
  });
}

// ---- Portal inteligente: decide a tela pelo histórico do aparelho ----
async function visitaDispositivo(lojaId, mac) {
  if (!mac) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/conectay_dispositivo_visita`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ p_loja: lojaId, p_mac: mac })
    });
    if (!r.ok) return null;               // função ainda não instalada
    return await r.json();
  } catch (e) { console.error('visitaDispositivo:', e.message); return null; }
}

async function marcarCadastrado(lojaId, mac, telefone) {
  if (!mac) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/conectay_dispositivo_cadastrado`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ p_loja: lojaId, p_mac: mac, p_telefone: telefone })
    });
  } catch (e) { console.error('marcarCadastrado:', e.message); }
}

module.exports = { resolverLoja, registrarAcesso, registrarLead, visitaDispositivo, marcarCadastrado };
