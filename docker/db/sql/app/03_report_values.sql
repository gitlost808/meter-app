-- Normalized consumption per meter type, served by GET /api/reports/:meterTypeId.
--
-- Row order: every window below orders by (timestamp, meter_first_date, value_id). At a meter
-- change the old meter's final reading and the new meter's first reading usually share a
-- timestamp; the old meter started earlier, so its reading comes first and carries the
-- time-based delta, while the new meter's first reading follows with date_diff 0 and delta 0.
-- value_id is the final tiebreaker so equal keys never leave the order undefined. The endpoint
-- orders by the same columns (meter_first_date is exposed as the last column for that purpose).
--
-- Averages: a row with date_diff 0 (the first row of a meter type, a new meter's first reading at
-- a meter change) closes no interval, so its delta_year is null instead of 0. The rolling averages
-- run over intervals, not rows: delta_last4_avg is the mean of the last 4 delta_year values and
-- delta_year_avg of the last 52, so a row without an interval neither pulls an average down nor
-- shortens its window. Such a row repeats the averages of the row before it (null for the first).
--
-- Applying a change to an existing database: the docker init scripts only run on a fresh volume,
-- so re-run this file against the app database, e.g.
--   psql "$DATABASE_URL" -f docker/db/sql/app/03_report_values.sql
-- CREATE OR REPLACE VIEW keeps existing columns and types; new columns may only be appended.
CREATE OR REPLACE VIEW v_value_stats
AS
WITH meter_start AS (
    SELECT
        t_value.meter_id,
        min(t_value.timestamp) AS meter_first_date
    FROM t_value
    GROUP BY t_value.meter_id
),

value_with_first_meter_date AS (
    SELECT
        v.id AS value_id,
        v.timestamp,
        v.value,
        v.value AS raw_value,
        v.meter_id,
        m.meter_type_id,
        ms.meter_first_date
    FROM t_value AS v
    INNER JOIN meter_start AS ms ON v.meter_id = ms.meter_id
    INNER JOIN t_meter AS m ON v.meter_id = m.id
    ORDER BY v.timestamp
),

adjusted_values AS (
    SELECT
        v.value_id,
        v.timestamp,
        v.value,
        v.raw_value,
        v.meter_id,
        v.meter_type_id,
        v.meter_first_date,
        CASE
            WHEN lag(v.value, 1) OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp, v.meter_first_date, v.value_id
            ) IS null THEN null
            ELSE v.value - lag(v.value, 1) OVER (
                PARTITION BY v.meter_id
                ORDER BY v.timestamp, v.meter_first_date, v.value_id
            )
        END AS meter_adjusted_value
    FROM value_with_first_meter_date AS v
    ORDER BY v.timestamp, v.meter_first_date
),

normalized_value AS (
    SELECT
        v.value_id AS id,
        v.timestamp,
        v.meter_id,
        v.meter_type_id,
        v.raw_value,
        v.meter_first_date,
        -- The first reading of each meter has no previous reading (meter_adjusted_value is null)
        -- and contributes 0: the first row of a meter type starts the series at 0, so the first
        -- interval gets a delta, and a new meter's first reading adds no jump at a meter change.
        sum(coalesce(v.meter_adjusted_value, 0))
            OVER (
                PARTITION BY v.meter_type_id
                ORDER BY
                    v.timestamp, v.meter_first_date, v.value_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )
            AS value
    FROM adjusted_values AS v
    ORDER BY v.timestamp, v.meter_first_date
),

normalized_value_delta AS (
    SELECT
        nv.id,
        nv.timestamp,
        nv.meter_id,
        nv.meter_type_id,
        nv.raw_value,
        nv.value,
        nv.meter_first_date,
        extract(
            DAY FROM nv.timestamp - lag(nv.timestamp, 1, nv.timestamp) OVER (
                PARTITION BY nv.meter_type_id
                ORDER BY nv.timestamp, nv.meter_first_date, nv.id
            )
        )::double precision AS date_diff,
        nv.value
        - lag(nv.value, 1) OVER (
            PARTITION BY nv.meter_type_id
            ORDER BY nv.timestamp, nv.meter_first_date, nv.id
        ) AS delta
    FROM normalized_value AS nv
),

delta_year AS (
    SELECT
        nvd.id,
        nvd.timestamp,
        nvd.meter_id,
        nvd.meter_type_id,
        nvd.raw_value,
        nvd.value,
        nvd.meter_first_date,
        nvd.date_diff,
        nvd.delta,
        CASE
            WHEN nvd.date_diff = 0::double precision THEN null
            ELSE nvd.delta / nvd.date_diff * 365::double precision
        END AS delta_year
    FROM normalized_value_delta AS nvd
),

-- interval_no counts the intervals (rows with a delta_year) up to and including each row, so a row
-- without an interval shares the number of the row before it. The averages below take a RANGE of
-- interval numbers, which covers exactly the last 4 or 52 intervals however many rows lie between.
numbered_interval AS (
    SELECT
        dy.id,
        dy.timestamp,
        dy.meter_id,
        dy.meter_type_id,
        dy.raw_value,
        dy.value,
        dy.meter_first_date,
        dy.date_diff,
        dy.delta,
        dy.delta_year,
        count(dy.delta_year)
            OVER (
                PARTITION BY dy.meter_type_id
                ORDER BY
                    dy.timestamp, dy.meter_first_date, dy.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )
            AS interval_no
    FROM delta_year AS dy
)

SELECT
    id,
    timestamp,
    meter_id,
    meter_type_id,
    raw_value,
    value,
    date_diff,
    delta,
    delta_year,
    avg(delta_year)
        OVER (
            PARTITION BY meter_type_id
            ORDER BY interval_no
            RANGE BETWEEN 3 PRECEDING AND CURRENT ROW
        )
        AS delta_last4_avg,
    avg(delta_year)
        OVER (
            PARTITION BY meter_type_id
            ORDER BY interval_no
            RANGE BETWEEN 51 PRECEDING AND CURRENT ROW
        )
        AS delta_year_avg,
    -- Appended last so CREATE OR REPLACE VIEW can update an existing view; used for ordering.
    meter_first_date
FROM numbered_interval;
