#!/bin/bash
# GroveAuth - Add New Client Script
# Run this to register a new site with GroveAuth

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           GroveAuth - Register New Client                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check for wrangler
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler CLI not found. Install with: pnpm add -g wrangler"
    exit 1
fi

# Prompt for client details
read -p "Client name (e.g., 'My Cool Site'): " CLIENT_NAME
read -p "Client ID (lowercase, no spaces, e.g., 'mycoolsite'): " CLIENT_ID
read -p "Site URL (e.g., 'https://mycoolsite.com'): " SITE_URL
read -p "Callback path (default: /auth/callback): " CALLBACK_PATH
CALLBACK_PATH=${CALLBACK_PATH:-/auth/callback}

# Generate UUID for client
CLIENT_UUID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "c$(date +%s)-0000-0000-0000-$(openssl rand -hex 6)")

# Generate client secret
CLIENT_SECRET=$(openssl rand -base64 32)

# Hash the secret for storage
CLIENT_SECRET_HASH=$(echo -n "$CLIENT_SECRET" | openssl dgst -sha256 -binary | base64)

# Build redirect URI and origin
REDIRECT_URI="${SITE_URL}${CALLBACK_PATH}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Client Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Name:         $CLIENT_NAME"
echo "  Client ID:    $CLIENT_ID"
echo "  Redirect URI: $REDIRECT_URI"
echo "  Origin:       $SITE_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  SAVE THIS SECRET - You won't see it again!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Client Secret: $CLIENT_SECRET"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Add this client to GroveAuth? (y/n): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

# Build SQL command
SQL="INSERT INTO clients (id, name, client_id, client_secret_hash, redirect_uris, allowed_origins, created_at, updated_at)
VALUES (
    '$CLIENT_UUID',
    '$CLIENT_NAME',
    '$CLIENT_ID',
    '$CLIENT_SECRET_HASH',
    '[\"$REDIRECT_URI\"]',
    '[\"$SITE_URL\"]',
    datetime('now'),
    datetime('now')
);"

echo ""
echo "Executing SQL..."

# Run the SQL
wrangler d1 execute groveauth --command "$SQL"

echo ""
echo "✅ Client registered successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Add these to your site's environment variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GROVEAUTH_CLIENT_ID=$CLIENT_ID"
echo "GROVEAUTH_CLIENT_SECRET=$CLIENT_SECRET"
echo "GROVEAUTH_REDIRECT_URI=$REDIRECT_URI"
echo ""
