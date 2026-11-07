-- View: public.v_meter_stats

-- DROP VIEW public.v_meter_stats;

-- The value id breaks ties between readings of one meter with the same
-- timestamp, so first/last value stay deterministic.

CREATE OR REPLACE VIEW public.v_meter_stats
AS
WITH meter_stats AS (
    SELECT DISTINCT
        m.id,
        m.name,
        m.meter_type_id,
        first_value(v.value)
            OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp, v.id
            )
        AS first_value,
        first_value(v.timestamp)
            OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp, v.id
            )
        AS first_value_date,
        first_value(v.value)
            OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp DESC, v.id DESC
            )
        AS last_value,
        first_value(v.timestamp)
            OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp DESC, v.id DESC
            )
        AS last_value_date,
        count(v.value)
            OVER (PARTITION BY v.meter_id)
        AS total_values
    FROM t_meter AS m
    LEFT JOIN t_value AS v ON m.id = v.meter_id
)

SELECT
    id,
    name,
    meter_type_id,
    first_value,
    first_value_date,
    last_value,
    last_value_date,
    total_values
FROM meter_stats;
