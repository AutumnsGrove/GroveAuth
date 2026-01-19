-- =============================================================================
-- Migration: 008_grove_cli_client
-- Description: Register grove-cli as an OAuth client for device code flow
-- =============================================================================

-- Grove CLI client for device authorization grant
-- No client_secret needed for public clients (CLI tools)
-- Redirect URI needed for post-login return to device authorization page
INSERT INTO clients (
    id,
    name,
    client_id,
    client_secret_hash,
    redirect_uris,
    allowed_origins,
    domain,
    is_internal_service,
    created_at,
    updated_at
) VALUES (
    'grove-cli-001',
    'Grove CLI',
    'grove-cli',
    '',  -- Public client, no secret required for device flow
    '["https://auth-api.grove.place/auth/device"]',  -- Device authorization page
    '[]',  -- No CORS needed for CLI
    NULL,  -- No domain restriction
    0,     -- Not an internal service
    datetime('now'),
    datetime('now')
) ON CONFLICT(client_id) DO NOTHING;
