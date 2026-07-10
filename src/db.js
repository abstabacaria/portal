const { Pool } = require('pg');

// Conexão com Supabase (PostgreSQL). Use a connection string do painel:
// Supabase > Project Settings > Database > Connection string (URI).
// Prefira a porta 6543 (pooler/pgBouncer) para apps serverless/free.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase exige SSL
  max: 5,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[db] erro no pool:', err.message));

/**
 * Valida e consome um código chamando a função validate_code().
 * @returns {Promise<{granted: boolean, reason: string}>}
 */
async function validateCode(code) {
  const { rows } = await pool.query('SELECT granted, reason FROM validate_code($1)', [code]);
  const row = rows[0] || { granted: false, reason: 'Erro interno' };
  return { granted: row.granted === true, reason: row.reason };
}

/** Registra tentativa de acesso (não derruba o fluxo se falhar). */
async function logAccess(entry) {
  try {
    await pool.query(
      `INSERT INTO access_log (code, client_mac, ap_mac, ssid, user_hash, result, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [entry.code || null, entry.client_mac || null, entry.ap_mac || null,
       entry.ssid || null, entry.user_hash || null, entry.result, entry.reason || null]
    );
  } catch (err) {
    console.error('[db] Falha ao gravar log:', err.message);
  }
}

module.exports = { pool, validateCode, logAccess };
