/**
 * CDN Routes - File upload and management for cdn.grove.place
 * All routes require admin access
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { verifyAccessToken } from '../services/jwt.js';
import { isUserAdmin } from '../db/queries.js';
import { createDbSession } from '../db/session.js';

const cdn = new Hono<{ Bindings: Env }>();

// Allowed MIME types (expanded from images-only to support all web assets)
const ALLOWED_TYPES = [
	// Images
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'image/avif',
	'image/bmp',
	'image/x-icon',
	// Videos
	'video/mp4',
	'video/webm',
	'video/ogg',
	'video/quicktime',
	// Audio
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'audio/webm',
	// Fonts
	'font/ttf',
	'font/otf',
	'font/woff',
	'font/woff2',
	'application/font-woff',
	'application/font-woff2',
	// Documents
	'application/pdf',
	// Web assets
	'text/css',
	'text/javascript',
	'application/javascript',
	'application/json',
	// Archives (for font packages, etc)
	'application/zip',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Middleware: Verify admin access
 */
cdn.use('/*', async (c, next) => {
	const authHeader = c.req.header('Authorization');

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return c.json({ error: 'unauthorized', error_description: 'Missing or invalid token' }, 401);
	}

	const token = authHeader.substring(7);
	const payload = await verifyAccessToken(c.env, token);

	if (!payload) {
		return c.json({ error: 'invalid_token', error_description: 'Token is invalid or expired' }, 401);
	}

	const db = createDbSession(c.env);
	const isAdmin = await isUserAdmin(db, payload.sub);
	if (!isAdmin) {
		return c.json({ error: 'forbidden', error_description: 'Admin access required' }, 403);
	}

	// Store user ID for later use
	c.set('userId', payload.sub);

	await next();
});

/**
 * Generate a unique ID for files
 */
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename: string): string {
	// Get extension
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const baseName = filename.substring(0, filename.length - ext.length - 1);

	// Sanitize base name
	const clean = baseName
		.toLowerCase()
		.replace(/[^a-z0-9-_]/g, '-')
		.replace(/-+/g, '-')
		.substring(0, 100); // Limit length

	// Add timestamp to prevent collisions
	const timestamp = Date.now().toString(36);

	return `${clean}-${timestamp}.${ext}`;
}

/**
 * POST /cdn/upload - Upload a file to the CDN
 */
cdn.post('/upload', async (c) => {
	const userId = c.get('userId');
	const db = createDbSession(c.env);

	try {
		const formData = await c.req.formData();
		const file = formData.get('file') as File | null;
		const folder = (formData.get('folder') as string) || '/';
		const altText = (formData.get('alt_text') as string) || null;

		if (!file) {
			return c.json({ error: 'No file provided' }, 400);
		}

		// Validate file type
		if (!ALLOWED_TYPES.includes(file.type)) {
			return c.json(
				{
					error: `Invalid file type: ${file.type}. Allowed types: images, videos, audio, fonts, PDFs, CSS, JS`,
				},
				400
			);
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			return c.json({ error: `File too large. Maximum size is 50MB` }, 400);
		}

		const originalFilename = file.name;
		const sanitizedFilename = sanitizeFilename(originalFilename);

		// Build R2 key: folder/filename
		const normalizedFolder = folder.startsWith('/') ? folder.substring(1) : folder;
		const key = normalizedFolder ? `${normalizedFolder}/${sanitizedFilename}` : sanitizedFilename;

		// Upload to R2
		const arrayBuffer = await file.arrayBuffer();

		const customMetadata: Record<string, string> = {
			originalFilename,
			uploadedBy: userId,
		};
		if (altText) {
			customMetadata.altText = altText;
		}

		await c.env.CDN_BUCKET.put(key, arrayBuffer, {
			httpMetadata: {
				contentType: file.type,
				cacheControl: 'public, max-age=31536000, immutable',
			},
			customMetadata,
		});

		// Store metadata in database
		const fileId = generateId();
		const now = new Date().toISOString();

		await db
			.prepare(
				`INSERT INTO cdn_files (id, filename, original_filename, key, content_type, size_bytes, folder, alt_text, uploaded_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				fileId,
				sanitizedFilename,
				originalFilename,
				key,
				file.type,
				file.size,
				folder,
				altText,
				userId,
				now,
				now
			)
			.run();

		const cdnUrl = `${c.env.CDN_URL}/${key}`;

		return c.json({
			success: true,
			file: {
				id: fileId,
				filename: sanitizedFilename,
				original_filename: originalFilename,
				key,
				content_type: file.type,
				size_bytes: file.size,
				folder,
				alt_text: altText,
				uploaded_by: userId,
				created_at: now,
				url: cdnUrl,
			},
		});
	} catch (error) {
		console.error('[CDN Upload Error]', error);
		return c.json({ error: 'Failed to upload file' }, 500);
	}
});

/**
 * GET /cdn/files - List files with pagination and filtering
 */
cdn.get('/files', async (c) => {
	const db = createDbSession(c.env);

	try {
		const limit = parseInt(c.req.query('limit') || '50');
		const offset = parseInt(c.req.query('offset') || '0');
		const folder = c.req.query('folder') || null;

		let query = 'SELECT * FROM cdn_files';
		const params: (string | number)[] = [];

		if (folder) {
			query += ' WHERE folder = ?';
			params.push(folder);
		}

		query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
		params.push(limit, offset);

		const result = await db.prepare(query).bind(...params).all();

		// Get total count
		let countQuery = 'SELECT COUNT(*) as total FROM cdn_files';
		const countParams: string[] = [];
		if (folder) {
			countQuery += ' WHERE folder = ?';
			countParams.push(folder);
		}
		const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();
		const total = countResult?.total || 0;

		// Add URLs to files
		const files = (result.results || []).map((file: any) => ({
			...file,
			url: `${c.env.CDN_URL}/${file.key}`,
		}));

		return c.json({
			files,
			total,
			limit,
			offset,
		});
	} catch (error) {
		console.error('[CDN List Error]', error);
		return c.json({ error: 'Failed to list files' }, 500);
	}
});

/**
 * GET /cdn/folders - List all unique folders
 */
cdn.get('/folders', async (c) => {
	const db = createDbSession(c.env);

	try {
		const result = await db.prepare('SELECT DISTINCT folder FROM cdn_files ORDER BY folder').all();

		const folders = (result.results || []).map((row: any) => row.folder);

		return c.json({ folders });
	} catch (error) {
		console.error('[CDN Folders Error]', error);
		return c.json({ error: 'Failed to list folders' }, 500);
	}
});

/**
 * DELETE /cdn/files/:id - Delete a file
 */
cdn.delete('/files/:id', async (c) => {
	const db = createDbSession(c.env);
	const fileId = c.req.param('id');

	try {
		// Get file metadata
		const file = await db.prepare('SELECT * FROM cdn_files WHERE id = ?').bind(fileId).first<{
			id: string;
			key: string;
		}>();

		if (!file) {
			return c.json({ error: 'File not found' }, 404);
		}

		// Delete from R2
		await c.env.CDN_BUCKET.delete(file.key);

		// Delete from database
		await db.prepare('DELETE FROM cdn_files WHERE id = ?').bind(fileId).run();

		return c.json({ success: true, message: 'File deleted' });
	} catch (error) {
		console.error('[CDN Delete Error]', error);
		return c.json({ error: 'Failed to delete file' }, 500);
	}
});

export default cdn;
