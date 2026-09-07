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
	let holdGithubPrefill = $state(false);
	let lastStamp = $state('');
	let modeInitialized = $state(false);

	let uploadingImage = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	// Obsidian Footer Navigation Stems
	let prevStem = $state('');
	let nextStem = $state('');
	let showFooterDetails = $state(false);

	$effect.pre(() => {
		const note = data.note;
		const stamp = `${note.date}:${note.updated_at}:${note.synced_at ?? ''}`;
		syncStatus = getSyncStatus(note);

		const prevDate = lastStamp.split(':')[0] ?? '';
		if (prevDate !== note.date) {
			prevStem = data.defaultPrevStem;
			nextStem = data.defaultNextStem;
		}

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

	function setWeatherPreset(w: string) {
		weather = w;
	}

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

	function insertFormat(before: string, after = '', defaultText = '') {
		const el = textareaEl;
		if (!el) {
			noteContent += before + defaultText + after;
			return;
		}
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const selection = noteContent.slice(start, end) || defaultText;
		noteContent = noteContent.slice(0, start) + before + selection + after + noteContent.slice(end);
		setTimeout(() => {
			el.focus();
			el.setSelectionRange(start + before.length, start + before.length + selection.length);
		}, 0);
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
			const res = await fetch(`/api/notes/${data.note.date}/push`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prevStem, nextStem })
			});
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

	async function deleteNote() {
		const res = await fetch(`/api/notes/${data.note.date}/delete`, { method: 'POST' });
		if (res.ok) goto('/');
		else status = 'Gagal menghapus note.';
		deleteOpen = false;
	}
</script>

<div class="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 pb-28 sm:pb-8">
	<!-- Top Navigation & Date Switcher -->
	<div class="flex items-center justify-between gap-2">
		<a
			href="/"
			class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-95"
		>
			&larr; <span class="hidden sm:inline">Daftar Catatan</span><span class="sm:hidden">Kembali</span>
		</a>

		<!-- Quick Day Switcher (Kemarin / Besok) -->
		<div class="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-xs text-xs font-medium text-stone-600">
			<a
				href="/notes/{data.prevDate}"
				title="Catatan tanggal {data.prevDate}"
				class="rounded-lg px-2.5 py-1 text-stone-700 hover:bg-stone-100 transition active:scale-95"
			>
				&larr; <span class="hidden sm:inline">Kemarin</span>
			</a>
			<span class="text-stone-300">|</span>
			<a
				href="/notes/{data.nextDate}"
				title="Catatan tanggal {data.nextDate}"
				class="rounded-lg px-2.5 py-1 text-stone-700 hover:bg-stone-100 transition active:scale-95"
			>
				<span class="hidden sm:inline">Besok</span> &rarr;
			</a>
		</div>
	</div>

	<!-- Note Header Card -->
	<header class="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<div class="flex items-center gap-2 flex-wrap">
					<h1 class="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">{dateLabel}</h1>
					{#if data.isToday}
						<span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
							Hari Ini
						</span>
					{:else if data.isPast}
						<span class="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200">
							Catatan Lampau
						</span>
					{/if}
				</div>

				<div class="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-stone-500">
					<span>{weather || 'Cuaca belum terisi'}</span>
					{#if mode === 'edit'}
						<button
							onclick={refetchWeather}
							disabled={refetchingWeather}
							class="text-xs text-teal-700 font-medium underline-offset-2 hover:underline disabled:opacity-50"
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

		<!-- Links Info -->
		<div class="flex flex-wrap items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500 gap-2">
			<div>
				{#if data.note.synced_at}
					<span>Terakhir push: {new Date(data.note.synced_at).toLocaleString('id-ID')}</span>
				{:else if data.note.github_path}
					<span class="text-amber-700">Pernah di-push ke GitHub, ada perubahan lokal.</span>
				{:else}
					<span>Draft lokal — belum di-push ke GitHub.</span>
				{/if}
			</div>

			<div class="flex items-center gap-3 text-xs">
				<a href="/notebook/{data.note.date}" class="font-medium text-teal-800 hover:underline">
					Buku Catatan
				</a>
				<span>·</span>
				<a href="/github/{data.note.date}" class="font-medium text-teal-800 hover:underline">
					GitHub Note
				</a>
			</div>
		</div>
	</header>

	<!-- Tabs View vs Edit -->
	<Tabs.Root bind:value={mode} class="space-y-5">
		<Tabs.List class="grid grid-cols-2 gap-1 rounded-xl bg-stone-200/80 p-1 text-sm font-semibold text-stone-600 shadow-xs">
			<Tabs.Trigger
				value="view"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
			>
				👁️ Lihat (View)
			</Tabs.Trigger>
			<Tabs.Trigger
				value="edit"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
			>
				✏️ Tulis (Edit)
			</Tabs.Trigger>
		</Tabs.List>

		<!-- MODE VIEW -->
		<Tabs.Content value="view" class="space-y-6 outline-none">
			<section class="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-bold text-stone-900">⚡ Prioritas</h2>
					<span class="text-xs font-semibold text-stone-500">{completionPct}% Selesai</span>
				</div>
				{#if priorityItems.length === 0}
					<p class="text-xs text-stone-400">Belum ada prioritas untuk hari ini.</p>
				{:else}
					<ul class="space-y-2.5">
						{#each priorityItems as item, i (`view-${i}-${item.text}`)}
							<li class="flex items-start gap-3 text-sm">
								<span
									class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border text-xs {item.done
										? 'border-teal-700 bg-teal-700 text-white'
										: 'border-stone-300 bg-stone-50'}"
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

			<section class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-bold text-stone-900">📝 Catatan</h2>
				{#if noteContent.trim()}
					<div class="prose-note">{@html renderedNote}</div>
				{:else}
					<p class="text-sm text-stone-400 py-6 text-center">Catatan masih kosong. Buka mode Tulis untuk mulai mengetik.</p>
				{/if}
			</section>
		</Tabs.Content>

		<!-- MODE EDIT -->
		<Tabs.Content value="edit" class="space-y-6 outline-none">
			<!-- Section Priority Editor -->
			<section class="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-bold text-stone-900">⚡ Daftar Prioritas</h2>
					<span class="text-xs font-semibold text-stone-500">{completionPct}% Selesai</span>
				</div>

				<ul class="space-y-2">
					{#each priorityItems as item, i (`edit-${i}-${item.text}`)}
						<li class="flex items-center gap-2.5 rounded-xl border border-stone-100 bg-stone-50/60 p-2 sm:p-2.5">
							<input
								type="checkbox"
								checked={item.done}
								onchange={() => toggleDone(i)}
								class="size-5 rounded-md border-stone-300 text-teal-700 focus:ring-teal-600 shrink-0 cursor-pointer"
							/>
							<span
								class="min-w-0 flex-1 text-sm leading-snug"
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
									class="rounded-lg p-1.5 text-xs text-stone-500 hover:bg-stone-200/70 disabled:opacity-25"
									aria-label="Naikkan"
								>
									↑
								</button>
								<button
									type="button"
									onclick={() => moveItem(i, 1)}
									disabled={i === priorityItems.length - 1}
									class="rounded-lg p-1.5 text-xs text-stone-500 hover:bg-stone-200/70 disabled:opacity-25"
									aria-label="Turunkan"
								>
									↓
								</button>
								<button
									type="button"
									onclick={() => removeItem(i)}
									class="rounded-lg p-1.5 text-xs text-red-600 hover:bg-red-50"
								>
									✕
								</button>
							</div>
						</li>
					{/each}
				</ul>

				<div class="flex gap-2 pt-1">
					<input
						bind:value={newItemText}
						placeholder="Tambah tugas/prioritas baru…"
						class="flex-1 rounded-xl border-stone-300 bg-stone-50/70 px-3.5 py-2 text-sm shadow-xs focus:border-teal-600 focus:ring-teal-600"
						onkeydown={(e) => e.key === 'Enter' && addItem()}
					/>
					<button
						onclick={addItem}
						class="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 active:scale-95"
					>
						Tambah
					</button>
				</div>
			</section>

			<!-- Section Cuaca & Input Cepat -->
			<section class="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<label class="block text-sm font-bold text-stone-900" for="weather-input">Kondisi Cuaca</label>
				<input
					id="weather-input"
					bind:value={weather}
					placeholder="Contoh: ⛅ 30°C - berawan"
					class="w-full rounded-xl border-stone-300 bg-stone-50/70 px-3.5 py-2 text-sm shadow-xs focus:border-teal-600 focus:ring-teal-600"
				/>

				<!-- Cuaca Presets Cepat -->
				<div class="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
					<span class="text-[11px] text-stone-400 font-medium">Pilih cepat:</span>
					<button
						type="button"
						onclick={() => setWeatherPreset('☀️ 32°C - cerah')}
						class="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 hover:bg-stone-100 transition"
					>
						☀️ Cerah
					</button>
					<button
						type="button"
						onclick={() => setWeatherPreset('⛅ 29°C - berawan')}
						class="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 hover:bg-stone-100 transition"
					>
						⛅ Berawan
					</button>
					<button
						type="button"
						onclick={() => setWeatherPreset('🌧️ 25°C - hujan')}
						class="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 hover:bg-stone-100 transition"
					>
						🌧️ Hujan
					</button>
					<button
						type="button"
						onclick={() => setWeatherPreset('🌦️ 28°C - gerimis')}
						class="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 hover:bg-stone-100 transition"
					>
						🌦️ Gerimis
					</button>
				</div>
			</section>

			<!-- Section Markdown Note Editor dengan Mobile Toolbar -->
			<section class="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<label class="block text-sm font-bold text-stone-900" for="note-editor">Note (Markdown)</label>

					<div class="flex items-center gap-2">
						{#if uploadingImage}
							<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 animate-pulse">
								<span class="size-2 rounded-full bg-teal-600"></span>
								Mengupload foto…
							</span>
						{/if}
						<label
							class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-xs cursor-pointer hover:bg-teal-100/80 transition active:scale-95 {uploadingImage ? 'opacity-50 pointer-events-none' : ''}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

				<!-- Toolbar Format Markdown Cepat Khusus Mobile & Desktop -->
				<div class="flex flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-stone-50/80 p-1 text-xs">
					<button
						type="button"
						title="Tebal (Bold)"
						onclick={() => insertFormat('**', '**', 'teks tebal')}
						class="min-h-[32px] min-w-[32px] rounded-lg px-2 py-1 font-bold text-stone-700 hover:bg-stone-200/70"
					>
						B
					</button>
					<button
						type="button"
						title="Miring (Italic)"
						onclick={() => insertFormat('*', '*', 'teks miring')}
						class="min-h-[32px] min-w-[32px] rounded-lg px-2 py-1 italic font-serif text-stone-700 hover:bg-stone-200/70"
					>
						I
					</button>
					<button
						type="button"
						title="Heading H2"
						onclick={() => insertFormat('\n## ', '', 'Judul Bagian')}
						class="min-h-[32px] min-w-[32px] rounded-lg px-2 py-1 font-semibold text-stone-700 hover:bg-stone-200/70"
					>
						H2
					</button>
					<button
						type="button"
						title="Task Checkbox"
						onclick={() => insertFormat('\n- [ ] ', '', 'Tugas')}
						class="min-h-[32px] rounded-lg px-2 py-1 font-mono text-[11px] text-stone-700 hover:bg-stone-200/70"
					>
						[ ]
					</button>
					<button
						type="button"
						title="Bullet list"
						onclick={() => insertFormat('\n- ', '', 'Daftar item')}
						class="min-h-[32px] min-w-[32px] rounded-lg px-2 py-1 text-stone-700 hover:bg-stone-200/70"
					>
						•
					</button>
					<button
						type="button"
						title="Kutipan (Quote)"
						onclick={() => insertFormat('\n> ', '', 'Kutipan')}
						class="min-h-[32px] min-w-[32px] rounded-lg px-2 py-1 text-stone-700 hover:bg-stone-200/70"
					>
						"
					</button>
					<button
						type="button"
						title="Kode Inline"
						onclick={() => insertFormat('`', '`', 'kode')}
						class="min-h-[32px] rounded-lg px-2 py-1 font-mono text-[11px] text-stone-700 hover:bg-stone-200/70"
					>
						&lt;/&gt;
					</button>
				</div>

				<textarea
					id="note-editor"
					bind:this={textareaEl}
					bind:value={noteContent}
					onpaste={handlePaste}
					ondrop={handleDrop}
					ondragover={(e) => e.preventDefault()}
					placeholder="Tulis catatan harian Anda di sini (mendukung Markdown, Paste gambar Ctrl+V, atau Drag & Drop)..."
					rows="16"
					class="w-full rounded-xl border-stone-300 p-3.5 font-mono text-sm leading-relaxed shadow-xs focus:border-teal-600 focus:ring-teal-600 sm:text-sm"
				></textarea>

				<p class="text-[11px] text-stone-400">
					Tips: Bisa <strong class="font-medium text-stone-600">Paste (Ctrl+V)</strong> screenshot atau <strong class="font-medium text-stone-600">Drag & Drop</strong> gambar ke dalam editor.
				</p>
			</section>

			<!-- Section Footer Obsidian Navigasi -->
			<section class="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<span class="text-xs font-bold text-stone-800">Navigasi Footer Obsidian</span>
						<span class="text-[10px] rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-500 font-mono">auto-linked</span>
					</div>
					<button
						type="button"
						onclick={() => (showFooterDetails = !showFooterDetails)}
						class="text-xs text-teal-700 font-medium hover:underline"
					>
						{showFooterDetails ? 'Tutup Pengaturan' : 'Sesuaikan Stem'}
					</button>
				</div>

				<!-- Live Preview of the footer -->
				<div class="rounded-xl border border-stone-200/80 bg-stone-50/70 p-3 font-mono text-xs text-stone-700 break-all leading-relaxed">
					⬅️ [[{prevStem}]] | 📅 {humanDateLabel(data.note.date)} | [[{nextStem}]] ➡️
				</div>

				{#if showFooterDetails}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100 text-xs">
						<div>
							<label for="prev-stem-input" class="block font-medium text-stone-700 mb-1">
								Stem Sebelumnya (⬅️):
							</label>
							<input
								id="prev-stem-input"
								bind:value={prevStem}
								class="w-full rounded-lg border-stone-300 bg-white px-3 py-1.5 font-mono text-xs shadow-xs focus:border-teal-600 focus:ring-teal-600"
							/>
						</div>
						<div>
							<label for="next-stem-input" class="block font-medium text-stone-700 mb-1">
								Stem Sesudahnya (➡️):
							</label>
							<input
								id="next-stem-input"
								bind:value={nextStem}
								class="w-full rounded-lg border-stone-300 bg-white px-3 py-1.5 font-mono text-xs shadow-xs focus:border-teal-600 focus:ring-teal-600"
							/>
						</div>
						<div class="sm:col-span-2 flex justify-end">
							<button
								type="button"
								onclick={() => {
									prevStem = data.defaultPrevStem;
									nextStem = data.defaultNextStem;
								}}
								class="text-xs text-stone-500 hover:text-stone-800 underline"
							>
								Reset ke Nilai Standar Kalender
							</button>
						</div>
					</div>
				{/if}
			</section>
		</Tabs.Content>
	</Tabs.Root>

	<!-- Desktop Actions Bar -->
	<div class="hidden sm:flex flex-wrap items-center gap-2.5 border-t border-stone-200/80 pt-4">
		<button
			onclick={saveToDb}
			disabled={saving || !dirtyLocal}
			class="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 disabled:opacity-50"
		>
			{saving ? 'Menyimpan…' : 'Simpan ke Database'}
		</button>
		<button
			onclick={pushToGithub}
			disabled={pushing}
			class="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 active:scale-95 disabled:opacity-50"
		>
			{#if pushing}
				<span class="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
				<span>Pushing ke GitHub…</span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 19V5"/>
					<path d="m5 12 7-7 7 7"/>
				</svg>
				<span>Push ke GitHub</span>
			{/if}
		</button>
		<a
			href="/github/{data.note.date}"
			class="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-600 shadow-xs hover:bg-stone-50"
		>
			Lihat di GitHub
		</a>

		<Dialog.Root bind:open={deleteOpen}>
			<Dialog.Trigger
				class="ml-auto rounded-xl px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
			>
				Hapus Catatan
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs" />
				<Dialog.Content
					class="fixed top-1/2 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-stone-200 bg-white p-6 shadow-xl outline-none"
				>
					<Dialog.Title class="text-base font-bold text-stone-900">Hapus daily note?</Dialog.Title>
					<Dialog.Description class="mt-2 text-xs text-stone-600 leading-relaxed">
						Note akan dihapus dari database. Jika sudah pernah di-push, file di repository GitHub juga akan dihapus.
					</Dialog.Description>
					<div class="mt-5 flex justify-end gap-2">
						<Dialog.Close class="rounded-xl border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50">
							Batal
						</Dialog.Close>
						<button
							onclick={deleteNote}
							class="rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 shadow-sm"
						>
							Hapus Sekarang
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	</div>

	<!-- Status Feedback Toast -->
	{#if status}
		<div class="rounded-xl border border-stone-200 bg-white p-3.5 text-xs text-stone-700 shadow-sm leading-relaxed">
			{status}
		</div>
	{/if}

	<!-- Sticky Mobile Bottom Bar (Thumb-Friendly on Phones) -->
	<div class="sm:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-lg flex items-center justify-between gap-2">
		<button
			onclick={saveToDb}
			disabled={saving || !dirtyLocal}
			class="flex-1 rounded-xl border border-stone-300 bg-stone-50 py-2.5 text-xs font-semibold text-stone-700 shadow-xs active:bg-stone-100 disabled:opacity-40"
		>
			{saving ? 'Menyimpan…' : 'Simpan'}
		</button>
		<button
			onclick={pushToGithub}
			disabled={pushing}
			class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 py-2.5 text-xs font-semibold text-white shadow-sm active:bg-teal-900 disabled:opacity-40"
		>
			{#if pushing}
				<span class="size-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
				<span>Pushing…</span>
			{:else}
				<span>Push GitHub</span>
			{/if}
		</button>
		<button
			onclick={() => (deleteOpen = true)}
			class="rounded-xl px-2.5 py-2.5 text-xs text-red-600 hover:bg-red-50"
			aria-label="Hapus"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 6h18"/>
				<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
				<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
			</svg>
		</button>
	</div>
</div>
