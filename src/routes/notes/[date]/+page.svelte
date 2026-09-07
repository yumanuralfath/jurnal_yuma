<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { humanDateLabel } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { getSyncStatus, syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Dialog, Tabs } from 'bits-ui';
	import type { PriorityItem } from '$lib/types';

	let { data } = $props();

	let weather = $state('');
	let noteContent = $state('');
	let priorityItems = $state<PriorityItem[]>([]);
	let dayName = $state('');
	let tags = $state<string[]>(['Daily']);
	let createdAt = $state('');
	let newItemText = $state('');
	let status = $state('');
	let saving = $state(false);
	let pushing = $state(false);
	let refetchingWeather = $state(false);
	let mode = $state<'view' | 'edit'>('view');
	let deleteOpen = $state(false);
	let syncStatus = $state<SyncStatus>('never');
	/** Prefill dari GitHub: jangan overwrite form sampai user Simpan. */
	let holdGithubPrefill = $state(false);
	let lastStamp = $state('');
	let modeInitialized = $state(false);

	$effect.pre(() => {
		const note = data.note;
		const stamp = `${note.date}:${note.updated_at}:${note.synced_at ?? ''}`;
		syncStatus = getSyncStatus(note);

		const prevDate = lastStamp.split(':')[0] ?? '';
		if (prevDate && prevDate !== note.date) {
			holdGithubPrefill = false;
			modeInitialized = false;
		}

		if (holdGithubPrefill) return;
		if (stamp === lastStamp) return;

		weather = note.weather;
		noteContent = note.note_content;
		priorityItems = structuredClone(note.priority_items);
		dayName = note.day_name;
		tags = [...note.tags];
		createdAt = note.created_at;
		lastStamp = stamp;

		if (!modeInitialized) {
			mode = data.isNew || !note.note_content ? 'edit' : 'view';
			modeInitialized = true;
		}
	});

	onMount(() => {
		if (page.url.searchParams.get('prefill') !== 'github') return;
		const key = `github-prefill:${data.note.date}`;
		const raw = sessionStorage.getItem(key);
		if (!raw) return;
		sessionStorage.removeItem(key);
		try {
			const prefill = JSON.parse(raw) as {
				weather?: string;
				note_content?: string;
				priority_items?: PriorityItem[];
				day_name?: string;
				tags?: string[];
				created_at?: string;
			};
			weather = prefill.weather ?? '';
			noteContent = prefill.note_content ?? '';
			priorityItems = structuredClone(prefill.priority_items ?? []);
			dayName = prefill.day_name || dayName;
			tags = prefill.tags?.length ? [...prefill.tags] : tags;
			createdAt = prefill.created_at || createdAt;
			mode = 'edit';
			holdGithubPrefill = true;
			status =
				'Isi dimuat dari GitHub ke editor. Database belum diubah — tekan Simpan atau Push untuk menyimpan.';
			history.replaceState({}, '', `/notes/${data.note.date}`);
		} catch {
			status = 'Gagal memuat prefill dari GitHub.';
		}
	});

	const dateLabel = $derived(humanDateLabel(data.note.date));
	const completionPct = $derived(
		priorityItems.length === 0
			? 0
			: Math.round((priorityItems.filter((i) => i.done).length / priorityItems.length) * 1000) / 10
	);
	const renderedNote = $derived(renderMarkdown(noteContent));
	const dirtyLocal = $derived(
		weather !== data.note.weather ||
			noteContent !== data.note.note_content ||
			JSON.stringify(priorityItems) !== JSON.stringify(data.note.priority_items) ||
			holdGithubPrefill
	);

	function addItem() {
		const text = newItemText.trim();
		if (!text) return;
		priorityItems = [...priorityItems, { text, done: false }];
		newItemText = '';
	}

	function removeItem(index: number) {
		priorityItems = priorityItems.filter((_, i) => i !== index);
	}

	function moveItem(index: number, dir: -1 | 1) {
		const next = index + dir;
		if (next < 0 || next >= priorityItems.length) return;
		const copy = [...priorityItems];
		const [item] = copy.splice(index, 1);
		copy.splice(next, 0, item);
		priorityItems = copy;
	}

	function toggleDone(index: number) {
		priorityItems = priorityItems.map((item, i) =>
			i === index ? { ...item, done: !item.done } : item
		);
	}

	function badgeClass(s: SyncStatus) {
		switch (s) {
			case 'synced':
				return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
			case 'dirty':
				return 'bg-amber-50 text-amber-900 ring-amber-200';
			case 'never':
				return 'bg-stone-100 text-stone-600 ring-stone-200';
		}
	}

	async function refetchWeather() {
		refetchingWeather = true;
		try {
			const res = await fetch('/api/weather');
			const json = await res.json();
			if (json.weather) weather = json.weather;
		} finally {
			refetchingWeather = false;
		}
	}

	async function saveToDb() {
		saving = true;
		status = '';
		try {
			const res = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: data.note.date,
					weather,
					note_content: noteContent,
					priority_items: priorityItems,
					created_at: createdAt,
					day_name: dayName,
					tags
				})
			});
			if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal simpan');
			holdGithubPrefill = false;
			status = 'Tersimpan ke database. Status: perlu push ke GitHub.';
			syncStatus = data.note.github_sha || syncStatus === 'synced' ? 'dirty' : 'never';
			await invalidateAll();
			return true;
		} catch (e) {
			status = e instanceof Error ? e.message : 'Gagal simpan';
			return false;
		} finally {
			saving = false;
		}
	}

	async function pushToGithub() {
		pushing = true;
		status = '';
		try {
			const saved = await saveToDb();
			if (!saved) return;
			const res = await fetch(`/api/notes/${data.note.date}/push`, { method: 'POST' });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Gagal push');
			holdGithubPrefill = false;
			status = `Berhasil push ke GitHub (${json.path}). Deploy otomatis akan jalan.`;
			syncStatus = 'synced';
			await invalidateAll();
		} catch (e) {
			status = e instanceof Error ? e.message : 'Gagal push';
		} finally {
			pushing = false;
		}
	}

	let uploadingImage = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	async function uploadImageFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		uploadingImage = true;
		const placeholder = `\n![Mengupload ${file.name}...]()\n`;

		const el = textareaEl;
		const startPos = el ? el.selectionStart : noteContent.length;
		const endPos = el ? el.selectionEnd : noteContent.length;

		const prevContent = noteContent;
		noteContent = prevContent.slice(0, startPos) + placeholder + prevContent.slice(endPos);

		try {
			const form = new FormData();
			form.append('file', file);

			const res = await fetch('/api/upload', {
				method: 'POST',
				body: form
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Gagal upload gambar');

			const markdownImage = `\n![](${json.url})\n`;
			noteContent = noteContent.replace(placeholder, markdownImage);
			status = 'Gambar berhasil diunggah ke Cloudinary dan disisipkan.';
		} catch (e) {
			noteContent = noteContent.replace(placeholder, '');
			status = e instanceof Error ? e.message : 'Gagal upload gambar';
		} finally {
			uploadingImage = false;
		}
	}

	function handleFileInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			uploadImageFile(file);
			target.value = '';
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					uploadImageFile(file);
					return;
				}
			}
		}
	}

	function handleDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file.type.startsWith('image/')) {
				e.preventDefault();
				uploadImageFile(file);
				return;
			}
		}
	}

	async function deleteNote() {
		const res = await fetch(`/api/notes/${data.note.date}/delete`, { method: 'POST' });
		if (res.ok) goto('/');
		else status = 'Gagal menghapus note.';
		deleteOpen = false;
	}
</script>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
	<a href="/" class="inline-flex text-sm text-stone-500 transition hover:text-stone-800">&larr; Kembali</a>

	<header class="space-y-3">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-stone-900">{dateLabel}</h1>
				<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
					<span>{weather || 'cuaca belum terisi'}</span>
					{#if mode === 'edit'}
						<button
							onclick={refetchWeather}
							disabled={refetchingWeather}
							class="text-xs text-teal-700 underline-offset-2 hover:underline disabled:opacity-50"
						>
							{refetchingWeather ? 'mengambil…' : 'refresh cuaca'}
						</button>
					{/if}
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<span class="rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 {badgeClass(syncStatus)}">
					{syncStatusLabel(syncStatus)}
				</span>
				{#if dirtyLocal}
					<span class="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
						Belum disimpan
					</span>
				{/if}
			</div>
		</div>

		{#if data.note.synced_at}
			<p class="text-xs text-stone-400">
				Terakhir push: {new Date(data.note.synced_at).toLocaleString('id-ID')}
				{#if data.note.github_path}
					· <span class="font-mono">{data.note.github_path}</span>
				{/if}
			</p>
		{:else if data.note.github_path}
			<p class="text-xs text-amber-700/80">
				Pernah di-push ke <span class="font-mono">{data.note.github_path}</span>, ada perubahan lokal yang belum
				di-push.
			</p>
		{:else}
			<p class="text-xs text-stone-400">Note ini masih draft — belum pernah di-push ke GitHub.</p>
		{/if}

		<p class="text-xs">
			<a href="/notebook/{data.note.date}" class="text-teal-800 underline-offset-2 hover:underline">
				Buka di Buku Catatan
			</a>
			<span class="text-stone-400"> · </span>
			<a href="/github/{data.note.date}" class="text-teal-800 underline-offset-2 hover:underline">
				Lihat versi GitHub
			</a>
		</p>
	</header>

	<Tabs.Root bind:value={mode} class="space-y-5">
		<Tabs.List class="inline-grid grid-cols-2 gap-1 rounded-lg bg-stone-200/70 p-1 text-sm font-medium text-stone-600">
			<Tabs.Trigger
				value="view"
				class="rounded-md px-4 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				View
			</Tabs.Trigger>
			<Tabs.Trigger
				value="edit"
				class="rounded-md px-4 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				Edit
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="view" class="space-y-6 outline-none">
			<section class="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-stone-800">Priority</h2>
					<span class="text-xs text-stone-500">{completionPct}%</span>
				</div>
				{#if priorityItems.length === 0}
					<p class="text-sm text-stone-400">Belum ada prioritas.</p>
				{:else}
					<ul class="space-y-2">
						{#each priorityItems as item, i (`${i}-${item.text}`)}
							<li class="flex items-start gap-3 text-sm">
								<span
									class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border {item.done
										? 'border-teal-700 bg-teal-700 text-white'
										: 'border-stone-300'}"
									aria-hidden="true"
								>
									{#if item.done}✓{/if}
								</span>
								<span class:line-through={item.done} class:text-stone-400={item.done} class="leading-relaxed">
									{item.text}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold text-stone-800">Note</h2>
				{#if noteContent.trim()}
					<div class="prose-note">{@html renderedNote}</div>
				{:else}
					<p class="text-sm text-stone-400">Kosong. Buka mode Edit untuk menulis.</p>
				{/if}
			</section>
		</Tabs.Content>

		<Tabs.Content value="edit" class="space-y-6 outline-none">
			<section class="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-stone-800">Priority</h2>
					<span class="text-xs text-stone-500">{completionPct}%</span>
				</div>
				<ul class="space-y-2">
					{#each priorityItems as item, i (`edit-${i}-${item.text}`)}
						<li class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={item.done}
								onchange={() => toggleDone(i)}
								class="size-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
							/>
							<span
								class="min-w-0 flex-1 text-sm"
								class:line-through={item.done}
								class:text-stone-400={item.done}
							>
								{item.text}
							</span>
							<div class="flex shrink-0 items-center gap-0.5">
								<button
									type="button"
									onclick={() => moveItem(i, -1)}
									disabled={i === 0}
									class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30"
									aria-label="Naikkan"
								>
									↑
								</button>
								<button
									type="button"
									onclick={() => moveItem(i, 1)}
									disabled={i === priorityItems.length - 1}
									class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30"
									aria-label="Turunkan"
								>
									↓
								</button>
								<button
									type="button"
									onclick={() => removeItem(i)}
									class="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
								>
									hapus
								</button>
							</div>
						</li>
					{/each}
				</ul>
				<div class="flex gap-2">
					<input
						bind:value={newItemText}
						placeholder="Tambah prioritas…"
						class="flex-1 rounded-lg border-stone-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
						onkeydown={(e) => e.key === 'Enter' && addItem()}
					/>
					<button
						onclick={addItem}
						class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
					>
						Tambah
					</button>
				</div>
			</section>

			<section class="space-y-2 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
				<label class="block text-sm font-semibold text-stone-800" for="weather-input">Cuaca</label>
				<input
					id="weather-input"
					bind:value={weather}
					class="mb-4 w-full rounded-lg border-stone-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
				/>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<label class="block text-sm font-semibold text-stone-800" for="note-editor">Note (Markdown)</label>
					<div class="flex items-center gap-2">
						{#if uploadingImage}
							<span class="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 animate-pulse">
								<span class="size-2 rounded-full bg-teal-600"></span>
								Mengupload ke Cloudinary…
							</span>
						{/if}
						<label
							class="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm cursor-pointer hover:bg-stone-50 transition {uploadingImage ? 'opacity-50 pointer-events-none' : ''}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
								<circle cx="9" cy="9" r="2"/>
								<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
							</svg>
							<span>Upload Foto</span>
							<input
								type="file"
								accept="image/*"
								class="sr-only"
								onchange={handleFileInput}
								disabled={uploadingImage}
							/>
						</label>
					</div>
				</div>

				<textarea
					id="note-editor"
					bind:this={textareaEl}
					bind:value={noteContent}
					onpaste={handlePaste}
					ondrop={handleDrop}
					ondragover={(e) => e.preventDefault()}
					placeholder="Tulis dalam markdown…"
					rows="16"
					class="w-full rounded-lg border-stone-300 p-3 font-mono text-sm leading-relaxed shadow-sm focus:border-teal-600 focus:ring-teal-600"
				></textarea>

				<p class="text-[11px] text-stone-400">
					Tips: Kamu bisa <strong class="font-medium text-stone-600">Paste (Ctrl+V)</strong> screenshot atau <strong class="font-medium text-stone-600">Drag & Drop</strong> foto langsung ke kotak catatan untuk auto-upload ke Cloudinary.
				</p>
			</section>
		</Tabs.Content>
	</Tabs.Root>

	<div class="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4">
		<button
			onclick={saveToDb}
			disabled={saving || !dirtyLocal}
			class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50 disabled:opacity-50"
		>
			{saving ? 'Menyimpan…' : 'Simpan'}
		</button>
		<button
			onclick={pushToGithub}
			disabled={pushing}
			class="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
		>
			{pushing ? 'Push…' : 'Push ke GitHub'}
		</button>
		<a
			href="/github/{data.note.date}"
			class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
		>
			Lihat GitHub
		</a>

		<Dialog.Root bind:open={deleteOpen}>
			<Dialog.Trigger
				class="ml-auto rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
			>
				Hapus
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-900/40" />
				<Dialog.Content
					class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-200 bg-white p-5 shadow-xl outline-none"
				>
					<Dialog.Title class="text-base font-semibold text-stone-900">Hapus daily note?</Dialog.Title>
					<Dialog.Description class="mt-2 text-sm text-stone-600">
						Note akan dihapus dari database. Kalau sudah pernah di-push, file di GitHub juga akan dihapus.
					</Dialog.Description>
					<div class="mt-5 flex justify-end gap-2">
						<Dialog.Close class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">
							Batal
						</Dialog.Close>
						<button
							onclick={deleteNote}
							class="rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600"
						>
							Hapus
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	</div>

	{#if status}
		<p class="rounded-lg bg-white px-3 py-2 text-sm text-stone-600 ring-1 ring-stone-200">{status}</p>
	{/if}
</div>
