<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { humanDateLabel, dateFromISO, monthNameFull, addDays } from '$lib/dateUtils';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Tabs, Dialog } from 'bits-ui';

	let { data } = $props();
	let filter = $state<'all' | SyncStatus>('all');
	let syncing = $state(false);
	let syncMsg = $state('');
	let datePickerOpen = $state(false);
	let customDate = $state('');

	$effect.pre(() => {
		if (!customDate) customDate = data.today;
	});

	const filteredNotes = $derived(
		filter === 'all'
			? data.notes
			: data.notes.filter((n) => n.syncStatus === filter)
	);

	const customDateExists = $derived(
		data.notes.some((n) => n.date === customDate)
	);

	function openCustomDate(targetDate: string) {
		datePickerOpen = false;
		goto(`/notes/${targetDate}`);
	}

	function onMonthChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		if (target.value) {
			goto(`/?month=${target.value}`);
		}
	}

	function formatMonthOption(ym: string) {
		const d = dateFromISO(`${ym}-01`);
		return `${monthNameFull(d)} ${d.getFullYear()}`;
	}

	async function syncToTurso() {
		syncing = true;
		syncMsg = '';
		try {
			const res = await fetch('/api/sync', { method: 'POST' });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Gagal sync');
			const repMsg = json.repaired > 0 ? ` serta ${json.repaired} note diperbaiki isinya.` : '.';
			syncMsg = `Sync selesai: ${json.imported} note baru diimpor${repMsg} (${json.skippedExisting} note lokal tidak ditimpa).`;
			await invalidateAll();
		} catch (e) {
			syncMsg = e instanceof Error ? e.message : 'Gagal sync';
		} finally {
			syncing = false;
		}
	}

	function badgeClass(status: SyncStatus) {
		switch (status) {
			case 'synced':
				return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
			case 'dirty':
				return 'bg-amber-50 text-amber-900 ring-amber-200';
			case 'never':
				return 'bg-stone-100 text-stone-600 ring-stone-200';
		}
	}
</script>

<div class="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
	<!-- Top Navigation App Bar -->
	<header class="flex items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
		<div class="flex items-center gap-2.5">
			<span class="flex size-9 items-center justify-center rounded-xl bg-teal-800 text-white shadow-sm">
				<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
					<path d="M6 6h10"/>
					<path d="M6 10h10"/>
				</svg>
			</span>
			<div>
				<h1 class="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">Journal Yuma</h1>
				<p class="text-[11px] font-medium tracking-wide text-stone-500 uppercase">Daily Notes Vault</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/notebook"
				class="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-95"
			>
				<span>Buku</span>
			</a>
			<button
				onclick={syncToTurso}
				disabled={syncing}
				class="inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-95 disabled:opacity-50"
			>
				{#if syncing}
					<span class="size-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					<span>Syncing…</span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
						<path d="M3 3v5h5"/>
						<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
						<path d="M16 16h5v5"/>
					</svg>
					<span>Sync</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- Quick Status Notification if any -->
	{#if syncMsg}
		<div class="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 text-xs text-teal-900 shadow-xs">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0 text-teal-700 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="m9 12 2 2 4-4"/>
			</svg>
			<p class="leading-relaxed">{syncMsg}</p>
		</div>
	{/if}

	<!-- Hero Action Card: Hari Ini & Pilihan Hari Lain -->
	<section class="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
					<span class="size-1.5 rounded-full bg-teal-600"></span>
					Hari Ini
				</span>
				<h2 class="mt-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
					{humanDateLabel(data.today)}
				</h2>
				<p class="mt-1 text-xs text-stone-500">
					Tulis kegiatan, prioritas, atau catatan harian Anda hari ini.
				</p>
			</div>

			<div class="flex flex-col gap-2 sm:w-56 shrink-0">
				<a
					href="/notes/{data.today}"
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.98]"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 5v14"/>
						<path d="M5 12h14"/>
					</svg>
					<span>Buka Note Hari Ini</span>
				</a>

				<!-- Dialog Pemicu Tambah Catatan Tanggal Lain -->
				<Dialog.Root bind:open={datePickerOpen}>
					<Dialog.Trigger
						class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50/80 px-4 py-2.5 text-center text-xs font-semibold text-stone-700 transition hover:bg-stone-100 active:scale-[0.98]"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
							<line x1="16" x2="16" y1="2" y2="6"/>
							<line x1="8" x2="8" y1="2" y2="6"/>
							<line x1="3" x2="21" y1="10" y2="10"/>
						</svg>
						<span>+ Catatan Tanggal Lain</span>
					</Dialog.Trigger>

					<Dialog.Portal>
						<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs" />
						<Dialog.Content class="fixed top-1/2 left-1/2 z-50 w-[min(94vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl outline-none">
							<Dialog.Title class="text-lg font-bold text-stone-900">
								Tulis Catatan Tanggal Lain
							</Dialog.Title>
							<Dialog.Description class="mt-1 text-xs text-stone-500">
								Pilih tanggal lampau atau hari lain. Footer navigasi akan otomatis disesuaikan dengan tanggal sebelum dan sesudahnya.
							</Dialog.Description>

							<!-- Quick Presets: Kemarin, 2 Hari Lalu, 3 Hari Lalu -->
							<div class="mt-4 space-y-2">
								<p class="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Pilihan Cepat:</p>
								<div class="grid grid-cols-3 gap-2">
									<button
										type="button"
										onclick={() => (customDate = addDays(data.today, -1))}
										class="rounded-xl border border-stone-200 bg-stone-50 p-2 text-center text-xs font-medium text-stone-700 hover:border-teal-600 hover:bg-teal-50/50 transition {customDate === addDays(data.today, -1) ? 'border-teal-700 bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-500' : ''}"
									>
										Kemarin
										<span class="block text-[10px] text-stone-400">{addDays(data.today, -1)}</span>
									</button>
									<button
										type="button"
										onclick={() => (customDate = addDays(data.today, -2))}
										class="rounded-xl border border-stone-200 bg-stone-50 p-2 text-center text-xs font-medium text-stone-700 hover:border-teal-600 hover:bg-teal-50/50 transition {customDate === addDays(data.today, -2) ? 'border-teal-700 bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-500' : ''}"
									>
										2 Hari Lalu
										<span class="block text-[10px] text-stone-400">{addDays(data.today, -2)}</span>
									</button>
									<button
										type="button"
										onclick={() => (customDate = addDays(data.today, -3))}
										class="rounded-xl border border-stone-200 bg-stone-50 p-2 text-center text-xs font-medium text-stone-700 hover:border-teal-600 hover:bg-teal-50/50 transition {customDate === addDays(data.today, -3) ? 'border-teal-700 bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-500' : ''}"
									>
										3 Hari Lalu
										<span class="block text-[10px] text-stone-400">{addDays(data.today, -3)}</span>
									</button>
								</div>
							</div>

							<!-- Custom Date Input -->
							<div class="mt-4 space-y-2">
								<label for="modal-date-picker" class="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
									Atau Pilih Tanggal Kalender:
								</label>
								<input
									id="modal-date-picker"
									type="date"
									bind:value={customDate}
									class="w-full rounded-xl border-stone-300 bg-stone-50/80 px-3.5 py-2.5 text-sm font-medium shadow-xs focus:border-teal-600 focus:ring-teal-600"
								/>
							</div>

							<!-- Selected Date Info Banner -->
							<div class="mt-4 rounded-xl border p-3 text-xs {customDateExists ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' : 'border-teal-200 bg-teal-50/60 text-teal-900'}">
								<p class="font-semibold">{humanDateLabel(customDate)}</p>
								<p class="text-[11px] mt-0.5 opacity-80">
									{#if customDateExists}
										Catatan untuk tanggal ini sudah ada di database (akan dibuka).
									{:else}
										Catatan belum ada. Akan dibuat baru dengan tanggal ini.
									{/if}
								</p>
							</div>

							<!-- Modal Action Buttons -->
							<div class="mt-6 flex justify-end gap-2">
								<Dialog.Close class="rounded-xl border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50">
									Batal
								</Dialog.Close>
								<button
									type="button"
									onclick={() => openCustomDate(customDate)}
									class="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm"
								>
									{customDateExists ? 'Buka Catatan' : 'Buat Catatan'}
								</button>
							</div>
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
			</div>
		</div>

		<!-- Counter Stats Pills -->
		<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 text-xs">
			<span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-600 ring-1 ring-stone-200/70">
				{data.counts.total} total
			</span>
			<span class="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800 ring-1 ring-emerald-200">
				{data.counts.synced} synced
			</span>
			<span class="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-900 ring-1 ring-amber-200">
				{data.counts.dirty} diubah lokal
			</span>
			<span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-600 ring-1 ring-stone-200">
				{data.counts.never} draft
			</span>
		</div>
	</section>

	<!-- Quick Links Bar -->
	<div class="flex flex-wrap gap-2">
		<a
			href="/notebook"
			class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-[#f7f3ea] px-3 py-2 text-xs font-semibold text-stone-800 shadow-xs hover:bg-[#f0eadc] transition"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
				<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
			</svg>
			<span>Baca Berurutan</span>
		</a>
		<a
			href="/notebook?mode=random"
			class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-[#f7f3ea] px-3 py-2 text-xs font-semibold text-stone-800 shadow-xs hover:bg-[#f0eadc] transition"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="m21 16-4 4-4-4"/>
				<path d="M17 20V4"/>
				<path d="m3 8 4-4 4 4"/>
				<path d="M7 4v16"/>
			</svg>
			<span>Buka Catatan Acak</span>
		</a>
		<a
			href="/github"
			class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-white px-3 py-2 text-xs font-medium text-stone-600 shadow-xs hover:bg-stone-50 transition"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
				<path d="M9 18c-4.51 2-5-2-7-2"/>
			</svg>
			<span>Lihat GitHub</span>
		</a>
	</div>

	<!-- Kontrol Navigasi Bulan & Pagination -->
	<section class="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<h3 class="text-base font-bold text-stone-900">{data.monthLabel}</h3>
				{#if data.isCurrentMonth}
					<span class="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
						Bulan Ini
					</span>
				{:else}
					<a
						href="/"
						class="text-xs font-medium text-teal-700 underline hover:text-teal-800"
					>
						Kembali ke Bulan Ini
					</a>
				{/if}
			</div>

			<!-- Dropdown Pilih Bulan -->
			<div class="flex items-center gap-1.5 text-xs text-stone-500">
				<label for="month-select" class="sr-only">Pilih Bulan</label>
				<select
					id="month-select"
					value={data.selectedMonth}
					onchange={onMonthChange}
					class="rounded-xl border-stone-300 bg-stone-50 py-1.5 pr-8 pl-3 text-xs font-semibold text-stone-700 shadow-xs focus:border-teal-600 focus:ring-teal-600"
				>
					{#each data.availableMonths as ym}
						<option value={ym}>
							{formatMonthOption(ym)} {ym === data.today.slice(0, 7) ? ' (Bulan Ini)' : ''}
						</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Tombol Pagination Bulan -->
		<div class="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-600">
			<div>
				{#if data.prevMonth}
					<a
						href="/?month={data.prevMonth}"
						class="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-stone-700 hover:bg-stone-100 transition active:scale-95"
					>
						&larr; {formatMonthOption(data.prevMonth)}
					</a>
				{:else}
					<span class="text-stone-300 min-h-[36px] inline-flex items-center">&larr; Bulan awal</span>
				{/if}
			</div>

			<span class="text-stone-400 font-mono text-[11px]">{filteredNotes.length} catatan</span>

			<div>
				{#if data.nextMonth}
					<a
						href="/?month={data.nextMonth}"
						class="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 text-stone-700 hover:bg-stone-100 transition active:scale-95"
					>
						{formatMonthOption(data.nextMonth)} &rarr;
					</a>
				{:else}
					<span class="text-stone-300 min-h-[36px] inline-flex items-center">Bulan terbaru &rarr;</span>
				{/if}
			</div>
		</div>
	</section>

	<!-- Filter Tabs: Semua / Diubah / Draft / Synced -->
	<Tabs.Root bind:value={filter} class="space-y-4">
		<Tabs.List
			class="grid grid-cols-4 gap-1 rounded-xl bg-stone-200/80 p-1 text-xs font-medium text-stone-600"
		>
			<Tabs.Trigger
				value="all"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs"
			>
				Semua
			</Tabs.Trigger>
			<Tabs.Trigger
				value="dirty"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs"
			>
				Diubah
			</Tabs.Trigger>
			<Tabs.Trigger
				value="never"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs"
			>
				Draft
			</Tabs.Trigger>
			<Tabs.Trigger
				value="synced"
				class="rounded-lg py-2 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs"
			>
				Synced
			</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>

	<!-- Daftar Catatan Harian -->
	{#if filteredNotes.length === 0}
		<div
			class="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-12 text-center text-sm text-stone-500 shadow-xs"
		>
			<p class="font-medium text-stone-700">Belum ada catatan untuk {data.monthLabel}</p>
			<p class="mt-1 text-xs text-stone-400">
				{#if filter !== 'all'}
					Tidak ditemukan catatan dengan filter "{filter}".
				{:else}
					Pilih tanggal lain atau buat catatan untuk bulan ini.
				{/if}
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			<ul class="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs divide-y divide-stone-100">
				{#each filteredNotes as note (note.date)}
					<li>
						<a
							href="/notes/{note.date}"
							class="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-stone-50/80 active:bg-stone-100/70"
						>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="truncate text-sm font-semibold text-stone-900">{humanDateLabel(note.date)}</p>
									{#if note.date === data.today}
										<span class="rounded-full bg-teal-100 px-1.5 py-0.2 text-[10px] font-semibold text-teal-800">
											Hari Ini
										</span>
									{/if}
								</div>
								{#if note.weather}
									<p class="truncate text-xs text-stone-500 mt-0.5">{note.weather}</p>
								{/if}
							</div>
							<span
								class="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 {badgeClass(
									note.syncStatus
								)}"
								title={syncStatusLabel(note.syncStatus)}
							>
								{syncStatusLabel(note.syncStatus)}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
