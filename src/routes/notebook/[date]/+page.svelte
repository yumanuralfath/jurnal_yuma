<script lang="ts">
	import { goto } from '$app/navigation';
	import { humanDateLabel, dateFromISO } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';
	import { Dialog } from 'bits-ui';

	let { data } = $props();

	let datePickerOpen = $state(false);
	let copied = $state(false);

	const dateLabel = $derived(humanDateLabel(data.note.date));
	const rendered = $derived(renderMarkdown(data.note.note_content));
	const progress = $derived(data.total === 0 ? 0 : ((data.index + 1) / data.total) * 100);
	const excerptWeather = $derived(data.note.weather || '—');

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

	function goRandom() {
		const pool = data.dates.filter((d) => d !== data.note.date);
		const pick = (pool.length ? pool : data.dates)[Math.floor(Math.random() * (pool.length || data.dates.length))];
		goto(`/notebook/${pick}?mode=random`);
	}

	function goToDate(d: string) {
		datePickerOpen = false;
		goto(`/notebook/${d}`);
	}

	async function copyPublicLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			copied = false;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.prevDate) goto(`/notebook/${data.prevDate}`);
		if (e.key === 'ArrowRight' && data.nextDate) goto(`/notebook/${data.nextDate}`);
		if (e.key === 'r' || e.key === 'R') goRandom();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 pb-16">
	<!-- Top Navigation Bar -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			{#if data.authed}
				<a
					href="/"
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 transition active:scale-95"
				>
					&larr; <span class="hidden sm:inline">Beranda Admin</span><span class="sm:hidden">Admin</span>
				</a>
			{:else}
				<div class="flex items-center gap-2">
					<span class="flex size-7 items-center justify-center rounded-lg bg-teal-800 text-white shadow-xs">
						📖
					</span>
					<span class="font-bold text-sm text-stone-800">Buku Catatan Yuma</span>
					<span class="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200">
						Publik
					</span>
				</div>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<!-- Dialog Pemilih Tanggal Catatan -->
			<Dialog.Root bind:open={datePickerOpen}>
				<Dialog.Trigger
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 transition active:scale-95"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
						<line x1="16" x2="16" y1="2" y2="6"/>
						<line x1="8" x2="8" y1="2" y2="6"/>
						<line x1="3" x2="21" y1="10" y2="10"/>
					</svg>
					<span>Pilih Tanggal ({data.total})</span>
				</Dialog.Trigger>

				<Dialog.Portal>
					<Dialog.Overlay class="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs" />
					<Dialog.Content class="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl outline-none">
						<div class="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
							<div>
								<Dialog.Title class="text-base font-bold text-stone-900">
									Daftar Tanggal Catatan
								</Dialog.Title>
								<Dialog.Description class="mt-0.5 text-xs text-stone-500">
									Tersedia {data.total} catatan harian yang dapat Anda baca secara online.
								</Dialog.Description>
							</div>
							<Dialog.Close class="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
								✕
							</Dialog.Close>
						</div>

						<!-- Quick Jump Navigation -->
						<div class="mt-4 flex flex-wrap gap-2 text-xs">
							<button
								type="button"
								onclick={() => goToDate(data.dates[data.dates.length - 1])}
								class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-700 hover:bg-stone-100 font-medium"
							>
								Terbaru ({data.dates[data.dates.length - 1]})
							</button>
							<button
								type="button"
								onclick={() => goToDate(data.dates[0])}
								class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-700 hover:bg-stone-100 font-medium"
							>
								Terlama ({data.dates[0]})
							</button>
							<button
								type="button"
								onclick={() => {
									datePickerOpen = false;
									goRandom();
								}}
								class="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-700 hover:bg-stone-100 font-medium"
							>
								🎲 Acak
							</button>
						</div>

						<!-- Accordion / List by Month -->
						<div class="mt-5 space-y-4">
							{#each data.availableMonths as monthGroup}
								<div class="space-y-2">
									<h4 class="sticky top-0 bg-white/95 py-1 text-xs font-bold text-stone-700 tracking-wide uppercase border-b border-stone-100">
										{monthGroup.label} <span class="text-[10px] font-normal text-stone-400">({monthGroup.dates.length} catatan)</span>
									</h4>
									<div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
										{#each monthGroup.dates as d}
											{@const dt = dateFromISO(d)}
											{@const isCurrent = d === data.note.date}
											<button
												type="button"
												onclick={() => goToDate(d)}
												class="rounded-xl border p-2 text-left text-xs transition active:scale-95 {isCurrent
													? 'border-teal-700 bg-teal-50 text-teal-900 font-bold ring-1 ring-teal-600 shadow-xs'
													: 'border-stone-200 bg-stone-50/70 text-stone-700 hover:bg-stone-100'}"
											>
												<span class="block text-xs font-semibold">{d.slice(8, 10)} {dt.toLocaleDateString('id-ID', { month: 'short' })}</span>
												<span class="block text-[10px] text-stone-400">{dt.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>

			<button
				onclick={copyPublicLink}
				class="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 transition active:scale-95"
				title="Salin tautan catatan ini"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="size-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
				</svg>
				<span>{copied ? 'Tersalin!' : 'Bagikan'}</span>
			</button>

			<button
				onclick={goRandom}
				class="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 transition active:scale-95 {data.mode === 'random' ? 'bg-stone-900 text-white border-stone-900' : ''}"
			>
				Acak
			</button>
		</div>
	</div>

	<!-- Shell Buku Catatan -->
	<div class="notebook-shell relative overflow-hidden rounded-2xl border border-stone-300/80 bg-[#f7f3ea] shadow-[0_20px_50px_-28px_rgb(28_25_23_/_0.45)]">
		<div
			class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-stone-400/25 to-transparent"
			aria-hidden="true"
		></div>
		<div class="absolute top-0 right-0 left-8 h-1.5 bg-[repeating-linear-gradient(90deg,#d6d3d1_0_8px,transparent_8px_16px)] opacity-50"></div>

		<div class="space-y-6 px-6 py-8 sm:px-10 sm:py-10">
			<!-- Header Catatan -->
			<header class="space-y-3 border-b border-stone-300/70 pb-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="font-[Georgia,Times,serif] text-xs tracking-[0.18em] text-stone-500 uppercase">
							Buku Catatan
						</p>
						<h1 class="mt-1 font-[Georgia,Times,serif] text-2xl sm:text-3xl leading-tight text-stone-900">
							{dateLabel}
						</h1>
						<p class="mt-2 text-xs sm:text-sm text-stone-600">{excerptWeather}</p>
					</div>

					{#if data.authed}
						<span class="rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 {badgeClass(data.syncStatus)}">
							{syncStatusLabel(data.syncStatus)}
						</span>
					{/if}
				</div>

				<!-- Progress Indicator -->
				<div class="space-y-1.5 pt-2">
					<div class="flex justify-between text-[11px] text-stone-500">
						<span>Halaman {data.index + 1} dari {data.total} catatan</span>
						<span>{Math.round(progress)}%</span>
					</div>
					<div class="h-1.5 overflow-hidden rounded-full bg-stone-300/70">
						<div class="h-full rounded-full bg-teal-800/80 transition-all" style="width: {progress}%"></div>
					</div>
				</div>
			</header>

			<!-- Priority Section jika ada -->
			{#if data.note.priority_items.length > 0}
				<section class="space-y-2 rounded-xl bg-white/40 p-4 border border-stone-300/40">
					<h2 class="font-[Georgia,Times,serif] text-base font-semibold text-stone-800">⚡ Prioritas</h2>
					<ul class="space-y-1.5">
						{#each data.note.priority_items as item, i (`${i}-${item.text}`)}
							<li class="flex items-start gap-2.5 text-sm text-stone-700">
								<span class="mt-0.5 text-xs font-semibold">{item.done ? '☑' : '☐'}</span>
								<span class:line-through={item.done} class:text-stone-400={item.done}>{item.text}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Konten Utama Catatan -->
			<section class="min-h-[14rem]">
				{#if data.note.note_content.trim()}
					<div class="prose-note font-[Georgia,Times,serif] text-[1.05rem] leading-8 text-stone-800">
						{@html rendered}
					</div>
				{:else}
					<p class="text-sm text-stone-500 italic py-12 text-center">Halaman catatan ini masih kosong.</p>
				{/if}
			</section>

			<!-- Footer Navigasi Halaman -->
			<footer class="flex flex-wrap items-center justify-between gap-2 border-t border-stone-300/70 pt-5">
				<div class="flex items-center gap-2">
					{#if data.prevDate}
						<a
							href="/notebook/{data.prevDate}"
							class="rounded-xl border border-stone-400/60 bg-white/80 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-white transition active:scale-95 shadow-xs"
						>
							&larr; Sebelumnya
						</a>
					{:else}
						<span class="rounded-xl px-3.5 py-2 text-xs text-stone-400 border border-transparent">
							&larr; Awal
						</span>
					{/if}

					{#if data.nextDate}
						<a
							href="/notebook/{data.nextDate}"
							class="rounded-xl border border-stone-400/60 bg-white/80 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-white transition active:scale-95 shadow-xs"
						>
							Berikutnya &rarr;
						</a>
					{:else}
						<span class="rounded-xl px-3.5 py-2 text-xs text-stone-400 border border-transparent">
							Terbaru &rarr;
						</span>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<button
						onclick={() => (datePickerOpen = true)}
						class="rounded-xl border border-stone-400/60 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-white transition shadow-xs"
					>
						Daftar Tanggal
					</button>

					{#if data.authed}
						<a
							href="/notes/{data.note.date}"
							class="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-sm transition active:scale-95"
						>
							Edit
						</a>
					{/if}
				</div>
			</footer>

			<p class="text-[11px] text-stone-400 text-center sm:text-left">
				Gunakan tombol panah keyboard ← → untuk berpindah halaman, atau tekan R untuk catatan acak.
			</p>
		</div>
	</div>
</div>
