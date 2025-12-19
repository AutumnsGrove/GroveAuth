-- GroveAuth Seed Data
-- Initial clients and allowed emails

-- GroveEngine client (internal sites on *.grove.place)
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins)
VALUES (
    'c1000000-0000-0000-0000-000000000001',
    'GroveEngine',
    'groveengine',
    'UUmHuEAZ07nnhhU91L1zWBdTPsZXR68JQgPW5N5aJZE',
    '["https://grove.place/auth/callback", "https://admin.grove.place/auth/callback", "https://admin.grove.place/callback", "https://forage.grove.place/auth/callback", "https://domains.grove.place/auth/callback"]',
    '["https://grove.place", "https://admin.grove.place", "https://forage.grove.place", "https://domains.grove.place"]'
);

-- AutumnsGrove client (main site - autumnsgrove.com)
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins)
VALUES (
    'c2000000-0000-0000-0000-000000000002',
    'AutumnsGrove',
    'autumnsgrove',
    'CfHJBZwJmFy0eXNx9vRUZAvXj673ePuuIGhX3IyJEik=',
    '["https://autumnsgrove.com/auth/callback"]',
    '["https://autumnsgrove.com"]'
);

-- Amber client (Grove storage management - amber.grove.place)
INSERT OR REPLACE INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins)
VALUES (
    'c3000000-0000-0000-0000-000000000003',
    'Amber',
    'amber',
    'lO8UBoFJKFkyTKvyoBp-LAyAzrC5j2kg4lQmkxKq5Vc',
    '["https://amber.grove.place/auth/callback"]',
    '["https://amber.grove.place", "https://amber-api.grove.place"]'
);

-- Initial allowed admin email
INSERT OR REPLACE INTO allowed_emails (email, added_by)
VALUES ('autumnbrown23@pm.me', 'system_seed');
