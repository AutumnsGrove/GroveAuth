/**
 * OAuth Login Initiation with PKCE
 *
 * Uses LoginGraft from @autumnsgrove/groveengine for unified auth.
 * Generates PKCE values, stores state in cookies, redirects to GroveAuth.
 */

import { createLoginHandler } from '@autumnsgrove/groveengine/grafts/login/server';

export const GET = createLoginHandler({
	clientId: 'groveengine',
	authUrl: 'https://auth.grove.place',
	defaultProvider: 'google',
	defaultReturnTo: '/dashboard'
});
