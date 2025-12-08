-- GroveAuth Seed Data
-- Initial clients and allowed emails

-- GroveEngine client (internal sites on *.grove.place)
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins)
VALUES (
    'c1000000-0000-0000-0000-000000000001',
    'GroveEngine',
    'groveengine',
    -- Placeholder hash - generate real secret and hash it before deployment
    'PLACEHOLDER_HASH_REPLACE_BEFORE_DEPLOY',
    '["https://grove.place/auth/callback", "https://admin.grove.place/auth/callback"]',
    '["https://grove.place", "https://admin.grove.place"]'
);

-- AutumnsGrove client (main site - autumnsgrove.com)
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins)
VALUES (
    'c2000000-0000-0000-0000-000000000002',
    'AutumnsGrove',
    'autumnsgrove',
    -- Placeholder hash - generate real secret and hash it before deployment
    'PLACEHOLDER_HASH_REPLACE_BEFORE_DEPLOY',
    '["https://autumnsgrove.com/auth/callback"]',
    '["https://autumnsgrove.com"]'
);

-- Initial allowed admin email
INSERT OR REPLACE INTO allowed_emails (email, added_by)
VALUES ('autumnbrown23@pm.me', 'system_seed');
