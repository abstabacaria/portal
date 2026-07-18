-- ============================================================
--  Absolem Tabacaria — Função de Métricas (PostgreSQL / Supabase)
--  Rode no SQL Editor do Supabase. Retorna todas as métricas em JSON.
--  Usa o fuso de São Paulo para "hoje", "por dia" e "por hora".
-- ============================================================

CREATE OR REPLACE FUNCTION get_metrics()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'granted_today', (
      SELECT count(*) FROM access_log
      WHERE result = 'granted'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')
            >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
    ),
    'granted_week', (
      SELECT count(*) FROM access_log
      WHERE result = 'granted' AND created_at >= now() - interval '7 days'
    ),
    'granted_month', (
      SELECT count(*) FROM access_log
      WHERE result = 'granted' AND created_at >= now() - interval '30 days'
    ),
    'granted_total', (
      SELECT count(*) FROM access_log WHERE result = 'granted'
    ),
    'unique_devices', (
      SELECT count(DISTINCT user_hash) FROM access_log
      WHERE result = 'granted' AND user_hash IS NOT NULL
    ),
    'by_day', (
      SELECT COALESCE(json_agg(t ORDER BY t.day), '[]'::json) FROM (
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
               count(*) AS total
        FROM access_log
        WHERE result = 'granted' AND created_at >= now() - interval '14 days'
        GROUP BY 1
      ) t
    ),
    'by_hour', (
      SELECT COALESCE(json_agg(h ORDER BY h.hour), '[]'::json) FROM (
        SELECT extract(hour FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int AS hour,
               count(*) AS total
        FROM access_log
        WHERE result = 'granted'
        GROUP BY 1
      ) h
    ),
    'updated_at', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  );
$$;
