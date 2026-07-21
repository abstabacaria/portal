// ============================================================
// CONECTAY — db.js
// validate_code (AUTO_CODE) + access_log (log paralelo)
// ============================================================

const AUTO_CODE = process.env.AUTO_CODE || 'ABSOLEM';
const AP_SECRET = process.env.AP_SECRET || '';

// Código de liberação do AP: aceita o AUTO_CODE global
function validateCode(code) {
  if (!code) return false;
  return String(code).trim().toUpperCase() === AUTO_CODE.toUpperCase();
}

// Valida assinatura simples vinda do AP (querystring ?s=AP_SECRET)
function validateApSecret(s) {
  if (!AP_SECRET) return true; // sem secret configurado, não bloqueia
  return s === AP_SECRET;
}

// Log paralelo em memória (últimos 200 eventos) — útil p/ debug via /health
const logBuf = [];
function accessLog(evento, extra = {}) {
  logBuf.push({ t: new Date().toISOString(), evento, ...extra });
  if (logBuf.length > 200) logBuf.shift();
  console.log(`[${evento}]`, JSON.stringify(extra));
}
function getLog() { return logBuf.slice(-50); }

module.exports = { validateCode, validateApSecret, accessLog, getLog, AUTO_CODE };
