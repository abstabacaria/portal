// Conexão com o Supabase via API REST (PostgREST), usando a SERVICE ROLE KEY.
// Não usa a senha do banco — funciona por HTTPS, igual ao site da loja.
// Requer as variáveis: SUPABASE_URL e SUPABASE_SERVICE_KEY.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn('[db] AVISO: SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados.');
}

const baseHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Valida e consome um código chamando a função validate_code via RPC.
 * @returns {Promise<{granted: boolean, reason: string}>}
 */
async function validateCode(code) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_code`, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ p_code: code }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`RPC validate_code falhou: ${res.status} ${t}`);
  }
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { granted: false, reason: 'Erro interno' };
  return { granted: row.granted === true, reason: row.reason };
}

/** Registra tentativa de acesso (não derruba o fluxo se falhar). */
async function logAccess(entry) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/access_log`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        code: entry.code || null,
        client_mac: entry.client_mac || null,
        ap_mac: entry.ap_mac || null,
        ssid: entry.ssid || null,
        user_hash: entry.user_hash || null,
        result: entry.result,
        reason: entry.reason || null,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[db] Falha ao gravar log:', res.status, t);
    }
  } catch (err) {
    console.error('[db] Falha ao gravar log:', err.message);
  }
}

/** Busca as métricas agregadas via função get_metrics no Supabase. */
async function getMetrics() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_metrics`, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`RPC get_metrics falhou: ${res.status} ${t}`);
  }
  return res.json();
}

module.exports = { validateCode, logAccess, getMetrics };
