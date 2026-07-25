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
  // A função retorna TABLE(granted, reason) -> array de objetos
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
/**
 * Métricas do Wi-Fi para o widget do site (rota /api/metrics).
 * Reconstruída a partir do formato real servido em produção:
 * { granted_today, granted_week, granted_month, granted_total,
 *   unique_devices, by_day:[{day,total}], by_hour:[{hour,total}], updated_at }
 * Janela: últimos 30 dias de acessos liberados (result=granted) no access_log.
 * Datas/horas no fuso America/Sao_Paulo.
 */
async function getMetrics() {
  const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/access_log`
    + `?select=created_at,client_mac&result=eq.granted`
    + `&created_at=gte.${encodeURIComponent(desde)}`
    + `&order=created_at.desc&limit=10000`;
  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Falha ao ler access_log: ${res.status} ${t}`);
  }
  const rows = await res.json();

  const TZ = 'America/Sao_Paulo';
  const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });

  const hojeStr = fmtDia.format(new Date());
  const seteDiasAtras = Date.now() - 7 * 24 * 3600 * 1000;

  let granted_today = 0, granted_week = 0;
  const devices = new Set();
  const porDia = {}, porHora = {};

  for (const r of rows) {
    const d = new Date(r.created_at);
    const diaStr = fmtDia.format(d);
    const hora = parseInt(fmtHora.format(d), 10) % 24;
    porDia[diaStr] = (porDia[diaStr] || 0) + 1;
    porHora[hora] = (porHora[hora] || 0) + 1;
    if (diaStr === hojeStr) granted_today++;
    if (d.getTime() >= seteDiasAtras) granted_week++;
    if (r.client_mac) devices.add(r.client_mac);
  }

  const by_day = Object.keys(porDia).sort().map(day => ({ day, total: porDia[day] }));
  const by_hour = Object.keys(porHora).map(Number).sort((a, b) => a - b)
    .map(hour => ({ hour, total: porHora[hour] }));

  const updated_at = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date()).replace(',', '');

  return {
    granted_today,
    granted_week,
    granted_month: rows.length,
    granted_total: rows.length,
    unique_devices: devices.size,
    by_day,
    by_hour,
    updated_at,
  };
}

module.exports = { validateCode, logAccess, getMetrics };
