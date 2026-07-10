-- ============================================================
--  Absolem Tabacaria — Captive Portal (PostgreSQL / Supabase)
--  Rode no SQL Editor do Supabase (ou via psql).
-- ============================================================

-- Códigos que liberam o acesso.
CREATE TABLE IF NOT EXISTS access_codes (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(40)  NOT NULL UNIQUE,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    max_uses    INTEGER      NOT NULL DEFAULT 0,   -- 0 = ilimitado
    used_count  INTEGER      NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ,                       -- NULL = não expira
    note        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Log de cada liberação (auditoria / Marco Civil / marketing).
CREATE TABLE IF NOT EXISTS access_log (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(40),
    client_mac  VARCHAR(32),
    ap_mac      VARCHAR(32),
    ssid        TEXT,
    user_hash   VARCHAR(128),
    result      VARCHAR(20) NOT NULL,   -- 'granted' | 'denied'
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Códigos de exemplo -----------------------------------------
INSERT INTO access_codes (code, max_uses, note)
VALUES ('ABSOLEM', 0, 'Codigo geral da loja')
ON CONFLICT (code) DO NOTHING;

INSERT INTO access_codes (code, max_uses, expires_at, note)
VALUES ('STORIES50', 50, now() + interval '30 days', 'Campanha stories')
ON CONFLICT (code) DO NOTHING;

-- Função que valida E consome o código de forma atômica.
-- Retorna (granted boolean, reason text).
CREATE OR REPLACE FUNCTION validate_code(p_code VARCHAR)
RETURNS TABLE(granted BOOLEAN, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    r access_codes%ROWTYPE;
BEGIN
    SELECT * INTO r FROM access_codes WHERE code = p_code FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Código não encontrado'; RETURN;
    END IF;
    IF NOT r.active THEN
        RETURN QUERY SELECT FALSE, 'Código desativado'; RETURN;
    END IF;
    IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN
        RETURN QUERY SELECT FALSE, 'Código expirado'; RETURN;
    END IF;
    IF r.max_uses > 0 AND r.used_count >= r.max_uses THEN
        RETURN QUERY SELECT FALSE, 'Limite de usos atingido'; RETURN;
    END IF;

    UPDATE access_codes SET used_count = used_count + 1 WHERE id = r.id;
    RETURN QUERY SELECT TRUE, 'OK';
END;
$$;
