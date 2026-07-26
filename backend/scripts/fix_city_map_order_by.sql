-- Fix order_by on the "Candidates per City (India Map)" report so it orders
-- by the aggregated count (compatible with GROUP BY city).
UPDATE reports
SET order_by = '[{"field":"count_id","direction":"desc"}]'::jsonb
WHERE name = 'Candidates per City (India Map)';

SELECT id, name, group_by, order_by FROM reports WHERE name = 'Candidates per City (India Map)';
