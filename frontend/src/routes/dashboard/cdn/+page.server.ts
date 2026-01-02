/**
 * CDN Manager - Server Load
 * Loads files and folders for the CDN manager at admin.grove.place
 */

import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, cookies, fetch }) => {
	const { session } = await parent();

	// Must be logged in
	if (!session.authenticated) {
		throw redirect(303, '/');
	}

	// Must be admin
	if (!session.user?.is_admin) {
		throw redirect(303, '/error?error=forbidden&error_description=Admin+access+required');
	}

	// Get access token from cookie
	const accessToken = cookies.get('access_token');
	if (!accessToken) {
		// No access token, redirect to home to re-authenticate
		throw redirect(303, '/');
	}

	// Fetch files from CDN API
	try {
		const [filesResponse, foldersResponse, auditResponse] = await Promise.all([
			fetch('https://auth-api.grove.place/cdn/files?limit=50&offset=0', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}),
			fetch('https://auth-api.grove.place/cdn/folders', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}),
			fetch('https://auth-api.grove.place/cdn/audit', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}),
		]);

		if (!filesResponse.ok || !foldersResponse.ok) {
			if (filesResponse.status === 401 || filesResponse.status === 403 || foldersResponse.status === 401 || foldersResponse.status === 403) {
				throw redirect(303, '/');
			}
			throw error(500, 'Failed to load CDN files');
		}

		const filesData = await filesResponse.json();
		const foldersData = await foldersResponse.json();
		const auditData = auditResponse.ok ? await auditResponse.json() : null;

		return {
			files: filesData.files || [],
			total: filesData.total || 0,
			folders: foldersData.folders || [],
			audit: auditData,
			cdnUrl: 'https://cdn.grove.place',
			accessToken, // Pass to client for API calls
			user: session.user,
		};
	} catch (err) {
		if (err instanceof Response || (err as any)?.status) {
			throw err;
		}
		console.error('[CDN Load Error]', err);
		throw redirect(303, '/error?error=api_error&error_description=Failed+to+load+CDN+data');
	}
};
