<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import { theme } from '$lib/theme';
	import { Sun, Moon, Cloud, Upload } from 'lucide-svelte';
	import type { PageData } from './$types';

	interface CdnFile {
		id: string;
		filename: string;
		original_filename: string;
		key: string;
		content_type: string;
		size_bytes: number;
		folder: string;
		alt_text: string | null;
		uploaded_by: string;
		created_at: string;
		url: string;
	}

	let { data }: { data: PageData } = $props();

	// State
	let files = $state(data.files as CdnFile[]);
	let folders = $state(data.folders as string[]);
	let isDragging = $state(false);
	let isUploading = $state(false);
	let uploadProgress = $state<{ name: string; progress: number }[]>([]);
	let errorMessage = $state('');
	let successMessage = $state('');
	let selectedFolder = $state('/');
	let newFolderName = $state('');
	let showNewFolder = $state(false);
	let copiedId = $state<string | null>(null);
	let deleteConfirmId = $state<string | null>(null);
	let isMigrating = $state(false);
	let migrateResult = $state<{ migrated: number; errors?: string[] } | null>(null);

	const accessToken = data.accessToken;
	const user = data.user;

	// Theme toggle
	function toggleTheme() {
		theme.toggle();
	}

	let isDark = $derived($theme);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getFileIcon(contentType: string): string {
		if (contentType.startsWith('image/')) return 'image';
		if (contentType.startsWith('video/')) return 'video';
		if (contentType.startsWith('audio/')) return 'audio';
		if (contentType === 'application/pdf') return 'pdf';
		if (contentType.startsWith('font/')) return 'font';
		if (contentType.includes('javascript') || contentType.includes('json') || contentType === 'text/css')
			return 'code';
		return 'file';
	}

	function isImage(contentType: string): boolean {
		return contentType.startsWith('image/') && contentType !== 'image/svg+xml';
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles) {
			await uploadFiles(Array.from(droppedFiles));
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			await uploadFiles(Array.from(input.files));
			input.value = '';
		}
	}

	async function uploadFiles(filesToUpload: File[]) {
		if (filesToUpload.length === 0) return;

		isUploading = true;
		errorMessage = '';
		successMessage = '';
		uploadProgress = filesToUpload.map((f) => ({ name: f.name, progress: 0 }));

		const folder = showNewFolder && newFolderName ? `/${newFolderName.replace(/^\/+|\/+$/g, '')}` : selectedFolder;

		let successCount = 0;

		for (let i = 0; i < filesToUpload.length; i++) {
			const file = filesToUpload[i];
			const formData = new FormData();
			formData.append('file', file);
			formData.append('folder', folder);

			try {
				uploadProgress[i].progress = 50;

				const response = await fetch('https://auth-api.grove.place/cdn/upload', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
					body: formData
				});

				const result = (await response.json()) as { success?: boolean; file?: CdnFile; error?: string };

				if (response.ok && result.success) {
					uploadProgress[i].progress = 100;
					files = [result.file as CdnFile, ...files];
					if (!folders.includes(folder)) {
						folders = [...folders, folder].sort();
					}
					successCount++;
				} else {
					throw new Error(result.error || 'Upload failed');
				}
			} catch (err) {
				errorMessage = err instanceof Error ? err.message : 'Upload failed';
				uploadProgress[i].progress = -1;
			}
		}

		isUploading = false;

		if (successCount > 0) {
			successMessage = `Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`;
			setTimeout(() => {
				successMessage = '';
			}, 3000);
		}

		if (showNewFolder && newFolderName && successCount > 0) {
			selectedFolder = folder;
			showNewFolder = false;
			newFolderName = '';
		}
	}

	async function copyUrl(file: CdnFile) {
		await navigator.clipboard.writeText(file.url);
		copiedId = file.id;
		setTimeout(() => {
			copiedId = null;
		}, 2000);
	}

	async function deleteFile(id: string) {
		try {
			const response = await fetch(`https://auth-api.grove.place/cdn/files/${id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${accessToken}`,
				}
			});

			if (response.ok) {
				files = files.filter((f) => f.id !== id);
				successMessage = 'File deleted successfully';
				setTimeout(() => {
					successMessage = '';
				}, 3000);
			} else {
				const result = (await response.json()) as { error?: string };
				throw new Error(result.error || 'Delete failed');
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Delete failed';
		}
		deleteConfirmId = null;
	}

	async function migrateUntrackedFiles() {
		isMigrating = true;
		errorMessage = '';
		migrateResult = null;

		try {
			const response = await fetch('https://auth-api.grove.place/cdn/migrate', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
				}
			});

			const result = await response.json();

			if (response.ok && result.success) {
				migrateResult = {
					migrated: result.migrated,
					errors: result.errors
				};
				successMessage = `Successfully migrated ${result.migrated} file${result.migrated !== 1 ? 's' : ''}`;

				// Reload the page to refresh the audit data
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			} else {
				throw new Error(result.error || 'Migration failed');
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Migration failed';
		} finally {
			isMigrating = false;
		}
	}
</script>

<svelte:head>
	<title>CDN Manager - Heartwood</title>
</svelte:head>

<main class="min-h-screen p-6 md:p-8">
	<!-- Header -->
	<header class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
		<div class="flex items-center gap-4">
			<Logo size="sm" />
			<div>
				<h1 class="text-2xl font-serif text-bark dark:text-gray-100">CDN Manager</h1>
				<p class="text-sm text-bark/60 dark:text-gray-400 font-sans">
					{files.length} tracked file{files.length !== 1 ? 's' : ''}
					{#if data.audit}
						<span class="text-bark/40 dark:text-gray-500">
							/ {data.audit.summary.total_r2_objects} total in CDN
						</span>
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<a href="/dashboard" class="text-sm text-bark/60 dark:text-gray-400 hover:text-bark dark:hover:text-gray-200 font-sans transition-colors">
				← Back to Dashboard
			</a>
			<span class="text-sm text-bark/60 dark:text-gray-400 font-sans">
				{user?.email}
			</span>
			<button
				onclick={toggleTheme}
				class="p-2 rounded-lg bg-grove-100 dark:bg-gray-700 hover:bg-grove-200 dark:hover:bg-gray-600 transition-colors"
				aria-label="Toggle theme"
			>
				{#if isDark}
					<Sun size={20} class="text-yellow-400" />
				{:else}
					<Moon size={20} class="text-gray-700" />
				{/if}
			</button>
		</div>
	</header>

	<!-- Audit Warning -->
	{#if data.audit && data.audit.summary.untracked_in_r2 > 0}
		<div class="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-4 rounded-lg">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1">
					<h3 class="font-serif font-semibold mb-2">⚠️ Untracked Files Detected</h3>
					<p class="font-sans text-sm mb-3">
						Found {data.audit.summary.untracked_in_r2} file{data.audit.summary.untracked_in_r2 > 1 ? 's' : ''} in R2 that {data.audit.summary.untracked_in_r2 > 1 ? 'are' : 'is'} not tracked in the database.
						These files exist in your CDN but won't show up in this manager.
					</p>
					<details class="text-sm mb-3">
						<summary class="cursor-pointer hover:text-amber-900 dark:hover:text-amber-200 font-sans font-medium mb-2">
							Show untracked files
						</summary>
						<ul class="space-y-1 mt-2 ml-4 font-mono text-xs">
							{#each data.audit.untracked_files as untrackedFile}
								<li class="flex items-center justify-between gap-4 py-1">
									<span class="truncate">{untrackedFile.key}</span>
									<span class="text-bark/50 dark:text-gray-500 whitespace-nowrap">{formatBytes(untrackedFile.size)}</span>
								</li>
							{/each}
						</ul>
					</details>
					<button
						onclick={migrateUntrackedFiles}
						disabled={isMigrating}
						class="px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white rounded-lg font-sans text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isMigrating}
							Migrating...
						{:else}
							Migrate All to Database
						{/if}
					</button>
					{#if migrateResult}
						<p class="mt-3 text-sm font-sans text-grove-700 dark:text-grove-400">
							✓ Successfully migrated {migrateResult.migrated} file{migrateResult.migrated !== 1 ? 's' : ''}
							{#if migrateResult.errors && migrateResult.errors.length > 0}
								<span class="text-red-600 dark:text-red-400">with {migrateResult.errors.length} error(s)</span>
							{/if}
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Messages -->
	{#if errorMessage}
		<div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
			<span class="font-sans text-sm">{errorMessage}</span>
			<button onclick={() => (errorMessage = '')} class="text-red-500 hover:text-red-700 dark:hover:text-red-300" aria-label="Dismiss error">
				<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
					<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
				</svg>
			</button>
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-6 bg-grove-50 dark:bg-grove-900/20 border border-grove-200 dark:border-grove-800 text-grove-700 dark:text-grove-400 px-4 py-3 rounded-lg">
			<span class="font-sans text-sm">{successMessage}</span>
		</div>
	{/if}

	<!-- Upload Zone -->
	<section class="mb-8">
		<div class="card p-8">
			<div
				class="border-2 border-dashed rounded-xl p-8 text-center transition-colors {isDragging
					? 'border-grove-500 bg-grove-50 dark:bg-grove-900/20'
					: 'border-grove-300 dark:border-gray-600 hover:border-grove-400 dark:hover:border-grove-500'}"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				role="button"
				tabindex="0"
			>
				<Upload size={48} class="mx-auto mb-4 text-grove-400" />

				<p class="text-bark/70 dark:text-gray-400 font-sans mb-4">
					Drag & drop files here, or
					<label class="text-grove-600 dark:text-grove-400 hover:text-grove-700 dark:hover:text-grove-300 cursor-pointer underline">
						browse
						<input type="file" multiple class="hidden" onchange={handleFileSelect} />
					</label>
				</p>

				<!-- Folder Selection -->
				<div class="flex items-center justify-center gap-4 mb-4">
					<div class="flex items-center gap-2">
						<label for="folder-select" class="text-sm text-bark/60 dark:text-gray-400 font-sans">Folder:</label>
						{#if showNewFolder}
							<input
								type="text"
								bind:value={newFolderName}
								placeholder="folder-name"
								class="px-3 py-1.5 text-sm border border-grove-300 dark:border-gray-600 rounded-lg focus:border-grove-500 focus:outline-none bg-white dark:bg-gray-800 text-bark dark:text-gray-100"
							/>
							<button
								onclick={() => {
									showNewFolder = false;
									newFolderName = '';
								}}
								class="text-bark/50 dark:text-gray-500 hover:text-bark dark:hover:text-gray-300 text-sm"
							>
								Cancel
							</button>
						{:else}
							<select
								id="folder-select"
								bind:value={selectedFolder}
								class="px-3 py-1.5 text-sm border border-grove-300 dark:border-gray-600 rounded-lg focus:border-grove-500 focus:outline-none bg-white dark:bg-gray-800 text-bark dark:text-gray-100"
							>
								<option value="/">/ (root)</option>
								{#each folders.filter((f) => f !== '/') as folder}
									<option value={folder}>{folder}</option>
								{/each}
							</select>
							<button
								onclick={() => (showNewFolder = true)}
								class="text-grove-600 dark:text-grove-400 hover:text-grove-700 dark:hover:text-grove-300 text-sm font-sans"
							>
								+ New folder
							</button>
						{/if}
					</div>
				</div>

				<p class="text-xs text-bark/40 dark:text-gray-500 font-sans">
					Max 50MB. Images, PDFs, videos, fonts, and code files supported.
				</p>
			</div>

			<!-- Upload Progress -->
			{#if isUploading && uploadProgress.length > 0}
				<div class="mt-4 space-y-2">
					{#each uploadProgress as item}
						<div class="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-grove-200 dark:border-gray-700">
							<span class="text-sm font-sans text-bark/70 dark:text-gray-400 flex-1 truncate">{item.name}</span>
							{#if item.progress === -1}
								<span class="text-xs text-red-500 font-sans">Failed</span>
							{:else if item.progress === 100}
								<svg class="w-5 h-5 text-grove-500" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
										clip-rule="evenodd"
									/>
								</svg>
							{:else}
								<div class="w-24 h-2 bg-grove-100 dark:bg-gray-700 rounded-full overflow-hidden">
									<div
										class="h-full bg-grove-500 transition-all duration-300"
										style="width: {item.progress}%"
									></div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	<!-- Files Grid -->
	<section>
		<h2 class="text-lg font-serif text-bark dark:text-gray-100 mb-4">Uploaded Files</h2>

		{#if files.length === 0}
			<div class="card text-center py-12">
				<Cloud size={64} class="mx-auto mb-4 text-grove-300 dark:text-gray-600" />
				<p class="text-bark/50 dark:text-gray-400 font-sans">No files uploaded yet</p>
				<p class="text-sm text-bark/40 dark:text-gray-500 font-sans mt-1">Drop files above to get started</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{#each files as file (file.id)}
					<div class="card overflow-hidden hover:shadow-lg transition-shadow group">
						<!-- Preview -->
						<div class="aspect-square bg-grove-50 dark:bg-gray-800 flex items-center justify-center relative">
							{#if isImage(file.content_type)}
								<img
									src={file.url}
									alt={file.alt_text || file.original_filename}
									class="w-full h-full object-cover"
								/>
							{:else}
								<div class="text-grove-400 dark:text-gray-500">
									<Cloud size={48} />
								</div>
							{/if}

							<!-- Delete Confirmation Overlay -->
							{#if deleteConfirmId === file.id}
								<div class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4">
									<p class="text-white text-sm font-sans mb-3 text-center">Delete this file?</p>
									<div class="flex gap-2">
										<button
											onclick={() => deleteFile(file.id)}
											class="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
										>
											Delete
										</button>
										<button
											onclick={() => (deleteConfirmId = null)}
											class="px-3 py-1.5 bg-white text-bark text-sm rounded-lg hover:bg-gray-100 transition-colors"
										>
											Cancel
										</button>
									</div>
								</div>
							{/if}
						</div>

						<!-- Info -->
						<div class="p-3">
							<p class="text-sm font-sans text-bark dark:text-gray-100 truncate" title={file.original_filename}>
								{file.original_filename}
							</p>
							<div class="flex items-center gap-2 mt-1 text-xs text-bark/50 dark:text-gray-400 font-sans">
								<span>{formatBytes(file.size_bytes)}</span>
								<span>•</span>
								<span>{formatDate(file.created_at)}</span>
							</div>
							{#if file.folder !== '/'}
								<p class="text-xs text-grove-600 dark:text-grove-400 font-sans mt-1">{file.folder}</p>
							{/if}

							<!-- Actions -->
							<div class="flex items-center gap-2 mt-3">
								<button
									onclick={() => copyUrl(file)}
									class="flex-1 px-2 py-1.5 text-xs font-sans bg-grove-50 dark:bg-gray-700 text-grove-700 dark:text-grove-400 rounded-lg hover:bg-grove-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1"
								>
									{#if copiedId === file.id}
										✓ Copied!
									{:else}
										Copy URL
									{/if}
								</button>
								<a
									href={file.url}
									target="_blank"
									rel="noopener noreferrer"
									class="p-1.5 text-bark/40 dark:text-gray-500 hover:text-grove-600 dark:hover:text-grove-400 transition-colors"
									title="Open in new tab"
								>
									<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
											clip-rule="evenodd"
										/>
										<path
											fill-rule="evenodd"
											d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
											clip-rule="evenodd"
										/>
									</svg>
								</a>
								<button
									onclick={() => (deleteConfirmId = file.id)}
									class="p-1.5 text-bark/40 dark:text-gray-500 hover:text-red-500 transition-colors"
									title="Delete file"
								>
									<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</main>
