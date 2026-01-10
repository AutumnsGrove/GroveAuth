-- Migration: Add two-factor requirement enforcement for premium tiers
-- Date: 2026-01-10

-- Add two_factor_exempt column to user_subscriptions for admin override
-- This allows admins to exempt users from mandatory 2FA in case of lockouts
ALTER TABLE user_subscriptions ADD COLUMN two_factor_exempt INTEGER DEFAULT 0;

-- Add two_factor_required_bypass_until column for temporary exemptions
-- Allows time-limited bypass (e.g., 24 hours to set up 2FA after upgrade)
ALTER TABLE user_subscriptions ADD COLUMN two_factor_required_bypass_until TEXT;
