/**
 * OAuth Callback Handler
 *
 * Uses LoginGraft from @autumnsgrove/groveengine for unified auth.
 * Exchanges authorization code for tokens, sets cross-subdomain cookies,
 * and redirects to the dashboard.
 */

import { createCallbackHandler } from '@autumnsgrove/groveengine/grafts/login/server';

export const GET = createCallbackHandler({
	clientId: 'groveengine',
	clientSecretEnvVar: 'GROVEENGINE_CLIENT_SECRET',
	authApiUrl: 'https://auth-api.grove.place',
	defaultReturnTo: '/dashboard',
	cookieDomain: '.grove.place'
});
