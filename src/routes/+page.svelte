<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { humanDateLabel } from '$lib/dateUtils';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Tabs } from 'bits-ui';

	let { data } = $props();
	let pickedOverride = $state<string | null>(null);
	let filter = $state<'all' | SyncStatus>('all');
	let syncing = $state(false);
	let syncMsg = $state('');

	const pickedDate = $derived(pickedOverride ?? data.today);

	const filteredSections = $derived(
		data.sections
			.map((section) => ({
				...section,
				notes:
					filter === 'all'
						? section.notes
						: section.notes.filter((n) => n.syncStatus === filter)
			}))
			.filter((section) => section.notes.length > 0)
	);

	function openDate() {
		if (pickedDate) goto(`/notes/${pickedDate}`);
	}

	async function syncToTurso() {
		syncing = true;
		syncMsg = '';
		try {
			const res = await fetch('/api/sync', { method: 'POST' });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error ?? 'Gagal sync');
			syncMsg = `Sync selesai: ${json.imported} note baru masuk Turso. ${json.skippedExisting} sudah ada (tidak ditimpa).`;
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
			Baca dari database lokal. <strong class="font-medium text-stone-800">Sync ke Turso</strong> hanya
			mengimpor note yang belum ada — note lama / yang sudah diubah lokal tidak ditimpa.
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

	{#if filteredSections.length === 0}
		<div
			class="rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-10 text-center text-sm text-stone-500"
		>
			Belum ada note. Tekan <strong class="font-medium text-stone-700">Sync ke Turso</strong> untuk
			mengimpor dari GitHub, atau buat note hari ini.
		</div>
	{:else}
		<div class="space-y-6">
			{#each filteredSections as section (section.key)}
				<section class="space-y-2">
					<h2 class="text-xs font-semibold tracking-wider text-stone-500 uppercase">{section.label}</h2>
					<ul class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
						{#each section.notes as note (note.date)}
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
				</section>
			{/each}
		</div>
	{/if}
</div>
