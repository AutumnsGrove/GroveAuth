/**
 * CDN Manager - Server Load
 * Loads files and folders for the CDN manager at admin.grove.place
 */

import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	// Get session token from cookie
	const sessionToken = cookies.get('session');

	if (!sessionToken) {
		throw redirect(302, '/login');
	}

	// Get access token from session
	const tokenResponse = await fetch('https://auth-api.grove.place/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			grant_type: 'session_token',
			session_token: sessionToken,
		}),
	});

	if (!tokenResponse.ok) {
		throw redirect(302, '/login');
	}

	const tokenData = await tokenResponse.json();
	const accessToken = tokenData.access_token;

	// Fetch files from CDN API
	try {
		const [filesResponse, foldersResponse] = await Promise.all([
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
		]);

		if (!filesResponse.ok || !foldersResponse.ok) {
			throw error(500, 'Failed to load CDN files');
		}

		const filesData = await filesResponse.json();
		const foldersData = await foldersResponse.json();

		return {
			files: filesData.files || [],
			total: filesData.total || 0,
			folders: foldersData.folders || [],
			cdnUrl: 'https://cdn.grove.place',
			accessToken, // Pass to client for API calls
		};
	} catch (err) {
		console.error('[CDN Load Error]', err);
		throw error(500, 'Failed to load CDN data');
	}
};
