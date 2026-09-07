<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { humanDateLabel, dateFromISO, monthNameFull } from '$lib/dateUtils';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Tabs } from 'bits-ui';

	let { data } = $props();
	let pickedOverride = $state<string | null>(null);
	let filter = $state<'all' | SyncStatus>('all');
	let syncing = $state(false);
	let syncMsg = $state('');

	const pickedDate = $derived(pickedOverride ?? data.today);

	const filteredNotes = $derived(
		filter === 'all'
			? data.notes
			: data.notes.filter((n) => n.syncStatus === filter)
	);

	function openDate() {
		if (pickedDate) goto(`/notes/${pickedDate}`);
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

<div class="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
	<header class="space-y-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="text-sm tracking-wide text-stone-500 uppercase">Journal Yuma</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Daily Notes</h1>
			</div>
			<div class="flex flex-wrap gap-2">
				<a
					href="/notebook"
					class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm transition hover:bg-stone-50"
				>
					Buku Catatan
				</a>
				<button
					onclick={syncToTurso}
					disabled={syncing}
					class="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
				>
					{syncing ? 'Syncing…' : 'Sync ke Turso'}
				</button>
			</div>
		</div>

		<p class="text-sm text-stone-600">
			Memuat hanya catatan bulan terpilih agar cepat dan ringan. <strong class="font-medium text-stone-800">Sync ke Turso</strong> mengimpor catatan baru dan memperbaiki catatan yang kosong dari GitHub.
		</p>

		<div class="flex flex-wrap gap-2 text-xs">
			<span class="rounded-full bg-white px-2.5 py-1 ring-1 ring-stone-200">{data.counts.total} total</span>
			<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-200"
				>{data.counts.synced} synced</span
			>
			<span class="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 ring-1 ring-amber-200"
				>{data.counts.dirty} diubah lokal</span
			>
			<span class="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600 ring-1 ring-stone-200"
				>{data.counts.never} draft</span
			>
		</div>

		{#if syncMsg}
			<p class="rounded-lg bg-white px-3 py-2 text-sm text-stone-600 ring-1 ring-stone-200">{syncMsg}</p>
		{/if}
	</header>

	<div class="flex flex-col gap-2 sm:flex-row">
		<a
			href="/notes/{data.today}"
			class="flex-1 rounded-lg bg-stone-900 px-3 py-2.5 text-center text-sm font-medium text-white transition hover:bg-stone-800"
		>
			Buka / buat note hari ini
		</a>
		<div class="flex gap-2">
			<input
				type="date"
				value={pickedDate}
				oninput={(e) => (pickedOverride = e.currentTarget.value)}
				class="rounded-lg border-stone-300 bg-white px-3 py-2 text-sm shadow-sm"
			/>
			<button
				onclick={openDate}
				class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
			>
				Buka
			</button>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		<a
			href="/notebook"
			class="rounded-lg border border-stone-300 bg-[#f7f3ea] px-3 py-2 text-sm text-stone-800 shadow-sm hover:bg-[#f0eadc]"
		>
			Baca berurutan
		</a>
		<a
			href="/notebook?mode=random"
			class="rounded-lg border border-stone-300 bg-[#f7f3ea] px-3 py-2 text-sm text-stone-800 shadow-sm hover:bg-[#f0eadc]"
		>
			Buka catatan acak
		</a>
		<a
			href="/github"
			class="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-600 shadow-sm hover:bg-stone-50"
		>
			Lihat GitHub (opsional)
		</a>
	</div>

	<!-- Kontrol Navigasi Bulan & Pagination -->
	<section class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold text-stone-900">{data.monthLabel}</h2>
				{#if data.isCurrentMonth}
					<span class="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
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
					class="rounded-lg border-stone-300 bg-stone-50 py-1.5 pr-8 pl-2.5 text-xs font-medium text-stone-700 shadow-sm focus:border-teal-600 focus:ring-teal-600"
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
		<div class="flex items-center justify-between pt-1 border-t border-stone-100 text-xs text-stone-600">
			<div>
				{#if data.prevMonth}
					<a
						href="/?month={data.prevMonth}"
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100 transition"
					>
						&larr; {formatMonthOption(data.prevMonth)}
					</a>
				{:else}
					<span class="text-stone-300">&larr; Bulan awal</span>
				{/if}
			</div>

			<span class="text-stone-400 font-mono text-[11px]">{filteredNotes.length} catatan</span>

			<div>
				{#if data.nextMonth}
					<a
						href="/?month={data.nextMonth}"
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100 transition"
					>
						{formatMonthOption(data.nextMonth)} &rarr;
					</a>
				{:else}
					<span class="text-stone-300">Bulan terbaru &rarr;</span>
				{/if}
			</div>
		</div>
	</section>

	<Tabs.Root bind:value={filter} class="space-y-4">
		<Tabs.List
			class="grid grid-cols-4 gap-1 rounded-lg bg-stone-200/70 p-1 text-sm font-medium text-stone-600"
		>
			<Tabs.Trigger
				value="all"
				class="rounded-md px-2 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				Semua
			</Tabs.Trigger>
			<Tabs.Trigger
				value="dirty"
				class="rounded-md px-2 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				Diubah
			</Tabs.Trigger>
			<Tabs.Trigger
				value="never"
				class="rounded-md px-2 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				Draft
			</Tabs.Trigger>
			<Tabs.Trigger
				value="synced"
				class="rounded-md px-2 py-1.5 transition data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
			>
				Synced
			</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>

	{#if filteredNotes.length === 0}
		<div
			class="rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-10 text-center text-sm text-stone-500"
		>
			Belum ada catatan untuk bulan {data.monthLabel}
			{#if filter !== 'all'}
				dengan status "{filter}".
			{:else}
				. Tekan <strong class="font-medium text-stone-700">Sync ke Turso</strong> atau buat catatan baru.
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			<ul class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
				{#each filteredNotes as note (note.date)}
					<li class="border-b border-stone-100 last:border-b-0">
						<a
							href="/notes/{note.date}"
							class="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-stone-50"
						>
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-stone-900">{humanDateLabel(note.date)}</p>
								{#if note.weather}
									<p class="truncate text-xs text-stone-500">{note.weather}</p>
								{/if}
							</div>
							<span
								class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 {badgeClass(
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
