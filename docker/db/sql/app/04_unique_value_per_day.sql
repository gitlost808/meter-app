-- One reading per meter and day.
--
-- Readings are daily values: a meter must not have two readings on the same day (UTC).
-- Different meters may share a day; at a meter change the old meter's last reading and
-- the new meter's first reading are taken on the same day.
--
-- Runs after the seed data on a fresh database (docker-entrypoint-initdb.d) and can be
-- applied to an existing database; running it again changes nothing:
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < docker/db/sql/app/04_unique_value_per_day.sql
--
-- 1. Exact duplicates (same meter, same day, same value) are removed, keeping the lowest id.
-- 2. If a meter still has several readings with different values on one day, the script
--    stops and lists them. The whole script runs in one transaction, so nothing is changed;
--    keep one reading per meter and day by hand and run it again.
-- 3. The unique index enforces the rule from then on. The API reports a violation as 409.

BEGIN;

DELETE FROM public.t_value AS duplicate
USING public.t_value AS kept
WHERE duplicate.meter_id = kept.meter_id
    AND (duplicate."timestamp" AT TIME ZONE 'UTC')::date = (kept."timestamp" AT TIME ZONE 'UTC')::date
    AND duplicate.value = kept.value
    AND duplicate.id > kept.id;

DO $$
DECLARE
    conflicts text;
BEGIN
    SELECT string_agg(format('meter %s on %s (%s)', meter_id, day, readings), '; ' ORDER BY meter_id, day)
    INTO conflicts
    FROM (
        SELECT
            meter_id,
            ("timestamp" AT TIME ZONE 'UTC')::date AS day,
            string_agg(format('id %s = %s', id, value), ', ' ORDER BY id) AS readings
        FROM public.t_value
        GROUP BY 1, 2
        HAVING count(*) > 1
    ) AS same_day;

    IF conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Meters with several different readings on the same day: %', conflicts
            USING HINT = 'Keep one reading per meter and day, then run this script again.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_t_value_meter_day
    ON public.t_value (meter_id, (("timestamp" AT TIME ZONE 'UTC')::date));

COMMIT;
