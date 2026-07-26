-- Seed the "Candidates per City" map report.
-- Idempotent: skip if a report with the same name already exists.
INSERT INTO reports (
    name,
    description,
    data_source,
    filters,
    columns,
    group_by,
    order_by,
    display_type,
    display_options,
    row_limit,
    owner_id,
    is_public
)
SELECT
    'Candidates per City (India Map)',
    'Bubble map of registered candidates across Indian cities. Circle size is proportional to the number of candidates from that city.',
    'candidates',
    '{"join":"and","children":[{"field":"city","op":"is_not_null"}]}'::jsonb,
    '[{"field":"city"},{"field":"id","aggregate":"count","label":"Candidate Count"}]'::jsonb,
    '["city"]'::jsonb,
    '[{"field":"id","direction":"desc"}]'::jsonb,
    'map',
    '{"map_city":"city","map_value":"count_id"}'::jsonb,
    1000,
    (SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' ORDER BY u.id ASC LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM reports WHERE name = 'Candidates per City (India Map)'
);

SELECT id, name, data_source, display_type FROM reports WHERE name = 'Candidates per City (India Map)';
