<script lang="ts">
	import { goto } from '$app/navigation';
	import { humanDateLabel } from '$lib/dateUtils';
	import { renderMarkdown } from '$lib/markdownRender';
	import { syncStatusLabel, type SyncStatus } from '$lib/syncStatus';

	let { data } = $props();

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

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.prevDate) goto(`/notebook/${data.prevDate}`);
		if (e.key === 'ArrowRight' && data.nextDate) goto(`/notebook/${data.nextDate}`);
		if (e.key === 'r' || e.key === 'R') goRandom();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<a href="/" class="text-sm text-stone-500 transition hover:text-stone-800">&larr; Beranda</a>
		<div class="flex flex-wrap gap-2">
			<a
				href="/notebook/{data.note.date}"
				class="rounded-lg px-3 py-1.5 text-sm transition {data.mode === 'order'
					? 'bg-stone-900 text-white'
					: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}"
			>
				Urut tanggal
			</a>
			<button
				onclick={goRandom}
				class="rounded-lg px-3 py-1.5 text-sm transition {data.mode === 'random'
					? 'bg-stone-900 text-white'
					: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50'}"
			>
				Acak
			</button>
		</div>
	</div>

	<div class="notebook-shell relative overflow-hidden rounded-2xl border border-stone-300/80 bg-[#f7f3ea] shadow-[0_20px_50px_-28px_rgb(28_25_23_/_0.45)]">
		<div
			class="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-stone-400/25 to-transparent"
			aria-hidden="true"
		></div>
		<div class="absolute top-0 right-0 left-8 h-1.5 bg-[repeating-linear-gradient(90deg,#d6d3d1_0_8px,transparent_8px_16px)] opacity-50"></div>

		<div class="space-y-5 px-6 py-8 sm:px-10 sm:py-10">
			<header class="space-y-3 border-b border-stone-300/70 pb-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="font-[Georgia,Times,serif] text-xs tracking-[0.18em] text-stone-500 uppercase">
							Buku Catatan
						</p>
						<h1 class="mt-1 font-[Georgia,Times,serif] text-3xl leading-tight text-stone-900">
							{dateLabel}
						</h1>
						<p class="mt-2 text-sm text-stone-600">{excerptWeather}</p>
					</div>
					<span class="rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 {badgeClass(data.syncStatus)}">
						{syncStatusLabel(data.syncStatus)}
					</span>
				</div>

				<div class="space-y-1.5">
					<div class="flex justify-between text-[11px] text-stone-500">
						<span>Halaman {data.index + 1} / {data.total}</span>
						<span>{Math.round(progress)}%</span>
					</div>
					<div class="h-1 overflow-hidden rounded-full bg-stone-300/70">
						<div class="h-full rounded-full bg-teal-800/80 transition-all" style="width: {progress}%"></div>
					</div>
				</div>
			</header>

			{#if data.note.priority_items.length > 0}
				<section class="space-y-2">
					<h2 class="font-[Georgia,Times,serif] text-lg text-stone-800">Priority</h2>
					<ul class="space-y-1.5">
						{#each data.note.priority_items as item, i (`${i}-${item.text}`)}
							<li class="flex items-start gap-2 text-sm text-stone-700">
								<span class="mt-0.5">{item.done ? '☑' : '☐'}</span>
								<span class:line-through={item.done} class:text-stone-400={item.done}>{item.text}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="min-h-[12rem]">
				{#if data.note.note_content.trim()}
					<div class="prose-note font-[Georgia,Times,serif] text-[1.05rem] leading-8 text-stone-800">
						{@html rendered}
					</div>
				{:else}
					<p class="text-sm text-stone-500 italic">Halaman ini masih kosong.</p>
				{/if}
			</section>

			<footer class="flex flex-wrap items-center gap-2 border-t border-stone-300/70 pt-5">
				{#if data.prevDate}
					<a
						href="/notebook/{data.prevDate}"
						class="rounded-lg border border-stone-400/60 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white"
					>
						← Sebelumnya
					</a>
				{:else}
					<span class="rounded-lg px-3 py-2 text-sm text-stone-400">← Sebelumnya</span>
				{/if}

				{#if data.nextDate}
					<a
						href="/notebook/{data.nextDate}"
						class="rounded-lg border border-stone-400/60 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white"
					>
						Berikutnya →
					</a>
				{:else}
					<span class="rounded-lg px-3 py-2 text-sm text-stone-400">Berikutnya →</span>
				{/if}

				<button
					onclick={goRandom}
					class="rounded-lg border border-stone-400/60 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white"
				>
					Acak
				</button>

				<a
					href="/notes/{data.note.date}"
					class="ml-auto rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
				>
					Edit
				</a>
			</footer>

			<p class="text-[11px] text-stone-500">
				Navigasi: ← → untuk urutan tanggal, R untuk acak. Data dari Turso (bukan GitHub API).
			</p>
		</div>
	</div>
</div>
