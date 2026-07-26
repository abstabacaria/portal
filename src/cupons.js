// ConectaY — módulo de cupons (Fase 2/3)
// Chama as funções (RPC) criadas na migração 011 via PostgREST, com service key.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: H, body: JSON.stringify(body || {}),
  });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!res.ok) throw new Error(`RPC ${fn}: ${res.status} ${txt}`);
  return data;
}

// resolve a loja por slug (id + config de cupom/balcão)
async function lojaPorSlugCupom(slug) {
  const url = `${SUPABASE_URL}/rest/v1/portal_lojas`
    + `?slug=eq.${encodeURIComponent(slug)}`
    + `&select=id,nome,slug,cupom_ativo,cupom_tipo,cupom_valor,cupom_min,cupom_regras,`
    + `balcao_pin,balcao_pedir_valor,logo_url,cor,cor2&limit=1`;
  const res = await fetch(url, { headers: H });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
}

// emite (ou reaproveita) cupom pra uma pessoa/loja
async function emitirCupom(lojaId, pessoaId, leadId) {
  const row = await rpc('portal_emitir_cupom', { p_loja: lojaId, p_pessoa: pessoaId, p_lead: leadId || null });
  return row; // objeto portal_cupons
}

async function consultarCupom(lojaId, code) {
  return rpc('portal_consultar_cupom', { p_loja: lojaId, p_code: code });
}

async function darBaixa(lojaId, code, { amount, actor, force, renew, ip, ua } = {}) {
  return rpc('portal_dar_baixa', {
    p_loja: lojaId, p_code: code, p_amount: amount ?? null,
    p_actor: actor || null, p_force: !!force, p_renew: !!renew,
    p_ip: ip || null, p_ua: ua || null,
  });
}

async function receitaAtribuida(lojaId) {
  return rpc('portal_receita_atribuida', { p_loja: lojaId });
}

module.exports = { lojaPorSlugCupom, emitirCupom, consultarCupom, darBaixa, receitaAtribuida };
